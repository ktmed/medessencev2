"""Medical terminology service for processing and translating medical terms."""

import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from app.data.medical_terms_de import GERMAN_MEDICAL_TERMS, GERMAN_ABBREVIATIONS, GERMAN_EMERGENCY_KEYWORDS
from app.data.medical_terms_en import ENGLISH_MEDICAL_TERMS, ENGLISH_ABBREVIATIONS, ENGLISH_EMERGENCY_KEYWORDS  
from app.data.medical_terms_fr import FRENCH_MEDICAL_TERMS, FRENCH_ABBREVIATIONS, FRENCH_EMERGENCY_KEYWORDS
from app.data.medical_terms_tr import TURKISH_MEDICAL_TERMS, TURKISH_ABBREVIATIONS, TURKISH_EMERGENCY_KEYWORDS
from app.core.exceptions import MedicalTerminologyException, EmergencyDetectionException

logger = logging.getLogger(__name__)

# Language-specific terminology mappings
LANGUAGE_TERMS = {
    "de": {
        "terms": GERMAN_MEDICAL_TERMS,
        "abbreviations": GERMAN_ABBREVIATIONS,
        "emergency_keywords": GERMAN_EMERGENCY_KEYWORDS
    },
    "en": {
        "terms": ENGLISH_MEDICAL_TERMS,
        "abbreviations": ENGLISH_ABBREVIATIONS,
        "emergency_keywords": ENGLISH_EMERGENCY_KEYWORDS
    },
    "fr": {
        "terms": FRENCH_MEDICAL_TERMS,
        "abbreviations": FRENCH_ABBREVIATIONS,
        "emergency_keywords": FRENCH_EMERGENCY_KEYWORDS
    },
    "tr": {
        "terms": TURKISH_MEDICAL_TERMS,
        "abbreviations": TURKISH_ABBREVIATIONS,
        "emergency_keywords": TURKISH_EMERGENCY_KEYWORDS
    }
}


