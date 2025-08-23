"""
Medical Ontology Schema for MedEssenceAI
Defines core medical entities, relationships, and semantic structure
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Union, Any
from enum import Enum
from datetime import datetime
import uuid


class EntityType(Enum):
    """Core medical entity types"""
    PATIENT = "patient"
    REPORT = "report"
    DIAGNOSIS = "diagnosis"
    PROCEDURE = "procedure"
    ANATOMY = "anatomy"
    PATHOLOGY = "pathology"
    MEDICATION = "medication"
    FINDING = "finding"
    ICD_CODE = "icd_code"
    PRACTITIONER = "practitioner"
    ORGANIZATION = "organization"


class RelationshipType(Enum):
    """Medical relationship types"""
    HAS_DIAGNOSIS = "has_diagnosis"
    UNDERWENT_PROCEDURE = "underwent_procedure"
    AFFECTS_ANATOMY = "affects_anatomy"
    INDICATES_PATHOLOGY = "indicates_pathology"
    PRESCRIBED_MEDICATION = "prescribed_medication"
    CONTAINS_FINDING = "contains_finding"
    CLASSIFIED_AS = "classified_as"
    PERFORMED_BY = "performed_by"
    GENERATED_BY = "generated_by"
    PART_OF = "part_of"
    RELATED_TO = "related_to"


class ModalityType(Enum):
    """Medical imaging and examination modalities"""
    MAMMOGRAPHY = "mammography"
    CT_SCAN = "ct_scan"
    MRI = "mri"
    ULTRASOUND = "ultrasound"
    XRAY = "xray"
    NUCLEAR_MEDICINE = "nuclear_medicine"
    PATHOLOGY = "pathology"
    CLINICAL_EXAMINATION = "clinical_examination"


@dataclass
class MedicalEntity:
    """Base class for all medical entities"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: EntityType = EntityType.PATIENT
    name: str = ""
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    confidence_score: float = 1.0
    source: str = ""
    
    def __post_init__(self):
        """Validate entity after initialization"""
        if not self.name:
            self.name = f"{self.entity_type.value}_{self.id[:8]}"


@dataclass
class Patient(MedicalEntity):
    """Patient entity with medical demographics"""
    entity_type: EntityType = field(default=EntityType.PATIENT, init=False)
    patient_id: str = ""
    age: Optional[int] = None
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    medical_record_number: str = ""
    
    def __post_init__(self):
        super().__post_init__()
        if not self.patient_id:
            self.patient_id = self.id


@dataclass
class MedicalReport(MedicalEntity):
    """Medical report entity"""
    entity_type: EntityType = field(default=EntityType.REPORT, init=False)
    report_id: str = ""
    patient_id: str = ""
    practitioner_id: str = ""
    modality: ModalityType = ModalityType.CLINICAL_EXAMINATION
    report_date: datetime = field(default_factory=datetime.now)
    report_text: str = ""
    findings: List[str] = field(default_factory=list)
    impressions: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    language: str = "de"  # Default German
    
    def __post_init__(self):
        super().__post_init__()
        if not self.report_id:
            self.report_id = self.id


@dataclass
class Diagnosis(MedicalEntity):
    """Diagnosis entity with ICD coding"""
    entity_type: EntityType = field(default=EntityType.DIAGNOSIS, init=False)
    icd_10_code: str = ""
    icd_10_description: str = ""
    diagnosis_text: str = ""
    certainty: str = "confirmed"  # confirmed, suspected, rule_out
    primary: bool = True
    onset_date: Optional[datetime] = None
    resolution_date: Optional[datetime] = None
    
    def __post_init__(self):
        super().__post_init__()
        if not self.name and self.icd_10_description:
            self.name = self.icd_10_description


@dataclass
class MedicalProcedure(MedicalEntity):
    """Medical procedure entity"""
    entity_type: EntityType = field(default=EntityType.PROCEDURE, init=False)
    procedure_code: str = ""
    procedure_name: str = ""
    modality: ModalityType = ModalityType.CLINICAL_EXAMINATION
    performed_date: datetime = field(default_factory=datetime.now)
    duration_minutes: Optional[int] = None
    complications: List[str] = field(default_factory=list)
    outcome: str = ""
    
    def __post_init__(self):
        super().__post_init__()
        if not self.name and self.procedure_name:
            self.name = self.procedure_name


@dataclass
class AnatomicalStructure(MedicalEntity):
    """Anatomical structure entity"""
    entity_type: EntityType = field(default=EntityType.ANATOMY, init=False)
    anatomy_code: str = ""
    system: str = ""  # respiratory, cardiovascular, etc.
    region: str = ""   # thorax, abdomen, etc.
    laterality: str = ""  # left, right, bilateral
    
    def __post_init__(self):
        super().__post_init__()
        if not self.name:
            parts = [self.system, self.region, self.laterality]
            self.name = " ".join([p for p in parts if p])


