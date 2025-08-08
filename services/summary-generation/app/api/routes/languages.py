"""Language support endpoints."""

import logging
from typing import List

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.summary_schemas import LanguageInfo
from app.data.cultural_adaptations import CULTURAL_ADAPTATIONS

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get("", response_model=List[LanguageInfo])
async def get_supported_languages() -> List[LanguageInfo]:
    """
    Get list of supported languages with their details.
    
    Returns information about each supported language including:
    - Language code and names
    - Supported complexity levels
    - Available cultural contexts
    """
    try:
        language_details = {
            "de": {
                "name": "German",
                "native_name": "Deutsch"
            },
            "en": {
                "name": "English", 
                "native_name": "English"
            },
            "fr": {
                "name": "French",
                "native_name": "Français"
            },
            "es": {
                "name": "Spanish",
                "native_name": "Español"
            },
            "it": {
                "name": "Italian",
                "native_name": "Italiano"
            },
            "tr": {
                "name": "Turkish",
                "native_name": "Türkçe"
            }
        }
        
        languages = []
        
        for lang_code in settings.SUPPORTED_LANGUAGES:
            if lang_code in language_details:
                # Get cultural contexts for this language
                cultural_contexts = []
                if lang_code in CULTURAL_ADAPTATIONS:
                    cultural_contexts = list(CULTURAL_ADAPTATIONS[lang_code].keys())
                
                language_info = LanguageInfo(
                    code=lang_code,
                    name=language_details[lang_code]["name"],
                    native_name=language_details[lang_code]["native_name"],
                    supported_complexities=settings.COMPLEXITY_LEVELS,
                    cultural_contexts=cultural_contexts
                )
                
                languages.append(language_info)
        
        logger.info(f"Returned {len(languages)} supported languages")
        return languages
        
    except Exception as e:
        logger.error(f"Error getting supported languages: {e}")
        return []


@router.get("/{language_code}", response_model=LanguageInfo)
async def get_language_info(language_code: str) -> LanguageInfo:
    """
    Get detailed information about a specific language.
    
    Returns comprehensive information about the language including
    supported complexity levels and cultural contexts.
    """
    try:
        if language_code not in settings.SUPPORTED_LANGUAGES:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Language '{language_code}' not supported")
        
        language_details = {
            "de": {"name": "German", "native_name": "Deutsch"},
            "en": {"name": "English", "native_name": "English"},
            "fr": {"name": "French", "native_name": "Français"},
            "es": {"name": "Spanish", "native_name": "Español"},
            "it": {"name": "Italian", "native_name": "Italiano"},
            "tr": {"name": "Turkish", "native_name": "Türkçe"}
        }
        
        if language_code not in language_details:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Language details not found for '{language_code}'")
        
        # Get cultural contexts
        cultural_contexts = []
        if language_code in CULTURAL_ADAPTATIONS:
            cultural_contexts = list(CULTURAL_ADAPTATIONS[language_code].keys())
        
        language_info = LanguageInfo(
            code=language_code,
            name=language_details[language_code]["name"],
            native_name=language_details[language_code]["native_name"],
            supported_complexities=settings.COMPLEXITY_LEVELS,
            cultural_contexts=cultural_contexts
        )
        
        logger.info(f"Returned language info for: {language_code}")
        return language_info
        
    except Exception as e:
        logger.error(f"Error getting language info for {language_code}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{language_code}/cultural-contexts")
async def get_cultural_contexts(language_code: str) -> dict:
    """
    Get available cultural contexts for a specific language.
    
    Returns detailed information about cultural adaptations available
    for the specified language, including communication styles and
    healthcare system information.
    """
    try:
        if language_code not in settings.SUPPORTED_LANGUAGES:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Language '{language_code}' not supported")
        
        if language_code not in CULTURAL_ADAPTATIONS:
            return {
                "language": language_code,
                "cultural_contexts": [],
                "message": "No specific cultural adaptations available for this language"
            }
        
        contexts = CULTURAL_ADAPTATIONS[language_code]
        
        # Format the response with detailed context information
        formatted_contexts = {}
        for region, context_data in contexts.items():
            formatted_contexts[region] = {
                "region": region,
                "communication_style": context_data.get("communication_style", {}),
                "family_involvement": context_data.get("family_involvement", "medium"),
                "healthcare_system": context_data.get("healthcare_system_info", {}),
                "cultural_notes": context_data.get("cultural_notes", "")
            }
        
        logger.info(f"Returned cultural contexts for language: {language_code}")
        return {
            "language": language_code,
            "cultural_contexts": formatted_contexts,
            "total_contexts": len(formatted_contexts)
        }
        
    except Exception as e:
        logger.error(f"Error getting cultural contexts for {language_code}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{language_code}/medical-terms")
async def get_medical_terms_sample(language_code: str, category: str = None) -> dict:
    """
    Get a sample of medical terms available for a language.
    
    Returns a sample of medical terminology translations available
    for the specified language, optionally filtered by category.
    """
    try:
        if language_code not in settings.SUPPORTED_LANGUAGES:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Language '{language_code}' not supported")
        
        from app.services.medical_terminology_service import MedicalTerminologyService
        terminology_service = MedicalTerminologyService()
        
        # Get available categories
        try:
            categories = terminology_service.get_term_categories(language_code)
        except Exception:
            return {
                "language": language_code,
                "message": "Medical terminology not available for this language",
                "available_categories": []
            }
        
        # If category specified, filter by it
        if category:
            if category not in categories:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail=f"Category '{category}' not found")
            
            sample_terms = categories[category][:10]  # Return up to 10 terms
            total_terms = len(categories[category])
        else:
            # Return sample from all categories
            sample_terms = []
            total_terms = 0
            for cat, terms in categories.items():
                sample_terms.extend(terms[:3])  # 3 terms per category
                total_terms += len(terms)
                if len(sample_terms) >= 15:  # Limit total sample
                    break
        
        logger.info(f"Returned medical terms sample for language: {language_code}")
        return {
            "language": language_code,
            "category": category,
            "sample_terms": sample_terms[:15],  # Limit to 15 terms
            "total_terms": total_terms,
            "available_categories": list(categories.keys())
        }
        
    except Exception as e:
        logger.error(f"Error getting medical terms for {language_code}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Internal server error")