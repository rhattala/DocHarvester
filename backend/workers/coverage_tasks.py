from datetime import datetime
from typing import Dict, List
import yaml
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from celery import shared_task

from backend.config import settings
from backend.models import Project, CoverageRequirement, CoverageStatus, DocumentChunk
from backend.models.lens import LensType
from backend.workers.celery_app import celery_app


# Create database session
engine = create_engine(settings.database_url.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@celery_app.task(name="backend.workers.coverage_tasks.check_project_coverage")
def check_project_coverage(project_id: int) -> Dict:
    """
    Check coverage requirements for a specific project
    
    Args:
        project_id: The project ID to check
        
    Returns:
        Dict with coverage status
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {"error": f"Project {project_id} not found"}
        
        # Load coverage requirements from YAML if not in database
        coverage_config = _load_coverage_config()
        
        # Get or create coverage requirements for this project
        requirements = db.query(CoverageRequirement).filter(
            CoverageRequirement.project_id == project_id
        ).all()
        
        if not requirements and project.tags:
            # Create requirements based on project tags and coverage config
            requirements = _create_requirements_from_config(
                db, project, coverage_config
            )
        
        # Check each requirement
        gaps = []
        for req in requirements:
            if req.is_required:
                # Count documents for this lens type
                doc_count = db.query(DocumentChunk).filter(
                    DocumentChunk.document.has(project_id=project_id),
                    DocumentChunk.lens_type == req.lens_type,
                    DocumentChunk.generation_status != "draft"
                ).count()
                
                is_satisfied = doc_count >= req.min_documents
                
                # Create coverage status record
                status = CoverageStatus(
                    requirement_id=req.id,
                    check_date=datetime.utcnow(),
                    is_satisfied=is_satisfied,
                    document_count=doc_count,
                    gap_description=f"Missing {req.lens_type} documentation" if not is_satisfied else None
                )
                db.add(status)
                
                if not is_satisfied:
                    gaps.append({
                        "lens_type": req.lens_type,
                        "required": req.min_documents,
                        "found": doc_count,
                        "gap": req.min_documents - doc_count
                    })
                    
                    # Queue auto-draft generation
                    from backend.workers.generation_tasks import generate_auto_draft
                    generate_auto_draft.delay(project_id, req.lens_type)
                    
                    status.auto_draft_queued = True
        
        db.commit()
        
        return {
            "project_id": project_id,
            "project_name": project.name,
            "check_date": datetime.utcnow().isoformat(),
            "gaps": gaps,
            "all_satisfied": len(gaps) == 0
        }
        
    finally:
        db.close()


@celery_app.task(name="backend.workers.coverage_tasks.check_all_project_coverage")
def check_all_project_coverage() -> List[Dict]:
    """Check coverage for all active projects"""
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        results = []
        
        for project in projects:
            result = check_project_coverage.delay(project.id)
            results.append({
                "project_id": project.id,
                "task_id": result.id
            })
        
        return results
        
    finally:
        db.close()


def _load_coverage_config() -> Dict:
    """Load coverage configuration from YAML file"""
    try:
        with open(settings.coverage_config_path, 'r') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        # Return default configuration
        return {
            "default": {
                "required_lenses": ["LOGIC", "SOP"],
                "min_documents": 1
            },
            "product_types": {
                "api": {
                    "required_lenses": ["LOGIC", "SOP", "CL"],
                    "min_documents": 1
                },
                "webapp": {
                    "required_lenses": ["LOGIC", "SOP", "GTM", "CL"],
                    "min_documents": 1
                },
                "library": {
                    "required_lenses": ["LOGIC", "SOP"],
                    "min_documents": 2
                }
            }
        }


def _create_requirements_from_config(
    db, project: Project, coverage_config: Dict
) -> List[CoverageRequirement]:
    """Create coverage requirements based on project tags and config"""
    requirements = []
    
    # Determine which config to use based on project tags
    config_to_use = coverage_config.get("default", {})
    
    for tag in project.tags:
        if tag in coverage_config.get("product_types", {}):
            config_to_use = coverage_config["product_types"][tag]
            break
    
    # Create requirements for each lens type
    required_lenses = config_to_use.get("required_lenses", ["LOGIC", "SOP"])
    min_documents = config_to_use.get("min_documents", 1)
    
    for lens_type in required_lenses:
        req = CoverageRequirement(
            project_id=project.id,
            lens_type=lens_type,
            is_required=True,
            min_documents=min_documents
        )
        db.add(req)
        requirements.append(req)
    
    db.commit()
    return requirements 