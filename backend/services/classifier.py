from typing import Tuple, Dict, List
from openai import OpenAI, AzureOpenAI
from backend.config import settings
from backend.models.lens import LensType


class LensClassifier:
    """Service for classifying text chunks into lens types"""
    
    def __init__(self):
        self.client = self._get_llm_client()
        self.lens_descriptions = {
            LensType.LOGIC: "Technical documentation explaining how the product works, architecture, implementation details, algorithms, and system design",
            LensType.SOP: "User guides, step-by-step instructions, tutorials, how-to documentation, and operational procedures",
            LensType.GTM: "Marketing materials, sales decks, product positioning, competitive analysis, and go-to-market strategies",
            LensType.CL: "Changelogs, release notes, retrospectives, user feedback, bug reports, and feature requests"
        }
    
    def _get_llm_client(self):
        """Initialize the appropriate LLM client based on settings"""
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
    
    async def classify_chunk(self, text: str, project_context: str = "") -> Tuple[LensType, float]:
        """
        Classify a text chunk into a lens type
        
        Args:
            text: The text chunk to classify
            project_context: Additional context about the project
            
        Returns:
            Tuple of (LensType, confidence_score)
        """
        prompt = self._build_classification_prompt(text, project_context)
        
        try:
            if settings.llm_provider in ["OPENAI", "AZURE_OPENAI"] and self.client:
                response = self._classify_with_openai(prompt)
            else:
                # Fallback to rule-based classification
                return self._rule_based_classification(text)
            
            lens_type, confidence = self._parse_classification_response(response)
            return lens_type, confidence
            
        except Exception as e:
            print(f"Error in LLM classification: {e}")
            # Fallback to rule-based classification
            return self._rule_based_classification(text)
    
    def _build_classification_prompt(self, text: str, project_context: str) -> str:
        """Build the classification prompt"""
        lens_descriptions = "\n".join([
            f"- {lens.value}: {desc}"
            for lens, desc in self.lens_descriptions.items()
        ])
        
        prompt = f"""Classify the following text chunk into one of these documentation lens types:

{lens_descriptions}

Project Context: {project_context or "General software documentation"}

Text to classify:
{text[:1000]}  # Limit text length for prompt

Respond with:
1. The lens type (LOGIC, SOP, GTM, or CL)
2. Confidence score (0.0 to 1.0)

Format: LENS_TYPE|CONFIDENCE
Example: LOGIC|0.85
"""
        return prompt
    
    def _classify_with_openai(self, prompt: str) -> str:
        """Classify using OpenAI API"""
        if settings.llm_provider == "AZURE_OPENAI":
            response = self.client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": "You are a documentation classifier."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=50
            )
        else:
            response = self.client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": "You are a documentation classifier."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=50
            )
        
        return response.choices[0].message.content.strip()
    
    def _parse_classification_response(self, response: str) -> Tuple[LensType, float]:
        """Parse the classification response"""
        try:
            parts = response.strip().split('|')
            lens_type = LensType(parts[0].strip())
            confidence = float(parts[1].strip())
            return lens_type, confidence
        except:
            # Default fallback
            return LensType.LOGIC, 0.5
    
    def _rule_based_classification(self, text: str) -> Tuple[LensType, float]:
        """Fallback rule-based classification"""
        text_lower = text.lower()
        
        # Keywords for each lens type
        logic_keywords = ['architecture', 'implementation', 'algorithm', 'system', 'design', 'component', 'module', 'function', 'class', 'api', 'database', 'schema']
        sop_keywords = ['step', 'guide', 'tutorial', 'how to', 'instruction', 'procedure', 'click', 'navigate', 'user', 'setup', 'configure']
        gtm_keywords = ['market', 'sales', 'customer', 'competitor', 'pricing', 'strategy', 'positioning', 'value proposition', 'target audience']
        cl_keywords = ['changelog', 'release', 'version', 'bug', 'fix', 'feature', 'improvement', 'feedback', 'issue', 'update']
        
        # Count keyword matches
        scores = {
            LensType.LOGIC: sum(1 for kw in logic_keywords if kw in text_lower),
            LensType.SOP: sum(1 for kw in sop_keywords if kw in text_lower),
            LensType.GTM: sum(1 for kw in gtm_keywords if kw in text_lower),
            LensType.CL: sum(1 for kw in cl_keywords if kw in text_lower)
        }
        
        # Get the lens with highest score
        max_lens = max(scores, key=scores.get)
        max_score = scores[max_lens]
        
        # Calculate confidence based on score
        confidence = min(0.9, max_score * 0.15) if max_score > 0 else 0.3
        
        return max_lens, confidence
    
    async def batch_classify(self, texts: List[str], project_context: str = "") -> List[Tuple[LensType, float]]:
        """Classify multiple text chunks"""
        results = []
        for text in texts:
            result = await self.classify_chunk(text, project_context)
            results.append(result)
        return results 