class MedicalTerminologyService:
    """Service for medical terminology processing and translation."""
    
    def __init__(self):
        """Initialize the medical terminology service."""
        self.supported_languages = list(LANGUAGE_TERMS.keys())
    
    def extract_medical_terms(self, text: str, source_language: str = "de") -> List[Dict[str, Any]]:
        """Extract medical terms from text."""
        try:
            if source_language not in self.supported_languages:
                raise MedicalTerminologyException(f"Unsupported source language: {source_language}")
            
            terms_data = LANGUAGE_TERMS[source_language]
            found_terms = []
            
            # Extract medical terms
            for term, term_info in terms_data["terms"].items():
                if self._find_term_in_text(term, text):
                    found_terms.append({
                        "original_term": term,
                        "category": term_info.get("category", "general"),
                        "simple": term_info.get("simple", term),
                        "definitions": {
                            "basic": term_info.get("basic", ""),
                            "intermediate": term_info.get("intermediate", ""),
                            "advanced": term_info.get("advanced", "")
                        }
                    })
            
            # Extract abbreviations
            for abbrev, abbrev_info in terms_data["abbreviations"].items():
                if self._find_term_in_text(abbrev, text):
                    found_terms.append({
                        "original_term": abbrev,
                        "category": "abbreviation",
                        "full_form": abbrev_info.get("full_form", ""),
                        "simple": abbrev_info.get("explanation", ""),
                        "specialty": abbrev_info.get("specialty", "")
                    })
            
            logger.info(f"Extracted {len(found_terms)} medical terms from text")
            return found_terms
            
        except Exception as e:
            logger.error(f"Error extracting medical terms: {e}")
            raise MedicalTerminologyException(f"Failed to extract medical terms: {str(e)}")
    
    def translate_terms(
        self,
        terms: List[str],
        source_language: str = "de",
        target_language: str = "en",
        complexity_level: str = "basic"
    ) -> Dict[str, Dict[str, str]]:
        """Translate medical terms between languages."""
        try:
            if source_language not in self.supported_languages:
                raise MedicalTerminologyException(f"Unsupported source language: {source_language}")
            
            if target_language not in self.supported_languages:
                raise MedicalTerminologyException(f"Unsupported target language: {target_language}")
            
            source_terms = LANGUAGE_TERMS[source_language]["terms"]
            target_terms = LANGUAGE_TERMS[target_language]["terms"]
            
            translations = {}
            
            for term in terms:
                # Try direct lookup first
                if term in source_terms:
                    source_info = source_terms[term]
                    # Find equivalent in target language by category
                    translation = self._find_equivalent_term(source_info, target_terms, complexity_level)
                    if translation:
                        translations[term] = translation
                else:
                    # Try fuzzy matching
                    fuzzy_match = self._fuzzy_match_term(term, source_terms)
                    if fuzzy_match:
                        translation = self._find_equivalent_term(fuzzy_match, target_terms, complexity_level)
                        if translation:
                            translations[term] = translation
            
            logger.info(f"Translated {len(translations)} terms from {source_language} to {target_language}")
            return translations
            
        except Exception as e:
            logger.error(f"Error translating terms: {e}")
            raise MedicalTerminologyException(f"Failed to translate terms: {str(e)}")
    
    def simplify_text(
        self,
        text: str,
        source_language: str = "de",
        target_language: str = "en", 
        complexity_level: str = "basic"
    ) -> str:
        """Simplify medical text by replacing complex terms with patient-friendly alternatives."""
        try:
            if source_language not in self.supported_languages:
                return text  # Return original if language not supported
            
            terms_data = LANGUAGE_TERMS[source_language]
            target_terms_data = LANGUAGE_TERMS.get(target_language, terms_data)
            
            simplified_text = text
            replacements_made = []
            
            # Replace medical terms
            for term, term_info in terms_data["terms"].items():
                if self._find_term_in_text(term, simplified_text):
                    # Get appropriate complexity level explanation
                    replacement = term_info.get(complexity_level, term_info.get("simple", term))
                    
                    # If translating to different language, try to find equivalent
                    if target_language != source_language:
                        target_equivalent = self._find_equivalent_term(
                            term_info, target_terms_data["terms"], complexity_level
                        )
                        if target_equivalent:
                            replacement = target_equivalent.get("explanation", replacement)
                    
                    simplified_text = simplified_text.replace(term, replacement)
                    replacements_made.append({"original": term, "replacement": replacement})
            
            # Replace abbreviations
            for abbrev, abbrev_info in terms_data["abbreviations"].items():
                if self._find_term_in_text(abbrev, simplified_text):
                    replacement = f"{abbrev_info.get('explanation', abbrev)} ({abbrev})"
                    simplified_text = simplified_text.replace(abbrev, replacement)
                    replacements_made.append({"original": abbrev, "replacement": replacement})
            
            logger.info(f"Made {len(replacements_made)} term replacements in text simplification")
            return simplified_text
            
        except Exception as e:
            logger.error(f"Error simplifying text: {e}")
            raise MedicalTerminologyException(f"Failed to simplify text: {str(e)}")
    
    def detect_emergency_conditions(self, text: str, language: str = "de") -> List[Dict[str, Any]]:
        """Detect emergency conditions mentioned in text."""
        try:
            if language not in self.supported_languages:
                logger.warning(f"Emergency detection not available for language: {language}")
                return []
            
            emergency_keywords = LANGUAGE_TERMS[language]["emergency_keywords"]
            detected_emergencies = []
            
            for keyword, emergency_info in emergency_keywords.items():
                if self._find_term_in_text(keyword, text):
                    detected_emergencies.append({
                        "keyword": keyword,
                        "urgency_level": emergency_info.get("urgency_level", "medium"),
                        "emergency_type": emergency_info.get("emergency_type", "general"),
                        "patient_warning": emergency_info.get("patient_warning", ""),
                        "immediate_actions": emergency_info.get("immediate_actions", []),
                        "when_to_seek_help": emergency_info.get("when_to_seek_help", ""),
                        "confidence_score": self._calculate_emergency_confidence(keyword, text)
                    })
            
            # Sort by urgency level
            urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            detected_emergencies.sort(key=lambda x: urgency_order.get(x["urgency_level"], 3))
            
            logger.info(f"Detected {len(detected_emergencies)} emergency conditions in text")
            return detected_emergencies
            
        except Exception as e:
            logger.error(f"Error detecting emergency conditions: {e}")
            raise EmergencyDetectionException(f"Failed to detect emergency conditions: {str(e)}")
    
    def create_glossary(
        self,
        terms: List[str],
        language: str = "de",
        complexity_level: str = "basic"
    ) -> List[Dict[str, str]]:
        """Create a patient-friendly glossary for medical terms."""
        try:
            if language not in self.supported_languages:
                raise MedicalTerminologyException(f"Unsupported language for glossary: {language}")
            
            terms_data = LANGUAGE_TERMS[language]
            glossary = []
            
            for term in terms:
                # Check in medical terms
                if term in terms_data["terms"]:
                    term_info = terms_data["terms"][term]
                    glossary.append({
                        "term": term,
                        "definition": term_info.get(complexity_level, term_info.get("basic", "")),
                        "category": term_info.get("category", "general")
                    })
                
                # Check in abbreviations
                elif term in terms_data["abbreviations"]:
                    abbrev_info = terms_data["abbreviations"][term]
                    glossary.append({
                        "term": term,
                        "definition": f"{abbrev_info.get('full_form', '')} - {abbrev_info.get('explanation', '')}",
                        "category": "abbreviation"
                    })
            
            # Remove duplicates and sort
            seen_terms = set()
            unique_glossary = []
            for entry in glossary:
                if entry["term"] not in seen_terms:
                    unique_glossary.append(entry)
                    seen_terms.add(entry["term"])
            
            unique_glossary.sort(key=lambda x: x["term"])
            
            logger.info(f"Created glossary with {len(unique_glossary)} terms")
            return unique_glossary
            
        except Exception as e:
            logger.error(f"Error creating glossary: {e}")
            raise MedicalTerminologyException(f"Failed to create glossary: {str(e)}")
    
    def get_term_categories(self, language: str = "de") -> Dict[str, List[str]]:
        """Get medical terms organized by category."""
        try:
            if language not in self.supported_languages:
                raise MedicalTerminologyException(f"Unsupported language: {language}")
            
            terms_data = LANGUAGE_TERMS[language]["terms"]
            categories = defaultdict(list)
            
            for term, term_info in terms_data.items():
                category = term_info.get("category", "general")
                categories[category].append(term)
            
            return dict(categories)
            
        except Exception as e:
            logger.error(f"Error getting term categories: {e}")
            raise MedicalTerminologyException(f"Failed to get term categories: {str(e)}")
    
    # Private helper methods
    
    def _find_term_in_text(self, term: str, text: str) -> bool:
        """Find if term exists in text (case-insensitive, word boundary)."""
        pattern = r'\b' + re.escape(term) + r'\b'
        return bool(re.search(pattern, text, re.IGNORECASE))
    
    def _fuzzy_match_term(self, term: str, terms_dict: Dict) -> Optional[Dict]:
        """Find fuzzy match for term in dictionary."""
        term_lower = term.lower()
        
        # Try exact match first
        for dict_term, term_info in terms_dict.items():
            if dict_term.lower() == term_lower:
                return term_info
        
        # Try partial match
        for dict_term, term_info in terms_dict.items():
            if term_lower in dict_term.lower() or dict_term.lower() in term_lower:
                return term_info
        
        return None
    
    def _find_equivalent_term(
        self,
        source_term_info: Dict,
        target_terms: Dict,
        complexity_level: str
    ) -> Optional[Dict]:
        """Find equivalent term in target language."""
        source_category = source_term_info.get("category", "general")
        
        # Look for terms in same category
        for term, term_info in target_terms.items():
            if term_info.get("category") == source_category:
                return {
                    "term": term,
                    "explanation": term_info.get(complexity_level, term_info.get("basic", term)),
                    "category": source_category
                }
        
        return None
    
    def _calculate_emergency_confidence(self, keyword: str, text: str) -> float:
        """Calculate confidence score for emergency detection."""
        # Simple confidence based on context and keyword clarity
        base_confidence = 0.7
        
        # Increase confidence if keyword appears multiple times
        occurrences = len(re.findall(re.escape(keyword), text, re.IGNORECASE))
        if occurrences > 1:
            base_confidence += 0.1
        
        # Increase confidence if found with other relevant keywords
        relevant_context = ["sofort", "notfall", "akut", "dringend", "critical", "urgent", "emergency"]
        context_words = sum(1 for word in relevant_context if word.lower() in text.lower())
        base_confidence += min(context_words * 0.05, 0.2)
        
        return min(base_confidence, 1.0)