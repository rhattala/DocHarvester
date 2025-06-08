from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    tags = Column(JSON, default=list)
    owners = Column(JSON, default=list)  # List of user emails
    
    # Relationships
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    coverage_requirements = relationship("CoverageRequirement", back_populates="project", cascade="all, delete-orphan")
    wiki_pages = relationship("WikiPage", back_populates="project", cascade="all, delete-orphan")
    wiki_structure = relationship("WikiStructure", back_populates="project", cascade="all, delete-orphan", uselist=False)
    
    # Connector configurations (encrypted in production)
    connector_configs = Column(JSON, default=dict) 