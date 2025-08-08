"""Complexity levels endpoints."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.summary_schemas import ComplexityLevelInfo

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get("", response_model=List[ComplexityLevelInfo])
async def get_complexity_levels() -> List[ComplexityLevelInfo]:
    """
    Get available complexity levels for summaries.
    
    Returns detailed information about each complexity level including:
    - Level identifier and display name
    - Description of the complexity level
    - Target audience information
    - Reading level requirements
    """
    try:
        complexity_details = {
            "basic": {
                "name": "Basic",
                "description": "Simple language with minimal medical terminology. Everyday words and short sentences.",
                "target_audience": "General public, patients with limited medical knowledge",
                "reading_level": "6th-8th grade level"
            },
            "intermediate": {
                "name": "Intermediate", 
                "description": "Some medical terms with clear explanations. Moderate complexity sentences.",
                "target_audience": "Patients with some medical background or higher education",
                "reading_level": "9th-12th grade level"
            },
            "advanced": {
                "name": "Advanced",
                "description": "Medical terminology with patient-friendly explanations. More detailed information.",
                "target_audience": "Healthcare professionals, medical students, or highly educated patients",
                "reading_level": "College level"
            }
        }
        
        complexity_levels = []
        
        for level in settings.COMPLEXITY_LEVELS:
            if level in complexity_details:
                complexity_info = ComplexityLevelInfo(
                    level=level,
                    name=complexity_details[level]["name"],
                    description=complexity_details[level]["description"],
                    target_audience=complexity_details[level]["target_audience"],
                    reading_level=complexity_details[level]["reading_level"]
                )
                
                complexity_levels.append(complexity_info)
        
        logger.info(f"Returned {len(complexity_levels)} complexity levels")
        return complexity_levels
        
    except Exception as e:
        logger.error(f"Error getting complexity levels: {e}")
        return []


@router.get("/{level}", response_model=ComplexityLevelInfo)
async def get_complexity_level(level: str) -> ComplexityLevelInfo:
    """
    Get detailed information about a specific complexity level.
    
    Returns comprehensive information about the complexity level including
    usage guidelines and target audience details.
    """
    try:
        if level not in settings.COMPLEXITY_LEVELS:
            raise HTTPException(status_code=404, detail=f"Complexity level '{level}' not supported")
        
        complexity_details = {
            "basic": {
                "name": "Basic",
                "description": "Simple language with minimal medical terminology. Uses everyday words and short sentences to ensure maximum comprehension.",
                "target_audience": "General public, patients with limited medical knowledge, elderly patients, or those with language barriers",
                "reading_level": "6th-8th grade level (elementary to middle school)"
            },
            "intermediate": {
                "name": "Intermediate",
                "description": "Balanced approach with some medical terms accompanied by clear explanations. Uses moderate complexity sentences with structured explanations.",
                "target_audience": "Patients with some medical background, higher education, or those comfortable with moderate complexity",
                "reading_level": "9th-12th grade level (high school)"
            },
            "advanced": {
                "name": "Advanced",
                "description": "More comprehensive medical terminology with detailed patient-friendly explanations. Provides in-depth information while maintaining accessibility.",
                "target_audience": "Healthcare professionals, medical students, highly educated patients, or those specifically requesting detailed information",
                "reading_level": "College level and above"
            }
        }
        
        if level not in complexity_details:
            raise HTTPException(status_code=404, detail=f"Details not found for complexity level '{level}'")
        
        complexity_info = ComplexityLevelInfo(
            level=level,
            name=complexity_details[level]["name"],
            description=complexity_details[level]["description"],
            target_audience=complexity_details[level]["target_audience"],
            reading_level=complexity_details[level]["reading_level"]
        )
        
        logger.info(f"Returned complexity level info for: {level}")
        return complexity_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complexity level info for {level}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{level}/examples")
async def get_complexity_examples(level: str) -> dict:
    """
    Get examples of text at different complexity levels.
    
    Returns sample medical explanations at the specified complexity level
    to demonstrate the language style and terminology usage.
    """
    try:
        if level not in settings.COMPLEXITY_LEVELS:
            raise HTTPException(status_code=404, detail=f"Complexity level '{level}' not supported")
        
        examples = {
            "basic": {
                "medical_term_example": {
                    "term": "Pneumonia",
                    "explanation": "Pneumonia is an infection in your lungs. It makes it hard to breathe and can cause fever and cough."
                },
                "findings_example": {
                    "original": "Patient presents with bilateral pulmonary infiltrates consistent with pneumonia.",
                    "simplified": "The X-ray shows signs of infection in both lungs."
                },
                "next_steps_example": {
                    "original": "Initiate antibiotic therapy and monitor respiratory status.",
                    "simplified": "You need to take antibiotics to fight the infection. We will watch how well you are breathing."
                }
            },
            "intermediate": {
                "medical_term_example": {
                    "term": "Pneumonia",
                    "explanation": "Pneumonia is a lung infection that causes inflammation in the air sacs (alveoli). This can make breathing difficult and cause symptoms like fever, cough, and chest pain."
                },
                "findings_example": {
                    "original": "Patient presents with bilateral pulmonary infiltrates consistent with pneumonia.",
                    "simplified": "The chest X-ray shows signs of pneumonia (lung infection) affecting both lungs, with areas of inflammation visible on the scan."
                },
                "next_steps_example": {
                    "original": "Initiate antibiotic therapy and monitor respiratory status.",
                    "simplified": "Treatment will include antibiotics to fight the bacterial infection. Your breathing and oxygen levels will be closely monitored."
                }
            },
            "advanced": {
                "medical_term_example": {
                    "term": "Pneumonia",
                    "explanation": "Pneumonia is an acute inflammatory condition of the lungs, typically caused by bacterial, viral, or fungal pathogens. It results in consolidation of the alveolar spaces, impeding gas exchange and causing respiratory symptoms."
                },
                "findings_example": {
                    "original": "Patient presents with bilateral pulmonary infiltrates consistent with pneumonia.",
                    "simplified": "Imaging reveals bilateral pulmonary infiltrates consistent with pneumonia, indicating inflammatory consolidation in both lung fields that impairs normal gas exchange."
                },
                "next_steps_example": {
                    "original": "Initiate antibiotic therapy and monitor respiratory status.",
                    "simplified": "Treatment protocol includes empirical antibiotic therapy targeting likely pathogens, with continuous monitoring of respiratory parameters including oxygen saturation and respiratory rate."
                }
            }
        }
        
        if level not in examples:
            return {
                "level": level,
                "message": "Examples not available for this complexity level",
                "examples": {}
            }
        
        logger.info(f"Returned complexity examples for level: {level}")
        return {
            "level": level,
            "examples": examples[level],
            "guidelines": {
                "basic": [
                    "Use simple, everyday words",
                    "Keep sentences short and clear",
                    "Avoid medical jargon",
                    "Use active voice",
                    "Explain everything in common terms"
                ],
                "intermediate": [
                    "Use some medical terms with explanations",
                    "Provide context for medical concepts",
                    "Use moderate sentence complexity",
                    "Balance detail with clarity",
                    "Include relevant background information"
                ],
                "advanced": [
                    "Use appropriate medical terminology",
                    "Provide comprehensive explanations",
                    "Include detailed mechanisms when relevant",
                    "Use precise medical language with clarification",
                    "Offer in-depth understanding while remaining accessible"
                ]
            }[level]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complexity examples for {level}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{level}/guidelines")
async def get_complexity_guidelines(level: str) -> dict:
    """
    Get writing guidelines for a specific complexity level.
    
    Returns detailed guidelines for writing medical content at the
    specified complexity level, including style recommendations
    and terminology usage rules.
    """
    try:
        if level not in settings.COMPLEXITY_LEVELS:
            raise HTTPException(status_code=404, detail=f"Complexity level '{level}' not supported")
        
        guidelines = {
            "basic": {
                "vocabulary": [
                    "Use common, everyday words",
                    "Avoid technical medical terms when possible",
                    "Replace complex words with simpler alternatives",
                    "Use familiar analogies and comparisons"
                ],
                "sentence_structure": [
                    "Keep sentences short (15 words or less)",
                    "Use simple subject-verb-object structure",
                    "Avoid complex grammatical constructions",
                    "Use active voice predominantly"
                ],
                "medical_terminology": [
                    "Minimize medical jargon",
                    "When medical terms are necessary, provide immediate explanation",
                    "Use parenthetical explanations: 'CT scan (special X-ray)'",
                    "Prefer common names over technical terms"
                ],
                "organization": [
                    "Use clear headings and bullet points",
                    "Present information in logical sequence",
                    "Use white space effectively",
                    "Highlight important information"
                ]
            },
            "intermediate": {
                "vocabulary": [
                    "Balance medical terms with explanations",
                    "Use moderately complex vocabulary appropriately",
                    "Provide context for medical concepts",
                    "Use transitional phrases for flow"
                ],
                "sentence_structure": [
                    "Use varied sentence lengths (15-25 words average)",
                    "Include some complex sentences with clear connections",
                    "Use coordination and subordination appropriately",
                    "Maintain clear subject-verb relationships"
                ],
                "medical_terminology": [
                    "Include relevant medical terms with explanations",
                    "Build medical vocabulary progressively",
                    "Use medical terms consistently once introduced",
                    "Provide context for understanding relationships"
                ],
                "organization": [
                    "Use hierarchical structure with subheadings",
                    "Group related information logically",
                    "Use connecting sentences between sections",
                    "Include summary points when helpful"
                ]
            },
            "advanced": {
                "vocabulary": [
                    "Use precise medical terminology appropriately",
                    "Include sophisticated vocabulary with context",
                    "Assume familiarity with basic medical concepts",
                    "Use technical terms when they enhance precision"
                ],
                "sentence_structure": [
                    "Use complex sentences with multiple clauses",
                    "Include detailed explanations and qualifications",
                    "Use sophisticated grammatical structures",
                    "Maintain clarity despite complexity"
                ],
                "medical_terminology": [
                    "Use standard medical terminology consistently",
                    "Provide detailed explanations of mechanisms",
                    "Include relevant pathophysiology when appropriate",
                    "Connect concepts to broader medical knowledge"
                ],
                "organization": [
                    "Use comprehensive structure with detailed sections",
                    "Include background information and context",
                    "Provide thorough explanations with supporting details",
                    "Use professional medical writing conventions"
                ]
            }
        }
        
        reading_level_info = {
            "basic": {
                "flesch_kincaid": "6-8 grade level",
                "avg_sentence_length": "10-15 words",
                "syllables_per_word": "1.3-1.5",
                "passive_voice": "< 10%"
            },
            "intermediate": {
                "flesch_kincaid": "9-12 grade level", 
                "avg_sentence_length": "15-20 words",
                "syllables_per_word": "1.5-1.8",
                "passive_voice": "< 20%"
            },
            "advanced": {
                "flesch_kincaid": "College level",
                "avg_sentence_length": "20-25 words",
                "syllables_per_word": "1.8-2.2",
                "passive_voice": "< 30%"
            }
        }
        
        logger.info(f"Returned complexity guidelines for level: {level}")
        return {
            "level": level,
            "guidelines": guidelines[level],
            "reading_level_metrics": reading_level_info[level],
            "quality_checklist": [
                "Content is medically accurate",
                "Language matches target complexity level",
                "Information is culturally appropriate",
                "Emergency conditions are clearly identified",
                "Next steps are actionable and clear",
                "Medical disclaimer is included"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complexity guidelines for {level}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")