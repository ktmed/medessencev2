#!/usr/bin/env python3
"""
Medical Ontology Builder for German Radiology Reports
Creates production-ready ontology for real-time transcription correction and findings extraction
"""
import pandas as pd
import re
import json
import pickle
import logging
from collections import defaultdict, Counter
from pathlib import Path
import nltk
from datetime import datetime
import spacy
from typing import Dict, List, Set, Tuple, Optional
import networkx as nx

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MedicalOntologyBuilder:
    """
    Builds comprehensive medical ontology from German radiology reports
    Optimized for real-time transcription correction and findings extraction
    """
    
    def __init__(self, data_path: str):
        self.data_path = Path(data_path)
        self.ontology = {
            'entities': {
                'anatomy': defaultdict(list),
                'pathology': defaultdict(list),
                'procedures': defaultdict(list),
                'measurements': defaultdict(list),
                'modifiers': defaultdict(list),
                'technical': defaultdict(list)
            },
            'relationships': defaultdict(list),
            'patterns': defaultdict(list),
            'abbreviations': {},
            'synonyms': defaultdict(set),
            'contexts': defaultdict(list)
        }
        
        # Medical entity patterns (German)
        self.entity_patterns = {
            'anatomy': [
                # Spine levels
                r'L[1-5]', r'Th[0-9]+', r'C[1-7]', r'S[1-5]',
                r'LWS', r'BWS', r'HWS',  # Lumbar, Thoracic, Cervical spine
                r'Wirbelsäule', r'Bandscheibe', r'Wirbelkörper',
                r'Facettengelenk', r'Spinalkanal', r'Neuroforamen',
                
                # Organs and tissues
                r'Leber', r'Niere', r'Milz', r'Herz', r'Lunge',
                r'Gehirn', r'Rückenmark', r'Muskel', r'Sehne',
                r'Knochen', r'Gelenk', r'Knorpel', r'Band',
                
                # Body regions
                r'Kopf', r'Hals', r'Brust', r'Bauch', r'Becken',
                r'Schulter', r'Arm', r'Hand', r'Bein', r'Fuß'
            ],
            
            'pathology': [
                # Degenerative changes
                r'Degeneration', r'Arthrose', r'Osteophyt', r'Sklerose',
                r'Protrusion', r'Prolaps', r'Sequester', r'Extrusion',
                r'Stenose', r'Spondylose', r'Spondylolisthesis',
                
                # Inflammatory conditions
                r'Ödem', r'Entzündung', r'Synovitis', r'Bursitis',
                r'Tendinitis', r'Myositis', r'Arthritis',
                
                # Trauma and fractures
                r'Fraktur', r'Bruch', r'Luxation', r'Distorsion',
                r'Kontusion', r'Hämatom', r'Ruptur', r'Riss',
                
                # Tumors and masses
                r'Tumor', r'Masse', r'Raumforderung', r'Zyste',
                r'Lipom', r'Hämangiom', r'Metastase'
            ],
            
            'procedures': [
                # MRI sequences
                r'T1', r'T2', r'FLAIR', r'DWI', r'STIR', r'PD',
                r'T1\+KM', r'T2\*', r'GRE', r'EPI',
                
                # CT techniques
                r'nativ', r'KM', r'Angio-CT', r'HR-CT',
                
                # General imaging
                r'sagittal', r'axial', r'koronar', r'schräg',
                r'Schichtdicke', r'Abstand'
            ],
            
            'measurements': [
                r'\d+\s*mm', r'\d+\s*cm', r'\d+\s*°',
                r'\d+\.\d+\s*mm', r'\d+\.\d+\s*cm',
                r'Grad\s+[I-V]+', r'Stadium\s+[0-4]'
            ],
            
            'modifiers': [
                r'diskret', r'deutlich', r'hochgradig', r'geringgradig',
                r'mäßig', r'ausgeprägt', r'subtil', r'massiv',
                r'bilateral', r'unilateral', r'zentral', r'peripher',
                r'proximal', r'distal', r'kranial', r'kaudal'
            ]
        }
        
        # Common German medical abbreviations
        self.abbreviations_map = {
            'MRT': 'Magnetresonanztomographie',
            'CT': 'Computertomographie',
            'LWS': 'Lendenwirbelsäule',
            'BWS': 'Brustwirbelsäule', 
            'HWS': 'Halswirbelsäule',
            'KM': 'Kontrastmittel',
            'BS': 'Bandscheibe',
            'WK': 'Wirbelkörper',
            'SK': 'Spinalkanal',
            'NF': 'Neuroforamen',
            'ZNS': 'Zentralnervensystem',
            'PNS': 'Peripheres Nervensystem',
            'li.': 'links',
            're.': 'rechts',
            'bds.': 'beidseits',
            'DD': 'Differentialdiagnose',
            'V.a.': 'Verdacht auf',
            'Z.n.': 'Zustand nach'
        }
        
        # Initialize NLP tools
        self.initialize_nlp()
        
    def initialize_nlp(self):
        """Initialize NLP tools for German text processing"""
        try:
            # Load German spaCy model
            self.nlp = spacy.load("de_core_news_sm")
            logger.info("Loaded German spaCy model")
        except OSError:
            logger.warning("German spaCy model not found. Using basic tokenization.")
            self.nlp = None
            
        # Download NLTK data if needed
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
            
    def load_data(self) -> pd.DataFrame:
        """Load medical data from CSV file"""
        logger.info(f"Loading data from {self.data_path}")
        
        # Try to find the data file
        possible_files = [
            self.data_path / "cleaned_data" / "medical_with_unstructured_20250831_131850.csv",
            self.data_path / "cleaned_data" / "medical_training_with_extracted_20250831_115240.csv",
            self.data_path / "medical_with_unstructured_20250831_131850.csv",
            self.data_path / "medical_training_with_extracted_20250831_115240.csv"
        ]
        
        data_file = None
        for file_path in possible_files:
            if file_path.exists():
                data_file = file_path
                break
                
        if not data_file:
            # Look for any CSV file
            csv_files = list(self.data_path.glob("**/*.csv"))
            if csv_files:
                data_file = csv_files[0]
                logger.info(f"Using first available CSV: {data_file}")
            else:
                raise FileNotFoundError("No CSV files found in the specified directory")
                
        logger.info(f"Reading data from: {data_file}")
        
        # Try different encodings
        encodings = ['utf-8', 'latin-1', 'cp1252']
        df = None
        
        for encoding in encodings:
            try:
                df = pd.read_csv(data_file, encoding=encoding)
                logger.info(f"Successfully loaded data with {encoding} encoding")
                logger.info(f"Data shape: {df.shape}")
                logger.info(f"Columns: {list(df.columns)}")
                break
            except Exception as e:
                logger.warning(f"Failed to load with {encoding}: {e}")
                continue
                
        if df is None:
            raise ValueError("Could not load data with any encoding")
            
        return df
        
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract medical entities from text using pattern matching and NLP"""
        if not text or pd.isna(text):
            return {category: [] for category in self.entity_patterns.keys()}
            
        text = str(text).lower()
        entities = {category: [] for category in self.entity_patterns.keys()}
        
        # Pattern-based extraction
        for category, patterns in self.entity_patterns.items():
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                entities[category].extend(matches)
                
        # NLP-based extraction if available
        if self.nlp:
            doc = self.nlp(text)
            
            # Extract named entities
            for ent in doc.ents:
                if ent.label_ in ['PER', 'ORG']:  # Skip person/organization names
                    continue
                    
                # Categorize entities based on context
                entity_text = ent.text.lower()
                if any(anat in entity_text for anat in ['wirbel', 'gelenk', 'knochen', 'organ']):
                    entities['anatomy'].append(ent.text)
                elif any(path in entity_text for path in ['stenose', 'prolaps', 'arthrose']):
                    entities['pathology'].append(ent.text)
                    
        # Clean and deduplicate
        for category in entities:
            entities[category] = list(set([e.strip() for e in entities[category] if e.strip()]))
            
        return entities
        
    def extract_relationships(self, text: str, entities: Dict[str, List[str]]) -> List[Tuple[str, str, str]]:
        """Extract relationships between entities"""
        relationships = []
        
        if not text or not entities:
            return relationships
            
        text = str(text).lower()
        
        # Common relationship patterns in German medical text
        relationship_patterns = [
            (r'(\w+)\s+(von|der|des)\s+(\w+)', 'located_in'),
            (r'(\w+)\s+(mit|bei)\s+(\w+)', 'associated_with'),
            (r'(\w+)\s+(zeigt|weist auf)\s+(\w+)', 'shows'),
            (r'(\w+)\s+(verursacht|führt zu)\s+(\w+)', 'causes'),
            (r'(\w+)-bedingt[e]?\s+(\w+)', 'caused_by'),
        ]
        
        for pattern, relation_type in relationship_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                entity1, _, entity2 = match.groups()
                relationships.append((entity1, relation_type, entity2))
                
        return relationships
        
    def extract_patterns(self, text: str) -> List[str]:
        """Extract common sentence patterns and templates"""
        if not text or pd.isna(text):
            return []
            
        text = str(text)
        patterns = []
        
        # Common German medical report patterns
        common_patterns = [
            r'Es zeigt sich \w+',
            r'Darstellung \w+ \w+',
            r'Im \w+ \w+ \w+',
            r'Die \w+ ist \w+',
            r'Kein Nachweis \w+',
            r'Verdacht auf \w+',
            r'Zustand nach \w+',
            r'Im Vergleich zur \w+',
            r'Regelrecht[e]? \w+',
            r'Unauffällig[e]? \w+'
        ]
        
        for pattern in common_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            patterns.extend(matches)
            
        return patterns
        
    def build_ontology_graph(self) -> nx.DiGraph:
        """Build a graph representation of the ontology"""
        G = nx.DiGraph()
        
        # Add entity nodes
        for category, entities in self.ontology['entities'].items():
            category_node = f"CATEGORY_{category.upper()}"
            G.add_node(category_node, type='category', name=category)
            
            for entity_list in entities.values():
                for entity in entity_list:
                    entity_node = f"{category}_{entity}"
                    G.add_node(entity_node, type='entity', category=category, name=entity)
                    G.add_edge(category_node, entity_node, relation='has_entity')
                    
        # Add relationship edges
        for source, relations in self.ontology['relationships'].items():
            for relation in relations:
                if len(relation) >= 3:
                    source_node = f"entity_{relation[0]}"
                    target_node = f"entity_{relation[2]}"
                    relation_type = relation[1]
                    
                    if source_node in G.nodes and target_node in G.nodes:
                        G.add_edge(source_node, target_node, relation=relation_type)
                        
        return G
        
    def process_reports(self, df: pd.DataFrame) -> None:
        """Process all medical reports to build ontology"""
        logger.info(f"Processing {len(df)} medical reports")
        
        # Determine the content column
        content_column = None
        possible_columns = ['medical_content', 'content', 'text', 'report', 'findings']
        
        for col in possible_columns:
            if col in df.columns:
                content_column = col
                break
                
        if not content_column:
            logger.error(f"No suitable content column found. Available columns: {list(df.columns)}")
            return
            
        logger.info(f"Using column: {content_column}")
        
        # Process reports in batches
        batch_size = 1000
        total_batches = len(df) // batch_size + 1
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min((batch_num + 1) * batch_size, len(df))
            
            if start_idx >= len(df):
                break
                
            logger.info(f"Processing batch {batch_num + 1}/{total_batches} (rows {start_idx}-{end_idx})")
            
            batch_df = df.iloc[start_idx:end_idx]
            
            for idx, row in batch_df.iterrows():
                try:
                    text = row[content_column]
                    if pd.isna(text):
                        continue
                        
                    # Extract entities
                    entities = self.extract_entities(text)
                    
                    # Store entities in ontology
                    for category, entity_list in entities.items():
                        for entity in entity_list:
                            if entity not in self.ontology['entities'][category]['items']:
                                self.ontology['entities'][category]['items'] = \
                                    self.ontology['entities'][category].get('items', [])
                                self.ontology['entities'][category]['items'].append(entity)
                                
                    # Extract relationships
                    relationships = self.extract_relationships(text, entities)
                    self.ontology['relationships'][content_column].extend(relationships)
                    
                    # Extract patterns
                    patterns = self.extract_patterns(text)
                    self.ontology['patterns'][content_column].extend(patterns)
                    
                    # Extract abbreviations
                    for abbrev, full_form in self.abbreviations_map.items():
                        if abbrev in text:
                            self.ontology['abbreviations'][abbrev] = full_form
                            
                except Exception as e:
                    logger.warning(f"Error processing row {idx}: {e}")
                    continue
                    
        # Post-process and clean ontology
        self.clean_ontology()
        
    def clean_ontology(self):
        """Clean and deduplicate ontology data"""
        logger.info("Cleaning and deduplicating ontology")
        
        # Clean entities
        for category in self.ontology['entities']:
            if 'items' in self.ontology['entities'][category]:
                # Remove duplicates and empty entries
                items = self.ontology['entities'][category]['items']
                cleaned_items = list(set([item.strip() for item in items if item and item.strip()]))
                
                # Sort by frequency (most common first)
                item_counts = Counter(items)
                self.ontology['entities'][category] = {
                    'items': sorted(cleaned_items, key=lambda x: item_counts.get(x, 0), reverse=True),
                    'count': len(cleaned_items),
                    'frequency': dict(item_counts.most_common(100))  # Top 100 most frequent
                }
                
        # Clean relationships
        for key in self.ontology['relationships']:
            relationships = self.ontology['relationships'][key]
            unique_relations = list(set(tuple(rel) if isinstance(rel, (list, tuple)) else rel 
                                         for rel in relationships))
            self.ontology['relationships'][key] = unique_relations[:1000]  # Limit to top 1000
            
        # Clean patterns
        for key in self.ontology['patterns']:
            patterns = self.ontology['patterns'][key]
            pattern_counts = Counter(patterns)
            self.ontology['patterns'][key] = dict(pattern_counts.most_common(100))
            
    def generate_lookup_structures(self) -> Dict:
        """Generate optimized lookup structures for real-time use"""
        logger.info("Generating lookup structures")
        
        lookup_structures = {
            'entity_lookup': {},
            'fuzzy_lookup': {},
            'prefix_lookup': defaultdict(list),
            'context_lookup': defaultdict(list),
            'abbreviation_lookup': self.ontology['abbreviations']
        }
        
        # Build entity lookup
        for category, data in self.ontology['entities'].items():
            if 'items' in data:
                for entity in data['items']:
                    lookup_structures['entity_lookup'][entity.lower()] = {
                        'category': category,
                        'original': entity,
                        'frequency': data['frequency'].get(entity, 1)
                    }
                    
                    # Build prefix lookup for auto-completion
                    entity_lower = entity.lower()
                    for i in range(1, min(len(entity_lower) + 1, 10)):  # Up to 10 chars
                        prefix = entity_lower[:i]
                        lookup_structures['prefix_lookup'][prefix].append({
                            'entity': entity,
                            'category': category,
                            'frequency': data['frequency'].get(entity, 1)
                        })
                        
        # Sort prefix lookup by frequency
        for prefix in lookup_structures['prefix_lookup']:
            lookup_structures['prefix_lookup'][prefix].sort(
                key=lambda x: x['frequency'], reverse=True
            )
            
        return lookup_structures
        
    def export_to_json(self, output_path: Path) -> None:
        """Export ontology to JSON format"""
        logger.info(f"Exporting ontology to JSON: {output_path}")
        
        # Convert defaultdict to regular dict for JSON serialization
        json_ontology = {
            'metadata': {
                'created': datetime.now().isoformat(),
                'total_entities': sum(len(data.get('items', [])) 
                                    for data in self.ontology['entities'].values()),
                'categories': list(self.ontology['entities'].keys())
            },
            'entities': dict(self.ontology['entities']),
            'relationships': {k: list(v) for k, v in self.ontology['relationships'].items()},
            'patterns': dict(self.ontology['patterns']),
            'abbreviations': dict(self.ontology['abbreviations'])
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(json_ontology, f, ensure_ascii=False, indent=2)
            
    def export_to_javascript(self, output_path: Path) -> None:
        """Export ontology as JavaScript module for frontend"""
        logger.info(f"Exporting ontology to JavaScript: {output_path}")
        
        js_content = f"""/**
 * Medical Ontology for German Radiology Reports
 * Generated: {datetime.now().isoformat()}
 * Auto-generated - Do not edit manually
 */

