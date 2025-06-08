from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SearchResult:
    """Represents a search result from a connector"""
    doc_id: str
    title: str
    snippet: str
    raw_text: str
    source_type: str
    source_url: Optional[str] = None
    source_meta: Dict[str, Any] = None
    file_type: Optional[str] = None
    last_modified: Optional[datetime] = None
    
    def __post_init__(self):
        if self.source_meta is None:
            self.source_meta = {}


class BaseConnector(ABC):
    """Abstract base class for all connectors"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test if the connector can establish a connection"""
        pass
    
    @abstractmethod
    async def search(self, query: str, limit: int = 50) -> List[SearchResult]:
        """
        Search for documents matching the query
        
        Args:
            query: Search query string
            limit: Maximum number of results to return
            
        Returns:
            List of SearchResult objects
        """
        pass
    
    @abstractmethod
    async def fetch_document(self, doc_id: str) -> SearchResult:
        """
        Fetch a specific document by ID
        
        Args:
            doc_id: Document identifier
            
        Returns:
            SearchResult object
        """
        pass
    
    async def ingest(self, doc_ids: List[str]) -> List[SearchResult]:
        """
        Ingest multiple documents
        
        Args:
            doc_ids: List of document identifiers
            
        Returns:
            List of SearchResult objects
        """
        results = []
        for doc_id in doc_ids:
            try:
                result = await self.fetch_document(doc_id)
                results.append(result)
            except Exception as e:
                print(f"Error fetching document {doc_id}: {e}")
        return results 