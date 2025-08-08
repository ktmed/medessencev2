#!/usr/bin/env python3
"""
Analyze radiology reports dataset to improve agent patterns
"""
import pandas as pd
import json
import re
from collections import Counter, defaultdict
import numpy as np

def analyze_reports(file_path):
    """Analyze the radiology reports Excel file"""
    print(f"Loading {file_path}...")
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path)
        print(f"Loaded {len(df)} reports")
        print(f"Columns: {list(df.columns)}")
        
        # Display first few rows to understand structure
        print("\nFirst 5 rows:")
        print(df.head())
        
        # Basic statistics
        print("\nDataset Statistics:")
        print(f"Total reports: {len(df)}")
        print(f"Columns: {df.shape[1]}")
        
        # Check for report text columns
        text_columns = []
        for col in df.columns:
            if df[col].dtype == 'object':  # Text columns
                non_null = df[col].dropna()
                if len(non_null) > 0:
                    # Check if it contains substantial text
                    avg_length = non_null.astype(str).str.len().mean()
                    if avg_length > 50:  # Likely contains report text
                        text_columns.append(col)
                        print(f"\nText column '{col}': avg length {avg_length:.0f} chars")
        
        # Analyze patterns in text columns
        patterns_found = defaultdict(list)
        
        # Common section headers in German radiology reports
        section_patterns = {
            'indication': [
                r'(?i)indikation[:\s]',
                r'(?i)klinik\s*und\s*rechtfertigende\s*indikation',
                r'(?i)fragestellung[:\s]'
            ],
            'technique': [
                r'(?i)technik[:\s]',
                r'(?i)untersuchungstechnik[:\s]',
                r'(?i)protokoll[:\s]'
            ],
            'findings': [
                r'(?i)befund[:\s]',
                r'(?i)befunde[:\s]',
                r'(?i)findings[:\s]'
            ],
            'impression': [
                r'(?i)beurteilung[:\s]',
                r'(?i)zusammenfassung[:\s]',
                r'(?i)impression[:\s]'
            ],
            'recommendations': [
                r'(?i)empfehlung[:\s]',
                r'(?i)procedere[:\s]',
                r'(?i)weiteres\s*vorgehen[:\s]'
            ]
        }
        
        # Modality patterns
        modality_patterns = {
            'ct': [r'(?i)computertomographie', r'(?i)\bct\b', r'(?i)multislice'],
            'mri': [r'(?i)mrt\b', r'(?i)magnetresonanz', r'(?i)kernspintomographie'],
            'xray': [r'(?i)röntgen', r'(?i)x-ray', r'(?i)konventionell'],
            'ultrasound': [r'(?i)sonographie', r'(?i)ultraschall', r'(?i)doppler'],
            'mammography': [r'(?i)mammographie', r'(?i)birads', r'(?i)brustdichte'],
            'pet': [r'(?i)pet-ct', r'(?i)positronen', r'(?i)pet/ct']
        }
        
        # Analyze each text column
        for col in text_columns[:5]:  # Limit to first 5 text columns
            print(f"\n\nAnalyzing column: {col}")
            
            # Sample of non-null texts
            texts = df[col].dropna().astype(str).tolist()
            print(f"Non-null texts: {len(texts)}")
            
            if len(texts) > 0:
                # Section analysis
                section_counts = Counter()
                for section, patterns in section_patterns.items():
                    count = 0
                    for text in texts[:1000]:  # Sample first 1000
                        for pattern in patterns:
                            if re.search(pattern, text):
                                count += 1
                                break
                    section_counts[section] = count
                
                print("\nSection patterns found:")
                for section, count in section_counts.most_common():
                    percentage = (count / min(len(texts), 1000)) * 100
                    print(f"  {section}: {count} ({percentage:.1f}%)")
                
                # Modality analysis
                modality_counts = Counter()
                for modality, patterns in modality_patterns.items():
                    count = 0
                    for text in texts[:1000]:  # Sample first 1000
                        for pattern in patterns:
                            if re.search(pattern, text):
                                count += 1
                                break
                    modality_counts[modality] = count
                
                print("\nModality patterns found:")
                for modality, count in modality_counts.most_common():
                    percentage = (count / min(len(texts), 1000)) * 100
                    print(f"  {modality}: {count} ({percentage:.1f}%)")
                
                # Extract common phrases
                print("\nExtracting common medical terms...")
                medical_terms = []
                term_patterns = [
                    r'(?i)\b\w+karzinom\b',
                    r'(?i)\b\w+itis\b',
                    r'(?i)\b\w+ose\b',
                    r'(?i)\b\w+om\b',
                    r'(?i)\b\w+pathie\b',
                    r'(?i)\bzyste[n]?\b',
                    r'(?i)\btumor\b',
                    r'(?i)\bmetastase[n]?\b',
                    r'(?i)\blymphknoten\b',
                    r'(?i)\bverkalkung[en]?\b'
                ]
                
                for text in texts[:500]:  # Sample first 500
                    for pattern in term_patterns:
                        matches = re.findall(pattern, text)
                        medical_terms.extend(matches)
                
                term_counts = Counter(medical_terms)
                print("Most common medical terms:")
                for term, count in term_counts.most_common(20):
                    print(f"  {term}: {count}")
                
                # Extract typical report structures
                print("\n\nAnalyzing report structures...")
                structure_examples = []
                for text in texts[:10]:  # First 10 examples
                    if len(text) > 200:
                        # Find section headers
                        headers = []
                        for line in text.split('\n'):
                            if re.search(r'^[A-Z][^:]+:', line):
                                headers.append(line.strip())
                        if headers:
                            structure_examples.append(headers)
                
                if structure_examples:
                    print("Example report structures found:")
                    for i, headers in enumerate(structure_examples[:5]):
                        print(f"\nExample {i+1}:")
                        for header in headers:
                            print(f"  - {header}")
        
        # Save analysis results
        analysis_results = {
            'total_reports': len(df),
            'columns': list(df.columns),
            'text_columns': text_columns,
            'section_patterns': dict(section_counts) if 'section_counts' in locals() else {},
            'modality_patterns': dict(modality_counts) if 'modality_counts' in locals() else {},
            'common_terms': dict(term_counts.most_common(50)) if 'term_counts' in locals() else {}
        }
        
        output_file = 'report-analysis-results.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n\nAnalysis complete! Results saved to {output_file}")
        
        return analysis_results
        
    except Exception as e:
        print(f"Error analyzing file: {e}")
        return None

if __name__ == "__main__":
    # Analyze the reports
    results = analyze_reports("data/originaldata.xlsx")
    
    if results:
        print("\n\nKey insights for improving agents:")
        print("1. Common section headers to look for:")
        for section, count in results.get('section_patterns', {}).items():
            print(f"   - {section}: {count} occurrences")
        
        print("\n2. Report types by modality:")
        for modality, count in results.get('modality_patterns', {}).items():
            print(f"   - {modality}: {count} reports")
        
        print("\n3. Consider adding patterns for these common terms:")
        for term, count in list(results.get('common_terms', {}).items())[:10]:
            print(f"   - {term}: {count} occurrences")