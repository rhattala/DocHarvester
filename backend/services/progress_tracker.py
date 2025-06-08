"""Progress tracking service for long-running operations"""
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from backend.models import ProcessingTask, Project, User
from backend.database import get_async_session


class ProgressTracker:
    """Service for tracking progress of long-running operations"""
    
    def __init__(self):
        self.active_tasks: Dict[int, Dict] = {}
        self.step_durations = {
            # Wiki generation steps with estimated times
            "wiki_generation": {
                "analyzing_project": 15,
                "extracting_entities": 30,
                "generating_structure": 25,
                "creating_pages": 60,
                "finalizing": 10
            },
            # Entity extraction steps
            "entity_extraction": {
                "initializing": 5,
                "processing_chunks": 45,
                "storing_entities": 20,
                "creating_relationships": 30
            },
            # Knowledge graph refresh steps
            "knowledge_graph_refresh": {
                "analyzing_documents": 20,
                "extracting_entities": 40,
                "mapping_relationships": 30,
                "updating_graph": 10
            }
        }
    
    async def create_task(
        self,
        db: AsyncSession,
        task_type: str,
        project_id: int,
        user_id: int,
        total_steps: Optional[int] = None
    ) -> ProcessingTask:
        """Create a new processing task"""
        
        # Calculate estimated duration based on task type
        estimated_duration = self._calculate_estimated_duration(task_type)
        steps = list(self.step_durations.get(task_type, {}).keys())
        
        task = ProcessingTask(
            task_type=task_type,
            status="pending",
            progress_percentage=0.0,
            current_step="initializing",
            total_steps=total_steps or len(steps),
            completed_steps=0,
            estimated_duration_seconds=estimated_duration,
            elapsed_time_seconds=0.0,
            remaining_time_seconds=estimated_duration,
            project_id=project_id,
            user_id=user_id,
            started_at=datetime.utcnow()
        )
        
        db.add(task)
        await db.flush()
        await db.refresh(task)
        
        # Store in active tasks for real-time tracking
        self.active_tasks[task.id] = {
            "start_time": time.time(),
            "steps": steps,
            "current_step_index": 0
        }
        
        return task
    
    async def update_progress(
        self,
        db: AsyncSession,
        task_id: int,
        current_step: str,
        progress_percentage: float,
        status: str = "running"
    ) -> bool:
        """Update task progress"""
        
        try:
            # Calculate elapsed time and remaining time
            active_task = self.active_tasks.get(task_id)
            elapsed_time = time.time() - active_task["start_time"] if active_task else 0
            
            # Estimate remaining time based on progress
            if progress_percentage > 0:
                total_estimated = elapsed_time / (progress_percentage / 100)
                remaining_time = max(0, total_estimated - elapsed_time)
            else:
                remaining_time = self._calculate_estimated_duration(None)  # Default estimate
            
            # Update in database
            await db.execute(
                update(ProcessingTask)
                .where(ProcessingTask.id == task_id)
                .values(
                    current_step=current_step,
                    progress_percentage=progress_percentage,
                    status=status,
                    elapsed_time_seconds=elapsed_time,
                    remaining_time_seconds=int(remaining_time),
                    updated_at=datetime.utcnow()
                )
            )
            await db.flush()  # Use flush instead of commit to avoid async context issues
            
            # Update active task tracking
            if active_task and current_step in active_task["steps"]:
                active_task["current_step_index"] = active_task["steps"].index(current_step)
            
            return True
            
        except Exception as e:
            print(f"❌ Error updating progress for task {task_id}: {e}")
            return False
    
    async def complete_task(
        self,
        db: AsyncSession,
        task_id: int,
        status: str = "completed",
        result_data: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """Mark task as completed"""
        
        try:
            active_task = self.active_tasks.get(task_id)
            elapsed_time = time.time() - active_task["start_time"] if active_task else 0
            
            await db.execute(
                update(ProcessingTask)
                .where(ProcessingTask.id == task_id)
                .values(
                    status=status,
                    progress_percentage=100.0 if status == "completed" else None,
                    elapsed_time_seconds=elapsed_time,
                    remaining_time_seconds=0,
                    completed_at=datetime.utcnow(),
                    result_data=result_data,
                    error_message=error_message,
                    updated_at=datetime.utcnow()
                )
            )
            await db.flush()  # Use flush instead of commit to avoid async context issues
            
            # Remove from active tasks
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
            
            return True
            
        except Exception as e:
            print(f"❌ Error completing task {task_id}: {e}")
            return False
    
    async def get_task_status(self, db: AsyncSession, task_id: int) -> Optional[Dict]:
        """Get current task status"""
        
        result = await db.execute(
            select(ProcessingTask)
            .options(selectinload(ProcessingTask.project))
            .where(ProcessingTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        
        if not task:
            return None
        
        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status,
            "progress_percentage": task.progress_percentage,
            "current_step": task.current_step,
            "total_steps": task.total_steps,
            "completed_steps": task.completed_steps,
            "estimated_duration_seconds": task.estimated_duration_seconds,
            "elapsed_time_seconds": task.elapsed_time_seconds,
            "remaining_time_seconds": task.remaining_time_seconds,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "result_data": task.result_data,
            "error_message": task.error_message,
            "project_name": task.project.name if task.project else None
        }
    
    async def get_project_tasks(
        self, 
        db: AsyncSession, 
        project_id: int, 
        active_only: bool = True
    ) -> List[Dict]:
        """Get all tasks for a project"""
        
        query = select(ProcessingTask).where(ProcessingTask.project_id == project_id)
        
        if active_only:
            query = query.where(ProcessingTask.status.in_(["pending", "running"]))
        
        query = query.order_by(ProcessingTask.created_at.desc())
        
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        return [
            {
                "id": task.id,
                "task_type": task.task_type,
                "status": task.status,
                "progress_percentage": task.progress_percentage,
                "current_step": task.current_step,
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "estimated_duration_seconds": task.estimated_duration_seconds,
                "remaining_time_seconds": task.remaining_time_seconds
            }
            for task in tasks
        ]
    
    def _calculate_estimated_duration(self, task_type: Optional[str]) -> int:
        """Calculate estimated duration for a task type"""
        
        if not task_type or task_type not in self.step_durations:
            return 120  # Default 2 minutes
        
        return sum(self.step_durations[task_type].values())
    
    async def increment_step(
        self,
        db: AsyncSession,
        task_id: int,
        step_name: str,
        progress_percentage: Optional[float] = None
    ) -> bool:
        """Increment to the next step in the process"""
        
        active_task = self.active_tasks.get(task_id)
        if not active_task:
            return False
        
        # Auto-calculate progress if not provided
        if progress_percentage is None:
            current_step_index = active_task.get("current_step_index", 0)
            total_steps = len(active_task["steps"])
            progress_percentage = ((current_step_index + 1) / total_steps) * 100
        
        return await self.update_progress(
            db, task_id, step_name, progress_percentage, "running"
        )


# Global progress tracker instance
progress_tracker = ProgressTracker()