"""
Exact Report Agents - Medical report processing with exact text preservation
All outputs are guaranteed to be exact substrings from the source text
"""

import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from app.services.exact_text_extractor import exact_text_extractor, ExtractedSection

logger = logging.getLogger(__name__)


@dataclass
class AgentExtractionResult:
    """Result from agent extraction with exact text"""
    agent_type: str
    sections: List[ExtractedSection]
    confidence: float
    training_examples: List[Dict[str, Any]]


class BaseReportAgent:
    """Base class for specialized medical report agents"""
    
    def __init__(self, agent_type: str, keywords: List[str], body_regions: List[str]):
        self.agent_type = agent_type
        self.keywords = keywords
        self.body_regions = body_regions
        self.extractor = exact_text_extractor
    
    def match_report(self, report_text: str, order: str) -> float:
        """Calculate match score for this agent"""
        score = 0.0
        report_lower = report_text.lower()
        order_lower = order.lower()
        
        # Check keywords
        for keyword in self.keywords:
            if keyword.lower() in report_lower or keyword.lower() in order_lower:
                score += 0.2
        
        # Check body regions
        for region in self.body_regions:
            if region.lower() in report_lower or region.lower() in order_lower:
                score += 0.1
        
        return min(score, 1.0)
    
    def extract_report_sections(self, report_text: str) -> List[ExtractedSection]:
        """Extract all sections from report"""
        return self.extractor.extract_sections(report_text)
    
    def create_training_examples(
        self, 
        report_text: str, 
        order: str,
        sections: List[ExtractedSection]
    ) -> List[Dict[str, Any]]:
        """Create training examples with exact text preservation"""
        examples = []
        
        # Common examples for all agents
        for section in sections:
            if section.name.lower() in ['indikation', 'fragestellung', 'indication']:
                example = self.extractor.create_training_pair(
                    report_text,
                    section.start_pos,
                    section.end_pos,
                    context_before=200,
                    context_after=100
                )
                if example:
                    example["instruction"] = f"Was ist die klinische Fragestellung für diese {order} Untersuchung?"
                    examples.append(example)
            
            elif section.name.lower() in ['befund', 'befunde', 'findings']:
                example = self.extractor.create_training_pair(
                    report_text,
                    section.start_pos,
                    section.end_pos,
                    context_before=300,
                    context_after=200
                )
                if example:
                    example["instruction"] = f"Beschreibe die Befunde dieser {self.agent_type.replace('_', ' ')} Untersuchung:"
                    examples.append(example)
            
            elif section.name.lower() in ['beurteilung', 'zusammenfassung', 'assessment']:
                example = self.extractor.create_training_pair(
                    report_text,
                    section.start_pos,
                    section.end_pos,
                    context_before=500,
                    context_after=100
                )
                if example:
                    example["instruction"] = "Fasse die radiologische Beurteilung zusammen:"
                    examples.append(example)
        
        # Add agent-specific examples
        specific_examples = self._create_specific_examples(report_text, order)
        examples.extend(specific_examples)
        
        return examples
    
    def _create_specific_examples(self, report_text: str, order: str) -> List[Dict[str, Any]]:
        """Override in subclasses for agent-specific examples"""
        return []


class SpineMRIAgent(BaseReportAgent):
    """Agent specialized for spine MRI reports"""
    
    def __init__(self):
        super().__init__(
            agent_type="spine_mri",
            keywords=['wirbelsäule', 'wirbel', 'bandscheib', 'spine', 'spinal', 'lws', 'hws', 'bws', 'myelon'],
            body_regions=['lws', 'hws', 'bws', 'wirbelsäule', 'sakrum']
        )
    
    def _create_specific_examples(self, report_text: str, order: str) -> List[Dict[str, Any]]:
        examples = []
        
        # Extract stenosis findings
        stenosis_findings = self.extractor.find_pathology_sentences(report_text)
        stenosis_sentences = []
        
        for start, end, sentence in stenosis_findings:
            if any(word in sentence.lower() for word in ['stenose', 'einengung', 'spinalkanal', 'neuroforamen']):
                stenosis_sentences.append((start, end, sentence))
        
        if stenosis_sentences:
            # Use first stenosis sentence as exact output
            start, end, sentence = stenosis_sentences[0]
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Beschreibe die Stenosen in diesem Befund:"
                examples.append(example)
        
        # Extract disc level mentions
        disc_levels = []
        import re
        disc_pattern = re.compile(r'(LWK|BWK|HWK|L|C|T)\s*\d+[-/]\s*\d+')
        
        for match in disc_pattern.finditer(report_text):
            disc_levels.append((match.start(), match.end(), match.group(0)))
        
        if disc_levels:
            # Find a sentence containing disc information
            sentences = self.extractor.find_pathology_sentences(report_text)
            for sent_start, sent_end, sentence in sentences:
                if any(disc[2] in sentence for disc in disc_levels[:3]):
                    example = self.extractor.create_training_pair(report_text, sent_start, sent_end)
                    if example:
                        example["instruction"] = f"Beschreibe die Bandscheibenbefunde dieser {order} Untersuchung:"
                        examples.append(example)
                        break
        
        return examples


