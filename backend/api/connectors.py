from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Project, User
from backend.api.auth import get_current_user
from backend.connectors.local_folder import LocalFolderConnector


router = APIRouter()


class ConnectorConfig(BaseModel):
    connector_type: str
    config: Dict[str, Any]


class ConnectorTestResponse(BaseModel):
    success: bool
    message: str


@router.get("/available")
async def list_available_connectors(
    current_user: User = Depends(get_current_user)
):
    """List all available connector types"""
    return {
        "connectors": [
            {
                "type": "local_folder",
                "name": "Local Folder",
                "description": "Ingest documents from a local folder",
                "config_schema": {
                    "folder_path": {
                        "type": "string",
                        "description": "Path to the folder to scan",
                        "required": True
                    },
                    "allowed_extensions": {
                        "type": "array",
                        "description": "List of file extensions to include",
                        "required": False,
                        "default": [".txt", ".md", ".pdf", ".docx", ".html", ".json", ".yml", ".yaml"]
                    }
                }
            },
            {
                "type": "sharepoint",
                "name": "SharePoint",
                "description": "Ingest documents from SharePoint (Coming Soon)",
                "config_schema": {
                    "site_url": {"type": "string", "required": True},
                    "client_id": {"type": "string", "required": True},
                    "client_secret": {"type": "string", "required": True, "secret": True}
                },
                "available": False
            },
            {
                "type": "git",
                "name": "Git Repository",
                "description": "Ingest documents from Git repositories (Coming Soon)",
                "config_schema": {
                    "repo_url": {"type": "string", "required": True},
                    "branch": {"type": "string", "default": "main"},
                    "access_token": {"type": "string", "required": False, "secret": True}
                },
                "available": False
            }
        ]
    }


@router.post("/test", response_model=ConnectorTestResponse)
async def test_connector(
    connector: ConnectorConfig,
    current_user: User = Depends(get_current_user)
):
    """Test a connector configuration"""
    try:
        if connector.connector_type == "local_folder":
            conn = LocalFolderConnector(connector.config)
            success = await conn.test_connection()
            
            if success:
                return ConnectorTestResponse(
                    success=True,
                    message="Successfully connected to local folder"
                )
            else:
                return ConnectorTestResponse(
                    success=False,
                    message="Folder does not exist or is not accessible"
                )
        else:
            return ConnectorTestResponse(
                success=False,
                message=f"Connector type '{connector.connector_type}' is not yet implemented"
            )
            
    except Exception as e:
        return ConnectorTestResponse(
            success=False,
            message=f"Error testing connector: {str(e)}"
        )


@router.post("/project/{project_id}/configure")
async def configure_project_connector(
    project_id: int,
    connector: ConnectorConfig,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Configure a connector for a project"""
    # Get project
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is owner
    if current_user.email not in project.owners and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to configure connectors for this project")
    
    # Update connector config
    if not project.connector_configs:
        project.connector_configs = {}
    
    project.connector_configs[connector.connector_type] = connector.config
    
    await db.commit()
    await db.refresh(project)
    
    return {
        "message": f"Connector '{connector.connector_type}' configured successfully",
        "project_id": project_id
    }


@router.get("/project/{project_id}/configurations")
async def get_project_connectors(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get configured connectors for a project"""
    # Get project
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "project_id": project_id,
        "connectors": project.connector_configs or {}
    }


@router.delete("/project/{project_id}/connector/{connector_type}")
async def remove_project_connector(
    project_id: int,
    connector_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a connector configuration from a project"""
    # Get project
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is owner
    if current_user.email not in project.owners and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to configure connectors for this project")
    
    # Remove connector config
    if project.connector_configs and connector_type in project.connector_configs:
        del project.connector_configs[connector_type]
        await db.commit()
        
        return {"message": f"Connector '{connector_type}' removed successfully"}
    else:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_type}' not found in project configuration") 