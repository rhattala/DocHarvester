"""Graphiti Knowledge Graph Integration for DocHarvester"""
import os
from typing import Dict, List, Optional, Any
import httpx
from datetime import datetime
import json

from backend.config import settings


class GraphitiClient:
    """Client for interacting with Graphiti knowledge graph service"""
    
    def __init__(self):
        self.base_url = os.getenv("GRAPHITI_URL", "http://graphiti:8000")
        self.api_key = os.getenv("GRAPHITI_API_KEY", "docharvester-key")
        self.use_local_llm = os.getenv("USE_LOCAL_LLM", "false").lower() == "true"
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def add_episode(
        self, 
        content: str, 
        metadata: Dict[str, Any],
        entity_types: Optional[List[Dict]] = None
    ) -> Dict:
        """Add a document/episode to the knowledge graph"""
        episode_data = {
            "content": content,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "docharvester"
        }
        
        if entity_types:
            episode_data["entity_types"] = entity_types
            
        response = await self.client.post(
            f"{self.base_url}/api/v1/episodes",
            json=episode_data,
            headers={"X-API-Key": self.api_key}
        )
        response.raise_for_status()
        return response.json()
    
    async def add_document_to_graph(
        self,
        document_id: int,
        title: str,
        content: str,
        document_type: str,
        lens_type: str,
        project_name: str,
        chunks: List[Dict],
        custom_entities: Optional[List[Dict]] = None
    ) -> Dict:
        """Add a document and its chunks to the knowledge graph"""
        
        # Define document-specific entity types based on lens
        entity_types = self._get_entity_types_for_lens(lens_type)
        
        # Prepare metadata
        metadata = {
            "document_id": document_id,
            "title": title,
            "document_type": document_type,
            "lens_type": lens_type,
            "project": project_name,
            "chunk_count": len(chunks)
        }
        
        # Add document as main episode
        main_episode = await self.add_episode(
            content=f"Document: {title}\n\n{content[:1000]}...",
            metadata=metadata,
            entity_types=entity_types
        )
        
        # Add chunks as related episodes
        chunk_episodes = []
        for idx, chunk in enumerate(chunks):
            chunk_metadata = {
                **metadata,
                "chunk_id": chunk["id"],
                "chunk_index": idx,
                "parent_episode": main_episode["id"]
            }
            
            chunk_episode = await self.add_episode(
                content=chunk["text"],
                metadata=chunk_metadata,
                entity_types=entity_types
            )
            chunk_episodes.append(chunk_episode)
        
        return {
            "main_episode": main_episode,
            "chunk_episodes": chunk_episodes,
            "entities_extracted": main_episode.get("entities", [])
        }
    
    async def search(
        self,
        query: str,
        project_name: Optional[str] = None,
        lens_types: Optional[List[str]] = None,
        search_type: str = "hybrid",  # hybrid, semantic, keyword, graph
        limit: int = 10
    ) -> Dict:
        """Search the knowledge graph"""
        params = {
            "query": query,
            "search_type": search_type,
            "limit": limit
        }
        
        # Add filters
        filters = {}
        if project_name:
            filters["project"] = project_name
        if lens_types:
            filters["lens_type"] = {"$in": lens_types}
            
        if filters:
            params["filters"] = json.dumps(filters)
        
        response = await self.client.get(
            f"{self.base_url}/api/v1/search",
            params=params,
            headers={"X-API-Key": self.api_key}
        )
        response.raise_for_status()
        return response.json()
    
    async def get_entity_relationships(
        self,
        entity_name: str,
        relationship_types: Optional[List[str]] = None,
        depth: int = 2
    ) -> Dict:
        """Get relationships for a specific entity"""
        params = {
            "entity": entity_name,
            "depth": depth
        }
        
        if relationship_types:
            params["relationship_types"] = ",".join(relationship_types)
        
        response = await self.client.get(
            f"{self.base_url}/api/v1/entities/relationships",
            params=params,
            headers={"X-API-Key": self.api_key}
        )
        response.raise_for_status()
        return response.json()
    
    async def get_temporal_graph(
        self,
        project_name: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        entity_types: Optional[List[str]] = None
    ) -> Dict:
        """Get temporal evolution of the knowledge graph"""
        params = {
            "project": project_name
        }
        
        if start_date:
            params["start_date"] = start_date.isoformat()
        if end_date:
            params["end_date"] = end_date.isoformat()
        if entity_types:
            params["entity_types"] = ",".join(entity_types)
        
        response = await self.client.get(
            f"{self.base_url}/api/v1/graph/temporal",
            params=params,
            headers={"X-API-Key": self.api_key}
        )
        response.raise_for_status()
        return response.json()
    
    async def extract_insights(
        self,
        project_name: str,
        insight_type: str = "summary",  # summary, trends, anomalies, recommendations
        context: Optional[Dict] = None
    ) -> Dict:
        """Extract insights from the knowledge graph using LLM"""
        data = {
            "project": project_name,
            "insight_type": insight_type,
            "use_local_llm": self.use_local_llm
        }
        
        if context:
            data["context"] = context
        
        response = await self.client.post(
            f"{self.base_url}/api/v1/insights",
            json=data,
            headers={"X-API-Key": self.api_key}
        )
        response.raise_for_status()
        return response.json()
    
    def _get_entity_types_for_lens(self, lens_type: str) -> List[Dict]:
        """Get entity type definitions based on lens type"""
        
        # Base entity types common to all lenses
        base_entities = [
            {
                "name": "Document",
                "properties": ["title", "type", "source", "date"]
            },
            {
                "name": "Section",
                "properties": ["heading", "content", "order"]
            },
            {
                "name": "Concept",
                "properties": ["name", "definition", "category"]
            }
        ]
        
        # Lens-specific entity types
        lens_entities = {
            "LOGIC": [
                {
                    "name": "BusinessRule",
                    "properties": ["name", "condition", "action", "priority"]
                },
                {
                    "name": "Process",
                    "properties": ["name", "steps", "inputs", "outputs"]
                },
                {
                    "name": "Decision",
                    "properties": ["criteria", "options", "outcome"]
                }
            ],
            "SOP": [
                {
                    "name": "Procedure",
                    "properties": ["name", "steps", "responsible_party", "frequency"]
                },
                {
                    "name": "Checklist",
                    "properties": ["name", "items", "completion_criteria"]
                },
                {
                    "name": "Policy",
                    "properties": ["name", "scope", "requirements", "exceptions"]
                }
            ],
            "GTM": [
                {
                    "name": "MarketSegment",
                    "properties": ["name", "characteristics", "size", "growth_rate"]
                },
                {
                    "name": "Campaign",
                    "properties": ["name", "objective", "channels", "budget", "timeline"]
                },
                {
                    "name": "Competitor",
                    "properties": ["name", "strengths", "weaknesses", "market_share"]
                }
            ],
            "CL": [
                {
                    "name": "Customer",
                    "properties": ["name", "type", "segment", "value"]
                },
                {
                    "name": "Interaction",
                    "properties": ["type", "date", "outcome", "sentiment"]
                },
                {
                    "name": "Issue",
                    "properties": ["type", "severity", "status", "resolution"]
                }
            ]
        }
        
        return base_entities + lens_entities.get(lens_type, [])
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Custom entity models for logistics domain
LOGISTICS_ENTITIES = [
    {
        "name": "Equipment",
        "properties": ["name", "type", "location", "status", "capacity"]
    },
    {
        "name": "Route",
        "properties": ["origin", "destination", "distance", "duration", "mode"]
    },
    {
        "name": "Facility",
        "properties": ["name", "type", "location", "capacity", "services"]
    },
    {
        "name": "Shipment",
        "properties": ["id", "origin", "destination", "status", "eta", "contents"]
    },
    {
        "name": "Carrier",
        "properties": ["name", "type", "coverage_area", "services", "rating"]
    }
] 