class CTScanAgent(BaseReportAgent):
    """Agent specialized for CT scan reports"""
    
    def __init__(self):
        super().__init__(
            agent_type="ct_scan",
            keywords=['ct', 'computertomographie', 'tomographie', 'kontrastmittel', 'spiral-ct', 'hrct'],
            body_regions=['thorax', 'abdomen', 'becken', 'kopf', 'hals', 'schädel']
        )
    
    def _create_specific_examples(self, report_text: str, order: str) -> List[Dict[str, Any]]:
        examples = []
        
        # Extract contrast information
        contrast_section = self.extractor.extract_by_type(report_text, 'technique')
        if contrast_section and 'kontrastmittel' in contrast_section.content.lower():
            example = self.extractor.create_training_pair(
                report_text,
                contrast_section.start_pos,
                contrast_section.end_pos
            )
            if example:
                example["instruction"] = "Welches Kontrastmittelprotokoll wurde verwendet?"
                examples.append(example)
        
        # Extract density measurements
        measurements = self.extractor.find_measurements(report_text)
        hu_measurements = []
        
        for start, end, measurement in measurements:
            if 'HU' in measurement or 'Hounsfield' in measurement:
                hu_measurements.append((start, end, measurement))
        
        if hu_measurements:
            # Use first HU measurement
            start, end, measurement = hu_measurements[0]
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Welche Dichtewerte wurden gemessen?"
                examples.append(example)
        
        return examples


class MammographyAgent(BaseReportAgent):
    """Agent specialized for mammography reports"""
    
    def __init__(self):
        super().__init__(
            agent_type="mammography",
            keywords=['mammographie', 'mamma', 'brust', 'breast', 'birads', 'mammo'],
            body_regions=['mamma', 'brust', 'axilla']
        )
    
    def _create_specific_examples(self, report_text: str, order: str) -> List[Dict[str, Any]]:
        examples = []
        
        # Extract BI-RADS classification
        import re
        birads_pattern = re.compile(r'(BI-?RADS|ACR)\s*([0-6]|[IVX]+)[^.]*\.')
        
        for match in birads_pattern.finditer(report_text):
            start, end = match.span()
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Welche BI-RADS Klassifikation wurde vergeben?"
                examples.append(example)
                break
        
        # Extract breast density
        density_pattern = re.compile(r'(ACR|Dichte|Dichtetyp)\s*([A-D]|[1-4])[^.]*\.')
        
        for match in density_pattern.finditer(report_text):
            start, end = match.span()
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Welche Brustdichte liegt vor?"
                examples.append(example)
                break
        
        return examples


class PathologyAgent(BaseReportAgent):
    """Agent specialized for pathology reports"""
    
    def __init__(self):
        super().__init__(
            agent_type="pathology",
            keywords=['histologie', 'biopsie', 'pathologie', 'gewebe', 'tumor', 'zytologie', 'immunhistochemie'],
            body_regions=['various']
        )
    
    def _create_specific_examples(self, report_text: str, order: str) -> List[Dict[str, Any]]:
        examples = []
        
        # Extract grading information
        import re
        grade_pattern = re.compile(r'(Grad|Grade|G)\s*[1-4][^.]*\.')
        
        for match in grade_pattern.finditer(report_text):
            start, end = match.span()
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Welches Grading wurde festgestellt?"
                examples.append(example)
                break
        
        # Extract staging information
        staging_pattern = re.compile(r'(pT|pN|pM|Stage)\s*\d+[a-z]*[^.]*\.')
        
        for match in staging_pattern.finditer(report_text):
            start, end = match.span()
            example = self.extractor.create_training_pair(report_text, start, end)
            if example:
                example["instruction"] = "Welches pathologische Staging liegt vor?"
                examples.append(example)
                break
        
        return examples


class ExactReportAgentFactory:
    """Factory for creating and managing exact report agents"""
    
    def __init__(self):
        self.agents = {
            'spine_mri': SpineMRIAgent(),
            'ct_scan': CTScanAgent(),
            'mammography': MammographyAgent(),
            'pathology': PathologyAgent()
        }
    
    def process_report(
        self, 
        report_text: str, 
        order: str,
        metadata: Dict[str, Any]
    ) -> List[AgentExtractionResult]:
        """Process a report with all matching agents"""
        results = []
        
        # Score each agent's match with the report
        agent_scores = {}
        for agent_type, agent in self.agents.items():
            score = agent.match_report(report_text, order)
            if score > 0.3:  # Threshold for agent activation
                agent_scores[agent_type] = score
        
        # Use top matching agents
        top_agents = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)[:3]
        
        for agent_type, confidence in top_agents:
            agent = self.agents[agent_type]
            
            # Extract sections
            sections = agent.extract_report_sections(report_text)
            
            # Generate training examples
            examples = agent.create_training_examples(report_text, order, sections)
            
            # Add metadata to examples
            for example in examples:
                example['agent_type'] = agent_type
                example['confidence'] = confidence
                example['exam_type'] = metadata.get('ExamDescription', '')
                example['icd_code'] = metadata.get('ICD_Code', '')
            
            result = AgentExtractionResult(
                agent_type=agent_type,
                sections=sections,
                confidence=confidence,
                training_examples=examples
            )
            
            results.append(result)
        
        return results


# Global instance
exact_report_agent_factory = ExactReportAgentFactory()