"""
AI Provider abstraction layer for multiple LLM providers
Supports OpenAI, Claude (Anthropic), and Gemini (Google)
"""

import abc
import logging
from typing import Dict, Any, List, Optional
import os
from enum import Enum

logger = logging.getLogger(__name__)


class AIProvider(Enum):
    """Supported AI providers"""
    OPENAI = "openai"
    CLAUDE = "claude"
    GEMINI = "gemini"


class BaseAIProvider(abc.ABC):
    """Abstract base class for AI providers"""
    
    @abc.abstractmethod
    async def generate_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate medical report from transcription"""
        pass
    
    @abc.abstractmethod
    async def check_report_quality(
        self,
        report_text: str
    ) -> Dict[str, Any]:
        """Check quality of generated report"""
        pass
    
    @abc.abstractmethod
    async def extract_medical_codes(
        self,
        report_text: str
    ) -> Dict[str, List[str]]:
        """Extract ICD and procedure codes"""
        pass
    
    @abc.abstractmethod
    def is_available(self) -> bool:
        """Check if provider is configured and available"""
        pass


class OpenAIProvider(BaseAIProvider):
    """OpenAI GPT-4 provider"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if self.api_key:
            import openai
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=self.api_key)
            self.model = os.getenv("OPENAI_MODEL", "gpt-4-1106-preview")
        else:
            self.client = None
            
    def is_available(self) -> bool:
        return self.client is not None
    
    async def generate_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.client:
            raise ValueError("OpenAI client not configured")
            
        from app.services.openai_service import MedicalPrompts
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": MedicalPrompts.SYSTEM_PROMPT},
                    {"role": "user", "content": MedicalPrompts.REPORT_GENERATION_PROMPT.format(
                        transcription=transcription,
                        examination_type=examination_type,
                        clinical_indication=clinical_indication
                    )}
                ],
                temperature=0.3,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content
            return self._parse_report_response(content)
            
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    async def check_report_quality(self, report_text: str) -> Dict[str, Any]:
        # Implementation similar to existing OpenAI service
        pass
    
    async def extract_medical_codes(self, report_text: str) -> Dict[str, List[str]]:
        # Implementation similar to existing OpenAI service
        pass
    
    def _parse_report_response(self, content: str) -> Dict[str, Any]:
        # Parse the response content into structured format
        # This is a simplified version - expand based on actual needs
        return {
            "findings": content,
            "assessment": "",
            "recommendations": "",
            "metadata": {"provider": "openai", "model": self.model}
        }


class ClaudeProvider(BaseAIProvider):
    """Anthropic Claude provider"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if self.api_key:
            import anthropic
            self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
            self.model = os.getenv("CLAUDE_MODEL", "claude-3-opus-20240229")
        else:
            self.client = None
            
    def is_available(self) -> bool:
        return self.client is not None
    
    async def generate_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.client:
            raise ValueError("Claude client not configured")
            
        from app.services.openai_service import MedicalPrompts
        
        try:
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.3,
                system=MedicalPrompts.SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": MedicalPrompts.REPORT_GENERATION_PROMPT.format(
                            transcription=transcription,
                            examination_type=examination_type,
                            clinical_indication=clinical_indication
                        )
                    }
                ]
            )
            
            content = message.content[0].text
            return self._parse_report_response(content)
            
        except Exception as e:
            logger.error(f"Claude generation failed: {e}")
            raise
    
    async def check_report_quality(self, report_text: str) -> Dict[str, Any]:
        # Implement quality checking with Claude
        pass
    
    async def extract_medical_codes(self, report_text: str) -> Dict[str, List[str]]:
        # Implement code extraction with Claude
        pass
    
    def _parse_report_response(self, content: str) -> Dict[str, Any]:
        return {
            "findings": content,
            "assessment": "",
            "recommendations": "",
            "metadata": {"provider": "claude", "model": self.model}
        }


class GeminiProvider(BaseAIProvider):
    """Google Gemini provider"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if self.api_key:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.model_name = os.getenv("GEMINI_MODEL", "gemini-pro")
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None
            
    def is_available(self) -> bool:
        return self.model is not None
    
    async def generate_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.model:
            raise ValueError("Gemini client not configured")
            
        from app.services.openai_service import MedicalPrompts
        
        try:
            # Gemini uses a different API structure
            prompt = f"{MedicalPrompts.SYSTEM_PROMPT}\n\n{MedicalPrompts.REPORT_GENERATION_PROMPT.format(
                transcription=transcription,
                examination_type=examination_type,
                clinical_indication=clinical_indication
            )}"
            
            response = await self.model.generate_content_async(prompt)
            content = response.text
            return self._parse_report_response(content)
            
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise
    
    async def check_report_quality(self, report_text: str) -> Dict[str, Any]:
        # Implement quality checking with Gemini
        pass
    
    async def extract_medical_codes(self, report_text: str) -> Dict[str, List[str]]:
        # Implement code extraction with Gemini
        pass
    
    def _parse_report_response(self, content: str) -> Dict[str, Any]:
        return {
            "findings": content,
            "assessment": "",
            "recommendations": "",
            "metadata": {"provider": "gemini", "model": self.model_name}
        }


class AIProviderFactory:
    """Factory class to manage AI providers with fallback support"""
    
    def __init__(self):
        self.providers = {
            AIProvider.OPENAI: OpenAIProvider(),
            AIProvider.CLAUDE: ClaudeProvider(),
            AIProvider.GEMINI: GeminiProvider()
        }
        
        # Set priority order from environment or use default
        priority_str = os.getenv("AI_PROVIDER_PRIORITY", "claude,gemini,openai")
        self.priority_order = [
            AIProvider(p.strip()) 
            for p in priority_str.split(",") 
            if p.strip() in [e.value for e in AIProvider]
        ]
    
    async def generate_report_with_fallback(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate report using available providers with fallback"""
        
        errors = []
        
        for provider_type in self.priority_order:
            provider = self.providers.get(provider_type)
            
            if not provider or not provider.is_available():
                logger.info(f"Provider {provider_type.value} not available, skipping")
                continue
                
            try:
                logger.info(f"Attempting report generation with {provider_type.value}")
                result = await provider.generate_report(
                    transcription=transcription,
                    examination_type=examination_type,
                    clinical_indication=clinical_indication,
                    template=template
                )
                logger.info(f"Successfully generated report with {provider_type.value}")
                return result
                
            except Exception as e:
                error_msg = f"Provider {provider_type.value} failed: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
        
        # All providers failed
        raise Exception(f"All AI providers failed. Errors: {'; '.join(errors)}")
    
    def get_available_providers(self) -> List[str]:
        """Get list of available providers"""
        return [
            provider_type.value 
            for provider_type, provider in self.providers.items() 
            if provider.is_available()
        ]


# Global factory instance
ai_provider_factory = AIProviderFactory()