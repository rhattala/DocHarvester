"""Wiki generation service using AI to create structured documentation"""
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import json
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete

from backend.config import settings
from backend.models import Project, Document, DocumentChunk, WikiPage, WikiStructure
from backend.services.embeddings import EmbeddingService
from backend.database import get_async_session
from backend.services.knowledge_graph.local_llm import LocalLLMService
from backend.services.progress_tracker import progress_tracker


class WikiGenerator:
    """Service for generating wiki content from document chunks with OpenAI as primary source"""
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
        
        # Initialize OpenAI client if API key is available - PRIORITIZE OPENAI for wiki generation
        self.openai_client = None
        self.has_openai = bool(settings.openai_api_key)
        
        if self.has_openai:
            try:
                self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
                print("🚀 OpenAI client initialized - PRIORITIZING OpenAI for wiki generation")
            except Exception as e:
                print(f"⚠️ OpenAI client initialization failed: {e}")
                self.has_openai = False
        
        # Initialize local LLM service for fallback only
        self.local_llm_service = LocalLLMService()
        
        # Use OpenAI preferentially for wiki generation due to complexity
        self.use_openai_for_wiki = self.has_openai  # Prefer OpenAI for wiki generation
        
        print(f"🧠 Wiki Generator initialized - OpenAI available: {self.has_openai}")
        print(f"📝 Wiki generation will use: {'OpenAI (Primary)' if self.use_openai_for_wiki else 'Local LLM (Fallback)'}")
    
    async def generate_wiki_for_project(
        self, 
        db: AsyncSession, 
        project_id: int,
        user_id: int,
        force_regenerate: bool = False
    ) -> Dict:
        """Generate or update wiki for a project with progress tracking and OpenAI priority"""
        
        # Create progress tracking task
        task = await progress_tracker.create_task(
            db=db,
            task_type="wiki_generation",
            project_id=project_id,
            user_id=user_id
        )
        
        try:
            print(f"� Starting wiki generation for project {project_id} (Task ID: {task.id})")
            
            # Step 1: Analyze project and get initial data
            await progress_tracker.update_progress(
                db, task.id, "analyzing_project", 10.0, "running"
            )
            
            result = await db.execute(
                select(Project).where(Project.id == project_id)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                await progress_tracker.complete_task(
                    db, task.id, "failed", error_message=f"Project {project_id} not found"
                )
                return {"error": f"Project {project_id} not found"}
            
            # Check if wiki exists and force_regenerate is False
            if not force_regenerate:
                result = await db.execute(
                    select(WikiStructure).where(WikiStructure.project_id == project_id)
                )
                existing_structure = result.scalar_one_or_none()
                if existing_structure and existing_structure.generation_status == "completed":
                    await progress_tracker.complete_task(
                        db, task.id, "completed", 
                        result_data={"message": "Wiki already exists", "wiki_structure_id": existing_structure.id}
                    )
                    return {"message": "Wiki already exists", "wiki_structure_id": existing_structure.id}
            
            # Step 2: Get project chunks
            await progress_tracker.update_progress(
                db, task.id, "extracting_entities", 25.0, "running"
            )
            
            chunks = await self._get_project_chunks(db, project_id)
            if not chunks:
                await progress_tracker.complete_task(
                    db, task.id, "failed", error_message="No content found to generate wiki from"
                )
                return {"error": "No content found to generate wiki from"}
            
            # Step 3: Get knowledge graph entities for context
            kg_context = await self._get_knowledge_graph_context(db, project_id)
            print(f"� Knowledge Graph Context: {kg_context.get('total_entities', 0)} entities found")
            
            # Step 4: Analyze domain and technology stack using OpenAI preferentially
            await progress_tracker.update_progress(
                db, task.id, "generating_structure", 40.0, "running"
            )
            
            domain_info = await self._analyze_project_domain(project, chunks, kg_context)
            print(f"🎯 Domain Analysis: {domain_info.get('domain', 'unknown')}")
            
            # Step 5: Generate wiki structure
            structure = await self._generate_wiki_structure(project, chunks, domain_info, kg_context)
            print(f"� Generated structure with {len(structure.get('sections', []))} sections")
            
            # Step 6: Save wiki structure
            wiki_structure = await self._save_wiki_structure(db, project_id, structure)
            
            # Step 7: Generate content for each wiki page
            await progress_tracker.update_progress(
                db, task.id, "creating_pages", 70.0, "running"
            )
            
            wiki_pages = await self._generate_wiki_pages(
                db, project, chunks, structure, wiki_structure.id, domain_info, kg_context, task.id
            )
            
            # Step 8: Finalize
            await progress_tracker.update_progress(
                db, task.id, "finalizing", 95.0, "running"
            )
            
            wiki_structure.generation_status = "completed"
            wiki_structure.last_generated_at = datetime.utcnow()
            await db.commit()
            
            # Complete task
            result_data = {
                "success": True,
                "project_id": project_id,
                "wiki_structure_id": wiki_structure.id,
                "pages_created": len(wiki_pages),
                "structure": structure,
                "domain": domain_info,
                "llm_used": "openai" if self.use_openai_for_wiki else "local",
                "entities_found": len(kg_context.get("entities", []))
            }
            
            await progress_tracker.complete_task(
                db, task.id, "completed", result_data=result_data
            )
            
            print(f"✅ Wiki generation completed successfully")
            return result_data
            
        except Exception as e:
            print(f"❌ Wiki generation failed: {e}")
            import traceback
            traceback.print_exc()
            
            try:
                await db.rollback()
                await progress_tracker.complete_task(
                    db, task.id, "failed", error_message=str(e)
                )
            except Exception as rollback_error:
                print(f"⚠️ Rollback failed: {rollback_error}")
            
            return {
                "error": str(e), 
                "project_id": project_id,
                "task_id": task.id,
                "llm_used": "openai" if self.use_openai_for_wiki else "local"
            }
    
    async def _get_project_chunks(self, db: AsyncSession, project_id: int) -> List[DocumentChunk]:
        """Get all document chunks for a project"""
        result = await db.execute(
            select(DocumentChunk)
            .join(Document)
            .where(Document.project_id == project_id)
            .order_by(DocumentChunk.importance_score.desc())
            .limit(100)  # Reduced from 500 to 100 for faster processing
        )
        return result.scalars().all()
    
    async def _get_knowledge_graph_context(self, db: AsyncSession, project_id: int) -> Dict:
        """Get knowledge graph entities and relationships for context with optimizations"""
        try:
            # Get entities from chunk metadata with improved query
            result = await db.execute(
                select(DocumentChunk.chunk_metadata)
                .join(Document)
                .where(Document.project_id == project_id)
                .where(DocumentChunk.chunk_metadata.isnot(None))
                .limit(200)  # Limit results for performance
            )
            
            entities = []
            relationships = []
            entity_names_seen = set()  # Deduplicate entities
            
            for (metadata,) in result:
                if isinstance(metadata, dict):
                    if "entities" in metadata:
                        for entity in metadata["entities"]:
                            if isinstance(entity, dict):
                                entity_name = entity.get("name", "")
                                if entity_name and entity_name not in entity_names_seen:
                                    entities.append(entity)
                                    entity_names_seen.add(entity_name)
                    if "relationships" in metadata:
                        relationships.extend(metadata["relationships"])
            
            # Group entities by type and get top entities per type for efficient context
            entities_by_type = {}
            for entity in entities:
                entity_type = entity.get("type", "Unknown")
                if entity_type not in entities_by_type:
                    entities_by_type[entity_type] = []
                if len(entities_by_type[entity_type]) < 10:  # Limit per type
                    entities_by_type[entity_type].append(entity.get("name", ""))
            
            # Create entity summary for efficient context use in OpenAI prompts
            entity_summary = {}
            for entity_type, names in entities_by_type.items():
                if names:
                    entity_summary[entity_type] = {
                        "count": len(names),
                        "top_examples": names[:5],  # Top 5 examples per type
                        "has_more": len(names) > 5
                    }
            
            print(f"🔗 Knowledge graph context: {len(entities)} entities, {len(relationships)} relationships")
            
            return {
                "entities": entities[:50],  # Limit for context window
                "relationships": relationships[:20],  # Limit relationships
                "entities_by_type": entities_by_type,
                "entity_summary": entity_summary,
                "total_entities": len(entities),
                "total_relationships": len(relationships)
            }
            
        except Exception as e:
            print(f"⚠️ Failed to get knowledge graph context: {e}")
            return {"entities": [], "relationships": [], "entities_by_type": {}, "entity_summary": {}}

    async def _call_llm(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 2000, json_mode: bool = False, task_type: str = "general") -> str:
        """Call LLM with OpenAI prioritized for wiki generation tasks"""
        
        # For wiki generation tasks, prioritize OpenAI due to complexity
        use_openai = self.use_openai_for_wiki and task_type in ["wiki_generation", "domain_analysis", "structure_generation"]
        
        # Try OpenAI first if available and preferred for this task
        if use_openai and self.openai_client:
            try:
                # Use best OpenAI model for task type
                model = self.local_llm_service.get_best_model_for_task(task_type, "OPENAI")
                print(f"🚀 Using OpenAI model: {model} for {task_type}")
                
                kwargs = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "timeout": 90  # 90 second timeout for complex wiki generation
                }
                
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                
                response = await self.openai_client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
                
            except Exception as e:
                print(f"⚠️ OpenAI API failed for {task_type}: {e}")
                print("🔄 Falling back to local LLM...")
        
        # Fall back to local LLM
        try:
            user_message = messages[-1]["content"] if messages else ""
            system_message = next((msg["content"] for msg in messages if msg["role"] == "system"), "")
            
            prompt = f"{system_message}\n\n{user_message}" if system_message else user_message
            
            if json_mode:
                prompt += "\n\nPlease respond with valid JSON only."
            
            response = await self.local_llm_service.query_llm(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
                task_type=task_type,
                use_cache=True
            )
            
            return response
            
        except Exception as e:
            print(f"❌ Both OpenAI and local LLM failed for {task_type}: {e}")
            raise Exception(f"All LLM services failed: {e}")

    async def _analyze_project_domain(self, project: Project, chunks: List[DocumentChunk], kg_context: Dict) -> Dict:
        """Analyze project domain using OpenAI for better quality analysis"""
        
        # Use highest-scoring chunks for better analysis
        sorted_chunks = sorted(chunks, key=lambda x: x.importance_score or 0, reverse=True)
        sample_chunks = sorted_chunks[:15]
        chunk_texts = "\n".join([chunk.text[:400] for chunk in sample_chunks])
        
        # Use optimized entity summary from knowledge graph
        entities_summary = ""
        if kg_context.get("entity_summary"):
            entities_summary = "\n".join([
                f"{entity_type}: {info['count']} items - examples: {', '.join(info['top_examples'])}"
                for entity_type, info in kg_context["entity_summary"].items()
            ])
        
        prompt = f"""Analyze this project comprehensively to determine its key characteristics:

Technologies: {entities_summary[:200]}

Key Entities Found in Knowledge Graph:
{entities_summary}

Sample Content:
{chunk_texts}

Provide a detailed analysis including:
1. Primary domain (web app, API, library, SOP documentation, logistics, etc.)
2. Main technologies and frameworks (top 5)
3. Architecture pattern
4. Key concepts and topics (top 7)
5. Target audience
6. Documentation style and approach
7. Business context

Respond with JSON:
{{
    "domain": "primary domain",
    "tech_stack": ["tech1", "tech2", "tech3", "tech4", "tech5"],
    "architecture": "architecture pattern", 
    "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5", "concept6", "concept7"],
    "audience": ["audience1", "audience2"],
    "documentation_style": "technical|procedural|mixed",
    "business_context": "brief business context",
    "complexity_level": "basic|intermediate|advanced"
}}"""
        
        messages = [
            {"role": "system", "content": "You are a senior technical architect and documentation expert. Provide comprehensive, accurate analysis."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self._call_llm(messages, temperature=0.2, max_tokens=1200, json_mode=True, task_type="domain_analysis")
            return json.loads(response)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON decode failed for domain analysis: {e}")
            # Enhanced fallback with knowledge graph insights
            tech_stack = []
            key_concepts = []
            
            if kg_context.get("entity_summary"):
                for entity_type, info in kg_context["entity_summary"].items():
                    if any(keyword in entity_type.lower() for keyword in ["technology", "framework", "tool"]):
                        tech_stack.extend(info["top_examples"][:2])
                    elif any(keyword in entity_type.lower() for keyword in ["concept", "process", "procedure"]):
                        key_concepts.extend(info["top_examples"][:3])
            
            return {
                "domain": "software project",
                "tech_stack": tech_stack[:5] if tech_stack else ["unknown"],
                "architecture": "unknown",
                "key_concepts": key_concepts[:7] if key_concepts else [],
                "audience": ["developers"],
                "documentation_style": "technical",
                "business_context": "software development project",
                "complexity_level": "intermediate"
            }

    async def _generate_wiki_structure(self, project: Project, chunks: List[DocumentChunk], domain_info: Dict, kg_context: Dict) -> Dict:
        """Generate wiki structure using knowledge graph entities for better organization with optimizations"""
        
        # Create optimized entity-aware content summary
        entity_sections = []
        if kg_context.get("entity_summary"):
            for entity_type, info in kg_context["entity_summary"].items():
                if info["count"] > 2:  # Only include types with multiple entities
                    entity_sections.append(f"{entity_type}: {info['count']} items")
        
        # Analyze content by lens type with focus on high-importance chunks
        lens_summary = {}
        high_importance_chunks = [c for c in chunks if (c.importance_score or 0) > 0.6]
        sample_chunks = high_importance_chunks[:30] if high_importance_chunks else chunks[:30]
        
        for chunk in sample_chunks:
            lens = chunk.lens_type
            if lens not in lens_summary:
                lens_summary[lens] = []
            if len(lens_summary[lens]) < 5:  # Limit samples per lens
                lens_summary[lens].append(chunk.text[:100])  # Reduced from 150
        
        lens_context = "\n".join([
            f"{lens}: {len(summaries)} chunks"
            for lens, summaries in lens_summary.items()
        ])
        
        prompt = f"""
        Create a comprehensive wiki structure for "{project.name}".
        
        Project Analysis:
        - Domain: {domain_info.get('domain', 'Unknown')}
        - Technology: {', '.join(domain_info.get('tech_stack', []))}
        - Architecture: {domain_info.get('architecture', 'Unknown')}
        - Audience: {', '.join(domain_info.get('audience', ['developers']))}
        
        Knowledge Graph Entities Found:
        {chr(10).join(entity_sections) if entity_sections else "No entities extracted yet"}
        
        Content Analysis:
        {lens_context}
        
        Create a logical wiki structure that:
        1. Starts with overview and quick start
        2. Covers architecture and key concepts
        3. Includes practical guides and references
        4. Organizes by the entities and concepts found
        5. Follows best practices for technical documentation
        
        Return JSON structure:
        {{
            "title": "Project Wiki",
            "sections": [
                {{
                    "title": "Section Title",
                    "slug": "section-slug", 
                    "description": "What this covers",
                    "order": 1,
                    "type": "overview|architecture|guide|reference|tutorial",
                    "children": [
                        {{
                            "title": "Subsection",
                            "slug": "subsection-slug",
                            "description": "Specific topic",
                            "order": 1,
                            "type": "concept|howto|reference|example"
                        }}
                    ]
                }}
            ]
        }}
        """
        
        messages = [
            {"role": "system", "content": "You are a technical documentation expert creating intuitive wiki structures."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self._call_llm(messages, temperature=0.3, max_tokens=2000, json_mode=True)
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback structure
            return {
                "title": f"{project.name} Wiki",
                "sections": [
                    {"title": "Overview", "slug": "overview", "description": "Project introduction", "order": 1, "type": "overview", "children": []},
                    {"title": "Getting Started", "slug": "getting-started", "description": "Quick start guide", "order": 2, "type": "guide", "children": []},
                    {"title": "Architecture", "slug": "architecture", "description": "System design", "order": 3, "type": "architecture", "children": []},
                    {"title": "API Reference", "slug": "api-reference", "description": "Technical reference", "order": 4, "type": "reference", "children": []}
                ]
            }
    
    async def _save_wiki_structure(self, db: AsyncSession, project_id: int, structure: Dict) -> WikiStructure:
        """Save wiki structure to database"""
        result = await db.execute(
            select(WikiStructure).where(WikiStructure.project_id == project_id)
        )
        wiki_structure = result.scalar_one_or_none()
        
        if wiki_structure:
            wiki_structure.structure = structure
            wiki_structure.generation_status = "generating"
        else:
            wiki_structure = WikiStructure(
                project_id=project_id,
                structure=structure,
                generation_status="generating"
            )
            db.add(wiki_structure)
        
        await db.flush()
        return wiki_structure
    
    async def _generate_wiki_pages(
        self, 
        db: AsyncSession, 
        project: Project, 
        chunks: List[DocumentChunk],
        structure: Dict,
        wiki_structure_id: int,
        domain_info: Dict,
        kg_context: Dict,
        task_id: int
    ) -> List[WikiPage]:
        """Generate content for each wiki page with domain awareness and knowledge graph context"""
        pages = []
        
        # Delete existing wiki pages for clean regeneration
        await db.execute(
            delete(WikiPage).where(WikiPage.project_id == project.id)
        )
        
        # Generate root page
        root_page = await self._generate_single_page(
            db, project, chunks, 
            title=f"{project.name} Wiki",
            slug="index",
            parent_id=None,
            order_index=0,
            page_type="overview",
            domain_info=domain_info,
            kg_context=kg_context
        )
        pages.append(root_page)
        
        # Generate pages for each section
        for section_idx, section in enumerate(structure.get("sections", [])):
            section_page = await self._generate_single_page(
                db, project, chunks,
                title=section["title"],
                slug=section["slug"],
                parent_id=root_page.id,
                order_index=section.get("order", section_idx),
                page_type=section.get("type", "general"),
                section_context=section.get("description", ""),
                domain_info=domain_info,
                kg_context=kg_context
            )
            pages.append(section_page)
            
            # Generate child pages
            for child_idx, child in enumerate(section.get("children", [])):
                child_page = await self._generate_single_page(
                    db, project, chunks,
                    title=child["title"],
                    slug=f"{section['slug']}-{child['slug']}",
                    parent_id=section_page.id,
                    order_index=child.get("order", child_idx),
                    page_type=child.get("type", "detail"),
                    section_context=f"{section['description']} - {child.get('description', '')}",
                    domain_info=domain_info,
                    kg_context=kg_context
                )
                pages.append(child_page)
        
        return pages
    
    async def _generate_single_page(
        self,
        db: AsyncSession,
        project: Project,
        chunks: List[DocumentChunk],
        title: str,
        slug: str,
        parent_id: Optional[int],
        order_index: int,
        page_type: str = "general",
        section_context: str = "",
        domain_info: Optional[Dict] = None,
        kg_context: Optional[Dict] = None
    ) -> WikiPage:
        """Generate content for a single wiki page with knowledge graph context"""
        
        # Find relevant chunks for this page
        relevant_chunks = await self._find_relevant_chunks(chunks, title, section_context, kg_context)
        
        # Generate content with domain and knowledge graph awareness
        content = await self._generate_page_content(
            project, title, page_type, section_context, relevant_chunks, domain_info, kg_context
        )
        
        # Create wiki page
        wiki_page = WikiPage(
            project_id=project.id,
            title=title,
            slug=slug,
            content=content["content"],
            summary=content["summary"],
            parent_id=parent_id,
            order_index=order_index,
            is_generated=True,
            generation_source_chunks=[chunk.id for chunk in relevant_chunks[:10]],
            confidence_score=content.get("confidence", 0.8),
            tags=content.get("tags", []),
            page_metadata={
                "domain": domain_info.get("domain", "unknown") if domain_info else "unknown",
                "page_type": page_type,
                "tech_stack": domain_info.get("tech_stack", []) if domain_info else [],
                "entities_used": len(kg_context.get("entities", [])) if kg_context else 0
            },
            status="published",
            published_at=datetime.utcnow()
        )
        
        db.add(wiki_page)
        await db.flush()
        
        return wiki_page
    
    async def _find_relevant_chunks(
        self, 
        chunks: List[DocumentChunk], 
        title: str, 
        context: str,
        kg_context: Optional[Dict] = None
    ) -> List[DocumentChunk]:
        """Find chunks relevant to a specific wiki page using keyword and entity matching"""
        
        # Build search terms from title, context, and knowledge graph entities
        search_terms = set(title.lower().split() + context.lower().split())
        
        # Add relevant entities as search terms
        if kg_context and kg_context.get("entities"):
            for entity in kg_context["entities"]:
                if isinstance(entity, dict) and "name" in entity:
                    search_terms.update(entity["name"].lower().split())
        
        # Score chunks based on relevance
        relevant = []
        for chunk in chunks:
            chunk_text_lower = chunk.text.lower()
            
            # Calculate relevance score
            keyword_score = sum(1 for term in search_terms if term in chunk_text_lower)
            
            # Boost score for chunks with metadata entities
            entity_score = 0
            if hasattr(chunk, 'metadata') and chunk.metadata and isinstance(chunk.metadata, dict):
                if "entities" in chunk.metadata:
                    entity_score = len(chunk.metadata["entities"]) * 0.5
            
            total_score = keyword_score + entity_score
            
            if total_score > 0:
                relevant.append((total_score, chunk))
        
        # Sort by relevance and return top chunks
        relevant.sort(key=lambda x: x[0], reverse=True)
        return [chunk for _, chunk in relevant[:15]]  # Limit to 15 chunks for context window
    
    async def _generate_page_content(
        self,
        project: Project,
        title: str,
        page_type: str,
        context: str,
        chunks: List[DocumentChunk],
        domain_info: Optional[Dict] = None,
        kg_context: Optional[Dict] = None
    ) -> Dict:
        """Generate content for a wiki page using LLM with knowledge graph context"""
        
        # Prepare chunk context with source information
        chunk_context = "\n\n".join([
            f"[Source: {getattr(chunk, 'document_title', 'Unknown')} | Type: {chunk.lens_type}]\n{chunk.text[:800]}"
            for chunk in chunks[:10]  # Limit chunks to stay within context window
        ])
        
        # Prepare knowledge graph context
        kg_summary = ""
        if kg_context and kg_context.get("entities_by_type"):
            kg_summary = "Related Entities:\n" + "\n".join([
                f"- {entity_type}: {', '.join(list(set(names))[:3])}"
                for entity_type, names in kg_context["entities_by_type"].items()
                if len(names) > 0
            ])
        
        # Get domain-specific settings
        writing_style = domain_info.get("documentation_style", "technical") if domain_info else "technical"
        audience = ", ".join(domain_info.get("audience", ["developers"])) if domain_info else "developers"
        tech_stack = ", ".join(domain_info.get("tech_stack", [])) if domain_info else "unknown"
        
        # Create comprehensive prompt based on page type
        base_prompt = f"""
        Create comprehensive documentation for "{title}" in the {project.name} wiki.
        
        Project Context:
        - Domain: {domain_info.get('domain', 'software project') if domain_info else 'software project'}
        - Technology Stack: {tech_stack}
        - Target Audience: {audience}
        - Writing Style: {writing_style}
        
        Section Context: {context}
        
        {kg_summary}
        
        Source Content:
        {chunk_context}
        
        Create a {page_type} page that is:
        1. Comprehensive and informative
        2. Well-structured with clear headings
        3. Practical and actionable
        4. Appropriate for the target audience
        5. Integrated with the project's technology stack
        
        Format as Markdown with:
        - Clear headings (##, ###)
        - Code blocks with language hints
        - Bullet points and numbered lists
        - Tables where appropriate
        - Bold **important** concepts
        - Links using [text](slug) format for internal references
        
        Focus on being helpful and accurate based on the provided source material.
        """
        
        messages = [
            {"role": "system", "content": f"You are a {writing_style} documentation expert creating clear, accurate content for {audience}. Focus on practical value and clarity."},
            {"role": "user", "content": base_prompt}
        ]
        
        try:
            # Generate main content
            content = await self._call_llm(messages, temperature=0.7, max_tokens=3000)
            
            # Generate summary
            summary_messages = [
                {"role": "system", "content": "Create a brief 2-3 sentence summary of the following documentation page."},
                {"role": "user", "content": f"Summarize this page: {title}\n\n{content[:1000]}"}
            ]
            
            summary = await self._call_llm(summary_messages, temperature=0.5, max_tokens=150)
            
            # Extract tags using knowledge graph context
            tags = await self._extract_smart_tags(title, content, domain_info, kg_context)
            
            return {
                "content": content,
                "summary": summary,
                "confidence": 0.85,
                "tags": tags
            }
            
        except Exception as e:
            print(f"⚠️ Failed to generate content for {title}: {e}")
            # Fallback content
            return {
                "content": f"# {title}\n\nContent for {title} will be available soon.\n\nSource materials found: {len(chunks)} documents",
                "summary": f"Documentation page for {title}",
                "confidence": 0.3,
                "tags": ["documentation", "placeholder"]
            }
    
    async def _extract_smart_tags(self, title: str, content: str, domain_info: Optional[Dict], kg_context: Optional[Dict]) -> List[str]:
        """Extract relevant tags using LLM and knowledge graph context"""
        
        # Build context from domain and entities
        tech_stack = domain_info.get('tech_stack', []) if domain_info else []
        entity_types = list(kg_context.get('entities_by_type', {}).keys()) if kg_context else []
        
        prompt = f"""
        Extract 5-7 relevant tags for this documentation page.
        
        Title: {title}
        Technologies: {', '.join(tech_stack)}
        Entity Types: {', '.join(entity_types)}
        
        Content excerpt: {content[:800]}
        
        Return a simple comma-separated list of lowercase tags.
        Focus on: technologies, concepts, problem domains, and user tasks.
        
        Example: authentication, jwt, api security, node.js, best practices
        """
        
        messages = [
            {"role": "system", "content": "You are a documentation tagging expert. Return only a comma-separated list of tags."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self._call_llm(messages, temperature=0.3, max_tokens=100)
            # Parse comma-separated tags
            tags = [tag.strip().lower() for tag in response.split(',') if tag.strip()]
            return tags[:7]  # Limit to 7 tags
            
        except Exception as e:
            print(f"⚠️ Failed to extract smart tags: {e}")
            # Fallback to simple extraction
            return self._extract_tags(title, content)
    
    def _extract_tags(self, title: str, content: str) -> List[str]:
        """Extract relevant tags from title and content (fallback method)"""
        tags = []
        
        # Common technical terms to look for
        tech_terms = [
            "api", "database", "authentication", "security", "deployment",
            "configuration", "installation", "troubleshooting", "architecture",
            "integration", "performance", "monitoring", "testing", "guide",
            "reference", "tutorial", "overview"
        ]
        
        content_lower = (title + " " + content).lower()
        
        for term in tech_terms:
            if term in content_lower:
                tags.append(term)
        
        return tags[:5]  # Limit to 5 tags 