const MedicalOntology = {{
  metadata: {{
    created: '{datetime.now().isoformat()}',
    totalEntities: {sum(len(data.get('items', [])) for data in self.ontology['entities'].values())},
    categories: {json.dumps(list(self.ontology['entities'].keys()))}
  }},
  
  entities: {json.dumps(dict(self.ontology['entities']), ensure_ascii=False, indent=2)},
  
  abbreviations: {json.dumps(dict(self.ontology['abbreviations']), ensure_ascii=False, indent=2)},
  
  // Helper functions for real-time lookup
  findEntity: function(term) {{
    const termLower = term.toLowerCase();
    for (const [category, data] of Object.entries(this.entities)) {{
      if (data.items && data.items.some(item => item.toLowerCase().includes(termLower))) {{
        return {{
          category: category,
          matches: data.items.filter(item => item.toLowerCase().includes(termLower))
        }};
      }}
    }}
    return null;
  }},
  
  getAutoComplete: function(prefix, maxResults = 10) {{
    const prefixLower = prefix.toLowerCase();
    const results = [];
    
    for (const [category, data] of Object.entries(this.entities)) {{
      if (data.items) {{
        const matches = data.items
          .filter(item => item.toLowerCase().startsWith(prefixLower))
          .slice(0, maxResults);
        
        for (const match of matches) {{
          results.push({{
            term: match,
            category: category,
            frequency: data.frequency ? data.frequency[match] || 1 : 1
          }});
        }}
      }}
    }}
    
    return results.sort((a, b) => b.frequency - a.frequency).slice(0, maxResults);
  }},
  
  expandAbbreviation: function(abbrev) {{
    return this.abbreviations[abbrev.toUpperCase()] || abbrev;
  }}
}};

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {{
  module.exports = MedicalOntology;
}} else if (typeof window !== 'undefined') {{
  window.MedicalOntology = MedicalOntology;
}}
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
            
    def export_statistics(self, output_path: Path) -> None:
        """Export ontology statistics and validation report"""
        logger.info(f"Exporting statistics to: {output_path}")
        
        # Calculate statistics
        stats = {
            'summary': {
                'creation_date': datetime.now().isoformat(),
                'total_categories': len(self.ontology['entities']),
                'total_entities': sum(len(data.get('items', [])) 
                                    for data in self.ontology['entities'].values()),
                'total_abbreviations': len(self.ontology['abbreviations']),
                'total_relationships': sum(len(rels) 
                                         for rels in self.ontology['relationships'].values()),
                'total_patterns': sum(len(patterns) 
                                    for patterns in self.ontology['patterns'].values())
            },
            'categories': {},
            'top_entities': {},
            'validation': {
                'warnings': [],
                'errors': []
            }
        }
        
        # Category statistics
        for category, data in self.ontology['entities'].items():
            if 'items' in data:
                stats['categories'][category] = {
                    'count': len(data['items']),
                    'top_10': list(data.get('frequency', {}).keys())[:10]
                }
                
                # Get top entities for this category
                if data.get('frequency'):
                    stats['top_entities'][category] = dict(
                        list(data['frequency'].items())[:20]
                    )
                    
        # Validation checks
        for category, data in self.ontology['entities'].items():
            if not data.get('items'):
                stats['validation']['warnings'].append(f"Category '{category}' has no entities")
            elif len(data['items']) < 5:
                stats['validation']['warnings'].append(f"Category '{category}' has very few entities ({len(data['items'])})")
                
        # Export as JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
            
    def build_complete_ontology(self) -> Dict:
        """Main method to build complete ontology"""
        logger.info("Starting complete ontology build process")
        
        try:
            # Load data
            df = self.load_data()
            
            # Process reports
            self.process_reports(df)
            
            # Generate lookup structures
            lookup_structures = self.generate_lookup_structures()
            
            # Create output directory
            output_dir = self.data_path / "ontology_output"
            output_dir.mkdir(exist_ok=True)
            
            # Export in multiple formats
            self.export_to_json(output_dir / "medical_ontology.json")
            self.export_to_javascript(output_dir / "medical_ontology.js")
            self.export_statistics(output_dir / "ontology_statistics.json")
            
            # Save lookup structures
            with open(output_dir / "lookup_structures.json", 'w', encoding='utf-8') as f:
                json.dump(lookup_structures, f, ensure_ascii=False, indent=2, default=str)
                
            # Save ontology graph
            graph = self.build_ontology_graph()
            nx.write_gexf(graph, output_dir / "ontology_graph.gexf")
            
            # Create usage examples
            self.create_usage_examples(output_dir)
            
            logger.info(f"Ontology build complete! Output in: {output_dir}")
            
            return {
                'ontology': self.ontology,
                'lookup_structures': lookup_structures,
                'statistics': self.get_summary_statistics()
            }
            
        except Exception as e:
            logger.error(f"Error building ontology: {e}")
            raise
            
    def get_summary_statistics(self) -> Dict:
        """Get summary statistics for the ontology"""
        return {
            'total_entities': sum(len(data.get('items', [])) 
                                for data in self.ontology['entities'].values()),
            'categories': {cat: len(data.get('items', [])) 
                         for cat, data in self.ontology['entities'].items()},
            'abbreviations': len(self.ontology['abbreviations']),
            'relationships': sum(len(rels) for rels in self.ontology['relationships'].values()),
            'patterns': sum(len(patterns) for patterns in self.ontology['patterns'].values())
        }
        
    def create_usage_examples(self, output_dir: Path) -> None:
        """Create usage examples for the ontology"""
        examples = {
            'real_time_correction': {
                'description': 'Example of real-time transcription correction',
                'input': 'Der Patient zeigt deutliche stenose im spinalkanal',
                'corrections': [
                    {'original': 'stenose', 'corrected': 'Stenose', 'category': 'pathology'},
                    {'original': 'spinalkanal', 'corrected': 'Spinalkanal', 'category': 'anatomy'}
                ]
            },
            'auto_completion': {
                'description': 'Auto-completion suggestions',
                'examples': [
                    {'input': 'Band', 'suggestions': ['Bandscheibe', 'Bandscheibenprotrusion', 'Bandverletzung']},
                    {'input': 'Steno', 'suggestions': ['Stenose', 'Stenosierung']},
                    {'input': 'L', 'suggestions': ['L1', 'L2', 'L3', 'L4', 'L5', 'LWS']}
                ]
            },
            'abbreviation_expansion': {
                'description': 'Abbreviation expansion',
                'examples': [
                    {'input': 'MRT LWS', 'expanded': 'Magnetresonanztomographie Lendenwirbelsäule'},
                    {'input': 'CT nativ', 'expanded': 'Computertomographie nativ'},
                    {'input': 'V.a. BS-Prolaps', 'expanded': 'Verdacht auf Bandscheiben-Prolaps'}
                ]
            },
            'entity_extraction': {
                'description': 'Structured findings extraction',
                'input': 'MRT der LWS zeigt deutliche L4/L5 Bandscheibenprotrusion mit Spinalkanalstenose',
                'extracted': {
                    'anatomy': ['LWS', 'L4', 'L5', 'Bandscheibe', 'Spinalkanal'],
                    'pathology': ['Protrusion', 'Stenose'],
                    'procedures': ['MRT'],
                    'modifiers': ['deutlich']
                }
            }
        }
        
        with open(output_dir / "usage_examples.json", 'w', encoding='utf-8') as f:
            json.dump(examples, f, ensure_ascii=False, indent=2)


def main():
    """Main execution function"""
    # Set up paths
    data_path = Path("/Users/keremtomak/Documents/work/development/REPOS/med-essence/llmtraining")
    
    logger.info("=== Medical Ontology Builder ===")
    logger.info(f"Data path: {data_path}")
    
    # Build ontology
    builder = MedicalOntologyBuilder(data_path)
    result = builder.build_complete_ontology()
    
    # Print summary
    stats = result['statistics']
    logger.info("\n=== ONTOLOGY BUILD SUMMARY ===")
    logger.info(f"Total entities: {stats['total_entities']}")
    logger.info("Entities by category:")
    for category, count in stats['categories'].items():
        logger.info(f"  {category}: {count}")
    logger.info(f"Abbreviations: {stats['abbreviations']}")
    logger.info(f"Relationships: {stats['relationships']}")
    logger.info(f"Patterns: {stats['patterns']}")
    
    logger.info("\nOntology build completed successfully!")
    logger.info("Output files created in: ontology_output/")


if __name__ == "__main__":
    main()