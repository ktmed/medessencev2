"""
Medical terminology processor for transcription enhancement
Handles medical term recognition, correction, and context-aware processing
"""

import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

from fuzzywuzzy import fuzz, process
from Levenshtein import distance as levenshtein_distance

from config import Config, config

logger = logging.getLogger(__name__)

try:
    from utils.german_medical_vocabulary import german_medical_vocabulary
    GERMAN_VOCAB_AVAILABLE = True
except ImportError:
    GERMAN_VOCAB_AVAILABLE = False
    logger.warning("German medical vocabulary not available")

class MedicalTerminologyProcessor:
    """Processes and enhances medical terminology in transcriptions"""
    
    def __init__(self):
        self.medical_dictionaries: Dict[str, Dict] = {}
        self.correction_cache: Dict[str, str] = {}
        self.common_errors: Dict[str, Dict[str, str]] = {}
        self.medical_abbreviations: Dict[str, Dict[str, str]] = {}
        
        # Load dictionaries
        asyncio.create_task(self._load_dictionaries())
    
    async def _load_dictionaries(self):
        """Load medical dictionaries for different languages"""
        try:
            logger.info("Loading medical dictionaries...")
            
            # Create dictionaries if they don't exist
            await self._create_default_dictionaries()
            
            # Load existing dictionaries
            dict_path = config.medical_dict_path_obj
            if dict_path.exists():
                for lang_file in dict_path.glob("*.json"):
                    lang_code = lang_file.stem
                    try:
                        with open(lang_file, 'r', encoding='utf-8') as f:
                            self.medical_dictionaries[lang_code] = json.load(f)
                        logger.info(f"Loaded medical dictionary for {lang_code}")
                    except Exception as e:
                        logger.error(f"Failed to load dictionary for {lang_code}: {e}")
            
            logger.info(f"Loaded {len(self.medical_dictionaries)} medical dictionaries")
            
        except Exception as e:
            logger.error(f"Failed to load medical dictionaries: {e}")
            # Create minimal fallback dictionaries
            await self._create_minimal_dictionaries()
    
    async def _create_default_dictionaries(self):
        """Create default medical dictionaries"""
        try:
            dict_path = config.medical_dict_path_obj
            dict_path.mkdir(parents=True, exist_ok=True)
            
            # English medical dictionary
            en_dict = await self._create_english_medical_dict()
            with open(dict_path / "en.json", 'w', encoding='utf-8') as f:
                json.dump(en_dict, f, indent=2, ensure_ascii=False)
            
            # German medical dictionary
            de_dict = await self._create_german_medical_dict()
            with open(dict_path / "de.json", 'w', encoding='utf-8') as f:
                json.dump(de_dict, f, indent=2, ensure_ascii=False)
            
            # Common medical abbreviations
            abbrev_dict = await self._create_abbreviations_dict()
            with open(dict_path / "abbreviations.json", 'w', encoding='utf-8') as f:
                json.dump(abbrev_dict, f, indent=2, ensure_ascii=False)
            
            logger.info("Created default medical dictionaries")
            
        except Exception as e:
            logger.error(f"Failed to create default dictionaries: {e}")
    
    async def _create_english_medical_dict(self) -> Dict:
        """Create English medical dictionary"""
        return {
            "terms": {
                # Radiology terms
                "ct": "CT",
                "mri": "MRI",
                "x-ray": "X-ray",
                "ultrasound": "ultrasound",
                "mammography": "mammography",
                "angiography": "angiography",
                "tomography": "tomography",
                "radiography": "radiography",
                "fluoroscopy": "fluoroscopy",
                "arthrography": "arthrography",
                
                # Anatomical terms
                "thorax": "thorax",
                "abdomen": "abdomen",
                "pelvis": "pelvis",
                "cranium": "cranium",
                "spine": "spine",
                "vertebrae": "vertebrae",
                "ribs": "ribs",
                "sternum": "sternum",
                "clavicle": "clavicle",
                "scapula": "scapula",
                "humerus": "humerus",
                "radius": "radius",
                "ulna": "ulna",
                "femur": "femur",
                "tibia": "tibia",
                "fibula": "fibula",
                
                # Medical conditions
                "pneumonia": "pneumonia",
                "fracture": "fracture",
                "contusion": "contusion",
                "laceration": "laceration",
                "hematoma": "hematoma",
                "edema": "edema",
                "inflammation": "inflammation",
                "neoplasm": "neoplasm",
                "carcinoma": "carcinoma",
                "sarcoma": "sarcoma",
                "lymphoma": "lymphoma",
                "metastasis": "metastasis",
                
                # Procedures
                "biopsy": "biopsy",
                "excision": "excision",
                "resection": "resection",
                "anastomosis": "anastomosis",
                "catheterization": "catheterization",
                "intubation": "intubation",
                "ventilation": "ventilation",
                "dialysis": "dialysis"
            },
            "corrections": {
                # Common misheard terms
                "cat scan": "CT scan",
                "m r i": "MRI",
                "x ray": "X-ray",
                "cat": "CT",
                "pneumonea": "pneumonia",
                "new monia": "pneumonia",
                "fraccher": "fracture",
                "hemotoma": "hematoma",
                "edima": "edema",
                "inflameation": "inflammation"
            },
            "patterns": [
                # Measurement patterns
                r"\b(\d+(?:\.\d+)?)\s*(mm|cm|m)\b",
                r"\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b",
                # Medical reference patterns
                r"\bT\d+\b",  # Vertebrae
                r"\bL\d+\b",  # Lumbar vertebrae
                r"\bC\d+\b",  # Cervical vertebrae
                r"\bHU\b",    # Hounsfield units
            ]
        }
    
    async def _create_german_medical_dict(self) -> Dict:
        """Create German medical dictionary"""
        return {
            "terms": {
                # Radiologie Begriffe
                "computertomographie": "Computertomographie",
                "magnetresonanztomographie": "Magnetresonanztomographie",
                "röntgen": "Röntgen",
                "ultraschall": "Ultraschall",
                "mammographie": "Mammographie",
                "angiographie": "Angiographie",
                "tomographie": "Tomographie",
                "radiographie": "Radiographie",
                "durchleuchtung": "Durchleuchtung",
                
                # Anatomische Begriffe
                "thorax": "Thorax",
                "brustkorb": "Brustkorb",
                "abdomen": "Abdomen",
                "bauchraum": "Bauchraum",
                "becken": "Becken",
                "schädel": "Schädel",
                "wirbelsäule": "Wirbelsäule",
                "wirbel": "Wirbel",
                "rippen": "Rippen",
                "brustbein": "Brustbein",
                "schlüsselbein": "Schlüsselbein",
                "schulterblatt": "Schulterblatt",
                "oberarmknochen": "Oberarmknochen",
                "speiche": "Speiche",
                "elle": "Elle",
                "oberschenkelknochen": "Oberschenkelknochen",
                "schienbein": "Schienbein",
                "wadenbein": "Wadenbein",
                
                # Medizinische Zustände
                "lungenentzündung": "Lungenentzündung",
                "pneumonie": "Pneumonie",
                "bruch": "Bruch",
                "fraktur": "Fraktur",
                "prellung": "Prellung",
                "riss": "Riss",
                "bluterguss": "Bluterguss",
                "hämatom": "Hämatom",
                "schwellung": "Schwellung",
                "ödem": "Ödem",
                "entzündung": "Entzündung",
                "tumor": "Tumor",
                "geschwulst": "Geschwulst",
                "karzinom": "Karzinom",
                "sarkom": "Sarkom",
                "lymphom": "Lymphom",
                "metastase": "Metastase",
                
                # Verfahren
                "biopsie": "Biopsie",
                "entfernung": "Entfernung",
                "resektion": "Resektion",
                "katheterisierung": "Katheterisierung",
                "intubation": "Intubation",
                "beatmung": "Beatmung",
                "dialyse": "Dialyse"
            },
            "corrections": {
                # Häufige Hörfehler
                "cat": "CT",
                "emmert": "MRT",
                "emmert i": "MRI",
                "rentgen": "Röntgen",
                "pneumonee": "Pneumonie",
                "fracktoor": "Fraktur",
                "hematoom": "Hämatom",
                "oedem": "Ödem"
            },
            "patterns": [
                # Messungspatterns
                r"\b(\d+(?:\.\d+)?)\s*(mm|cm|m)\b",
                r"\b(\d+(?:\.\d+)?)\s*mal\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b",
                # Medizinische Referenzpatterns
                r"\bBWK\s*\d+\b",  # Brustwirbelkörper
                r"\bLWK\s*\d+\b",  # Lendenwirbelkörper
                r"\bHWK\s*\d+\b",  # Halswirbelkörper
                r"\bHE\b",         # Hounsfield-Einheiten
            ]
        }
    
    async def _create_abbreviations_dict(self) -> Dict:
        """Create medical abbreviations dictionary"""
        return {
            "en": {
                "CT": "computed tomography",
                "MRI": "magnetic resonance imaging",
                "US": "ultrasound",
                "XR": "X-ray",
                "AP": "anteroposterior",
                "PA": "posteroanterior",
                "LAT": "lateral",
                "LAO": "left anterior oblique",
                "RAO": "right anterior oblique",
                "LPO": "left posterior oblique",
                "RPO": "right posterior oblique",
                "IV": "intravenous",
                "PO": "per os",
                "IM": "intramuscular",
                "SC": "subcutaneous",
                "ICU": "intensive care unit",
                "ER": "emergency room",
                "OR": "operating room",
                "dx": "diagnosis",
                "tx": "treatment",
                "hx": "history",
                "fx": "fracture",
                "abd": "abdomen",
                "ext": "extremity",
                "bilat": "bilateral",
                "unilat": "unilateral"
            },
            "de": {
                "CT": "Computertomographie",
                "MRT": "Magnetresonanztomographie",
                "US": "Ultraschall",
                "RÖ": "Röntgen",
                "AP": "anterior-posterior",
                "PA": "posterior-anterior",
                "LAT": "lateral",
                "IV": "intravenös",
                "PO": "per os",
                "IM": "intramuskulär",
                "SC": "subkutan",
                "ITS": "Intensivstation",
                "NA": "Notaufnahme",
                "OP": "Operation",
                "DG": "Diagnose",
                "TH": "Therapie",
                "AN": "Anamnese",
                "FX": "Fraktur",
                "ABD": "Abdomen",
                "EXT": "Extremität",
                "BILAT": "bilateral",
                "UNILAT": "unilateral"
            }
        }
    
    async def _create_minimal_dictionaries(self):
        """Create minimal fallback dictionaries"""
        self.medical_dictionaries = {
            "en": {
                "terms": {"ct": "CT", "mri": "MRI", "x-ray": "X-ray"},
                "corrections": {"cat": "CT"},
                "patterns": []
            },
            "de": {
                "terms": {"ct": "CT", "mrt": "MRT"},
                "corrections": {"cat": "CT"},
                "patterns": []
            }
        }
    
    async def process_text(self, text: str, language: str = "en") -> Tuple[str, List[str]]:
        """
        Process transcribed text to enhance medical terminology
        
        Args:
            text: Transcribed text
            language: Language code
            
        Returns:
            Tuple of (enhanced_text, found_medical_terms)
        """
        try:
            if not text.strip():
                return text, []
            
            # Get language dictionary
            lang_dict = self.medical_dictionaries.get(language, self.medical_dictionaries.get("en", {}))
            if not lang_dict:
                return text, []
            
            enhanced_text = text
            found_medical_terms = []
            
            # Apply German medical vocabulary if available and language is German
            if GERMAN_VOCAB_AVAILABLE and language == "de":
                enhanced_text = german_medical_vocabulary.correct_text(enhanced_text)
                # Extract entities
                entities = german_medical_vocabulary.get_medical_entities(enhanced_text)
                found_medical_terms.extend([entity[0] for entity in entities])
            
            # Apply corrections
            enhanced_text = await self._apply_corrections(enhanced_text, lang_dict)
            
            # Enhance medical terms
            enhanced_text, terms = await self._enhance_medical_terms(enhanced_text, lang_dict)
            found_medical_terms.extend(terms)
            
            # Expand abbreviations
            enhanced_text = await self._expand_abbreviations(enhanced_text, language)
            
            # Apply medical patterns
            enhanced_text = await self._apply_medical_patterns(enhanced_text, lang_dict)
            
            # Clean up text
            enhanced_text = await self._clean_text(enhanced_text)
            
            return enhanced_text, list(set(found_medical_terms))
            
        except Exception as e:
            logger.error(f"Error processing medical text: {e}")
            return text, []
    
    async def _apply_corrections(self, text: str, lang_dict: Dict) -> str:
        """Apply common medical term corrections"""
        corrections = lang_dict.get("corrections", {})
        
        for incorrect, correct in corrections.items():
            # Case-insensitive replacement with word boundaries
            pattern = r'\b' + re.escape(incorrect) + r'\b'
            text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
        
        return text
    
    async def _enhance_medical_terms(self, text: str, lang_dict: Dict) -> Tuple[str, List[str]]:
        """Enhance medical terminology with proper capitalization and spelling"""
        terms = lang_dict.get("terms", {})
        found_terms = []
        
        words = text.split()
        enhanced_words = []
        
        for word in words:
            cleaned_word = re.sub(r'[^\w\s-]', '', word.lower())
            
            # Direct match
            if cleaned_word in terms:
                enhanced_words.append(word.replace(cleaned_word, terms[cleaned_word], 1))
                found_terms.append(terms[cleaned_word])
            # Fuzzy match for medical terms
            else:
                best_match = await self._find_fuzzy_match(cleaned_word, terms)
                if best_match:
                    enhanced_words.append(word.replace(cleaned_word, best_match, 1))
                    found_terms.append(best_match)
                else:
                    enhanced_words.append(word)
        
        return " ".join(enhanced_words), found_terms
    
    async def _find_fuzzy_match(self, word: str, terms: Dict[str, str], threshold: int = 85) -> str:
        """Find fuzzy match for medical terms"""
        if len(word) < 3:  # Skip very short words
            return None
        
        # Check cache first
        cache_key = f"{word}_{threshold}"
        if cache_key in self.correction_cache:
            return self.correction_cache[cache_key]
        
        # Find best match
        matches = process.extractBests(word, terms.keys(), limit=3, score_cutoff=threshold)
        
        if matches:
            best_match = matches[0][0]
            corrected_term = terms[best_match]
            
            # Cache the result
            self.correction_cache[cache_key] = corrected_term
            
            return corrected_term
        
        return None
    
    async def _expand_abbreviations(self, text: str, language: str) -> str:
        """Expand medical abbreviations"""
        abbrev_dict = self.medical_abbreviations.get(language, {})
        
        if not abbrev_dict:
            # Load from file if not in memory
            try:
                abbrev_path = config.medical_dict_path_obj / "abbreviations.json"
                if abbrev_path.exists():
                    with open(abbrev_path, 'r', encoding='utf-8') as f:
                        all_abbrevs = json.load(f)
                        abbrev_dict = all_abbrevs.get(language, {})
                        self.medical_abbreviations[language] = abbrev_dict
            except Exception as e:
                logger.warning(f"Failed to load abbreviations: {e}")
        
        for abbrev, expansion in abbrev_dict.items():
            # Replace standalone abbreviations
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            text = re.sub(pattern, f"{abbrev} ({expansion})", text)
        
        return text
    
    async def _apply_medical_patterns(self, text: str, lang_dict: Dict) -> str:
        """Apply medical-specific patterns and formatting"""
        patterns = lang_dict.get("patterns", [])
        
        for pattern in patterns:
            try:
                # Apply pattern-specific formatting
                if "mm|cm|m" in pattern:
                    # Standardize measurements
                    text = re.sub(pattern, self._format_measurement, text)
                elif r"\bT\d+\b" in pattern or r"\bL\d+\b" in pattern or r"\bC\d+\b" in pattern:
                    # Format vertebrae references
                    text = re.sub(pattern, self._format_vertebrae, text)
            except Exception as e:
                logger.warning(f"Failed to apply pattern {pattern}: {e}")
        
        return text
    
    def _format_measurement(self, match) -> str:
        """Format measurement matches"""
        return match.group(0)  # For now, just return as-is
    
    def _format_vertebrae(self, match) -> str:
        """Format vertebrae references"""
        return match.group(0)  # For now, just return as-is
    
    async def _clean_text(self, text: str) -> str:
        """Clean and format the text"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Fix punctuation spacing
        text = re.sub(r'\s+([.,;:!?])', r'\1', text)
        text = re.sub(r'([.,;:!?])\s*([A-Z])', r'\1 \2', text)
        
        # Capitalize sentences
        sentences = text.split('. ')
        capitalized_sentences = []
        
        for sentence in sentences:
            if sentence:
                capitalized_sentence = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
                capitalized_sentences.append(capitalized_sentence)
        
        return '. '.join(capitalized_sentences).strip()
    
    def get_medical_context_score(self, text: str, language: str = "en") -> float:
        """Calculate medical context confidence score"""
        try:
            if not text:
                return 0.0
            
            lang_dict = self.medical_dictionaries.get(language, {})
            medical_terms = lang_dict.get("terms", {})
            
            # Count medical terms in text
            words = text.lower().split()
            medical_word_count = 0
            
            for word in words:
                cleaned_word = re.sub(r'[^\w\s-]', '', word)
                if cleaned_word in medical_terms:
                    medical_word_count += 1
            
            # Calculate ratio
            if len(words) == 0:
                return 0.0
            
            medical_ratio = medical_word_count / len(words)
            
            # Apply bonus for common medical patterns
            pattern_bonus = 0.0
            medical_patterns = [
                r'\b(patient|diagnosis|treatment|procedure|examination)\b',
                r'\b\d+\s*(mm|cm|m|kg|g|ml|l)\b',
                r'\b(left|right|bilateral|anterior|posterior|superior|inferior)\b'
            ]
            
            for pattern in medical_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    pattern_bonus += 0.1
            
            return min(1.0, medical_ratio * 5 + pattern_bonus)  # Scale and cap at 1.0
            
        except Exception as e:
            logger.error(f"Error calculating medical context score: {e}")
            return 0.0
    
    async def get_suggestions(self, text: str, language: str = "en") -> List[Dict]:
        """Get suggestions for improving medical terminology"""
        suggestions = []
        
        try:
            lang_dict = self.medical_dictionaries.get(language, {})
            terms = lang_dict.get("terms", {})
            
            words = text.split()
            
            for i, word in enumerate(words):
                cleaned_word = re.sub(r'[^\w\s-]', '', word.lower())
                
                if len(cleaned_word) > 2:  # Skip short words
                    # Find potential corrections
                    matches = process.extractBests(cleaned_word, terms.keys(), limit=3, score_cutoff=70)
                    
                    if matches and matches[0][1] < 95:  # Not an exact match
                        suggestions.append({
                            "position": i,
                            "original": word,
                            "suggestions": [terms[match[0]] for match in matches[:3]],
                            "confidence": matches[0][1] / 100.0
                        })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error generating suggestions: {e}")
            return []