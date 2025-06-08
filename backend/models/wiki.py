from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from backend.models.base import Base, TimestampMixin


class WikiPage(Base, TimestampMixin):
    """Model for wiki pages"""
    __tablename__ = "wiki_pages"
    
    # Core fields
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=False)
    summary = Column(Text)
    
    # Hierarchy
    parent_id = Column(Integer, ForeignKey("wiki_pages.id"), nullable=True)
    order_index = Column(Integer, default=0)
    
    # Generation metadata
    is_generated = Column(Boolean, default=False)
    generation_source_chunks = Column(JSON, default=list)  # List of chunk IDs used
    confidence_score = Column(Integer, default=0)
    
    # Metadata
    tags = Column(JSON, default=list)
    page_metadata = Column(JSON, default=dict)
    
    # Status
    status = Column(String(50), default="draft")  # draft, published, archived
    view_count = Column(Integer, default=0)
    
    # Timestamps
    published_at = Column(DateTime, nullable=True)
    last_edited_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="wiki_pages")
    children = relationship("WikiPage", backref="parent", remote_side="WikiPage.id")
    

class WikiStructure(Base, TimestampMixin):
    """Model for storing the overall wiki structure/table of contents"""
    __tablename__ = "wiki_structures"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    structure = Column(JSON, nullable=False)  # Hierarchical structure of the wiki
    last_generated_at = Column(DateTime, nullable=True)
    generation_status = Column(String(50), default="pending")  # pending, generating, completed, failed
    
    # Relationships
    project = relationship("Project", back_populates="wiki_structure", uselist=False) 