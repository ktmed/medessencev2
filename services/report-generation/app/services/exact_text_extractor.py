"""
Exact Text Extractor for Medical Reports
Ensures all extracted content is EXACTLY from the source text
No modifications, no generation, no truncation
"""

import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ExtractedSection:
    """Represents an extracted section from a medical report"""
    name: str
    start_pos: int
    end_pos: int
    content: str
    header: str
    
    def get_with_context(self, full_text: str, before: int = 500, after: int = 200) -> str:
        """Get section with surrounding context"""
        context_start = max(0, self.start_pos - before)
        context_end = min(len(full_text), self.end_pos + after)
        return full_text[context_start:context_end]


class ExactTextExtractor:
    """Extract exact text from medical reports without any modifications"""
    
    def __init__(self):
        # Common section headers in German medical reports
        self.section_headers = [
            # German headers
            'Indikation', 'Fragestellung', 'Klinische Angaben', 'Anamnese',
            'Technik', 'Methode', 'Untersuchungstechnik', 'Protokoll',
            'Befund', 'Befunde', 'Beschreibung',
            'Beurteilung', 'Zusammenfassung', 'Bewertung', 'Schlussfolgerung',
            'Diagnose', 'Diagnosen',
            'Empfehlung', 'Procedere', 'Weiteres Vorgehen',
            'Vergleich', 'Voruntersuchung',
            'Kontrastmittel', 'KM',
            'Limitation', 'Einschränkung',
            # English headers (sometimes used)
            'Indication', 'Clinical History', 'Technique', 'Findings',
            'Impression', 'Assessment', 'Recommendation', 'Comparison'
        ]
        
        # Common end markers for sections
        self.end_markers = [
            'Mit freundlichen Grüßen',
            'Mit kollegialen Grüßen',
            'Hochachtungsvoll',
            'Dr. med.',
            'Prof. Dr.',
            'Facharzt für',
            'Fachärztin für'
        ]
    
    def extract_sections(self, text: str) -> List[ExtractedSection]:
        """Extract all sections from the report preserving exact text"""
        sections = []
        text_lower = text.lower()
        
        # Find all potential section headers
        potential_sections = []
        
        for header in self.section_headers:
            header_lower = header.lower()
            
            # Look for header followed by colon
            search_patterns = [
                header_lower + ':',
                header_lower + ' :',
                '\n' + header_lower + ':',
                '\n' + header_lower + ' :'
            ]
            
            for pattern in search_patterns:
                pos = 0
                while True:
                    pos = text_lower.find(pattern, pos)
                    if pos == -1:
                        break
                    
                    # Find the actual header in original case
                    header_start = pos
                    if pattern.startswith('\n'):
                        header_start += 1
                    
                    # Find end of header (after colon)
                    header_end = text.find(':', header_start) + 1
                    if header_end == 0:
                        pos += 1
                        continue
                    
                    actual_header = text[header_start:header_end].strip()
                    
                    potential_sections.append({
                        'name': header,
                        'header': actual_header,
                        'start': header_start,
                        'content_start': header_end
                    })
                    
                    pos = header_end
        
        # Sort by position
        potential_sections.sort(key=lambda x: x['start'])
        
        # Determine section boundaries
        for i, section in enumerate(potential_sections):
            start_pos = section['start']
            content_start = section['content_start']
            
            # Find end of section
            if i + 1 < len(potential_sections):
                # Next section starts
                end_pos = potential_sections[i + 1]['start']
            else:
                # Look for end markers or end of text
                end_pos = len(text)
                for marker in self.end_markers:
                    marker_pos = text.find(marker, content_start)
                    if marker_pos != -1 and marker_pos < end_pos:
                        end_pos = marker_pos
            
            # Extract exact content
            content = text[content_start:end_pos].strip()
            
            if content:  # Only add non-empty sections
                sections.append(ExtractedSection(
                    name=section['name'],
                    start_pos=start_pos,
                    end_pos=end_pos,
                    content=content,
                    header=section['header']
                ))
        
        return sections
    
    def extract_by_type(self, text: str, section_type: str) -> Optional[ExtractedSection]:
        """Extract a specific section type from the report"""
        sections = self.extract_sections(text)
        
        # Map section types to possible headers
        type_mapping = {
            'indication': ['Indikation', 'Fragestellung', 'Klinische Angaben', 'Anamnese', 'Indication'],
            'technique': ['Technik', 'Methode', 'Untersuchungstechnik', 'Protokoll', 'Technique'],
            'findings': ['Befund', 'Befunde', 'Beschreibung', 'Findings'],
            'assessment': ['Beurteilung', 'Zusammenfassung', 'Bewertung', 'Impression', 'Assessment'],
            'recommendation': ['Empfehlung', 'Procedere', 'Weiteres Vorgehen', 'Recommendation']
        }
        
        possible_headers = type_mapping.get(section_type.lower(), [])
        
        for section in sections:
            if section.name in possible_headers:
                return section
        
        return None
    
    def find_measurements(self, text: str) -> List[Tuple[int, int, str]]:
        """Find measurements in text and return exact positions"""
        measurements = []
        units = ['mm', 'cm', 'ml', 'mg', 'HU', 'kV', 'mAs', 'Tesla', 'T']
        
        for unit in units:
            pos = 0
            while True:
                pos = text.find(unit, pos)
                if pos == -1:
                    break
                
                # Look backwards for number
                start = pos - 1
                while start >= 0 and (text[start].isdigit() or text[start] in '., '):
                    start -= 1
                start += 1
                
                # Look forward to complete unit
                end = pos + len(unit)
                
                # Extend to sentence boundary
                while end < len(text) and text[end] not in '.!?\n':
                    end += 1
                if end < len(text) and text[end] == '.':
                    end += 1
                
                measurement_text = text[start:end].strip()
                if measurement_text and any(c.isdigit() for c in measurement_text):
                    measurements.append((start, end, measurement_text))
                
                pos = end
        
        return measurements
    
    def find_pathology_sentences(self, text: str) -> List[Tuple[int, int, str]]:
        """Find sentences containing pathological findings"""
        findings = []
        
        # Pathological finding keywords
        pathology_keywords = [
            'unauffällig', 'regelrecht', 'normal', 'ohne Nachweis',
            'Tumor', 'Metastase', 'Läsion', 'Herdbefund',
            'Stenose', 'Einengung', 'Kompression',
            'Entzündung', 'Infektion', 'Abszess',
            'Fraktur', 'Ruptur', 'Riss',
            'Zyste', 'Knoten', 'Verkalkung',
            'Erguss', 'Flüssigkeit', 'Ödem'
        ]
        
        # Split text into sentences
        sentences = []
        start = 0
        for i, char in enumerate(text):
            if char in '.!?':
                sentences.append((start, i + 1, text[start:i + 1].strip()))
                start = i + 1
        
        # Check each sentence for pathology keywords
        for sent_start, sent_end, sentence in sentences:
            sentence_lower = sentence.lower()
            for keyword in pathology_keywords:
                if keyword.lower() in sentence_lower:
                    findings.append((sent_start, sent_end, sentence))
                    break
        
        return findings
    
    def extract_exact_span(self, text: str, start: int, end: int) -> str:
        """Extract exact text span with validation"""
        if start < 0 or end > len(text) or start >= end:
            return ""
        return text[start:end]
    
    def create_training_pair(
        self, 
        text: str, 
        output_start: int, 
        output_end: int,
        context_before: int = 500,
        context_after: int = 200
    ) -> Dict[str, str]:
        """Create a training input-output pair ensuring output is in input"""
        
        # Extract exact output
        output = self.extract_exact_span(text, output_start, output_end)
        if not output:
            return None
        
        # Get context ensuring it contains the output
        context_start = max(0, output_start - context_before)
        context_end = min(len(text), output_end + context_after)
        
        input_text = self.extract_exact_span(text, context_start, context_end)
        
        # Validate output is in input
        if output not in input_text:
            # Expand context if needed
            context_start = max(0, output_start - context_before * 2)
            context_end = min(len(text), output_end + context_after * 2)
            input_text = self.extract_exact_span(text, context_start, context_end)
        
        if output in input_text:
            return {
                "input": input_text,
                "output": output,
                "validation": {
                    "output_position": input_text.find(output),
                    "output_in_input": True
                }
            }
        
        return None


# Global instance
exact_text_extractor = ExactTextExtractor()