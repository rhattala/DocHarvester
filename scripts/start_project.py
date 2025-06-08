#!/usr/bin/env python3
"""
DocHarvester CLI - Start a new project

Usage:
    python scripts/start_project.py "My Project" --tags webapp,api --folder /path/to/docs
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from getpass import getpass


async def main():
    parser = argparse.ArgumentParser(description="Start a new DocHarvester project")
    parser.add_argument("name", help="Project name")
    parser.add_argument("--tags", help="Comma-separated tags (e.g., webapp,api)", default="")
    parser.add_argument("--folder", help="Local folder to scan for documents")
    parser.add_argument("--api-url", default="http://localhost:8000", help="API URL")
    parser.add_argument("--email", help="User email (will prompt if not provided)")
    parser.add_argument("--password", help="User password (will prompt if not provided)")
    
    args = parser.parse_args()
    
    # Get credentials
    email = args.email or input("Email: ")
    password = args.password or getpass("Password: ")
    
    # Parse tags
    tags = [tag.strip() for tag in args.tags.split(",") if tag.strip()]
    
    async with httpx.AsyncClient() as client:
        try:
            # Login
            print(f"Logging in as {email}...")
            login_response = await client.post(
                f"{args.api_url}/api/v1/auth/token",
                data={"username": email, "password": password}
            )
            
            if login_response.status_code != 200:
                print(f"Login failed: {login_response.text}")
                return
            
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Create project
            print(f"Creating project '{args.name}'...")
            project_data = {
                "name": args.name,
                "tags": tags,
                "description": f"Project created via CLI"
            }
            
            project_response = await client.post(
                f"{args.api_url}/api/v1/projects/start_project",
                json=project_data,
                headers=headers
            )
            
            if project_response.status_code != 200:
                print(f"Failed to create project: {project_response.text}")
                return
            
            project = project_response.json()
            project_id = project["id"]
            print(f"✓ Project created with ID: {project_id}")
            
            # Configure local folder connector if provided
            if args.folder:
                folder_path = Path(args.folder)
                if not folder_path.exists():
                    print(f"Warning: Folder {args.folder} does not exist")
                else:
                    print(f"Configuring local folder connector for {args.folder}...")
                    
                    connector_config = {
                        "connector_type": "local_folder",
                        "config": {
                            "folder_path": str(folder_path.absolute())
                        }
                    }
                    
                    connector_response = await client.post(
                        f"{args.api_url}/api/v1/connectors/project/{project_id}/configure",
                        json=connector_config,
                        headers=headers
                    )
                    
                    if connector_response.status_code == 200:
                        print("✓ Local folder connector configured")
                        
                        # Trigger ingestion
                        print("Starting document ingestion...")
                        ingest_response = await client.post(
                            f"{args.api_url}/api/v1/projects/{project_id}/ingest",
                            headers=headers
                        )
                        
                        if ingest_response.status_code == 200:
                            task_info = ingest_response.json()
                            print(f"✓ Ingestion started (Task ID: {task_info['task_id']})")
                        else:
                            print(f"Failed to start ingestion: {ingest_response.text}")
                    else:
                        print(f"Failed to configure connector: {connector_response.text}")
            
            print("\nNext steps:")
            print(f"1. View your project: {args.api_url}/docs#/projects/get_project_api_v1_projects__project_id__get")
            print(f"2. Check coverage: {args.api_url}/api/v1/coverage/project/{project_id}/status")
            print(f"3. Search documents: {args.api_url}/api/v1/documents/search/chunks?project_id={project_id}&query=your-search")
            
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main()) 