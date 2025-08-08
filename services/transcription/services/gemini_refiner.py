"""
Gemini-based medical transcription refinement service
"""

import os
import logging
from typing import Optional
import google.generativeai as genai

logger = logging.getLogger(__name__)

class GeminiMedicalRefiner:
    """Refines medical transcriptions using Google's Gemini AI"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model = None
        self.initialized = False
        
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel('gemini-pro')
                self.initialized = True
                logger.info("Gemini medical refiner initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
    
    def is_available(self) -> bool:
        """Check if Gemini refiner is available"""
        return self.initialized and self.model is not None
    
    async def refine_transcription(self, raw_text: str, language: str = "de") -> str:
        """Refine medical transcription using Gemini"""
        if not self.is_available():
            logger.warning("Gemini refiner not available, returning original text")
            return raw_text
        
        if not raw_text or not raw_text.strip():
            return raw_text
        
        try:
            # Language-specific prompts
            if language == "de":
                system_instruction = """Du bist ein hochqualifizierter medizinischer Transkriptionist mit Spezialisierung auf die deutsche Sprache.
Deine Aufgabe ist es, ein rohes, unbearbeitetes Transkript aus einem Diktat zu verarbeiten.
Bitte führe folgende Aktionen durch:
1. Korrigiere alle Sprache-zu-Text-Fehler
2. Formatiere den Text in eine klare und professionelle medizinische Notiz
3. Stelle sicher, dass die korrekte deutsche medizinische Terminologie verwendet wird
4. Korrigiere grammatikalische Fehler und stelle sicher, dass der Text kohärent ist
5. Füge KEINE Informationen hinzu, die nicht im Originaltext vorhanden sind
6. Behalte den medizinischen Kontext bei (Radiologie, MRT, CT, etc.)

Gib NUR den verfeinerten deutschen Text aus, ohne einleitende Phrasen."""
            else:
                system_instruction = """You are a highly skilled medical transcriptionist.
Your task is to process a raw, unedited transcript from a voice dictation.
Please perform the following actions:
1. Correct any speech-to-text errors
2. Format the text into a clear and professional medical note
3. Ensure the use of correct medical terminology
4. Correct grammatical errors and ensure coherence
5. Do NOT add any information not present in the original text
6. Maintain the medical context (radiology, MRI, CT, etc.)

Output ONLY the refined text, without any introductory phrases."""

            # Call Gemini API
            response = self.model.generate_content(
                f"{system_instruction}\n\nRaw transcript:\n{raw_text}",
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    top_p=0.8,
                    max_output_tokens=2048,
                )
            )
            
            refined_text = response.text.strip()
            
            # Log improvement
            if refined_text != raw_text:
                logger.info(f"Gemini refined transcription - Original length: {len(raw_text)}, Refined length: {len(refined_text)}")
            
            return refined_text
            
        except Exception as e:
            logger.error(f"Gemini refinement failed: {e}")
            return raw_text
    
    async def refine_medical_report(self, report_text: str, examination_type: str = None) -> str:
        """Refine a medical report with specific formatting"""
        if not self.is_available():
            return report_text
        
        try:
            prompt = f"""Als medizinischer Experte, formatiere diesen Radiologiebefund professionell:

Untersuchungstyp: {examination_type or 'Radiologische Untersuchung'}
Rohtext: {report_text}

Strukturiere den Befund mit folgenden Abschnitten:
- Klinische Angaben
- Technik
- Befund
- Beurteilung
- Empfehlung

Verwende korrekte medizinische Terminologie und füge keine neuen Informationen hinzu."""

            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    top_p=0.9,
                    max_output_tokens=2048,
                )
            )
            
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Report refinement failed: {e}")
            return report_text


# Singleton instance
gemini_refiner = GeminiMedicalRefiner()