"""
PostgreSQL Database Setup for Medical Ontology
Initializes database schema and populates with ontology data
"""
import os
import json
import psycopg2
from psycopg2.extras import execute_batch
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection(database_url=None):
    """Create database connection"""
    if not database_url:
        database_url = os.environ.get('DATABASE_URL')
    
    # Handle Heroku's postgres:// URL format
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return psycopg2.connect(database_url)

def create_tables(conn):
    """Create ontology tables"""
    cursor = conn.cursor()
    
    # Drop existing tables if they exist
    cursor.execute("DROP TABLE IF EXISTS medical_entities CASCADE")
    
    # Create medical_entities table with optimized indexes
    cursor.execute("""
        CREATE TABLE medical_entities (
            id SERIAL PRIMARY KEY,
            term VARCHAR(500) NOT NULL,
            category VARCHAR(50) NOT NULL,
            frequency INTEGER DEFAULT 1,
            term_lower VARCHAR(500) GENERATED ALWAYS AS (LOWER(term)) STORED,
            term_length INTEGER GENERATED ALWAYS AS (LENGTH(term)) STORED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indexes for fast lookups
    cursor.execute("CREATE INDEX idx_term_lower ON medical_entities(term_lower)")
    cursor.execute("CREATE INDEX idx_category ON medical_entities(category)")
    cursor.execute("CREATE INDEX idx_frequency ON medical_entities(frequency DESC)")
    cursor.execute("CREATE INDEX idx_term_prefix ON medical_entities(term_lower varchar_pattern_ops)")
    cursor.execute("CREATE INDEX idx_term_length ON medical_entities(term_length)")
    
    conn.commit()
    logger.info("Database tables created successfully")

def load_ontology_data():
    """Load ontology data from JSON file"""
    ontology_path = Path(__file__).parent.parent / 'data' / 'ontology_output' / 'medical_ontology.json'
    
    if not ontology_path.exists():
        logger.error(f"Ontology file not found: {ontology_path}")
        return None
    
    with open(ontology_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def populate_database(conn, ontology_data):
    """Populate database with ontology data"""
    cursor = conn.cursor()
    
    # Prepare data for batch insert
    records = []
    categories = ['anatomy', 'pathology', 'procedures', 'measurements', 
                  'modifiers', 'medications', 'symptoms']
    
    for category in categories:
        if category in ontology_data:
            category_data = ontology_data[category]
            if isinstance(category_data, dict):
                for term, frequency in category_data.items():
                    # Skip very short terms or numbers
                    if len(term) > 1 and not term.isdigit():
                        records.append((term, category, frequency))
    
    # Batch insert for performance
    execute_batch(
        cursor,
        "INSERT INTO medical_entities (term, category, frequency) VALUES (%s, %s, %s)",
        records,
        page_size=1000
    )
    
    conn.commit()
    logger.info(f"Inserted {len(records)} medical entities")
    return len(records)

def create_search_functions(conn):
    """Create PostgreSQL functions for fuzzy search"""
    cursor = conn.cursor()
    
    # Create fuzzy search function using PostgreSQL's similarity features
    cursor.execute("""
        CREATE OR REPLACE FUNCTION fuzzy_search(
            search_term TEXT,
            threshold FLOAT DEFAULT 0.3
        )
        RETURNS TABLE(
            term VARCHAR,
            category VARCHAR,
            frequency INTEGER,
            similarity FLOAT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                me.term,
                me.category,
                me.frequency,
                similarity(LOWER(search_term), me.term_lower) AS sim
            FROM medical_entities me
            WHERE similarity(LOWER(search_term), me.term_lower) > threshold
            ORDER BY sim DESC, me.frequency DESC
            LIMIT 10;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create autocomplete function
    cursor.execute("""
        CREATE OR REPLACE FUNCTION autocomplete(
            prefix TEXT,
            max_results INTEGER DEFAULT 10
        )
        RETURNS TABLE(
            term VARCHAR,
            category VARCHAR,
            frequency INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                me.term,
                me.category,
                me.frequency
            FROM medical_entities me
            WHERE me.term_lower LIKE LOWER(prefix) || '%'
            ORDER BY me.frequency DESC, me.term_length
            LIMIT max_results;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    conn.commit()
    logger.info("Search functions created successfully")

def enable_pg_trgm(conn):
    """Enable pg_trgm extension for fuzzy matching"""
    cursor = conn.cursor()
    try:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        conn.commit()
        logger.info("pg_trgm extension enabled")
    except Exception as e:
        logger.warning(f"Could not enable pg_trgm extension: {e}")
        conn.rollback()

def main():
    """Main setup function"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL environment variable not set")
        return
    
    # Load ontology data
    logger.info("Loading ontology data...")
    ontology_data = load_ontology_data()
    if not ontology_data:
        return
    
    # Connect to database
    logger.info("Connecting to database...")
    conn = get_db_connection(database_url)
    
    try:
        # Enable extensions
        enable_pg_trgm(conn)
        
        # Create tables
        logger.info("Creating database tables...")
        create_tables(conn)
        
        # Populate database
        logger.info("Populating database...")
        count = populate_database(conn, ontology_data)
        
        # Create search functions
        logger.info("Creating search functions...")
        create_search_functions(conn)
        
        logger.info(f"Database setup complete! Loaded {count} entities")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()