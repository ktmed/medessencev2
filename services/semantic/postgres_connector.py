"""
PostgreSQL Connector for Ontology Service
Direct database queries instead of in-memory loading
"""

import os
import asyncpg
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PostgreSQLOntology:
    """PostgreSQL-based ontology service for fast queries"""
    
    def __init__(self):
        self.pool = None
        self.db_url = os.getenv('DATABASE_URL', 'postgresql://keremtomak@localhost:5432/medessence_dev')
        
    async def connect(self):
        """Create connection pool to PostgreSQL"""
        try:
            # Parse the connection URL for asyncpg
            if self.db_url.startswith('postgresql://'):
                # asyncpg expects 'postgres://' not 'postgresql://'
                db_url = self.db_url.replace('postgresql://', 'postgres://')
            else:
                db_url = self.db_url
                
            self.pool = await asyncpg.create_pool(
                db_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("PostgreSQL connection pool created")
            
            # Test connection
            async with self.pool.acquire() as conn:
                count = await conn.fetchval('SELECT COUNT(*) FROM icd_codes')
                logger.info(f"Connected to PostgreSQL - {count} ICD codes available")
                
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {str(e)}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL connection pool closed")
    
    async def search_icd_codes(self, text: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search ICD codes by text in label
        Returns matching ICD codes with relevance
        """
        if not self.pool:
            await self.connect()
            
        async with self.pool.acquire() as conn:
            # Search for ICD codes with text in label
            query = """
                SELECT 
                    "icdCode" as icd_code,
                    "icdNormCode" as icd_norm_code,
                    label,
                    "chapterNr" as chapter_nr,
                    terminal,
                    CASE 
                        WHEN LOWER(label) LIKE LOWER($1) THEN 1.0
                        WHEN LOWER(label) LIKE LOWER($2) THEN 0.8
                        ELSE 0.6
                    END as confidence
                FROM icd_codes
                WHERE 
                    LOWER(label) LIKE LOWER($2)
                    AND terminal = 'T'
                ORDER BY confidence DESC, "icdCode"
                LIMIT $3
            """
            
            exact_pattern = f'{text}%'
            contains_pattern = f'%{text}%'
            
            rows = await conn.fetch(query, exact_pattern, contains_pattern, limit)
            
            results = []
            for row in rows:
                results.append({
                    'code': row['icd_code'],
                    'description': row['label'],
                    'chapter': row['chapter_nr'],
                    'terminal': row['terminal'] == 'T',
                    'confidence': float(row['confidence'])
                })
            
            return results
    
    async def get_icd_by_code(self, icd_code: str) -> Optional[Dict[str, Any]]:
        """Get specific ICD code details"""
        if not self.pool:
            await self.connect()
            
        async with self.pool.acquire() as conn:
            query = """
                SELECT * FROM icd_codes 
                WHERE "icdCode" = $1 OR "icdNormCode" = $1
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, icd_code)
            
            if row:
                return dict(row)
            return None
    
    async def search_medical_cases(self, 
                                 icd_code: Optional[str] = None,
                                 exam_type: Optional[str] = None,
                                 text_search: Optional[str] = None,
                                 limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search medical cases with various filters
        """
        if not self.pool:
            await self.connect()
            
        async with self.pool.acquire() as conn:
            # Build dynamic query
            conditions = []
            params = []
            param_count = 0
            
            if icd_code:
                param_count += 1
                conditions.append(f"\"icdCode\" LIKE ${param_count}")
                params.append(f"{icd_code}%")
            
            if exam_type:
                param_count += 1
                conditions.append(f"LOWER(\"examDescription\") LIKE LOWER(${param_count})")
                params.append(f"%{exam_type}%")
            
            if text_search:
                param_count += 1
                conditions.append(f"LOWER(\"reportText\") LIKE LOWER(${param_count})")
                params.append(f"%{text_search}%")
            
            where_clause = " AND ".join(conditions) if conditions else "1=1"
            param_count += 1
            params.append(limit)
            
            query = f"""
                SELECT 
                    id,
                    "patientSex" as patient_sex,
                    "caseAgeClass" as case_age_class,
                    "examServiceId" as exam_service_id,
                    "examDescription" as exam_description,
                    "icdCode" as icd_code,
                    SUBSTRING("reportText", 1, 500) as report_preview,
                    "examDate" as exam_date
                FROM medical_cases
                WHERE {where_clause}
                LIMIT ${param_count}
            """
            
            rows = await conn.fetch(query, *params)
            
            results = []
            for row in rows:
                results.append({
                    'id': row['id'],
                    'patient_sex': row['patient_sex'],
                    'age_class': row['case_age_class'],
                    'exam_type': row['exam_description'],
                    'icd_code': row['icd_code'],
                    'report_preview': row['report_preview'],
                    'exam_date': row['exam_date'].isoformat() if row['exam_date'] else None
                })
            
            return results
    
    async def get_icd_suggestions_for_text(self, text: str, modality: Optional[str] = None) -> Dict[str, Any]:
        """
        Get ICD suggestions based on medical text and modality
        Uses both keyword matching and statistical analysis from cases
        """
        if not self.pool:
            await self.connect()
            
        suggestions = {
            'text_based_suggestions': [],
            'modality_specific_suggestions': [],
            'case_based_suggestions': []
        }
        
        async with self.pool.acquire() as conn:
            # 1. Text-based ICD search
            keywords = self._extract_medical_keywords(text)
            
            for keyword in keywords[:5]:  # Limit to top 5 keywords
                keyword_suggestions = await self.search_icd_codes(keyword, limit=3)
                suggestions['text_based_suggestions'].extend(keyword_suggestions)
            
            # 2. Modality-specific common codes
            if modality:
                modality_query = """
                    SELECT 
                        mc."icdCode" as icd_code,
                        ic.label,
                        COUNT(*) as case_count,
                        0.7 as confidence
                    FROM medical_cases mc
                    JOIN icd_codes ic ON mc."icdCode" = ic."icdCode"
                    WHERE 
                        LOWER(mc."examDescription") LIKE LOWER($1)
                        AND mc."icdCode" IS NOT NULL
                    GROUP BY mc."icdCode", ic.label
                    ORDER BY case_count DESC
                    LIMIT 5
                """
                
                modality_pattern = f'%{modality}%'
                rows = await conn.fetch(modality_query, modality_pattern)
                
                for row in rows:
                    suggestions['modality_specific_suggestions'].append({
                        'code': row['icd_code'],
                        'description': row['label'],
                        'case_count': row['case_count'],
                        'confidence': float(row['confidence'])
                    })
            
            # 3. Case-based suggestions (find similar cases)
            # Extract key terms for similarity search
            key_terms = self._extract_key_medical_terms(text)
            
            if key_terms:
                case_query = """
                    SELECT 
                        mc."icdCode" as icd_code,
                        ic.label,
                        COUNT(*) as match_count,
                        0.6 as confidence
                    FROM medical_cases mc
                    JOIN icd_codes ic ON mc."icdCode" = ic."icdCode"
                    WHERE 
                        mc."icdCode" IS NOT NULL
                        AND (
                """
                
                term_conditions = []
                params = []
                for i, term in enumerate(key_terms[:3], 1):
                    term_conditions.append(f"LOWER(mc.\"reportText\") LIKE LOWER(${i})")
                    params.append(f'%{term}%')
                
                case_query += " OR ".join(term_conditions)
                case_query += """
                        )
                    GROUP BY mc."icdCode", ic.label
                    ORDER BY match_count DESC
                    LIMIT 5
                """
                
                rows = await conn.fetch(case_query, *params)
                
                for row in rows:
                    suggestions['case_based_suggestions'].append({
                        'code': row['icd_code'],
                        'description': row['label'],
                        'match_count': row['match_count'],
                        'confidence': float(row['confidence'])
                    })
        
        # Deduplicate and rank suggestions
        all_suggestions = self._merge_and_rank_suggestions(suggestions)
        
        return {
            'suggested_icd_codes': all_suggestions[:10],
            'total_suggestions': len(all_suggestions),
            'method': 'postgresql_query'
        }
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics"""
        if not self.pool:
            await self.connect()
            
        async with self.pool.acquire() as conn:
            stats = {}
            
            # ICD statistics
            stats['icd_count'] = await conn.fetchval('SELECT COUNT(*) FROM icd_codes')
            stats['terminal_codes'] = await conn.fetchval("SELECT COUNT(*) FROM icd_codes WHERE terminal = 'T'")
            
            # Medical cases statistics
            stats['total_cases'] = await conn.fetchval('SELECT COUNT(*) FROM medical_cases')
            stats['cases_with_icd'] = await conn.fetchval('SELECT COUNT(*) FROM medical_cases WHERE "icdCode" IS NOT NULL')
            
            # Top modalities
            modality_query = """
                SELECT "examDescription" as exam_description, COUNT(*) as count
                FROM medical_cases
                WHERE "examDescription" IS NOT NULL
                GROUP BY "examDescription"
                ORDER BY count DESC
                LIMIT 5
            """
            
            rows = await conn.fetch(modality_query)
            stats['top_modalities'] = [
                {'modality': row['exam_description'], 'count': row['count']}
                for row in rows
            ]
            
            return stats
    
    def _extract_medical_keywords(self, text: str) -> List[str]:
        """Extract medical keywords from German text"""
        # Common German medical terms to look for
        medical_terms = [
            'mammographie', 'ultraschall', 'sono', 'biopsie', 'karzinom',
            'tumor', 'metastase', 'lymphknoten', 'malignom', 'benigne',
            'zyste', 'fibroadenom', 'mikrokalk', 'birads', 'mastektomie',
            'chemotherapie', 'bestrahlung', 'hormontherapie', 'rezidiv'
        ]
        
        text_lower = text.lower()
        found_keywords = []
        
        for term in medical_terms:
            if term in text_lower:
                found_keywords.append(term)
        
        # Also extract any words that might be medical terms (capitalized, long)
        words = text.split()
        for word in words:
            if len(word) > 6 and word[0].isupper():
                cleaned = word.strip('.,;:!?')
                if cleaned not in found_keywords:
                    found_keywords.append(cleaned.lower())
        
        return found_keywords[:10]  # Limit to 10 keywords
    
    def _extract_key_medical_terms(self, text: str) -> List[str]:
        """Extract key medical terms for case matching"""
        # Focus on diagnostic terms
        diagnostic_terms = [
            'unauffällig', 'suspekt', 'maligne', 'benigne', 'metastase',
            'infiltration', 'invasion', 'nekrose', 'fibrose', 'ödeme'
        ]
        
        text_lower = text.lower()
        found_terms = []
        
        for term in diagnostic_terms:
            if term in text_lower:
                found_terms.append(term)
        
        return found_terms
    
    def _merge_and_rank_suggestions(self, suggestions: Dict[str, List]) -> List[Dict[str, Any]]:
        """Merge and rank ICD suggestions from different sources"""
        merged = {}
        
        # Collect all suggestions with their confidence scores
        for source, items in suggestions.items():
            weight = 1.0 if 'text_based' in source else 0.8 if 'modality' in source else 0.6
            
            for item in items:
                code = item['code']
                if code not in merged:
                    merged[code] = {
                        'code': code,
                        'description': item['description'],
                        'confidence': item['confidence'] * weight,
                        'sources': [source]
                    }
                else:
                    # Combine confidence scores
                    merged[code]['confidence'] = min(
                        1.0,
                        merged[code]['confidence'] + (item['confidence'] * weight * 0.3)
                    )
                    merged[code]['sources'].append(source)
        
        # Sort by confidence
        ranked = sorted(merged.values(), key=lambda x: x['confidence'], reverse=True)
        
        return ranked


# Singleton instance
_pg_ontology = None

def get_postgres_ontology():
    """Get singleton PostgreSQL ontology instance"""
    global _pg_ontology
    if _pg_ontology is None:
        _pg_ontology = PostgreSQLOntology()
    return _pg_ontology