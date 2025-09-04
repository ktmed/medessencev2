#!/usr/bin/env python3
"""
Advanced Medical Pattern Matcher
Extracts complex medical patterns and templates for auto-completion and structured reporting
"""
import re
import json
import logging
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set, Optional
import pandas as pd
from pathlib import Path
import networkx as nx
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class MedicalPattern:
    """Represents a medical reporting pattern"""
    pattern: str
    template: str
    frequency: int
    confidence: float
    category: str
    context: str
    variables: List[str]
    example: str

class AdvancedPatternMatcher:
    """Advanced pattern matcher for medical reports with template generation"""
    
    def __init__(self):
        self.patterns = defaultdict(list)
        self.templates = defaultdict(list)
        self.phrase_patterns = {}
        self.semantic_patterns = defaultdict(list)
        
        # Define medical report section patterns
        self.section_patterns = {
            'indication': [
                r'indikation[:\s]*(.*?)(?=\n|\.|;)',
                r'fragestellung[:\s]*(.*?)(?=\n|\.|;)',
                r'klinische angabe[:\s]*(.*?)(?=\n|\.|;)'
            ],
            'technique': [
                r'technik[:\s]*(.*?)(?=\n|\.|;)',
                r'untersuchung[:\s]*(.*?)(?=\n|\.|;)',
                r'methode[:\s]*(.*?)(?=\n|\.|;)'
            ],
            'findings': [
                r'befund[:\s]*(.*?)(?=beurteilung|fazit|\n\n)',
                r'beschreibung[:\s]*(.*?)(?=beurteilung|fazit|\n\n)',
                r'darstellung[:\s]*(.*?)(?=beurteilung|fazit|\n\n)'
            ],
            'assessment': [
                r'beurteilung[:\s]*(.*?)(?=empfehlung|\n\n|$)',
                r'fazit[:\s]*(.*?)(?=empfehlung|\n\n|$)',
                r'diagnose[:\s]*(.*?)(?=empfehlung|\n\n|$)'
            ],
            'recommendation': [
                r'empfehlung[:\s]*(.*?)(?=\n\n|$)',
                r'weiteres vorgehen[:\s]*(.*?)(?=\n\n|$)',
                r'kontrolle[:\s]*(.*?)(?=\n\n|$)'
            ]
        }
        
        # Medical sentence patterns with variables
        self.sentence_patterns = [
            # Anatomical descriptions
            {
                'pattern': r'(?:die|der|das)\s+(\w+)\s+(?:ist|sind|zeigt|zeigen)\s+(\w+)',
                'template': 'Die {anatomy} {verb} {finding}',
                'category': 'anatomical_description',
                'variables': ['anatomy', 'verb', 'finding']
            },
            {
                'pattern': r'im\s+bereich\s+(?:des|der)\s+(\w+)\s+(\w+)',
                'template': 'Im Bereich {location} {finding}',
                'category': 'location_finding',
                'variables': ['location', 'finding']
            },
            {
                'pattern': r'darstellung\s+(\w+)\s+(\w+)',
                'template': 'Darstellung {modifier} {anatomy}',
                'category': 'description',
                'variables': ['modifier', 'anatomy']
            },
            
            # Pathological findings
            {
                'pattern': r'nachweis\s+(?:von|einer?)\s+(\w+)',
                'template': 'Nachweis {pathology}',
                'category': 'positive_finding',
                'variables': ['pathology']
            },
            {
                'pattern': r'kein\s+nachweis\s+(?:von|einer?)\s+(\w+)',
                'template': 'Kein Nachweis {pathology}',
                'category': 'negative_finding',
                'variables': ['pathology']
            },
            {
                'pattern': r'verdacht\s+auf\s+(\w+)',
                'template': 'Verdacht auf {pathology}',
                'category': 'suspected_finding',
                'variables': ['pathology']
            },
            
            # Measurements and grades
            {
                'pattern': r'grad\s+([I-V]+|\d+)\s+(\w+)',
                'template': 'Grad {grade} {pathology}',
                'category': 'graded_finding',
                'variables': ['grade', 'pathology']
            },
            {
                'pattern': r'(?:ca\.|circa)\s*(\d+(?:\.\d+)?)\s*(mm|cm)\s+(\w+)',
                'template': 'Ca. {measurement} {unit} {structure}',
                'category': 'measurement',
                'variables': ['measurement', 'unit', 'structure']
            },
            
            # Comparative findings
            {
                'pattern': r'im\s+vergleich\s+zur?\s+(\w+)\s+(\w+)',
                'template': 'Im Vergleich zu {comparison} {finding}',
                'category': 'comparative',
                'variables': ['comparison', 'finding']
            },
            {
                'pattern': r'gegenüber\s+(\w+)\s+(\w+)',
                'template': 'Gegenüber {baseline} {change}',
                'category': 'change_description',
                'variables': ['baseline', 'change']
            },
            
            # Treatment and post-operative
            {
                'pattern': r'zustand\s+nach\s+(\w+)',
                'template': 'Zustand nach {procedure}',
                'category': 'post_procedure',
                'variables': ['procedure']
            },
            {
                'pattern': r'(?:nach|unter)\s+(\w+)\s+(\w+)',
                'template': 'Nach {treatment} {result}',
                'category': 'treatment_result',
                'variables': ['treatment', 'result']
            }
        ]
        
        # Complex multi-sentence patterns
        self.complex_patterns = [
            {
                'name': 'spine_degenerative_pattern',
                'pattern': [
                    r'darstellung.*wirbelsäule',
                    r'bandscheibe.*(?:protrusion|prolaps|degeneration)',
                    r'spinalkanal.*(?:stenose|einengung)'
                ],
                'template': '''
Darstellung der {spine_level} Wirbelsäule.
Die Bandscheiben zeigen {degeneration_grade} degenerative Veränderungen.
{specific_findings}
{spinal_canal_assessment}
''',
                'category': 'spine_degenerative',
                'variables': ['spine_level', 'degeneration_grade', 'specific_findings', 'spinal_canal_assessment']
            },
            {
                'name': 'joint_arthritis_pattern',
                'pattern': [
                    r'gelenk.*darstellung',
                    r'knorpel.*(?:verschmälerung|ausdünnung)',
                    r'(?:arthrose|arthritis)'
                ],
                'template': '''
Darstellung des {joint} Gelenks.
Der Gelenkknorpel zeigt {cartilage_changes}.
{arthritis_grade} Arthrose mit {specific_changes}.
''',
                'category': 'joint_arthritis',
                'variables': ['joint', 'cartilage_changes', 'arthritis_grade', 'specific_changes']
            }
        ]
        
    def extract_patterns(self, reports: List[str]) -> Dict[str, List[MedicalPattern]]:
        """Extract patterns from medical reports"""
        logger.info(f"Extracting patterns from {len(reports)} reports")
        
        all_patterns = defaultdict(list)
        
        for i, report in enumerate(reports):
            if i % 1000 == 0:
                logger.info(f"Processing report {i}/{len(reports)}")
                
            if not report or pd.isna(report):
                continue
                
            report = str(report).lower()
            
            # Extract section patterns
            section_patterns = self.extract_section_patterns(report)
            for section, patterns in section_patterns.items():
                all_patterns[f'section_{section}'].extend(patterns)
                
            # Extract sentence patterns
            sentence_patterns = self.extract_sentence_patterns(report)
            for category, patterns in sentence_patterns.items():
                all_patterns[f'sentence_{category}'].extend(patterns)
                
            # Extract complex patterns
            complex_patterns = self.extract_complex_patterns(report)
            for category, patterns in complex_patterns.items():
                all_patterns[f'complex_{category}'].extend(patterns)
                
            # Extract phrase patterns
            phrase_patterns = self.extract_phrase_patterns(report)
            all_patterns['phrases'].extend(phrase_patterns)
            
        # Consolidate and rank patterns
        consolidated_patterns = self.consolidate_patterns(all_patterns)
        
        return consolidated_patterns
        
    def extract_section_patterns(self, report: str) -> Dict[str, List[MedicalPattern]]:
        """Extract patterns from report sections"""
        section_patterns = defaultdict(list)
        
        for section, patterns in self.section_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, report, re.IGNORECASE | re.MULTILINE)
                for match in matches:
                    content = match.group(1).strip()
                    if len(content) > 10:  # Only meaningful content
                        pattern_obj = MedicalPattern(
                            pattern=pattern,
                            template=f"{section.title()}: {{content}}",
                            frequency=1,
                            confidence=0.9,
                            category=section,
                            context=report[max(0, match.start()-50):match.end()+50],
                            variables=['content'],
                            example=content
                        )
                        section_patterns[section].append(pattern_obj)
                        
        return section_patterns
        
    def extract_sentence_patterns(self, report: str) -> Dict[str, List[MedicalPattern]]:
        """Extract sentence-level patterns"""
        sentence_patterns = defaultdict(list)
        
        sentences = re.split(r'[.!?]+', report)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 10:
                continue
                
            for pattern_def in self.sentence_patterns:
                matches = re.finditer(pattern_def['pattern'], sentence, re.IGNORECASE)
                for match in matches:
                    variables = list(match.groups())
                    if len(variables) == len(pattern_def['variables']):
                        pattern_obj = MedicalPattern(
                            pattern=pattern_def['pattern'],
                            template=pattern_def['template'],
                            frequency=1,
                            confidence=0.8,
                            category=pattern_def['category'],
                            context=sentence,
                            variables=variables,
                            example=sentence
                        )
                        sentence_patterns[pattern_def['category']].append(pattern_obj)
                        
        return sentence_patterns
        
    def extract_complex_patterns(self, report: str) -> Dict[str, List[MedicalPattern]]:
        """Extract complex multi-sentence patterns"""
        complex_patterns = defaultdict(list)
        
        for pattern_def in self.complex_patterns:
            # Check if all sub-patterns are present
            pattern_matches = []
            for sub_pattern in pattern_def['pattern']:
                matches = list(re.finditer(sub_pattern, report, re.IGNORECASE))
                if matches:
                    pattern_matches.append(matches[0])
                else:
                    pattern_matches = None
                    break
                    
            if pattern_matches:
                # Extract the relevant section of the report
                start_pos = min(match.start() for match in pattern_matches)
                end_pos = max(match.end() for match in pattern_matches)
                context = report[start_pos:end_pos]
                
                pattern_obj = MedicalPattern(
                    pattern=str(pattern_def['pattern']),
                    template=pattern_def['template'],
                    frequency=1,
                    confidence=0.95,
                    category=pattern_def['category'],
                    context=context,
                    variables=pattern_def['variables'],
                    example=context[:200] + '...' if len(context) > 200 else context
                )
                complex_patterns[pattern_def['category']].append(pattern_obj)
                
        return complex_patterns
        
    def extract_phrase_patterns(self, report: str) -> List[MedicalPattern]:
        """Extract common phrase patterns"""
        phrases = []
        
        # Common medical phrase patterns
        phrase_patterns = [
            r'(?:unauffällig|regelrecht|normal)\w*\s+(?:darstellung|befund)',
            r'(?:diskret|geringgradig|mäßig|deutlich|hochgradig)\s+\w+',
            r'(?:bilateral|unilateral|links|rechts)\s+\w+',
            r'(?:ohne|mit)\s+(?:nachweis|hinweis)\s+\w+',
            r'im\s+(?:sinne|rahmen)\s+\w+',
            r'vereinbar\s+mit\s+\w+',
            r'typisch\s+für\s+\w+',
            r'passend\s+zu\s+\w+'
        ]
        
        for pattern in phrase_patterns:
            matches = re.finditer(pattern, report, re.IGNORECASE)
            for match in matches:
                phrase = match.group(0)
                if len(phrase) > 5:
                    pattern_obj = MedicalPattern(
                        pattern=pattern,
                        template=phrase,
                        frequency=1,
                        confidence=0.7,
                        category='phrase',
                        context=report[max(0, match.start()-20):match.end()+20],
                        variables=[],
                        example=phrase
                    )
                    phrases.append(pattern_obj)
                    
        return phrases
        
    def consolidate_patterns(self, all_patterns: Dict[str, List[MedicalPattern]]) -> Dict[str, List[MedicalPattern]]:
        """Consolidate and rank patterns by frequency"""
        logger.info("Consolidating patterns")
        
        consolidated = defaultdict(list)
        
        for category, patterns in all_patterns.items():
            if not patterns:
                continue
                
            # Group similar patterns
            pattern_groups = defaultdict(list)
            
            for pattern in patterns:
                # Use template as grouping key
                key = pattern.template if pattern.template else pattern.pattern
                pattern_groups[key].append(pattern)
                
            # Create consolidated patterns
            for template, group in pattern_groups.items():
                if len(group) < 2:  # Skip patterns that only appear once
                    continue
                    
                # Calculate aggregate statistics
                total_frequency = len(group)
                avg_confidence = sum(p.confidence for p in group) / len(group)
                
                # Get best example
                best_example = max(group, key=lambda x: len(x.example))
                
                # Collect all variables
                all_variables = set()
                for pattern in group:
                    all_variables.update(pattern.variables)
                
                consolidated_pattern = MedicalPattern(
                    pattern=group[0].pattern,
                    template=template,
                    frequency=total_frequency,
                    confidence=min(avg_confidence, 1.0),
                    category=group[0].category,
                    context=best_example.context,
                    variables=list(all_variables),
                    example=best_example.example
                )
                
                consolidated[category].append(consolidated_pattern)
                
            # Sort by frequency
            consolidated[category].sort(key=lambda x: x.frequency, reverse=True)
            # Keep top patterns only
            consolidated[category] = consolidated[category][:100]
            
        return dict(consolidated)
        
    def generate_templates(self, patterns: Dict[str, List[MedicalPattern]]) -> Dict[str, List[Dict]]:
        """Generate templates for structured reporting"""
        logger.info("Generating templates")
        
        templates = defaultdict(list)
        
        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                if pattern.frequency >= 5:  # Only include frequently used patterns
                    template_data = {
                        'id': f"{category}_{len(templates[category])}",
                        'name': f"{category.replace('_', ' ').title()} Template",
                        'template': pattern.template,
                        'variables': pattern.variables,
                        'category': category,
                        'frequency': pattern.frequency,
                        'confidence': pattern.confidence,
                        'example': pattern.example,
                        'usage_instructions': self.generate_usage_instructions(pattern)
                    }
                    templates[category].append(template_data)
                    
        return dict(templates)
        
    def generate_usage_instructions(self, pattern: MedicalPattern) -> str:
        """Generate usage instructions for a pattern"""
        instructions = f"Use this template for {pattern.category.replace('_', ' ')} descriptions. "
        
        if pattern.variables:
            instructions += "Fill in the following variables: " + ", ".join(f"{{{var}}}" for var in pattern.variables)
        
        instructions += f" Confidence: {pattern.confidence:.1%}, Used {pattern.frequency} times in corpus."
        
        return instructions
        
    def export_patterns(self, patterns: Dict[str, List[MedicalPattern]], output_dir: Path):
        """Export patterns to various formats"""
        logger.info(f"Exporting patterns to {output_dir}")
        
        # Create output directory
        output_dir.mkdir(exist_ok=True)
        
        # Convert to JSON-serializable format
        json_patterns = {}
        for category, pattern_list in patterns.items():
            json_patterns[category] = []
            for pattern in pattern_list:
                json_patterns[category].append({
                    'pattern': pattern.pattern,
                    'template': pattern.template,
                    'frequency': pattern.frequency,
                    'confidence': pattern.confidence,
                    'category': pattern.category,
                    'variables': pattern.variables,
                    'example': pattern.example
                })
                
        # Export as JSON
        with open(output_dir / 'medical_patterns.json', 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'created': datetime.now().isoformat(),
                    'total_categories': len(json_patterns),
                    'total_patterns': sum(len(patterns) for patterns in json_patterns.values())
                },
                'patterns': json_patterns
            }, f, ensure_ascii=False, indent=2)
            
        # Generate templates
        templates = self.generate_templates(patterns)
        
        with open(output_dir / 'medical_templates.json', 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'created': datetime.now().isoformat(),
                    'total_templates': sum(len(temps) for temps in templates.values())
                },
                'templates': templates
            }, f, ensure_ascii=False, indent=2)
            
        # Export as JavaScript module
        self.export_as_javascript(json_patterns, templates, output_dir)
        
        # Generate pattern statistics
        self.export_pattern_statistics(patterns, output_dir)
        
    def export_as_javascript(self, patterns: Dict, templates: Dict, output_dir: Path):
        """Export patterns as JavaScript module"""
        
        js_content = f"""/**
 * Medical Patterns and Templates
 * Generated: {datetime.now().isoformat()}
 * Auto-generated - Do not edit manually
 */

const MedicalPatterns = {{
  patterns: {json.dumps(patterns, ensure_ascii=False, indent=2)},
  
  templates: {json.dumps(templates, ensure_ascii=False, indent=2)},
  
  // Helper functions
  getPatternsByCategory: function(category) {{
    return this.patterns[category] || [];
  }},
  
  getTemplatesByCategory: function(category) {{
    return this.templates[category] || [];
  }},
  
  findMatchingPatterns: function(text) {{
    const matches = [];
    const textLower = text.toLowerCase();
    
    for (const [category, patternList] of Object.entries(this.patterns)) {{
      for (const pattern of patternList) {{
        const regex = new RegExp(pattern.pattern, 'i');
        if (regex.test(textLower)) {{
          matches.push({{
            category: category,
            pattern: pattern,
            confidence: pattern.confidence
          }});
        }}
      }}
    }}
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }},
  
  suggestTemplate: function(text, category = null) {{
    const matchingPatterns = this.findMatchingPatterns(text);
    
    if (category) {{
      const categoryPattern = matchingPatterns.find(m => m.category === category);
      if (categoryPattern) {{
        const templates = this.getTemplatesByCategory(category);
        return templates.find(t => t.template === categoryPattern.pattern.template);
      }}
    }}
    
    if (matchingPatterns.length > 0) {{
      const bestMatch = matchingPatterns[0];
      const templates = this.getTemplatesByCategory(bestMatch.category);
      return templates.find(t => t.template === bestMatch.pattern.template);
    }}
    
    return null;
  }}
}};

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {{
  module.exports = MedicalPatterns;
}} else if (typeof window !== 'undefined') {{
  window.MedicalPatterns = MedicalPatterns;
}}
"""
        
        with open(output_dir / 'medical_patterns.js', 'w', encoding='utf-8') as f:
            f.write(js_content)
            
    def export_pattern_statistics(self, patterns: Dict[str, List[MedicalPattern]], output_dir: Path):
        """Export pattern statistics"""
        
        stats = {
            'summary': {
                'total_categories': len(patterns),
                'total_patterns': sum(len(pattern_list) for pattern_list in patterns.values()),
                'created': datetime.now().isoformat()
            },
            'by_category': {},
            'top_patterns': {},
            'frequency_distribution': {}
        }
        
        for category, pattern_list in patterns.items():
            if not pattern_list:
                continue
                
            stats['by_category'][category] = {
                'count': len(pattern_list),
                'avg_frequency': sum(p.frequency for p in pattern_list) / len(pattern_list),
                'avg_confidence': sum(p.confidence for p in pattern_list) / len(pattern_list),
                'total_frequency': sum(p.frequency for p in pattern_list)
            }
            
            # Top patterns for this category
            top_patterns = sorted(pattern_list, key=lambda x: x.frequency, reverse=True)[:10]
            stats['top_patterns'][category] = [
                {
                    'template': p.template,
                    'frequency': p.frequency,
                    'confidence': p.confidence,
                    'example': p.example[:100] + '...' if len(p.example) > 100 else p.example
                }
                for p in top_patterns
            ]
            
            # Frequency distribution
            frequencies = [p.frequency for p in pattern_list]
            stats['frequency_distribution'][category] = {
                'min': min(frequencies),
                'max': max(frequencies),
                'median': sorted(frequencies)[len(frequencies) // 2],
                'high_frequency': len([f for f in frequencies if f >= 10]),
                'medium_frequency': len([f for f in frequencies if 5 <= f < 10]),
                'low_frequency': len([f for f in frequencies if f < 5])
            }
            
        with open(output_dir / 'pattern_statistics.json', 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)


def main():
    """Main execution function for pattern extraction"""
    import sys
    
    # Set up paths
    data_path = Path("/Users/keremtomak/Documents/work/development/REPOS/med-essence/llmtraining")
    
    logger.info("=== Advanced Medical Pattern Matcher ===")
    
    # Load medical reports
    logger.info("Loading medical reports...")
    
    # Try to find the data file
    possible_files = [
        data_path / "cleaned_data" / "medical_with_unstructured_20250831_131850.csv",
        data_path / "cleaned_data" / "medical_training_with_extracted_20250831_115240.csv"
    ]
    
    data_file = None
    for file_path in possible_files:
        if file_path.exists():
            data_file = file_path
            break
            
    if not data_file:
        csv_files = list(data_path.glob("**/*.csv"))
        if csv_files:
            data_file = csv_files[0]
            logger.info(f"Using first available CSV: {data_file}")
        else:
            logger.error("No CSV files found")
            sys.exit(1)
    
    # Load data
    logger.info(f"Reading data from: {data_file}")
    
    encodings = ['utf-8', 'latin-1', 'cp1252']
    df = None
    
    for encoding in encodings:
        try:
            # Read a sample first to check structure
            df_sample = pd.read_csv(data_file, nrows=100, encoding=encoding)
            logger.info(f"Sample loaded with {encoding}, columns: {list(df_sample.columns)}")
            
            # Find content column
            content_column = None
            possible_columns = ['medical_content', 'content', 'text', 'report', 'findings']
            
            for col in possible_columns:
                if col in df_sample.columns:
                    content_column = col
                    break
                    
            if not content_column:
                logger.error(f"No suitable content column found. Available: {list(df_sample.columns)}")
                sys.exit(1)
                
            # Load full dataset (limited for processing time)
            logger.info(f"Loading full dataset with content column: {content_column}")
            df = pd.read_csv(data_file, encoding=encoding, nrows=10000)  # Limit for faster processing
            logger.info(f"Loaded {len(df)} reports")
            break
            
        except Exception as e:
            logger.warning(f"Failed to load with {encoding}: {e}")
            continue
    
    if df is None:
        logger.error("Could not load data with any encoding")
        sys.exit(1)
    
    # Extract patterns
    matcher = AdvancedPatternMatcher()
    
    # Convert reports to list
    reports = df[content_column].dropna().astype(str).tolist()
    logger.info(f"Processing {len(reports)} reports for pattern extraction")
    
    # Extract patterns
    patterns = matcher.extract_patterns(reports)
    
    # Export patterns
    output_dir = data_path / "ontology_output"
    output_dir.mkdir(exist_ok=True)
    
    matcher.export_patterns(patterns, output_dir)
    
    # Print summary
    logger.info("\n=== PATTERN EXTRACTION SUMMARY ===")
    total_patterns = sum(len(pattern_list) for pattern_list in patterns.values())
    logger.info(f"Total patterns extracted: {total_patterns}")
    
    for category, pattern_list in patterns.items():
        if pattern_list:
            avg_freq = sum(p.frequency for p in pattern_list) / len(pattern_list)
            logger.info(f"  {category}: {len(pattern_list)} patterns (avg frequency: {avg_freq:.1f})")
    
    logger.info(f"\nPattern files exported to: {output_dir}")
    logger.info("Files created:")
    logger.info("  - medical_patterns.json")
    logger.info("  - medical_templates.json") 
    logger.info("  - medical_patterns.js")
    logger.info("  - pattern_statistics.json")


if __name__ == "__main__":
    main()