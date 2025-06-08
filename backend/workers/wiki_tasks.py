"""Wiki generation tasks"""
import asyncio
from typing import Dict
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from backend.config import settings
from backend.models import Project, WikiStructure
from backend.workers.celery_app import celery_app
from backend.services.wiki_generator import WikiGenerator


# Create async engine for wiki generation
async_engine = create_async_engine(settings.database_url)
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@celery_app.task(
    name="backend.workers.wiki_tasks.generate_project_wiki",
    bind=True,
    soft_time_limit=600,  # 10 minutes soft limit
    time_limit=900       # 15 minutes hard limit
)
def generate_project_wiki(self, project_id: int, force_regenerate: bool = False) -> Dict:
    """
    Generate wiki for a project
    
    Args:
        project_id: The project ID
        force_regenerate: Force regeneration even if wiki exists
        
    Returns:
        Dict with generation results
    """
    try:
        return asyncio.run(_generate_project_wiki_async(project_id, force_regenerate))
    except Exception as e:
        print(f"Wiki generation failed for project {project_id}: {e}")
        return {
            "error": str(e),
            "project_id": project_id,
            "status": "failed"
        }


async def _generate_project_wiki_async(project_id: int, force_regenerate: bool = False) -> Dict:
    """Async implementation of wiki generation"""
    async with AsyncSessionLocal() as db:
        try:
            generator = WikiGenerator()
            result = await generator.generate_wiki_for_project(db, project_id, force_regenerate)
            return result
        except Exception as e:
            return {
                "error": str(e),
                "project_id": project_id
            }


@celery_app.task(
    name="backend.workers.wiki_tasks.update_wiki_after_ingestion",
    bind=True, 
    soft_time_limit=300,  # 5 minutes soft limit
    time_limit=600       # 10 minutes hard limit
)
def update_wiki_after_ingestion(self, project_id: int) -> Dict:
    """
    Update wiki after new documents are ingested
    
    Args:
        project_id: The project ID
        
    Returns:
        Dict with update results
    """
    try:
        return asyncio.run(_update_wiki_after_ingestion_async(project_id))
    except Exception as e:
        print(f"Wiki update failed for project {project_id}: {e}")
        return {
            "error": str(e),
            "project_id": project_id,
            "status": "failed"
        }


async def _update_wiki_after_ingestion_async(project_id: int) -> Dict:
    """Check if wiki exists and regenerate if significant changes"""
    async with AsyncSessionLocal() as db:
        try:
            # Check if wiki exists
            result = await db.execute(
                select(WikiStructure).where(WikiStructure.project_id == project_id)
            )
            wiki_structure = result.scalar_one_or_none()
            
            if not wiki_structure:
                # No wiki exists, generate one
                generator = WikiGenerator()
                return await generator.generate_wiki_for_project(db, project_id, False)
            
            # For now, always regenerate after ingestion
            # In production, check if significant changes warrant regeneration
            generator = WikiGenerator()
            return await generator.generate_wiki_for_project(db, project_id, True)
            
        except Exception as e:
            return {
                "error": str(e),
                "project_id": project_id
            } 