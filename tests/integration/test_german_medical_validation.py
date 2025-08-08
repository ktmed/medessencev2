#!/usr/bin/env python3
"""
German Medical Terminology and Structure Validation Tests.

This script validates German medical terminology, report structure, and
compliance with German medical standards in the radiology AI system.
"""

import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Set, Tuple
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GermanMedicalValidator:
    """Validate German medical terminology and report structure."""
    
    def __init__(self, test_data_path: str = "test_data"):
        self.test_data_path = Path(test_data_path)
        self.sample_data = {}
        self.validation_results = []
        
        # German medical terminology database
        self.german_medical_terms = self._load_german_medical_terms()
        self.radiology_terms = self._load_radiology_terms()
        self.anatomy_terms = self._load_anatomy_terms()
        self.pathology_terms = self._load_pathology_terms()
        
        # German medical report structure patterns
        self.report_structure_patterns = self._define_report_structure_patterns()
        
        # ICD-10-GM codes (German version)
        self.icd_patterns = self._define_icd_patterns()
    
    def _load_german_medical_terms(self) -> Set[str]:
        """Load German medical terminology."""
        return {
            # General medical terms
            "patient", "patientin", "befund", "diagnose", "untersuchung", "behandlung",
            "therapie", "medikament", "symptom", "krankheit", "gesundheit", "arzt", 
            "ärztin", "klinik", "krankenhaus", "praxis",
            
            # Medical procedures
            "operation", "eingriff", "biopsie", "punktion", "injektion", "infusion",
            "narkose", "betäubung", "anästhesie",
            
            # Medical conditions
            "entzündung", "infektion", "tumor", "krebs", "karzinom", "metastase",
            "stenose", "okklusion", "thrombose", "embolie", "ischämie",
            
            # Body systems
            "herz", "lunge", "leber", "niere", "gehirn", "wirbelsäule", "knochen",
            "muskel", "gelenk", "band", "sehne", "nerv", "gefäß", "arterie", "vene",
            
            # Medical adjectives
            "akut", "chronisch", "benign", "malign", "pathologisch", "physiologisch",
            "normal", "abnormal", "unauffällig", "auffällig", "vergrößert", "verkleinert"
        }
    
    def _load_radiology_terms(self) -> Set[str]:
        """Load German radiology-specific terminology."""
        return {
            # Imaging modalities
            "röntgen", "computertomographie", "magnetresonanztomographie", "kernspintomographie",
            "ultraschall", "sonographie", "mammographie", "szintigraphie", "pet", "spect",
            "mrt", "mri", "ct", "sono",
            
            # Imaging terms
            "aufnahme", "bildgebung", "schnittbild", "schicht", "projektion", "ebene",
            "kontrast", "kontrastmittel", "nativ", "darstellung", "abbildung",
            "auflösung", "qualität", "artefakt",
            
            # Anatomical directions
            "kranial", "kaudal", "ventral", "dorsal", "lateral", "medial", "proximal", "distal",
            "anterior", "posterior", "superior", "inferior", "rechts", "links", "beidseits",
            
            # Image findings
            "dichte", "signal", "intensität", "enhancement", "anreicherung", "perfusion",
            "diffusion", "flussleer", "hypodense", "hyperdense", "hyperintense", "hypointense",
            
            # Technical parameters
            "tesla", "kilovolt", "milliampere", "schichtdicke", "kollimation", "fov",
            "matrix", "pixel", "voxel", "fenster", "level"
        }
    
    def _load_anatomy_terms(self) -> Set[str]:
        """Load German anatomical terminology."""
        return {
            # Spine and skeletal
            "wirbelsäule", "halswirbelsäule", "brustwirbelsäule", "lendenwirbelsäule",
            "sakrum", "steißbein", "wirbelkörper", "bandscheibe", "spinalkanal",
            "neuroforamen", "facettengelenk", "ligament", "ligamentum",
            
            # Spine abbreviations
            "hws", "bws", "lws", "swk", "lwk", "bwk", "hwk",
            
            # Brain and nervous system
            "gehirn", "großhirn", "kleinhirn", "hirnstamm", "ventral", "frontal", "parietal",
            "temporal", "okzipital", "cerebellum", "thalamus", "basalganglien",
            
            # Chest and cardiovascular
            "thorax", "lunge", "herz", "aorta", "pulmonalarterie", "vena cava",
            "mediastinum", "pleura", "perikard", "myokard", "endokard",
            
            # Abdomen
            "abdomen", "leber", "gallenblase", "pankreas", "milz", "niere", "nebenniere",
            "darm", "magen", "duodenum", "jejunum", "ileum", "kolon", "rektum",
            
            # Pelvis and reproductive
            "becken", "blase", "prostata", "uterus", "ovar", "adnexe",
            
            # Musculoskeletal
            "muskel", "sehne", "band", "knochen", "gelenk", "knorpel", "meniskus",
            "bursa", "synovialis"
        }
    
    def _load_pathology_terms(self) -> Set[str]:
        """Load German pathology terminology."""
        return {
            # General pathology
            "läsion", "raumforderung", "masse", "tumor", "neoplasma", "proliferation",
            "degeneration", "nekrose", "fibrose", "sklerose", "atrophie", "hypertrophie",
            
            # Inflammatory conditions
            "entzündung", "arthritis", "tendinitis", "bursitis", "myositis", "neuritis",
            "dermatitis", "kolitis", "gastritis", "hepatitis", "nephritis",
            
            # Vascular pathology
            "stenose", "okklusion", "aneurysma", "dissection", "thrombose", "embolie",
            "infarkt", "ischämie", "hämorrhagie", "blutung", "hämatom",
            
            # Bone and joint pathology
            "fraktur", "bruch", "luxation", "subluxation", "arthrose", "osteoporose",
            "osteomyelitis", "osteonekrose", "chondromalazie",
            
            # Spine-specific pathology
            "spondylose", "spondylarthrose", "spondylolisthesis", "bulging", "protrusion",
            "extrusion", "sequester", "spinalkanalstenose", "neuroforamenstenose",
            
            # Imaging findings
            "ödem", "kontusion", "ruptur", "riss", "verdickung", "verengung", "erweiterung",
            "verstärkung", "verschmälerung", "auflockerung", "verdichtung", "zyste",
            "verkalkung", "ossifikation"
        }
    
    def _define_report_structure_patterns(self) -> Dict[str, List[str]]:
        """Define German medical report structure patterns."""
        return {
            "header_patterns": [
                r"radiologische\s+allianz",
                r"radiologie",
                r"institut\s+für\s+radiologie",
                r"praxis\s+für\s+radiologie"
            ],
            "greeting_patterns": [
                r"sehr\s+geehrte[rs]?\s+.*kollegi?n",
                r"liebe[rs]?\s+kollegi?n",
                r"sehr\s+geehrte\s+damen\s+und\s+herren"
            ],
            "patient_info_patterns": [
                r"patient(?:in)?:?\s*[A-ZÄÖÜ][a-zäöüß]+",
                r"geb\.?\s+am\s+\d{2}\.\d{2}\.\d{4}",
                r"geboren\s+am\s+\d{2}\.\d{2}\.\d{4}"
            ],
            "indication_patterns": [
                r"klinik\s+und\s+rechtfertigende\s+indikationsstellung:",
                r"indikationsstellung:",
                r"fragestellung:",
                r"klinische\s+angaben:",
                r"anamnese:"
            ],
            "technique_patterns": [
                r"technik:\s*\d+[,.]?\d*\s*tesla",
                r"t1\s+u\.?\s+t2\s+\d+\s*mm",
                r"schichtdicke\s*:?\s*\d+\s*mm",
                r"nativ\s+untersuchung",
                r"kontrastmittel(?:gabe)?"
            ],
            "findings_patterns": [
                r"befund:",
                r"beschreibung:",
                r"in\s+untersuchungslagerung"
            ],
            "assessment_patterns": [
                r"beurteilung:",
                r"zusammenfassung:",
                r"diagnose:",
                r"schlussfolgerung:"
            ],
            "closing_patterns": [
                r"mit\s+freundlichen\s+(?:kollegialen\s+)?grüßen",
                r"hochachtungsvoll",
                r"mit\s+bestem\s+dank"
            ]
        }
    
    def _define_icd_patterns(self) -> Dict[str, str]:
        """Define ICD-10-GM code patterns."""
        return {
            "icd_format": r"[A-Z]\d{2}(?:\.\d)?",
            "common_radiology_codes": [
                r"M\d{2}",  # Musculoskeletal disorders
                r"G\d{2}",  # Nervous system disorders  
                r"C\d{2}",  # Neoplasms
                r"I\d{2}",  # Circulatory system disorders
                r"J\d{2}",  # Respiratory system disorders
                r"Z\d{2}"   # Factors influencing health status
            ]
        }
    
    async def load_test_data(self):
        """Load the extracted sample medical reports."""
        sample_file = self.test_data_path / "sample_medical_data.json"
        
        if not sample_file.exists():
            raise FileNotFoundError(f"Sample data file not found: {sample_file}")
        
        with open(sample_file, 'r', encoding='utf-8') as f:
            self.sample_data = json.load(f)
        
        logger.info(f"Loaded test data for {len(self.sample_data)} examination types")
    
    def validate_german_terminology(self, text: str) -> Dict[str, Any]:
        """Validate German medical terminology in text."""
        text_lower = text.lower()
        
        # Count different types of terms
        medical_terms_found = [term for term in self.german_medical_terms if term in text_lower]
        radiology_terms_found = [term for term in self.radiology_terms if term in text_lower]
        anatomy_terms_found = [term for term in self.anatomy_terms if term in text_lower]
        pathology_terms_found = [term for term in self.pathology_terms if term in text_lower]
        
        # Calculate terminology density
        total_words = len(text.split())
        medical_term_density = len(medical_terms_found) / total_words if total_words > 0 else 0
        
        # Check for English contamination
        english_words = [
            "the", "and", "or", "with", "for", "from", "this", "that", "these", "those",
            "examination", "finding", "diagnosis", "treatment", "patient", "report"
        ]
        english_contamination = [word for word in english_words if word in text_lower]
        
        return {
            "medical_terms_found": medical_terms_found[:10],  # Limit for readability
            "radiology_terms_found": radiology_terms_found[:10],
            "anatomy_terms_found": anatomy_terms_found[:10], 
            "pathology_terms_found": pathology_terms_found[:10],
            "total_german_medical_terms": len(medical_terms_found) + len(radiology_terms_found) + len(anatomy_terms_found) + len(pathology_terms_found),
            "medical_term_density": round(medical_term_density, 4),
            "english_contamination": english_contamination,
            "contamination_score": len(english_contamination),
            "terminology_richness_score": min(100, (len(set(medical_terms_found + radiology_terms_found + anatomy_terms_found + pathology_terms_found)) / 20) * 100)
        }
    
    def validate_report_structure(self, text: str) -> Dict[str, Any]:
        """Validate German medical report structure."""
        structure_validation = {
            "has_header": False,
            "has_greeting": False,
            "has_patient_info": False,
            "has_indication": False,
            "has_technique": False,
            "has_findings": False,
            "has_assessment": False,
            "has_closing": False,
            "structure_completeness_score": 0,
            "found_patterns": {}
        }
        
        text_lower = text.lower()
        
        # Check each structural element
        for structure_type, patterns in self.report_structure_patterns.items():
            found_patterns = []
            for pattern in patterns:
                matches = re.findall(pattern, text_lower)
                if matches:
                    found_patterns.extend(matches)
            
            structure_validation["found_patterns"][structure_type] = found_patterns
            
            # Update boolean flags
            if structure_type == "header_patterns" and found_patterns:
                structure_validation["has_header"] = True
            elif structure_type == "greeting_patterns" and found_patterns:
                structure_validation["has_greeting"] = True
            elif structure_type == "patient_info_patterns" and found_patterns:
                structure_validation["has_patient_info"] = True
            elif structure_type == "indication_patterns" and found_patterns:
                structure_validation["has_indication"] = True
            elif structure_type == "technique_patterns" and found_patterns:
                structure_validation["has_technique"] = True
            elif structure_type == "findings_patterns" and found_patterns:
                structure_validation["has_findings"] = True
            elif structure_type == "assessment_patterns" and found_patterns:
                structure_validation["has_assessment"] = True
            elif structure_type == "closing_patterns" and found_patterns:
                structure_validation["has_closing"] = True
        
        # Calculate completeness score
        structure_elements = [
            structure_validation["has_header"],
            structure_validation["has_greeting"],
            structure_validation["has_patient_info"],
            structure_validation["has_indication"],
            structure_validation["has_technique"],
            structure_validation["has_findings"],
            structure_validation["has_assessment"],
            structure_validation["has_closing"]
        ]
        
        structure_validation["structure_completeness_score"] = sum(structure_elements) / len(structure_elements) * 100
        
        return structure_validation
    
    def validate_icd_codes(self, icd_code: str, text: str) -> Dict[str, Any]:
        """Validate ICD-10-GM codes."""
        validation_result = {
            "icd_code": icd_code,
            "is_valid_format": False,
            "is_radiology_relevant": False,
            "code_category": None,
            "validation_score": 0
        }
        
        if not icd_code:
            return validation_result
        
        # Check format
        if re.match(self.icd_patterns["icd_format"], icd_code):
            validation_result["is_valid_format"] = True
        
        # Check if it's radiology-relevant
        for pattern in self.icd_patterns["common_radiology_codes"]:
            if re.match(pattern, icd_code):
                validation_result["is_radiology_relevant"] = True
                validation_result["code_category"] = self._get_icd_category(icd_code)
                break
        
        # Calculate validation score
        score = 0
        if validation_result["is_valid_format"]:
            score += 50
        if validation_result["is_radiology_relevant"]:
            score += 50
        
        validation_result["validation_score"] = score
        
        return validation_result
    
    def _get_icd_category(self, icd_code: str) -> str:
        """Get ICD code category description."""
        if icd_code.startswith('M'):
            return "Krankheiten des Muskel-Skelett-Systems"
        elif icd_code.startswith('G'):
            return "Krankheiten des Nervensystems"
        elif icd_code.startswith('C'):
            return "Bösartige Neubildungen"
        elif icd_code.startswith('I'):
            return "Krankheiten des Kreislaufsystems"
        elif icd_code.startswith('J'):
            return "Krankheiten des Atmungssystems"
        elif icd_code.startswith('Z'):
            return "Faktoren, die den Gesundheitszustand beeinflussen"
        else:
            return "Sonstige"
    
    def validate_medical_language_quality(self, text: str) -> Dict[str, Any]:
        """Validate German medical language quality."""
        text_lower = text.lower()
        
        quality_metrics = {
            "uses_formal_language": False,
            "uses_medical_passive_voice": False,
            "uses_appropriate_tense": False,
            "uses_medical_abbreviations": False,
            "avoids_colloquialisms": True,
            "uses_precise_terminology": False,
            "language_quality_score": 0,
            "detected_issues": []
        }
        
        # Check formal language (Sie form)
        formal_indicators = ["sie", "ihre", "ihnen", "sehr geehrte"]
        if any(indicator in text_lower for indicator in formal_indicators):
            quality_metrics["uses_formal_language"] = True
        
        # Check medical passive voice
        passive_indicators = ["wurde", "werden", "wird", "ist zu", "lässt sich", "zeigt sich"]
        if any(indicator in text_lower for indicator in passive_indicators):
            quality_metrics["uses_medical_passive_voice"] = True
        
        # Check appropriate tense (mostly present and past)
        present_indicators = ["ist", "sind", "zeigt", "weist", "liegt vor"]
        past_indicators = ["wurde", "war", "zeigte", "erfolgte"]
        if any(indicator in text_lower for indicator in present_indicators + past_indicators):
            quality_metrics["uses_appropriate_tense"] = True
        
        # Check medical abbreviations
        medical_abbreviations = ["mrt", "ct", "hws", "lws", "bws", "bzw", "ggf", "ca", "mm", "cm"]
        found_abbreviations = [abbr for abbr in medical_abbreviations if abbr in text_lower]
        if found_abbreviations:
            quality_metrics["uses_medical_abbreviations"] = True
        
        # Check for colloquialisms (should be avoided)
        colloquialisms = ["ziemlich", "echt", "mega", "super", "total", "echt"]
        found_colloquialisms = [coll for coll in colloquialisms if coll in text_lower]
        if found_colloquialisms:
            quality_metrics["avoids_colloquialisms"] = False
            quality_metrics["detected_issues"].append(f"Colloquialisms found: {found_colloquialisms}")
        
        # Check precise terminology
        precise_terms = ["befund", "diagnose", "pathologie", "anatomie", "morphologie"]
        if any(term in text_lower for term in precise_terms):
            quality_metrics["uses_precise_terminology"] = True
        
        # Calculate overall quality score
        quality_checks = [
            quality_metrics["uses_formal_language"],
            quality_metrics["uses_medical_passive_voice"],
            quality_metrics["uses_appropriate_tense"],
            quality_metrics["uses_medical_abbreviations"],
            quality_metrics["avoids_colloquialisms"],
            quality_metrics["uses_precise_terminology"]
        ]
        
        quality_metrics["language_quality_score"] = sum(quality_checks) / len(quality_checks) * 100
        
        return quality_metrics
    
    async def validate_sample(self, sample: Dict[str, Any], exam_type: str) -> Dict[str, Any]:
        """Validate a single medical report sample."""
        logger.info(f"Validating sample for {exam_type}")
        
        text = sample.get("transcription", "")
        icd_code = sample.get("icd_code", "")
        
        validation_result = {
            "examination_type": exam_type,
            "patient_id": sample.get("patient_id"),
            "original_examination_type": sample.get("examination_type_original"),
            "text_length": len(text),
            "validation_timestamp": datetime.now().isoformat(),
            "terminology_validation": self.validate_german_terminology(text),
            "structure_validation": self.validate_report_structure(text),
            "icd_validation": self.validate_icd_codes(icd_code, text),
            "language_quality_validation": self.validate_medical_language_quality(text),
            "overall_validation_score": 0
        }
        
        # Calculate overall validation score
        scores = [
            validation_result["terminology_validation"]["terminology_richness_score"],
            validation_result["structure_validation"]["structure_completeness_score"],
            validation_result["icd_validation"]["validation_score"],
            validation_result["language_quality_validation"]["language_quality_score"]
        ]
        
        validation_result["overall_validation_score"] = sum(scores) / len(scores)
        
        return validation_result
    
    async def run_comprehensive_validation(self):
        """Run comprehensive German medical validation on all samples."""
        logger.info("🧪 Starting comprehensive German medical validation")
        
        # Load test data
        await self.load_test_data()
        
        all_validation_results = []
        
        # Validate each examination type
        for exam_type, samples in self.sample_data.items():
            logger.info(f"\n📋 Validating examination type: {exam_type}")
            
            for i, sample in enumerate(samples):
                logger.info(f"   Validating sample {i+1}/{len(samples)}")
                
                validation_result = await self.validate_sample(sample, exam_type)
                all_validation_results.append(validation_result)
                
                # Log key metrics
                logger.info(f"     Overall score: {validation_result['overall_validation_score']:.1f}%")
                logger.info(f"     Terminology richness: {validation_result['terminology_validation']['terminology_richness_score']:.1f}%")
                logger.info(f"     Structure completeness: {validation_result['structure_validation']['structure_completeness_score']:.1f}%")
        
        # Save validation results
        await self.save_validation_results(all_validation_results)
        
        # Generate summary
        await self.generate_validation_summary(all_validation_results)
    
    async def save_validation_results(self, results: List[Dict[str, Any]]):
        """Save German medical validation results."""
        results_file = self.test_data_path / f"german_medical_validation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        validation_summary = {
            "validation_timestamp": datetime.now().isoformat(),
            "total_samples": len(results),
            "average_overall_score": sum(r["overall_validation_score"] for r in results) / len(results) if results else 0,
            "validation_criteria": {
                "german_medical_terms_count": len(self.german_medical_terms),
                "radiology_terms_count": len(self.radiology_terms),
                "anatomy_terms_count": len(self.anatomy_terms),
                "pathology_terms_count": len(self.pathology_terms)
            },
            "detailed_results": results
        }
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(validation_summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Validation results saved to: {results_file}")
    
    async def generate_validation_summary(self, results: List[Dict[str, Any]]):
        """Generate comprehensive validation summary."""
        total_samples = len(results)
        
        logger.info(f"\n📊 GERMAN MEDICAL VALIDATION SUMMARY")
        logger.info(f"=====================================")
        logger.info(f"Total samples validated: {total_samples}")
        
        if not results:
            return
        
        # Overall scores
        avg_overall_score = sum(r["overall_validation_score"] for r in results) / total_samples
        avg_terminology_score = sum(r["terminology_validation"]["terminology_richness_score"] for r in results) / total_samples
        avg_structure_score = sum(r["structure_validation"]["structure_completeness_score"] for r in results) / total_samples
        avg_icd_score = sum(r["icd_validation"]["validation_score"] for r in results) / total_samples
        avg_language_quality_score = sum(r["language_quality_validation"]["language_quality_score"] for r in results) / total_samples
        
        logger.info(f"\nAverage Scores:")
        logger.info(f"Overall validation score: {avg_overall_score:.1f}%")
        logger.info(f"Terminology richness: {avg_terminology_score:.1f}%")
        logger.info(f"Structure completeness: {avg_structure_score:.1f}%")
        logger.info(f"ICD code validation: {avg_icd_score:.1f}%")
        logger.info(f"Language quality: {avg_language_quality_score:.1f}%")
        
        # Terminology analysis
        logger.info(f"\nTerminology Analysis:")
        total_medical_terms = sum(r["terminology_validation"]["total_german_medical_terms"] for r in results)
        total_contamination = sum(r["terminology_validation"]["contamination_score"] for r in results)
        
        logger.info(f"Total German medical terms found: {total_medical_terms}")
        logger.info(f"Average terms per report: {total_medical_terms / total_samples:.1f}")
        logger.info(f"English contamination instances: {total_contamination}")
        
        # Structure analysis
        logger.info(f"\nReport Structure Analysis:")
        structure_elements = ["has_header", "has_greeting", "has_patient_info", "has_indication", 
                            "has_technique", "has_findings", "has_assessment", "has_closing"]
        
        for element in structure_elements:
            count = sum(1 for r in results if r["structure_validation"][element])
            percentage = count / total_samples * 100
            logger.info(f"  {element.replace('has_', '').replace('_', ' ').title()}: {count}/{total_samples} ({percentage:.1f}%)")
        
        # ICD code analysis
        logger.info(f"\nICD Code Analysis:")
        valid_format_count = sum(1 for r in results if r["icd_validation"]["is_valid_format"])
        radiology_relevant_count = sum(1 for r in results if r["icd_validation"]["is_radiology_relevant"])
        
        logger.info(f"Valid ICD format: {valid_format_count}/{total_samples} ({valid_format_count/total_samples*100:.1f}%)")
        logger.info(f"Radiology relevant: {radiology_relevant_count}/{total_samples} ({radiology_relevant_count/total_samples*100:.1f}%)")
        
        # Language quality analysis
        logger.info(f"\nLanguage Quality Analysis:")
        quality_elements = ["uses_formal_language", "uses_medical_passive_voice", "uses_appropriate_tense",
                          "uses_medical_abbreviations", "avoids_colloquialisms", "uses_precise_terminology"]
        
        for element in quality_elements:
            count = sum(1 for r in results if r["language_quality_validation"][element])
            percentage = count / total_samples * 100
            logger.info(f"  {element.replace('uses_', '').replace('_', ' ').title()}: {count}/{total_samples} ({percentage:.1f}%)")
        
        # Best and worst performing samples
        best_sample = max(results, key=lambda x: x["overall_validation_score"])
        worst_sample = min(results, key=lambda x: x["overall_validation_score"])
        
        logger.info(f"\nBest Performing Sample:")
        logger.info(f"  Examination type: {best_sample['examination_type']}")
        logger.info(f"  Overall score: {best_sample['overall_validation_score']:.1f}%")
        
        logger.info(f"\nWorst Performing Sample:")
        logger.info(f"  Examination type: {worst_sample['examination_type']}")
        logger.info(f"  Overall score: {worst_sample['overall_validation_score']:.1f}%")
        
        # Common terminology found
        logger.info(f"\nMost Common German Medical Terms Found:")
        all_medical_terms = []
        for result in results:
            all_medical_terms.extend(result["terminology_validation"]["medical_terms_found"])
        
        from collections import Counter
        term_counts = Counter(all_medical_terms)
        for term, count in term_counts.most_common(10):
            logger.info(f"  {term}: {count} occurrences")


async def main():
    """Main validation function."""
    TEST_DATA_PATH = "test_data"
    
    logger.info("🚀 Starting German Medical Validation Tests")
    logger.info(f"Test data path: {TEST_DATA_PATH}")
    
    validator = GermanMedicalValidator(TEST_DATA_PATH)
    
    try:
        await validator.run_comprehensive_validation()
        logger.info("✅ All German medical validation tests completed!")
    except Exception as e:
        logger.error(f"❌ Validation test execution failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())