"""
ICD-10-GM Database Loader for German Medical Interface
Loads and manages the comprehensive German ICD database
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Set, Tuple
import logging
from pathlib import Path
import pickle
from dataclasses import dataclass
import re

logger = logging.getLogger(__name__)


@dataclass
class ICDEntry:
    """ICD-10-GM database entry"""
    year: int
    level: int
    terminal: str  # T=Terminal, N=Non-terminal
    icd_code: str
    icd_normcode: str
    label: str  # German description
    chapter_nr: int
    icd_block_first: str
    gender_specific: str
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    rare_in_central_europe: str = 'N'
    notifiable: str = 'N'
    
    @property
    def is_terminal(self) -> bool:
        """Check if this is a terminal (billable) code"""
        return self.terminal == 'T'
    
    @property
    def is_gender_specific(self) -> bool:
        """Check if code is gender specific"""
        return self.gender_specific in ['M', 'F']
    
    @property
    def has_age_restriction(self) -> bool:
        """Check if code has age restrictions"""
        return self.age_min is not None or self.age_max is not None


class ICDDatabase:
    """German ICD-10-GM database management"""
    
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.entries: Dict[str, ICDEntry] = {}
        self.chapters: Dict[int, Dict[str, str]] = {}
        self.blocks: Dict[str, List[str]] = {}
        self.terminal_codes: Set[str] = set()
        self.search_index: Dict[str, Set[str]] = {}
        self.loaded = False
        
        # German ICD chapter mappings
        self.chapter_names = {
            1: "Bestimmte infektiöse und parasitäre Krankheiten",
            2: "Neubildungen", 
            3: "Krankheiten des Blutes und der blutbildenden Organe",
            4: "Endokrine, Ernährungs- und Stoffwechselkrankheiten",
            5: "Psychische und Verhaltensstörungen",
            6: "Krankheiten des Nervensystems",
            7: "Krankheiten des Auges und der Augenanhangsgebilde",
            8: "Krankheiten des Ohres und des Warzenfortsatzes",
            9: "Krankheiten des Kreislaufsystems",
            10: "Krankheiten des Atmungssystems",
            11: "Krankheiten des Verdauungssystems",
            12: "Krankheiten der Haut und der Unterhaut",
            13: "Krankheiten des Muskel-Skelett-Systems",
            14: "Krankheiten des Urogenitalsystems",
            15: "Schwangerschaft, Geburt und Wochenbett",
            16: "Bestimmte Zustände, die ihren Ursprung in der Perinatalperiode haben",
            17: "Angeborene Fehlbildungen, Deformitäten und Chromosomenanomalien",
            18: "Symptome und abnorme klinische und Laborbefunde",
            19: "Verletzungen, Vergiftungen und bestimmte andere Folgen äußerer Ursachen",
            20: "Äußere Ursachen von Morbidität und Mortalität",
            21: "Faktoren, die den Gesundheitszustand beeinflussen",
            22: "Schlüsselnummern für besondere Zwecke"
        }
    
    def load_database(self) -> None:
        """Load ICD database from CSV file"""
        logger.info(f"Loading ICD database from {self.csv_path}")
        
        try:
            # Try different encodings for German text
            encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
            df = None
            for encoding in encodings:
                try:
                    df = pd.read_csv(self.csv_path, encoding=encoding, low_memory=False)
                    logger.info(f"Successfully loaded CSV with {encoding} encoding")
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                raise ValueError("Could not decode CSV file with any common encoding")
            
            logger.info(f"Loaded {len(df)} ICD entries")
            
            # Process each entry
            for _, row in df.iterrows():
                entry = self._create_icd_entry(row)
                if entry:
                    self.entries[entry.icd_code] = entry
                    
                    # Build indexes
                    if entry.is_terminal:
                        self.terminal_codes.add(entry.icd_code)
                    
                    # Build chapter index
                    if entry.chapter_nr not in self.chapters:
                        self.chapters[entry.chapter_nr] = {
                            'name': self.chapter_names.get(entry.chapter_nr, f"Kapitel {entry.chapter_nr}"),
                            'codes': []
                        }
                    self.chapters[entry.chapter_nr]['codes'].append(entry.icd_code)
                    
                    # Build block index
                    if entry.icd_block_first not in self.blocks:
                        self.blocks[entry.icd_block_first] = []
                    self.blocks[entry.icd_block_first].append(entry.icd_code)
                    
                    # Build search index
                    self._index_for_search(entry)
            
            # Get latest year data
            latest_year = df['year'].max()
            logger.info(f"Using ICD-10-GM data for year {latest_year}")
            
            self.loaded = True
            logger.info(f"ICD database loaded: {len(self.entries)} entries, {len(self.terminal_codes)} terminal codes")
            
        except Exception as e:
            logger.error(f"Error loading ICD database: {str(e)}")
            raise
    
    def _create_icd_entry(self, row: pd.Series) -> Optional[ICDEntry]:
        """Create ICD entry from CSV row"""
        try:
            # Handle missing values
            age_min = None if pd.isna(row.get('age_min')) else int(row['age_min'])
            age_max = None if pd.isna(row.get('age_max')) else int(row['age_max'])
            
            entry = ICDEntry(
                year=int(row['year']),
                level=int(row['level']),
                terminal=str(row['terminal']),
                icd_code=str(row['icd_code']),
                icd_normcode=str(row['icd_normcode']),
                label=str(row['label']),
                chapter_nr=int(row['chapter_nr']),
                icd_block_first=str(row['icd_block_first']),
                gender_specific=str(row.get('gender_specific', '9')),
                age_min=age_min,
                age_max=age_max,
                rare_in_central_europe=str(row.get('rare_in_central_europe', 'N')),
                notifiable=str(row.get('notifiable', 'N'))
            )
            
            return entry
            
        except Exception as e:
            logger.warning(f"Error creating ICD entry from row: {str(e)}")
            return None
    
    def _index_for_search(self, entry: ICDEntry) -> None:
        """Build search index for German text search"""
        # Tokenize German label for search
        label_words = self._tokenize_german_text(entry.label.lower())
        
        for word in label_words:
            if word not in self.search_index:
                self.search_index[word] = set()
            self.search_index[word].add(entry.icd_code)
    
    def _tokenize_german_text(self, text: str) -> List[str]:
        """Tokenize German medical text for search"""
        # Remove common German stop words and medical noise
        stop_words = {'der', 'die', 'das', 'und', 'oder', 'mit', 'von', 'zu', 'im', 'am', 'an', 'auf', 'für', 'bei', 'nach', 'vor', 'über', 'unter', 'durch', 'ohne', 'gegen', 'um', 'während', 'wegen', 'trotz'}
        
        # Split on whitespace and punctuation
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter out stop words and short words
        meaningful_words = [w for w in words if len(w) > 2 and w not in stop_words]
        
        return meaningful_words
    
    def get_entry(self, icd_code: str) -> Optional[ICDEntry]:
        """Get ICD entry by code"""
        if not self.loaded:
            self.load_database()
        return self.entries.get(icd_code)
    
    def search_by_text(self, search_text: str, max_results: int = 20) -> List[ICDEntry]:
        """Search ICD codes by German text"""
        if not self.loaded:
            self.load_database()
        
        search_words = self._tokenize_german_text(search_text.lower())
        if not search_words:
            return []
        
        # Find codes that match any search word
        candidate_codes = set()
        for word in search_words:
            # Exact match
            if word in self.search_index:
                candidate_codes.update(self.search_index[word])
            
            # Partial match for longer words
            if len(word) > 4:
                for index_word, codes in self.search_index.items():
                    if word in index_word or index_word in word:
                        candidate_codes.update(codes)
        
        # Score and rank results
        scored_results = []
        for code in candidate_codes:
            entry = self.entries[code]
            score = self._calculate_relevance_score(entry, search_words)
            if score > 0:
                scored_results.append((score, entry))
        
        # Sort by relevance and return top results
        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in scored_results[:max_results]]
    
    def _calculate_relevance_score(self, entry: ICDEntry, search_words: List[str]) -> float:
        """Calculate relevance score for search results"""
        score = 0.0
        label_lower = entry.label.lower()
        
        for word in search_words:
            if word in label_lower:
                # Exact word match
                score += 2.0
                # Bonus for word at beginning
                if label_lower.startswith(word):
                    score += 1.0
            elif any(word in w for w in label_lower.split()):
                # Partial word match
                score += 1.0
        
        # Bonus for terminal codes (billable)
        if entry.is_terminal:
            score += 0.5
        
        # Penalty for rare diseases in Central Europe
        if entry.rare_in_central_europe == 'J':
            score -= 0.5
        
        return score
    
    def get_codes_by_chapter(self, chapter_nr: int) -> List[ICDEntry]:
        """Get all codes from a specific chapter"""
        if not self.loaded:
            self.load_database()
        
        if chapter_nr in self.chapters:
            codes = self.chapters[chapter_nr]['codes']
            return [self.entries[code] for code in codes if code in self.entries]
        return []
    
    def get_terminal_codes_only(self) -> List[ICDEntry]:
        """Get only terminal (billable) codes"""
        if not self.loaded:
            self.load_database()
        
        return [self.entries[code] for code in self.terminal_codes if code in self.entries]
    
    def suggest_codes_for_modality(self, modality: str) -> List[ICDEntry]:
        """Suggest relevant ICD codes for imaging modality"""
        modality_searches = {
            'mammographie': 'mammographie screening brust',
            'sonographie': 'ultraschall untersuchung',
            'computertomographie': 'computertomographie ct',
            'mrt': 'magnetresonanz tomographie',
            'röntgen': 'röntgen radiographie'
        }
        
        search_text = modality_searches.get(modality.lower(), modality)
        return self.search_by_text(search_text, max_results=10)
    
    def get_gender_specific_codes(self, gender: str) -> List[ICDEntry]:
        """Get codes specific to gender (M/F)"""
        if not self.loaded:
            self.load_database()
        
        gender_code = 'M' if gender.lower() in ['male', 'männlich', 'm'] else 'F'
        return [entry for entry in self.entries.values() 
                if entry.gender_specific == gender_code]
    
    def get_age_appropriate_codes(self, age: int) -> List[ICDEntry]:
        """Get codes appropriate for given age"""
        if not self.loaded:
            self.load_database()
        
        appropriate_codes = []
        for entry in self.entries.values():
            # Check age restrictions
            if entry.age_min is not None and age < entry.age_min:
                continue
            if entry.age_max is not None and age > entry.age_max:
                continue
            appropriate_codes.append(entry)
        
        return appropriate_codes
    
    def get_statistics(self) -> Dict[str, int]:
        """Get database statistics"""
        if not self.loaded:
            self.load_database()
        
        return {
            'total_entries': len(self.entries),
            'terminal_codes': len(self.terminal_codes),
            'chapters': len(self.chapters),
            'blocks': len(self.blocks),
            'search_terms': len(self.search_index)
        }
    
    def save_cache(self, cache_path: str) -> None:
        """Save processed database to cache file"""
        cache_data = {
            'entries': self.entries,
            'chapters': self.chapters, 
            'blocks': self.blocks,
            'terminal_codes': self.terminal_codes,
            'search_index': self.search_index
        }
        
        with open(cache_path, 'wb') as f:
            pickle.dump(cache_data, f)
        
        logger.info(f"ICD database cached to {cache_path}")
    
    def load_cache(self, cache_path: str) -> bool:
        """Load processed database from cache file"""
        try:
            with open(cache_path, 'rb') as f:
                cache_data = pickle.load(f)
            
            self.entries = cache_data['entries']
            self.chapters = cache_data['chapters']
            self.blocks = cache_data['blocks'] 
            self.terminal_codes = cache_data['terminal_codes']
            self.search_index = cache_data['search_index']
            self.loaded = True
            
            logger.info(f"ICD database loaded from cache: {len(self.entries)} entries")
            return True
            
        except Exception as e:
            logger.warning(f"Could not load ICD cache: {str(e)}")
            return False


def create_icd_database() -> ICDDatabase:
    """Create ICD database instance with German data"""
    icd_csv_path = "/Users/keremtomak/Documents/work/development/REPOS/med-essence/data/icd/ICDdataexport/icd_meta_codes.csv"
    
    db = ICDDatabase(icd_csv_path)
    
    # Try to load from cache first
    cache_path = Path(icd_csv_path).parent / "icd_cache.pkl"
    if cache_path.exists():
        if db.load_cache(str(cache_path)):
            return db
    
    # Load from CSV and create cache
    db.load_database()
    db.save_cache(str(cache_path))
    
    return db


# German medical specialty mappings for ICD chapter relevance
SPECIALTY_CHAPTER_MAPPING = {
    'mammographie': [2, 21],  # Neubildungen, Gesundheitszustand
    'radiologie': [2, 18, 19],  # Neubildungen, Symptome, Verletzungen
    'kardiologie': [9],  # Kreislaufsystem
    'pneumologie': [10],  # Atmungssystem
    'gastroenterologie': [11],  # Verdauungssystem
    'neurologie': [6],  # Nervensystem
    'orthopädie': [13, 19],  # Muskel-Skelett, Verletzungen
    'urologie': [14],  # Urogenitalsystem
    'gynäkologie': [14, 15],  # Urogenitalsystem, Schwangerschaft
    'onkologie': [2],  # Neubildungen
    'dermatologie': [12],  # Haut
    'hno': [8],  # Ohr
    'augenheilkunde': [7],  # Auge
    'psychiatrie': [5],  # Psychische Störungen
    'innere_medizin': [1, 3, 4, 9, 10, 11]  # Multiple systems
}


if __name__ == "__main__":
    # Test the ICD database
    print("Creating German ICD-10-GM database...")
    icd_db = create_icd_database()
    
    print(f"Database statistics: {icd_db.get_statistics()}")
    
    # Test search
    search_results = icd_db.search_by_text("mammographie screening")
    print(f"\nSearch results for 'mammographie screening':")
    for entry in search_results[:5]:
        print(f"  {entry.icd_code}: {entry.label}")
    
    # Test modality suggestions
    mammo_codes = icd_db.suggest_codes_for_modality("mammographie")
    print(f"\nSuggested codes for mammography:")
    for entry in mammo_codes[:3]:
        print(f"  {entry.icd_code}: {entry.label}")