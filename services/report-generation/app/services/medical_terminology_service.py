"""
Medical terminology validation and management service
"""

import logging
import re
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.medical_data import MedicalTerm, ICDCode, RadiologyFinding
from app.core.exceptions import MedicalTerminologyException, ICDCodeException

logger = logging.getLogger(__name__)


class MedicalTerminologyService:
    """Service for medical terminology validation and management"""
    
    def __init__(self):
        # Common German medical abbreviations
        self.abbreviations = {
            "KM": "Kontrastmittel",
            "i.v.": "intravenös",
            "a.p.": "anterior-posterior",
            "lat.": "lateral",
            "HU": "Hounsfield Units",
            "T1": "T1-gewichtet",
            "T2": "T2-gewichtet",
            "FLAIR": "Fluid Attenuated Inversion Recovery",
            "DWI": "Diffusion Weighted Imaging",
            "CT": "Computertomographie",
            "MRT": "Magnetresonanztomographie",
            "MRI": "Magnetic Resonance Imaging"
        }
        
        # Common anatomical terms
        self.anatomical_terms = {
            "kranial": "zum Kopf hin",
            "kaudal": "zum Schwanz hin",
            "ventral": "bauchwärts",
            "dorsal": "rückenwärts",
            "lateral": "seitlich",
            "medial": "zur Mitte hin",
            "proximal": "körpernah",
            "distal": "körperfern",
            "anterior": "vorn",
            "posterior": "hinten",
            "superior": "oben",
            "inferior": "unten"
        }
        
        # Medical finding patterns
        self.finding_patterns = {
            "normal": [
                "unauffällig", "regelrecht", "normal", "physiologisch",
                "keine pathologie", "kein hinweis", "ohne befund"
            ],
            "pathological": [
                "pathologisch", "auffällig", "verdächtig", "fraglich",
                "raumforderung", "läsion", "defekt", "deformität"
            ],
            "size_measurements": [
                r"\d+\s*mm", r"\d+\s*cm", r"\d+x\d+\s*mm",
                r"\d+x\d+x\d+\s*mm", r"\d+,\d+\s*cm"
            ]
        }
    
    async def validate_medical_terms(
        self,
        text: str,
        db: AsyncSession,
        examination_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate medical terminology in text"""
        
        try:
            # Normalize text
            normalized_text = self._normalize_text(text)
            
            # Extract potential medical terms
            terms = self._extract_medical_terms(normalized_text)
            
            # Validate terms against database
            validation_results = await self._validate_terms_in_db(terms, db, examination_type)
            
            # Check for common errors
            spelling_issues = self._check_spelling_issues(normalized_text)
            
            # Analyze terminology consistency
            consistency_score = self._analyze_terminology_consistency(normalized_text)
            
            return {
                "is_valid": len(validation_results["invalid_terms"]) == 0,
                "confidence_score": validation_results["confidence_score"],
                "valid_terms": validation_results["valid_terms"],
                "invalid_terms": validation_results["invalid_terms"],
                "suggestions": validation_results["suggestions"],
                "spelling_issues": spelling_issues,
                "consistency_score": consistency_score,
                "total_terms_checked": len(terms)
            }
            
        except Exception as e:
            logger.error(f"Error validating medical terms: {e}")
            raise MedicalTerminologyException(f"Terminology validation failed: {str(e)}")
    
    async def suggest_medical_terms(
        self,
        partial_term: str,
        db: AsyncSession,
        category: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Suggest medical terms based on partial input"""
        
        try:
            query = select(MedicalTerm).where(
                MedicalTerm.term_de.ilike(f"%{partial_term}%")
            )
            
            if category:
                query = query.where(MedicalTerm.category == category)
            
            query = query.order_by(MedicalTerm.usage_count.desc()).limit(limit)
            
            result = await db.execute(query)
            terms = result.scalars().all()
            
            suggestions = []
            for term in terms:
                suggestions.append({
                    "term_de": term.term_de,
                    "term_en": term.term_en,
                    "category": term.category,
                    "definition_de": term.definition_de,
                    "confidence": term.confidence_score,
                    "usage_count": term.usage_count
                })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error suggesting medical terms: {e}")
            return []
    
    async def validate_icd_codes(
        self,
        codes: List[str],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Validate ICD-10-GM codes"""
        
        try:
            valid_codes = []
            invalid_codes = []
            
            for code in codes:
                # Normalize code format
                normalized_code = self._normalize_icd_code(code)
                
                # Check in database
                query = select(ICDCode).where(ICDCode.code == normalized_code)
                result = await db.execute(query)
                icd_entry = result.scalar_one_or_none()
                
                if icd_entry:
                    valid_codes.append({
                        "code": icd_entry.code,
                        "description_de": icd_entry.description_de,
                        "is_billable": icd_entry.is_billable,
                        "radiology_relevance": icd_entry.radiology_relevance
                    })
                else:
                    # Try to find similar codes
                    similar_codes = await self._find_similar_icd_codes(normalized_code, db)
                    invalid_codes.append({
                        "code": code,
                        "normalized_code": normalized_code,
                        "similar_codes": similar_codes
                    })
            
            return {
                "is_valid": len(invalid_codes) == 0,
                "valid_codes": valid_codes,
                "invalid_codes": invalid_codes,
                "validation_summary": {
                    "total_codes": len(codes),
                    "valid_count": len(valid_codes),
                    "invalid_count": len(invalid_codes)
                }
            }
            
        except Exception as e:
            logger.error(f"Error validating ICD codes: {e}")
            raise ICDCodeException(f"ICD code validation failed: {str(e)}")
    
    async def suggest_icd_codes_for_findings(
        self,
        findings: str,
        examination_type: str,
        db: AsyncSession,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Suggest ICD codes based on radiological findings"""
        
        try:
            # Extract key terms from findings
            key_terms = self._extract_key_finding_terms(findings)
            
            # Find relevant radiology findings
            query = select(RadiologyFinding).where(
                RadiologyFinding.examination_type == examination_type
            )
            
            # Add text search conditions
            for term in key_terms:
                query = query.where(
                    RadiologyFinding.finding_name_de.ilike(f"%{term}%")
                )
            
            query = query.order_by(RadiologyFinding.frequency_score.desc()).limit(limit * 2)
            
            result = await db.execute(query)
            radiology_findings = result.scalars().all()
            
            # Get ICD codes from findings
            suggested_codes = []
            seen_codes = set()
            
            for finding in radiology_findings:
                if finding.related_icd_codes:
                    for icd_code in finding.related_icd_codes:
                        if icd_code not in seen_codes:
                            # Get full ICD code details
                            icd_query = select(ICDCode).where(ICDCode.code == icd_code)
                            icd_result = await db.execute(icd_query)
                            icd_entry = icd_result.scalar_one_or_none()
                            
                            if icd_entry:
                                suggested_codes.append({
                                    "code": icd_entry.code,
                                    "description_de": icd_entry.description_de,
                                    "radiology_relevance": icd_entry.radiology_relevance,
                                    "related_finding": finding.finding_name_de,
                                    "confidence": finding.accuracy_score
                                })
                                seen_codes.add(icd_code)
                                
                                if len(suggested_codes) >= limit:
                                    break
                
                if len(suggested_codes) >= limit:
                    break
            
            # Sort by relevance and confidence
            suggested_codes.sort(
                key=lambda x: (x["radiology_relevance"], x["confidence"]),
                reverse=True
            )
            
            return suggested_codes[:limit]
            
        except Exception as e:
            logger.error(f"Error suggesting ICD codes for findings: {e}")
            return []
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for terminology analysis"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Expand abbreviations
        for abbr, full_form in self.abbreviations.items():
            text = text.replace(abbr.lower(), full_form.lower())
        
        return text
    
    def _extract_medical_terms(self, text: str) -> List[str]:
        """Extract potential medical terms from text"""
        # Split text into words and phrases
        words = text.split()
        terms = []
        
        # Single words that might be medical terms
        for word in words:
            # Remove punctuation
            clean_word = re.sub(r'[^\w\-]', '', word)
            if len(clean_word) > 3:  # Only consider words longer than 3 characters
                terms.append(clean_word)
        
        # Two-word combinations
        for i in range(len(words) - 1):
            term = f"{words[i]} {words[i+1]}"
            clean_term = re.sub(r'[^\w\s\-]', '', term).strip()
            if len(clean_term) > 5:
                terms.append(clean_term)
        
        return list(set(terms))  # Remove duplicates
    
    async def _validate_terms_in_db(
        self,
        terms: List[str],
        db: AsyncSession,
        examination_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate terms against medical terms database"""
        
        valid_terms = []
        invalid_terms = []
        suggestions = []
        total_confidence = 0.0
        
        for term in terms:
            # Search for exact match
            query = select(MedicalTerm).where(
                func.lower(MedicalTerm.term_de) == term.lower()
            )
            
            result = await db.execute(query)
            medical_term = result.scalar_one_or_none()
            
            if medical_term:
                valid_terms.append({
                    "term": term,
                    "category": medical_term.category,
                    "confidence": medical_term.confidence_score
                })
                total_confidence += medical_term.confidence_score
            else:
                # Look for similar terms
                similar_query = select(MedicalTerm).where(
                    MedicalTerm.term_de.ilike(f"%{term}%")
                ).limit(3)
                
                similar_result = await db.execute(similar_query)
                similar_terms = similar_result.scalars().all()
                
                invalid_terms.append(term)
                
                if similar_terms:
                    for similar in similar_terms:
                        suggestions.append({
                            "original_term": term,
                            "suggested_term": similar.term_de,
                            "category": similar.category,
                            "confidence": similar.confidence_score
                        })
        
        confidence_score = total_confidence / len(terms) if terms else 0.0
        
        return {
            "valid_terms": valid_terms,
            "invalid_terms": invalid_terms,
            "suggestions": suggestions,
            "confidence_score": confidence_score
        }
    
    def _check_spelling_issues(self, text: str) -> List[Dict[str, str]]:
        """Check for common spelling issues in medical terms"""
        issues = []
        
        # Common misspellings in German medical terminology
        common_errors = {
            "kontrastmittel": "Kontrastmittel",
            "röntgen": "Röntgen",
            "computertomographie": "Computertomographie",
            "magnetresonanztomographie": "Magnetresonanztomographie",
            "pathologisch": "pathologisch",
            "physiologisch": "physiologisch"
        }
        
        text_lower = text.lower()
        for error, correct in common_errors.items():
            if error in text_lower and correct.lower() not in text_lower:
                issues.append({
                    "error": error,
                    "suggestion": correct,
                    "type": "spelling"
                })
        
        return issues
    
    def _analyze_terminology_consistency(self, text: str) -> float:
        """Analyze consistency of terminology usage"""
        # Check for consistent use of terms vs abbreviations
        consistency_score = 1.0
        
        # Check abbreviation consistency
        for abbr, full_form in self.abbreviations.items():
            abbr_count = text.lower().count(abbr.lower())
            full_count = text.lower().count(full_form.lower())
            
            if abbr_count > 0 and full_count > 0:
                # Mixed usage detected
                consistency_score -= 0.1
        
        return max(0.0, consistency_score)
    
    def _normalize_icd_code(self, code: str) -> str:
        """Normalize ICD code format"""
        # Remove spaces and convert to uppercase
        normalized = code.replace(" ", "").upper()
        
        # Ensure proper format (letter followed by numbers)
        if re.match(r'^[A-Z]\d{2}', normalized):
            return normalized
        
        return code  # Return original if format is unclear
    
    async def _find_similar_icd_codes(
        self,
        code: str,
        db: AsyncSession
    ) -> List[Dict[str, str]]:
        """Find similar ICD codes"""
        
        # Extract the base pattern (first 3 characters)
        if len(code) >= 3:
            base_pattern = code[:3]
            
            query = select(ICDCode).where(
                ICDCode.code.like(f"{base_pattern}%")
            ).limit(5)
            
            result = await db.execute(query)
            similar_codes = result.scalars().all()
            
            return [
                {
                    "code": similar.code,
                    "description_de": similar.description_de[:100] + "..." if len(similar.description_de) > 100 else similar.description_de
                }
                for similar in similar_codes
            ]
        
        return []
    
    def _extract_key_finding_terms(self, findings: str) -> List[str]:
        """Extract key terms from findings text for ICD code suggestion"""
        
        # Remove common non-specific words
        stop_words = {
            "der", "die", "das", "und", "oder", "in", "an", "auf", "mit",
            "von", "zu", "ist", "sind", "wird", "werden", "kann", "könnte",
            "zeigt", "zeigen", "sichtbar", "erkennbar", "dargestellt"
        }
        
        # Extract words
        words = re.findall(r'\w+', findings.lower())
        
        # Filter out stop words and short words
        key_terms = [
            word for word in words 
            if len(word) > 3 and word not in stop_words
        ]
        
        # Get most relevant terms (limit to avoid too broad search)
        return key_terms[:10]


# Global instance
medical_terminology_service = MedicalTerminologyService()