"""OpenAI integration service for medical text generation."""

import logging
import time
from typing import Dict, List, Optional, Any
import json

import openai
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.exceptions import OpenAIServiceException
from app.data.cultural_adaptations import get_cultural_adaptation

logger = logging.getLogger(__name__)
settings = get_settings()


class OpenAIService:
    """Service for OpenAI API interactions."""
    
    def __init__(self):
        """Initialize OpenAI service."""
        if not settings.OPENAI_API_KEY:
            raise OpenAIServiceException("OpenAI API key not configured")
        
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.max_tokens = settings.OPENAI_MAX_TOKENS
        self.temperature = settings.OPENAI_TEMPERATURE
    
    async def generate_patient_summary(
        self,
        medical_report: str,
        language: str = "de",
        complexity_level: str = "basic",
        cultural_context: Optional[str] = None,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate patient-friendly summary from medical report."""
        try:
            start_time = time.time()
            
            # Get cultural adaptation
            cultural_adaptation = get_cultural_adaptation(language, region)
            
            # Build the prompt
            prompt = self._build_summary_prompt(
                medical_report=medical_report,
                language=language,
                complexity_level=complexity_level,
                cultural_adaptation=cultural_adaptation
            )
            
            logger.info(f"Generating summary for language: {language}, complexity: {complexity_level}")
            
            # Make API call
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt(language, complexity_level, cultural_adaptation)
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
            
            generation_time = time.time() - start_time
            
            # Parse response
            content = response.choices[0].message.content
            summary_data = json.loads(content)
            
            # Add metadata
            summary_data["generation_metadata"] = {
                "model_used": self.model,
                "generation_time_seconds": round(generation_time, 2),
                "tokens_input": response.usage.prompt_tokens if response.usage else None,
                "tokens_output": response.usage.completion_tokens if response.usage else None,
                "total_tokens": response.usage.total_tokens if response.usage else None
            }
            
            logger.info(f"Summary generated successfully in {generation_time:.2f}s")
            return summary_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            raise OpenAIServiceException("Invalid response format from AI service")
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {e}")
            raise OpenAIServiceException("AI service rate limit exceeded. Please try again later.")
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise OpenAIServiceException(f"AI service error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in OpenAI service: {e}")
            raise OpenAIServiceException("AI service temporarily unavailable")
    
    async def detect_emergency_conditions(
        self,
        medical_report: str,
        language: str = "de"
    ) -> Dict[str, Any]:
        """Detect emergency conditions in medical report."""
        try:
            prompt = self._build_emergency_detection_prompt(medical_report, language)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_emergency_detection_system_prompt(language)
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.1,  # Lower temperature for more consistent emergency detection
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            emergency_data = json.loads(content)
            
            logger.info(f"Emergency detection completed for language: {language}")
            return emergency_data
            
        except Exception as e:
            logger.error(f"Error in emergency detection: {e}")
            raise OpenAIServiceException("Emergency detection service error")
    
    async def simplify_medical_terms(
        self,
        medical_terms: List[str],
        language: str = "de",
        complexity_level: str = "basic"
    ) -> Dict[str, str]:
        """Simplify medical terms for patient understanding."""
        try:
            prompt = self._build_term_simplification_prompt(medical_terms, language, complexity_level)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_term_simplification_system_prompt(language, complexity_level)
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1500,
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            simplified_terms = json.loads(content)
            
            logger.info(f"Simplified {len(medical_terms)} terms for language: {language}")
            return simplified_terms.get("terms", {})
            
        except Exception as e:
            logger.error(f"Error in term simplification: {e}")
            raise OpenAIServiceException("Term simplification service error")
    
    def _get_system_prompt(self, language: str, complexity_level: str, cultural_adaptation: Dict) -> str:
        """Get system prompt for summary generation."""
        language_names = {
            "de": "German",
            "en": "English", 
            "fr": "French",
            "es": "Spanish",
            "it": "Italian",
            "tr": "Turkish"
        }
        
        lang_name = language_names.get(language, "German")
        
        return f"""You are a medical AI assistant specialized in creating patient-friendly medical summaries. 
        
Your task is to convert complex German medical reports into clear, understandable summaries in {lang_name} for patients.

IMPORTANT GUIDELINES:
1. **Language**: Respond in {lang_name} only
2. **Complexity Level**: {complexity_level.title()} - adjust medical terminology accordingly
3. **Cultural Context**: {cultural_adaptation.get('communication_style', {})}
4. **Family Involvement**: {cultural_adaptation.get('family_involvement', 'medium')}
5. **Medical Accuracy**: Maintain complete medical accuracy while simplifying language
6. **Patient Safety**: Include appropriate warnings and emergency indicators
7. **Disclaimers**: Always include medical disclaimers appropriate for the culture

COMPLEXITY LEVELS:
- Basic: Use everyday language, avoid medical jargon, explain everything simply
- Intermediate: Some medical terms with explanations, more detail
- Advanced: Medical terminology with patient-friendly explanations

RESPONSE FORMAT: JSON with the following structure:
{{
    "title": "Patient-friendly title",
    "what_was_examined": "Simple explanation of the examination",
    "key_findings": "Main findings in plain language", 
    "what_this_means": "What the findings mean for the patient",
    "next_steps": "Recommended actions and follow-up",
    "when_to_contact_doctor": "When to seek immediate medical help",
    "glossary": [
        {{"term": "medical term", "definition": "patient-friendly definition", "category": "category"}}
    ],
    "emergency_indicators": [
        {{"keyword": "emergency term", "urgency_level": "critical/high/medium", "warning": "patient warning"}}
    ],
    "medical_disclaimer": "Appropriate medical disclaimer",
    "confidence_score": "high/medium/low"
}}"""
    
    def _build_summary_prompt(
        self,
        medical_report: str,
        language: str,
        complexity_level: str,
        cultural_adaptation: Dict
    ) -> str:
        """Build the prompt for summary generation."""
        greeting = cultural_adaptation.get("greeting_style", "Dear Patient,")
        
        return f"""Please create a patient-friendly medical summary from the following German medical report.

CULTURAL CONTEXT:
- Greeting style: {greeting}
- Communication approach: {cultural_adaptation.get('explanation_style', 'clear_informative')}
- Family involvement level: {cultural_adaptation.get('family_involvement', 'medium')}

MEDICAL REPORT:
{medical_report}

Please generate a comprehensive summary that:
1. Uses culturally appropriate language and tone
2. Explains medical findings at the {complexity_level} level
3. Includes emergency indicators if any urgent conditions are mentioned
4. Provides clear next steps appropriate for the healthcare system
5. Includes a glossary of important medical terms
6. Contains appropriate medical disclaimers

Remember: The patient's safety and understanding are paramount. Be thorough but accessible."""
    
    def _get_emergency_detection_system_prompt(self, language: str) -> str:
        """Get system prompt for emergency detection."""
        return f"""You are a medical AI specialized in identifying emergency conditions in medical reports.

Analyze the medical report and identify any conditions that require immediate or urgent medical attention.

EMERGENCY CATEGORIES:
- CRITICAL: Life-threatening, requires immediate emergency care
- HIGH: Urgent, requires medical attention within hours
- MEDIUM: Concerning, requires medical follow-up soon
- LOW: Monitor, routine follow-up sufficient

RESPONSE FORMAT: JSON
{{
    "is_emergency": true/false,
    "urgency_level": "critical/high/medium/low",
    "emergency_conditions": [
        {{
            "condition": "condition name",
            "urgency": "critical/high/medium/low",
            "type": "cardiac/respiratory/neurological/bleeding/other",
            "patient_warning": "Warning message in {language}",
            "immediate_actions": ["action1", "action2"]
        }}
    ],
    "confidence": "high/medium/low"
}}"""
    
    def _build_emergency_detection_prompt(self, medical_report: str, language: str) -> str:
        """Build prompt for emergency detection."""
        return f"""Analyze this German medical report for emergency conditions:

{medical_report}

Identify any conditions that require immediate medical attention, urgent care, or careful monitoring. Consider symptoms, diagnoses, and findings that could indicate:
- Cardiac emergencies
- Respiratory distress
- Neurological emergencies  
- Severe bleeding or trauma
- Acute infections
- Other critical conditions

Provide patient warnings and immediate actions in {language}."""
    
    def _get_term_simplification_system_prompt(self, language: str, complexity_level: str) -> str:
        """Get system prompt for term simplification."""
        return f"""You are a medical terminology expert specializing in patient education.

Convert medical terms into patient-friendly explanations in {language} at the {complexity_level} complexity level.

COMPLEXITY GUIDELINES:
- Basic: Everyday language, no medical jargon
- Intermediate: Some medical terms with clear explanations
- Advanced: Medical terminology with detailed patient-friendly explanations

RESPONSE FORMAT: JSON
{{
    "terms": {{
        "medical_term_1": "patient-friendly explanation",
        "medical_term_2": "patient-friendly explanation"
    }}
}}"""
    
    def _build_term_simplification_prompt(
        self,
        medical_terms: List[str],
        language: str,
        complexity_level: str
    ) -> str:
        """Build prompt for term simplification."""
        terms_str = "\n".join([f"- {term}" for term in medical_terms])
        
        return f"""Simplify these medical terms for patient understanding in {language} at {complexity_level} level:

{terms_str}

Provide clear, accurate explanations that patients can easily understand while maintaining medical accuracy."""