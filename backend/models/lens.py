from enum import Enum
from sqlalchemy import Column, String, Float, Text
from .base import Base, TimestampMixin


class LensType(str, Enum):
    """Document lens types"""
    LOGIC = "LOGIC"  # How the product works
    SOP = "SOP"      # User step-by-step instructions
    GTM = "GTM"      # Internal marketing/decks
    CL = "CL"        # Changelog, retros, feedback


class Lens(Base, TimestampMixin):
    __tablename__ = "lenses"
    
    name = Column(String(50), unique=True, nullable=False)
    lens_type = Column(String(10), nullable=False)
    description = Column(Text)
    weight = Column(Float, default=1.0)
    
    # Prompt template for auto-generation
    prompt_template = Column(Text) 