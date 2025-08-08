"""
German medical vocabulary correction and enhancement
"""

import re
from typing import Dict, List, Tuple

class GermanMedicalVocabulary:
    """Handles German medical terminology corrections and enhancements"""
    
    def __init__(self):
        # Common medical term corrections
        self.corrections = {
            # Anatomical terms
            'wirbel säule': 'Wirbelsäule',
            'lenden wirbel': 'Lendenwirbel',
            'brust wirbel': 'Brustwirbel',
            'band scheibe': 'Bandscheibe',
            'band scheiben': 'Bandscheiben',
            'spinal kanal': 'Spinalkanal',
            'nerven wurzel': 'Nervenwurzel',
            'zwischen wirbel': 'Zwischenwirbelraum',
            
            # Medical conditions
            'pro laps': 'Prolaps',
            'pro trusion': 'Protrusion',
            'ste nose': 'Stenose',
            'frak tur': 'Fraktur',
            'osteo porose': 'Osteoporose',
            'arth rose': 'Arthrose',
            'spon dylose': 'Spondylose',
            'osteo chondrose': 'Osteochondrose',
            
            # Medical procedures
            'computer tomographie': 'Computertomographie',
            'ct untersuchung': 'CT-Untersuchung',
            'mrt untersuchung': 'MRT-Untersuchung',
            'rönt gen': 'Röntgen',
            'ultra schall': 'Ultraschall',
            'mammo graphie': 'Mammographie',
            
            # Medical terms
            'be fund': 'Befund',
            'diag nose': 'Diagnose',
            'unter suchung': 'Untersuchung',
            'auf fällig': 'auffällig',
            'un auffällig': 'unauffällig',
            'patho logisch': 'pathologisch',
            'physio logisch': 'physiologisch',
            
            # Common misrecognitions
            'kd': 'CD',
            'birads': 'BI-RADS',
            'bi rads': 'BI-RADS',
            't1': 'T1',
            't2': 'T2',
            'l1': 'L1',
            'l2': 'L2',
            'l3': 'L3',
            'l4': 'L4',
            'l5': 'L5',
            's1': 'S1',
            
            # Medical abbreviations
            'bzw': 'beziehungsweise',
            'ggf': 'gegebenenfalls',
            'z.b.': 'zum Beispiel',
            'ca.': 'circa',
            'sog.': 'sogenannte',
            'evtl.': 'eventuell',
            
            # Compound words
            'knochen mark': 'Knochenmark',
            'weich teil': 'Weichteil',
            'kontrast mittel': 'Kontrastmittel',
            'signal anhebung': 'Signalanhebung',
            'signal absenkung': 'Signalabsenkung',
            
            # Direction terms
            'ventral': 'ventral',
            'dorsal': 'dorsal',
            'kranial': 'kranial',
            'kaudal': 'kaudal',
            'medial': 'medial',
            'lateral': 'lateral',
            'bilateral': 'bilateral',
            'beidseits': 'beidseits',
            'links seitig': 'linksseitig',
            'rechts seitig': 'rechtsseitig',
        }
        
        # Medical phrases that should be kept together
        self.medical_phrases = [
            'keine Auffälligkeiten',
            'regelrecht konfiguriert',
            'normal weit',
            'frei durchgängig',
            'kein Nachweis',
            'keine Hinweise auf',
            'im Normbereich',
            'altersgerecht',
            'seitengleich',
            'symmetrisch',
        ]
        
        # Common medical sentence patterns
        self.sentence_patterns = [
            (r'zeigt sich (ein|eine|keine)', r'zeigt sich \1'),
            (r'findet sich (ein|eine|kein|keine)', r'findet sich \1'),
            (r'nachweisbar (ist|sind)', r'nachweisbar \1'),
            (r'erkennbar (ist|sind)', r'erkennbar \1'),
            (r'darstellbar (ist|sind)', r'darstellbar \1'),
        ]
    
    def correct_text(self, text: str) -> str:
        """Apply medical vocabulary corrections to text"""
        if not text:
            return text
        
        # Apply basic corrections
        corrected = text
        
        # Case-insensitive replacements
        for wrong, correct in self.corrections.items():
            pattern = re.compile(re.escape(wrong), re.IGNORECASE)
            corrected = pattern.sub(correct, corrected)
        
        # Fix spacing around hyphens and slashes
        corrected = re.sub(r'\s*-\s*', '-', corrected)
        corrected = re.sub(r'\s*/\s*', '/', corrected)
        
        # Fix spacing around punctuation
        corrected = re.sub(r'\s+([.,;:!?])', r'\1', corrected)
        corrected = re.sub(r'([.,;:!?])(?=[A-Za-zÄÖÜäöü])', r'\1 ', corrected)
        
        # Apply sentence pattern corrections
        for pattern, replacement in self.sentence_patterns:
            corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
        
        # Ensure proper capitalization for medical terms
        corrected = self._fix_capitalization(corrected)
        
        # Fix number-letter combinations (e.g., "L 4" -> "L4")
        corrected = re.sub(r'([LTSC])\s+(\d)', r'\1\2', corrected)
        
        # Fix decimal numbers
        corrected = re.sub(r'(\d)\s*,\s*(\d)', r'\1,\2', corrected)
        
        return corrected.strip()
    
    def _fix_capitalization(self, text: str) -> str:
        """Fix capitalization of medical terms"""
        # Split into sentences
        sentences = re.split(r'([.!?]+)', text)
        
        result = []
        for i, part in enumerate(sentences):
            if i % 2 == 0 and part.strip():  # Text parts (not punctuation)
                # Capitalize first letter of sentence
                if part.strip():
                    part = part.strip()
                    part = part[0].upper() + part[1:] if part else part
                
                # Capitalize specific medical terms
                for term in ['Wirbelsäule', 'Bandscheibe', 'Befund', 'Patient', 
                           'Untersuchung', 'Röntgen', 'MRT', 'CT']:
                    pattern = re.compile(re.escape(term.lower()), re.IGNORECASE)
                    part = pattern.sub(term, part)
                
                result.append(part)
            else:
                result.append(part)
        
        return ''.join(result)
    
    def enhance_medical_context(self, text: str, examination_type: str = None) -> str:
        """Enhance text with medical context"""
        enhanced = text
        
        # Add examination type context if provided
        if examination_type and examination_type.upper() in ['MRT', 'CT', 'RÖNTGEN']:
            if not any(exam in enhanced.upper() for exam in ['MRT', 'CT', 'RÖNTGEN']):
                enhanced = f"{examination_type}-Untersuchung: {enhanced}"
        
        # Ensure medical phrases are properly formatted
        for phrase in self.medical_phrases:
            pattern = re.compile(phrase.replace(' ', r'\s+'), re.IGNORECASE)
            enhanced = pattern.sub(phrase, enhanced)
        
        return enhanced
    
    def get_medical_entities(self, text: str) -> List[Tuple[str, str]]:
        """Extract medical entities from text"""
        entities = []
        
        # Anatomical structures
        anatomical_terms = [
            'Wirbelsäule', 'Bandscheibe', 'Spinalkanal', 'Nervenwurzel',
            'Lendenwirbel', 'Brustwirbel', 'Halswirbel', 'Facettengelenk',
            'Wirbelkörper', 'Dornfortsatz', 'Querfortsatz'
        ]
        
        # Medical conditions
        conditions = [
            'Prolaps', 'Protrusion', 'Stenose', 'Fraktur', 'Arthrose',
            'Spondylose', 'Osteochondrose', 'Osteoporose', 'Skoliose',
            'Kyphose', 'Lordose', 'Spondylolisthesis'
        ]
        
        # Extract entities
        for term in anatomical_terms:
            if term.lower() in text.lower():
                entities.append((term, 'ANATOMY'))
        
        for term in conditions:
            if term.lower() in text.lower():
                entities.append((term, 'CONDITION'))
        
        return entities


# Singleton instance
german_medical_vocabulary = GermanMedicalVocabulary()