import numpy as np
from typing import List, Union
from openai import OpenAI, AzureOpenAI
from backend.config import settings


class EmbeddingService:
    """Service for generating text embeddings"""
    
    def __init__(self):
        self.client = self._get_embedding_client()
        self.model = settings.embedding_model
        self.dimension = settings.embedding_dimension
    
    def _get_embedding_client(self):
        """Initialize the appropriate embedding client"""
        if settings.llm_provider == "OPENAI":
            return OpenAI(api_key=settings.openai_api_key)
        elif settings.llm_provider == "AZURE_OPENAI":
            return AzureOpenAI(
                api_key=settings.azure_openai_api_key,
                azure_endpoint=settings.azure_openai_endpoint,
                api_version="2023-05-15"
            )
        else:
            return None
    
    def get_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: The text to embed
            
        Returns:
            List of floats representing the embedding
        """
        if not self.client:
            # Return random embedding if no client configured
            return self._get_random_embedding()
        
        try:
            if settings.llm_provider == "AZURE_OPENAI":
                response = self.client.embeddings.create(
                    model=settings.azure_openai_deployment,
                    input=text
                )
            else:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=text
                )
            
            return response.data[0].embedding
            
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return self._get_random_embedding()
    
    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embeddings
        """
        if not self.client:
            return [self._get_random_embedding() for _ in texts]
        
        try:
            if settings.llm_provider == "AZURE_OPENAI":
                response = self.client.embeddings.create(
                    model=settings.azure_openai_deployment,
                    input=texts
                )
            else:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts
                )
            
            return [item.embedding for item in response.data]
            
        except Exception as e:
            print(f"Error generating embeddings batch: {e}")
            return [self._get_random_embedding() for _ in texts]
    
    def _get_random_embedding(self) -> List[float]:
        """Generate a random embedding for testing/fallback"""
        # Generate normalized random vector
        vec = np.random.randn(self.dimension)
        vec = vec / np.linalg.norm(vec)
        return vec.tolist()
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First embedding vector
            vec2: Second embedding vector
            
        Returns:
            Cosine similarity score between -1 and 1
        """
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def find_similar(
        self, 
        query_embedding: List[float], 
        candidate_embeddings: List[List[float]], 
        top_k: int = 10,
        threshold: float = 0.0
    ) -> List[tuple]:
        """
        Find most similar embeddings to a query
        
        Args:
            query_embedding: The query embedding
            candidate_embeddings: List of candidate embeddings
            top_k: Number of top results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of (index, similarity_score) tuples
        """
        similarities = []
        
        for i, candidate in enumerate(candidate_embeddings):
            sim = self.cosine_similarity(query_embedding, candidate)
            if sim >= threshold:
                similarities.append((i, sim))
        
        # Sort by similarity descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k] 