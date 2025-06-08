from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, Float, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, TimestampMixin


class CoverageRequirement(Base, TimestampMixin):
    __tablename__ = "coverage_requirements"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    lens_type = Column(String(10), nullable=False)  # LOGIC, SOP, GTM, CL
    is_required = Column(Boolean, default=True)
    min_documents = Column(Integer, default=1)
    
    # Relationships
    project = relationship("Project", back_populates="coverage_requirements")
    
    # Unique constraint on project_id + lens_type
    __table_args__ = (
        {'extend_existing': True}
    )


class CoverageStatus(Base, TimestampMixin):
    __tablename__ = "coverage_status"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    lens_type = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False)  # complete, good, partial, poor
    document_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    coverage_percentage = Column(Float, default=0.0)
    missing_topics = Column(JSON, default=list)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project")
    
    # Unique constraint on project_id + lens_type
    __table_args__ = (
        {'extend_existing': True}
    ) 