@dataclass
class Finding(MedicalEntity):
    """Clinical finding entity"""
    entity_type: EntityType = field(default=EntityType.FINDING, init=False)
    finding_text: str = ""
    finding_type: str = ""  # normal, abnormal, incidental
    severity: str = ""  # mild, moderate, severe
    location: str = ""
    size_mm: Optional[float] = None
    characteristics: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        super().__post_init__()
        if not self.name and self.finding_text:
            self.name = self.finding_text[:50] + "..." if len(self.finding_text) > 50 else self.finding_text


@dataclass
class ICDCode(MedicalEntity):
    """ICD-10-GM code entity"""
    entity_type: EntityType = field(default=EntityType.ICD_CODE, init=False)
    code: str = ""
    title: str = ""
    description: str = ""
    category: str = ""
    subcategory: str = ""
    version: str = "ICD-10-GM-2024"
    parent_code: Optional[str] = None
    child_codes: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        super().__post_init__()
        if not self.name and self.title:
            self.name = f"{self.code}: {self.title}"


@dataclass
class MedicalRelationship:
    """Relationship between medical entities"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    relationship_type: RelationshipType = RelationshipType.RELATED_TO
    source_entity_id: str = ""
    target_entity_id: str = ""
    weight: float = 1.0
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate relationship"""
        if not self.source_entity_id or not self.target_entity_id:
            raise ValueError("Source and target entity IDs are required")


