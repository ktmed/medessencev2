"""
Semantic Layer for MedEssenceAI
Provides ETL pipeline from Excel data to medical ontology and knowledge graph
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
import re
from datetime import datetime, timedelta
import logging
from pathlib import Path

from medical_ontology import (
    MedicalOntology, MedicalEntity, Patient, MedicalReport, Diagnosis, 
    MedicalProcedure, Finding, ICDCode, AnatomicalStructure,
    MedicalRelationship, EntityType, RelationshipType, ModalityType,
    GERMAN_MEDICAL_TERMS
)
from icd_database import ICDDatabase, create_icd_database, SPECIALTY_CHAPTER_MAPPING

logger = logging.getLogger(__name__)


class MedicalSemanticETL:
    """ETL pipeline for converting medical Excel data to semantic ontology"""
    
    def __init__(self):
        self.ontology = MedicalOntology()
        self.extraction_rules = self._load_extraction_rules()
        self.icd_database = create_icd_database()  # Load comprehensive German ICD database
        self.medical_nlp = MedicalNLPProcessor()
        
    def _load_extraction_rules(self) -> Dict[str, Any]:
        """Load rules for extracting medical concepts from text"""
        return {
            'patient_id_patterns': [
                r'(?i)patient[-_\s]*(?:id|number)?\s*:?\s*([A-Z0-9]+)',
                r'(?i)patienten[-_\s]*(?:nr|nummer)?\s*:?\s*([A-Z0-9]+)'
            ],
            'icd_code_patterns': [
                r'([A-Z]\d{2}(?:\.\d{1,2})?)',  # ICD-10 format
                r'ICD[-\s]*(?:10[-\s]*)?(?:GM[-\s]*)?:?\s*([A-Z]\d{2}(?:\.\d{1,2})?)'
            ],
            'finding_indicators': [
                'befund', 'finding', 'beobachtung', 'observation',
                'auffällig', 'abnormal', 'normal', 'unauffällig'
            ],
            'anatomy_keywords': {
                'breast': ['brust', 'mamma', 'mammae', 'breast'],
                'lung': ['lunge', 'pulmo', 'lung', 'thorax'],
                'heart': ['herz', 'kardial', 'heart', 'cardiac'],
                'liver': ['leber', 'hepatisch', 'liver', 'hepatic'],
                'kidney': ['niere', 'renal', 'kidney', 'nephro']
            },
            'modality_keywords': {
                'mammography': ['mammographie', 'mammography', 'mammo'],
                'ct_scan': ['computertomographie', 'ct', 'computer tomography'],
                'mri': ['magnetresonanztomographie', 'mrt', 'mri', 'magnetic resonance'],
                'ultrasound': ['ultraschall', 'sonographie', 'ultrasound', 'sono'],
                'xray': ['röntgen', 'x-ray', 'radiographie']
            }
        }
    
    def _extract_icd_codes_from_text(self, text: str) -> List[str]:
        """Extract and validate ICD codes from German medical text"""
        # Use patterns to find potential ICD codes
        codes = []
        for pattern in self.extraction_rules['icd_code_patterns']:
            matches = re.findall(pattern, text)
            codes.extend(matches)
        
        # Validate codes against database and return only valid ones
        valid_codes = []
        for code in codes:
            icd_entry = self.icd_database.get_entry(code)
            if icd_entry:
                valid_codes.append(code)
        
        return valid_codes
    
    def _suggest_icd_codes_from_text(self, text: str, max_suggestions: int = 5) -> List[str]:
        """Suggest ICD codes based on German medical text content"""
        # Use ICD database search to find relevant codes
        search_results = self.icd_database.search_by_text(text, max_results=max_suggestions)
        return [entry.icd_code for entry in search_results]
    
    def extract_from_excel(self, excel_path: str, sheet_name: str = None) -> MedicalOntology:
        """Extract medical concepts from Excel file and build ontology"""
        logger.info(f"Starting extraction from {excel_path}")
        
        try:
            # Load Excel data
            if sheet_name:
                df = pd.read_excel(excel_path, sheet_name=sheet_name)
            else:
                df = pd.read_excel(excel_path)
            
            logger.info(f"Loaded {len(df)} records with {len(df.columns)} columns")
            
            # Analyze column structure
            column_mapping = self._analyze_columns(df)
            logger.info(f"Column mapping: {column_mapping}")
            
            # Extract entities
            self._extract_patients(df, column_mapping)
            self._extract_reports(df, column_mapping)
            self._extract_diagnoses(df, column_mapping)
            self._extract_procedures(df, column_mapping)
            self._extract_findings(df, column_mapping)
            
            # Extract relationships
            self._extract_relationships(df, column_mapping)
            
            logger.info(f"Extraction complete: {self.ontology.get_statistics()}")
            return self.ontology
            
        except Exception as e:
            logger.error(f"Error during extraction: {str(e)}")
            raise
    
    def _analyze_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        """Analyze DataFrame columns and map to medical concepts"""
        column_mapping = {}
        
        for col in df.columns:
            col_lower = col.lower()
            
            # Map columns to entity types
            if any(term in col_lower for term in ['patient', 'patienten']):
                if any(term in col_lower for term in ['id', 'nr', 'number']):
                    column_mapping[col] = 'patient_id'
                else:
                    column_mapping[col] = 'patient_info'
            
            elif any(term in col_lower for term in ['report', 'bericht', 'befund']):
                if 'id' in col_lower:
                    column_mapping[col] = 'report_id'
                elif any(term in col_lower for term in ['text', 'content', 'inhalt']):
                    column_mapping[col] = 'report_text'
                else:
                    column_mapping[col] = 'report_info'
            
            elif any(term in col_lower for term in ['diagnos', 'icd']):
                if 'code' in col_lower:
                    column_mapping[col] = 'icd_code'
                else:
                    column_mapping[col] = 'diagnosis_text'
            
            elif any(term in col_lower for term in ['procedure', 'verfahren', 'untersuchung']):
                column_mapping[col] = 'procedure_info'
            
            elif any(term in col_lower for term in ['finding', 'befund', 'ergebnis']):
                column_mapping[col] = 'finding_text'
            
            elif any(term in col_lower for term in ['date', 'datum', 'time', 'zeit']):
                column_mapping[col] = 'temporal'
            
            else:
                column_mapping[col] = 'general_data'
        
        return column_mapping
    
    def _extract_patients(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract patient entities from DataFrame"""
        patient_cols = [col for col, mapping in column_mapping.items() 
                       if mapping in ['patient_id', 'patient_info']]
        
        if not patient_cols:
            # Generate synthetic patient IDs
            for idx in range(len(df)):
                patient = Patient(
                    patient_id=f"P{idx+1:06d}",
                    name=f"Patient {idx+1}",
                    metadata={'source_row': idx}
                )
                self.ontology.add_entity(patient)
            return
        
        # Extract from actual patient columns
        for idx, row in df.iterrows():
            patient_data = {}
            
            for col in patient_cols:
                if col in row and pd.notna(row[col]):
                    if column_mapping[col] == 'patient_id':
                        patient_data['patient_id'] = str(row[col])
                    else:
                        # Extract additional patient info using NLP
                        text = str(row[col])
                        extracted_info = self.medical_nlp.extract_patient_info(text)
                        patient_data.update(extracted_info)
            
            # Create patient entity
            if 'patient_id' not in patient_data:
                patient_data['patient_id'] = f"P{idx+1:06d}"
            
            patient = Patient(
                patient_id=patient_data['patient_id'],
                name=patient_data.get('name', f"Patient {patient_data['patient_id']}"),
                age=patient_data.get('age'),
                gender=patient_data.get('gender'),
                metadata={'source_row': idx, 'extracted_data': patient_data}
            )
            self.ontology.add_entity(patient)
    
    def _extract_reports(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract medical report entities"""
        report_cols = [col for col, mapping in column_mapping.items() 
                      if mapping in ['report_id', 'report_text', 'report_info']]
        
        for idx, row in df.iterrows():
            report_data = {}
            report_text = ""
            
            for col in report_cols:
                if col in row and pd.notna(row[col]):
                    if column_mapping[col] == 'report_text':
                        report_text = str(row[col])
                    elif column_mapping[col] == 'report_id':
                        report_data['report_id'] = str(row[col])
            
            # Extract modality from text
            modality = self._extract_modality(report_text)
            
            # Create report entity
            if 'report_id' not in report_data:
                report_data['report_id'] = f"R{idx+1:06d}"
            
            report = MedicalReport(
                report_id=report_data['report_id'],
                patient_id=f"P{idx+1:06d}",  # Link to patient
                modality=modality,
                report_text=report_text,
                language="de" if self._is_german_text(report_text) else "en",
                metadata={'source_row': idx}
            )
            self.ontology.add_entity(report)
    
    def _extract_diagnoses(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract diagnosis entities with ICD codes"""
        diag_cols = [col for col, mapping in column_mapping.items() 
                    if mapping in ['icd_code', 'diagnosis_text']]
        
        for idx, row in df.iterrows():
            # Extract ICD codes from text
            icd_codes = []
            diagnosis_text = ""
            
            for col in diag_cols:
                if col in row and pd.notna(row[col]):
                    text = str(row[col])
                    if column_mapping[col] == 'icd_code':
                        icd_codes.extend(self._extract_icd_codes_from_text(text))
                    else:
                        diagnosis_text += " " + text
                        # Also try to find codes in diagnosis text
                        icd_codes.extend(self._extract_icd_codes_from_text(text))
            
            # If no explicit codes found, try to suggest from text
            if not icd_codes and diagnosis_text.strip():
                suggested_codes = self._suggest_icd_codes_from_text(diagnosis_text.strip())
                icd_codes.extend(suggested_codes)
            
            # Create diagnosis entities with German ICD data
            for icd_code in icd_codes:
                icd_entry = self.icd_database.get_entry(icd_code)
                
                if icd_entry:
                    diagnosis = Diagnosis(
                        icd_10_code=icd_code,
                        icd_10_description=icd_entry.label,  # German description
                        diagnosis_text=diagnosis_text.strip(),
                        metadata={
                            'source_row': idx, 
                            'chapter': icd_entry.chapter_nr,
                            'terminal': icd_entry.is_terminal,
                            'gender_specific': icd_entry.is_gender_specific
                        }
                    )
                    self.ontology.add_entity(diagnosis)
    
    def _extract_procedures(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract procedure entities"""
        proc_cols = [col for col, mapping in column_mapping.items() 
                    if mapping == 'procedure_info']
        
        for idx, row in df.iterrows():
            procedure_text = ""
            
            for col in proc_cols:
                if col in row and pd.notna(row[col]):
                    procedure_text += " " + str(row[col])
            
            if procedure_text.strip():
                # Extract modality to infer procedure type
                modality = self._extract_modality(procedure_text)
                
                procedure = MedicalProcedure(
                    procedure_name=procedure_text.strip()[:100],
                    modality=modality,
                    metadata={'source_row': idx}
                )
                self.ontology.add_entity(procedure)
    
    def _extract_findings(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract clinical findings"""
        finding_cols = [col for col, mapping in column_mapping.items() 
                       if mapping == 'finding_text']
        
        for idx, row in df.iterrows():
            finding_text = ""
            
            for col in finding_cols:
                if col in row and pd.notna(row[col]):
                    finding_text += " " + str(row[col])
            
            if finding_text.strip():
                # Extract findings using NLP
                findings = self.medical_nlp.extract_findings(finding_text)
                
                for finding_info in findings:
                    finding = Finding(
                        finding_text=finding_info['text'],
                        finding_type=finding_info.get('type', 'unknown'),
                        severity=finding_info.get('severity', ''),
                        location=finding_info.get('location', ''),
                        metadata={'source_row': idx}
                    )
                    self.ontology.add_entity(finding)
    
    def _extract_relationships(self, df: pd.DataFrame, column_mapping: Dict[str, str]):
        """Extract relationships between entities"""
        # Get entities by source row for relationship linking
        entities_by_row = {}
        for entity in self.ontology.entities.values():
            row_idx = entity.metadata.get('source_row')
            if row_idx is not None:
                if row_idx not in entities_by_row:
                    entities_by_row[row_idx] = []
                entities_by_row[row_idx].append(entity)
        
        # Create relationships within each row
        for row_idx, entities in entities_by_row.items():
            patient_entities = [e for e in entities if isinstance(e, Patient)]
            report_entities = [e for e in entities if isinstance(e, MedicalReport)]
            diagnosis_entities = [e for e in entities if isinstance(e, Diagnosis)]
            procedure_entities = [e for e in entities if isinstance(e, MedicalProcedure)]
            finding_entities = [e for e in entities if isinstance(e, Finding)]
            
            # Link reports to patients
            for patient in patient_entities:
                for report in report_entities:
                    rel = MedicalRelationship(
                        relationship_type=RelationshipType.GENERATED_BY,
                        source_entity_id=report.id,
                        target_entity_id=patient.id
                    )
                    self.ontology.add_relationship(rel)
                
                # Link diagnoses to patients
                for diagnosis in diagnosis_entities:
                    rel = MedicalRelationship(
                        relationship_type=RelationshipType.HAS_DIAGNOSIS,
                        source_entity_id=patient.id,
                        target_entity_id=diagnosis.id
                    )
                    self.ontology.add_relationship(rel)
            
            # Link findings to reports
            for report in report_entities:
                for finding in finding_entities:
                    rel = MedicalRelationship(
                        relationship_type=RelationshipType.CONTAINS_FINDING,
                        source_entity_id=report.id,
                        target_entity_id=finding.id
                    )
                    self.ontology.add_relationship(rel)
    
    def _extract_modality(self, text: str) -> ModalityType:
        """Extract imaging modality from text"""
        text_lower = text.lower()
        
        for modality, keywords in self.extraction_rules['modality_keywords'].items():
            if any(keyword in text_lower for keyword in keywords):
                return ModalityType(modality)
        
        return ModalityType.CLINICAL_EXAMINATION
    
    def _is_german_text(self, text: str) -> bool:
        """Detect if medical text is in German"""
        # Enhanced German detection for medical texts
        german_indicators = [
            # Common German articles and prepositions
            'der', 'die', 'das', 'und', 'oder', 'mit', 'von', 'zu', 'ist', 'sind', 'im', 'am', 'an', 'auf', 'für', 'bei',
            # Medical German terms
            'befund', 'untersuchung', 'patient', 'patientin', 'diagnose', 'therapie', 'behandlung',
            'mammographie', 'sonographie', 'computertomographie', 'röntgen', 'unauffällig', 'auffällig',
            'brust', 'lunge', 'herz', 'leber', 'niere', 'abdomen', 'thorax'
        ]
        
        text_lower = text.lower()
        german_count = sum(1 for word in german_indicators if word in text_lower)
        
        # Also check for German medical suffixes and patterns
        german_patterns = [
            r'\w+ung\b',  # -ung endings (Untersuchung, Behandlung)
            r'\w+keit\b',  # -keit endings
            r'\w+heit\b',  # -heit endings
            r'\w+isch\b',  # -isch endings (pathologisch)
            r'\w+ie\b',    # -ie endings (Mammographie, Sonographie)
        ]
        
        pattern_matches = sum(1 for pattern in german_patterns 
                            if re.search(pattern, text_lower))
        
        return german_count >= 2 or pattern_matches >= 2


class MedicalNLPProcessor:
    """Natural Language Processing for medical text"""
    
    def __init__(self):
        self.german_medical_terms = GERMAN_MEDICAL_TERMS
        
    def extract_patient_info(self, text: str) -> Dict[str, Any]:
        """Extract patient information from text"""
        info = {}
        
        # Extract age
        age_match = re.search(r'(?i)(?:age|alter)?\s*:?\s*(\d{1,3})\s*(?:years?|jahre?)?', text)
        if age_match:
            info['age'] = int(age_match.group(1))
        
        # Extract gender
        if re.search(r'(?i)\b(?:female|weiblich|frau|woman)\b', text):
            info['gender'] = 'female'
        elif re.search(r'(?i)\b(?:male|männlich|mann|man)\b', text):
            info['gender'] = 'male'
        
        return info
    
    def extract_findings(self, text: str) -> List[Dict[str, str]]:
        """Extract clinical findings from text"""
        findings = []
        
        # Split text into sentences
        sentences = re.split(r'[.!?]+', text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            finding_info = {'text': sentence}
            
            # Determine finding type
            if any(term in sentence.lower() for term in ['normal', 'unauffällig', 'unremarkable']):
                finding_info['type'] = 'normal'
            elif any(term in sentence.lower() for term in ['abnormal', 'auffällig', 'pathological']):
                finding_info['type'] = 'abnormal'
            else:
                finding_info['type'] = 'unknown'
            
            # Extract severity
            if any(term in sentence.lower() for term in ['severe', 'schwer', 'hochgradig']):
                finding_info['severity'] = 'severe'
            elif any(term in sentence.lower() for term in ['moderate', 'mäßig', 'mittelgradig']):
                finding_info['severity'] = 'moderate'
            elif any(term in sentence.lower() for term in ['mild', 'leicht', 'geringgradig']):
                finding_info['severity'] = 'mild'
            
            findings.append(finding_info)
        
        return findings


def create_semantic_layer_from_excel(excel_path: str) -> MedicalOntology:
    """Main function to create semantic layer from Excel file"""
    etl = MedicalSemanticETL()
    ontology = etl.extract_from_excel(excel_path)
    return ontology


if __name__ == "__main__":
    # Test the semantic layer
    test_excel_path = "/Users/keremtomak/Documents/work/development/REPOS/med-essence/development/experiments/testcode/latestcompleteexplanations3.xlsx"
    
    if Path(test_excel_path).exists():
        print(f"Creating semantic layer from {test_excel_path}")
        ontology = create_semantic_layer_from_excel(test_excel_path)
        print(f"Semantic layer created with {len(ontology.entities)} entities")
        print(ontology.get_statistics())
    else:
        print(f"Test file not found: {test_excel_path}")