class MedicalOntology:
    """Medical ontology management system"""
    
    def __init__(self):
        self.entities: Dict[str, MedicalEntity] = {}
        self.relationships: Dict[str, MedicalRelationship] = {}
        self.entity_types: Dict[EntityType, Set[str]] = {et: set() for et in EntityType}
        self.indexes = {
            'icd_codes': {},
            'patient_ids': {},
            'report_ids': {},
            'anatomical_structures': {},
            'findings': {}
        }
    
    def add_entity(self, entity: MedicalEntity) -> str:
        """Add entity to ontology"""
        self.entities[entity.id] = entity
        self.entity_types[entity.entity_type].add(entity.id)
        
        # Update indexes
        if isinstance(entity, ICDCode):
            self.indexes['icd_codes'][entity.code] = entity.id
        elif isinstance(entity, Patient):
            if entity.patient_id:
                self.indexes['patient_ids'][entity.patient_id] = entity.id
        elif isinstance(entity, MedicalReport):
            if entity.report_id:
                self.indexes['report_ids'][entity.report_id] = entity.id
        elif isinstance(entity, AnatomicalStructure):
            key = f"{entity.system}:{entity.region}"
            if key not in self.indexes['anatomical_structures']:
                self.indexes['anatomical_structures'][key] = []
            self.indexes['anatomical_structures'][key].append(entity.id)
        elif isinstance(entity, Finding):
            if entity.finding_type not in self.indexes['findings']:
                self.indexes['findings'][entity.finding_type] = []
            self.indexes['findings'][entity.finding_type].append(entity.id)
        
        return entity.id
    
    def add_relationship(self, relationship: MedicalRelationship) -> str:
        """Add relationship to ontology"""
        # Validate entities exist
        if (relationship.source_entity_id not in self.entities or 
            relationship.target_entity_id not in self.entities):
            raise ValueError("Both source and target entities must exist")
        
        self.relationships[relationship.id] = relationship
        return relationship.id
    
    def get_entity(self, entity_id: str) -> Optional[MedicalEntity]:
        """Get entity by ID"""
        return self.entities.get(entity_id)
    
    def get_entities_by_type(self, entity_type: EntityType) -> List[MedicalEntity]:
        """Get all entities of specific type"""
        entity_ids = self.entity_types.get(entity_type, set())
        return [self.entities[eid] for eid in entity_ids]
    
    def find_patient_by_id(self, patient_id: str) -> Optional[Patient]:
        """Find patient by patient ID"""
        entity_id = self.indexes['patient_ids'].get(patient_id)
        if entity_id:
            return self.entities.get(entity_id)
        return None
    
    def find_icd_code(self, code: str) -> Optional[ICDCode]:
        """Find ICD code entity"""
        entity_id = self.indexes['icd_codes'].get(code)
        if entity_id:
            return self.entities.get(entity_id)
        return None
    
    def find_related_entities(self, entity_id: str, 
                            relationship_type: Optional[RelationshipType] = None) -> List[MedicalEntity]:
        """Find entities related to given entity"""
        related_entities = []
        
        for rel in self.relationships.values():
            if rel.source_entity_id == entity_id:
                if relationship_type is None or rel.relationship_type == relationship_type:
                    target_entity = self.entities.get(rel.target_entity_id)
                    if target_entity:
                        related_entities.append(target_entity)
            elif rel.target_entity_id == entity_id:
                if relationship_type is None or rel.relationship_type == relationship_type:
                    source_entity = self.entities.get(rel.source_entity_id)
                    if source_entity:
                        related_entities.append(source_entity)
        
        return related_entities
    
    def find_patient_reports(self, patient_id: str) -> List[MedicalReport]:
        """Find all reports for a patient"""
        reports = []
        for entity in self.entities.values():
            if (isinstance(entity, MedicalReport) and 
                entity.patient_id == patient_id):
                reports.append(entity)
        return sorted(reports, key=lambda r: r.report_date, reverse=True)
    
    def find_findings_by_anatomy(self, anatomy_system: str) -> List[Finding]:
        """Find findings related to anatomical system"""
        anatomical_ids = self.indexes['anatomical_structures'].get(anatomy_system, [])
        findings = []
        
        for anatomy_id in anatomical_ids:
            related_findings = self.find_related_entities(
                anatomy_id, RelationshipType.AFFECTS_ANATOMY)
            findings.extend([f for f in related_findings if isinstance(f, Finding)])
        
        return findings
    
    def export_for_knowledge_graph(self) -> Dict[str, Any]:
        """Export ontology data for knowledge graph import"""
        return {
            'entities': [
                {
                    'id': entity.id,
                    'type': entity.entity_type.value,
                    'properties': entity.__dict__
                }
                for entity in self.entities.values()
            ],
            'relationships': [
                {
                    'id': rel.id,
                    'type': rel.relationship_type.value,
                    'source': rel.source_entity_id,
                    'target': rel.target_entity_id,
                    'properties': {
                        'weight': rel.weight,
                        'confidence': rel.confidence,
                        'metadata': rel.metadata
                    }
                }
                for rel in self.relationships.values()
            ]
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get ontology statistics"""
        return {
            'total_entities': len(self.entities),
            'total_relationships': len(self.relationships),
            'entities_by_type': {
                et.value: len(ids) for et, ids in self.entity_types.items()
            },
            'indexes': {
                name: len(index) for name, index in self.indexes.items()
            }
        }


# German medical terminology - primary interface language
GERMAN_MEDICAL_TERMS = {
    # Core medical entities
    'patient': 'Patient',
    'patientin': 'Patientin', 
    'befund': 'Befund',
    'diagnose': 'Diagnose',
    'untersuchung': 'Untersuchung',
    'verfahren': 'Verfahren',
    'behandlung': 'Behandlung',
    'therapie': 'Therapie',
    'bericht': 'Bericht',
    'dokumentation': 'Dokumentation',
    
    # Imaging modalities in German
    'mammographie': 'Mammographie',
    'sonographie': 'Sonographie', 
    'ultraschall': 'Ultraschall',
    'computertomographie': 'Computertomographie',
    'ct': 'CT',
    'magnetresonanztomographie': 'Magnetresonanztomographie', 
    'mrt': 'MRT',
    'röntgen': 'Röntgen',
    'radiographie': 'Radiographie',
    'szintigraphie': 'Szintigraphie',
    'nuklearmedizin': 'Nuklearmedizin',
    
    # Anatomical structures
    'brust': 'Brust',
    'mamma': 'Mamma',
    'lunge': 'Lunge',
    'herz': 'Herz',
    'leber': 'Leber', 
    'niere': 'Niere',
    'gehirn': 'Gehirn',
    'wirbelsäule': 'Wirbelsäule',
    'abdomen': 'Abdomen',
    'thorax': 'Thorax',
    'becken': 'Becken',
    'extremitäten': 'Extremitäten',
    
    # Clinical findings
    'unauffällig': 'unauffällig',
    'auffällig': 'auffällig', 
    'pathologisch': 'pathologisch',
    'normal': 'normal',
    'abnormal': 'abnormal',
    'verdächtig': 'verdächtig',
    'maligne': 'maligne',
    'benigne': 'benigne',
    'zystisch': 'zystisch',
    'solid': 'solid',
    'entzündlich': 'entzündlich',
    
    # Severity levels
    'leicht': 'leicht',
    'mäßig': 'mäßig', 
    'schwer': 'schwer',
    'hochgradig': 'hochgradig',
    'geringgradig': 'geringgradig',
    'mittelgradig': 'mittelgradig',
    
    # Common medical descriptors
    'akut': 'akut',
    'chronisch': 'chronisch',
    'rezidivierend': 'rezidivierend',
    'progredient': 'progredient',
    'stabil': 'stabil',
    'rückläufig': 'rückläufig'
}


def create_sample_ontology() -> MedicalOntology:
    """Create sample ontology for testing"""
    ontology = MedicalOntology()
    
    # Create sample patient
    patient = Patient(
        patient_id="P001",
        name="Sample Patient",
        age=45,
        gender="female"
    )
    ontology.add_entity(patient)
    
    # Create sample report
    report = MedicalReport(
        report_id="R001",
        patient_id="P001",
        modality=ModalityType.MAMMOGRAPHY,
        report_text="Mammographie-Untersuchung zeigt normale Befunde",
        language="de"
    )
    ontology.add_entity(report)
    
    # Create relationship
    relationship = MedicalRelationship(
        relationship_type=RelationshipType.GENERATED_BY,
        source_entity_id=report.id,
        target_entity_id=patient.id
    )
    ontology.add_relationship(relationship)
    
    return ontology


if __name__ == "__main__":
    # Test the ontology
    ontology = create_sample_ontology()
    print("Sample ontology created:")
    print(ontology.get_statistics())