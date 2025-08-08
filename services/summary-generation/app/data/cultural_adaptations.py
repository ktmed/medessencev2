"""Cultural adaptations for different regions and languages."""

CULTURAL_ADAPTATIONS = {
    "de": {
        "DE": {  # Germany
            "communication_style": {
                "formality": "formal",
                "directness": "high",
                "medical_authority": "respected",
                "patient_autonomy": "high"
            },
            "family_involvement": "medium",
            "greeting_style": "Liebe Patientin, lieber Patient,",
            "explanation_style": "direct_medical",
            "recommendation_style": "authoritative_yet_respectful",
            "disclaimer_style": "comprehensive_legal",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "Hausarzt",
                "insurance_system": "statutory_insurance",
                "typical_next_steps": ["Hausarzt kontaktieren", "Überweisung erhalten", "Termin vereinbaren"]
            },
            "sensitive_topics": ["mental_health_stigma", "alternative_medicine_skepticism"],
            "preferred_metaphors": ["technical_mechanical", "body_as_machine"],
            "cultural_notes": "Germans prefer detailed, technical explanations and direct communication about medical conditions."
        },
        "AT": {  # Austria
            "communication_style": {
                "formality": "formal",
                "directness": "medium",
                "medical_authority": "highly_respected",
                "patient_autonomy": "medium"
            },
            "family_involvement": "medium",
            "greeting_style": "Sehr geehrte Patientin, sehr geehrter Patient,",
            "explanation_style": "formal_respectful",
            "recommendation_style": "authoritative",
            "disclaimer_style": "formal_comprehensive",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "praktischer Arzt",
                "insurance_system": "social_insurance",
                "typical_next_steps": ["Hausarzt aufsuchen", "Überweisung", "Facharzttermin"]
            },
            "cultural_notes": "Austrians appreciate formal, respectful communication with emphasis on medical expertise."
        },
        "CH": {  # Switzerland
            "communication_style": {
                "formality": "very_formal",
                "directness": "medium",
                "medical_authority": "respected",
                "patient_autonomy": "high"
            },
            "family_involvement": "low",
            "greeting_style": "Geschätzte Patientin, geschätzter Patient,",
            "explanation_style": "precise_conservative",
            "recommendation_style": "consultative",
            "disclaimer_style": "precise_legal",
            "healthcare_system_info": {
                "emergency_number": "144",
                "primary_care": "Hausarzt",
                "insurance_system": "mandatory_basic_plus_supplementary",
                "typical_next_steps": ["Hausarzt konsultieren", "Spezialisten-Überweisung", "Terminvereinbarung"]
            },
            "cultural_notes": "Swiss patients expect precise, conservative medical communication with emphasis on patient choice."
        }
    },
    "en": {
        "US": {  # United States
            "communication_style": {
                "formality": "informal_friendly",
                "directness": "high",
                "medical_authority": "questioned",
                "patient_autonomy": "very_high"
            },
            "family_involvement": "low",
            "greeting_style": "Dear Patient,",
            "explanation_style": "empowering_educational",
            "recommendation_style": "consultative_choice_oriented",
            "disclaimer_style": "liability_focused",
            "healthcare_system_info": {
                "emergency_number": "911",
                "primary_care": "Primary Care Physician",
                "insurance_system": "private_insurance_complex",
                "typical_next_steps": ["Contact your doctor", "Schedule appointment", "Check insurance coverage"]
            },
            "sensitive_topics": ["cost_concerns", "insurance_coverage", "medical_debt"],
            "preferred_metaphors": ["sports_military", "battle_against_disease"],
            "cultural_notes": "Americans prefer empowering language, choice options, and cost transparency."
        },
        "GB": {  # United Kingdom
            "communication_style": {
                "formality": "polite_reserved",
                "directness": "medium",
                "medical_authority": "trusted",
                "patient_autonomy": "high"
            },
            "family_involvement": "medium",
            "greeting_style": "Dear Patient,",
            "explanation_style": "reassuring_understated",
            "recommendation_style": "gentle_guidance",
            "disclaimer_style": "polite_comprehensive",
            "healthcare_system_info": {
                "emergency_number": "999",
                "primary_care": "GP (General Practitioner)",
                "insurance_system": "NHS_free_at_point_of_use",
                "typical_next_steps": ["See your GP", "Get referred if needed", "Book through NHS"]
            },
            "cultural_notes": "British patients appreciate understated, reassuring communication with polite reserve."
        }
    },
    "fr": {
        "FR": {  # France
            "communication_style": {
                "formality": "formal",
                "directness": "medium",
                "medical_authority": "highly_respected",
                "patient_autonomy": "medium"
            },
            "family_involvement": "high",
            "greeting_style": "Chère Patiente, Cher Patient,",
            "explanation_style": "intellectual_detailed",
            "recommendation_style": "authoritative_paternalistic",
            "disclaimer_style": "formal_legal",
            "healthcare_system_info": {
                "emergency_number": "15",
                "primary_care": "médecin traitant",
                "insurance_system": "securite_sociale",
                "typical_next_steps": ["Consulter votre médecin traitant", "Obtenir une ordonnance", "Prendre rendez-vous"]
            },
            "sensitive_topics": ["mental_health", "lifestyle_factors"],
            "preferred_metaphors": ["intellectual_scientific", "body_harmony"],
            "cultural_notes": "French patients expect intellectually sophisticated explanations with emphasis on medical expertise."
        },
        "BE": {  # Belgium
            "communication_style": {
                "formality": "formal",
                "directness": "low",
                "medical_authority": "respected",
                "patient_autonomy": "medium"
            },
            "family_involvement": "medium",
            "greeting_style": "Chère Patiente, Cher Patient,",
            "explanation_style": "careful_diplomatic",
            "recommendation_style": "consensus_building",
            "disclaimer_style": "cautious_comprehensive",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "médecin généraliste",
                "insurance_system": "mutuelle_system",
                "typical_next_steps": ["Consulter votre médecin", "Remboursement mutuelle", "Suivi médical"]
            },
            "cultural_notes": "Belgian patients prefer diplomatic, consensus-oriented medical communication."
        }
    },
    "tr": {
        "TR": {  # Turkey
            "communication_style": {
                "formality": "respectful",
                "directness": "low",
                "medical_authority": "highly_respected",
                "patient_autonomy": "low"
            },
            "family_involvement": "very_high",
            "greeting_style": "Değerli Hastamız,",
            "explanation_style": "respectful_family_oriented",
            "recommendation_style": "authoritative_caring",
            "disclaimer_style": "religious_medical",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "aile hekimi",
                "insurance_system": "SGK_universal",
                "typical_next_steps": ["Aile hekiminize başvurun", "Sevk alın", "Randevu alın"]
            },
            "sensitive_topics": ["family_honor", "gender_specific_care", "religious_considerations"],
            "preferred_metaphors": ["family_strength", "spiritual_healing"],
            "cultural_notes": "Turkish patients expect family-inclusive, respectful communication with deference to medical authority."
        }
    },
    "es": {
        "ES": {  # Spain
            "communication_style": {
                "formality": "warm_formal",
                "directness": "medium",
                "medical_authority": "respected",
                "patient_autonomy": "medium"
            },
            "family_involvement": "high",
            "greeting_style": "Estimado/a Paciente,",
            "explanation_style": "warm_personal",
            "recommendation_style": "caring_authoritative",
            "disclaimer_style": "warm_comprehensive",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "médico de cabecera",
                "insurance_system": "sistema_publico_salud",
                "typical_next_steps": ["Consulte su médico de cabecera", "Solicite cita", "Siga tratamiento"]
            },
            "cultural_notes": "Spanish patients appreciate warm, personal communication with family involvement."
        },
        "MX": {  # Mexico
            "communication_style": {
                "formality": "respectful_warm",
                "directness": "low",
                "medical_authority": "highly_respected",
                "patient_autonomy": "low"
            },
            "family_involvement": "very_high",
            "greeting_style": "Estimado/a Paciente,",
            "explanation_style": "respectful_family_centered",
            "recommendation_style": "paternalistic_caring",
            "disclaimer_style": "religious_family_oriented",
            "healthcare_system_info": {
                "emergency_number": "911",
                "primary_care": "médico familiar",
                "insurance_system": "IMSS_seguro_popular",
                "typical_next_steps": ["Acuda a su médico familiar", "Consulte en su clínica", "Siga indicaciones médicas"]
            },
            "cultural_notes": "Mexican patients expect respectful, family-centered communication with religious considerations."
        }
    },
    "it": {
        "IT": {  # Italy
            "communication_style": {
                "formality": "warm_formal",
                "directness": "medium",
                "medical_authority": "respected",
                "patient_autonomy": "medium"
            },
            "family_involvement": "very_high",
            "greeting_style": "Gentile Paziente,",
            "explanation_style": "warm_expressive",
            "recommendation_style": "passionate_caring",
            "disclaimer_style": "warm_comprehensive",
            "healthcare_system_info": {
                "emergency_number": "112",
                "primary_care": "medico di famiglia",
                "insurance_system": "servizio_sanitario_nazionale",
                "typical_next_steps": ["Consulti il suo medico di famiglia", "Prenoti visita", "Segua le cure"]
            },
            "cultural_notes": "Italian patients appreciate warm, expressive communication with strong family involvement."
        }
    }
}

def get_cultural_adaptation(language: str, region: str = None) -> dict:
    """Get cultural adaptation settings for a language and region."""
    if language not in CULTURAL_ADAPTATIONS:
        # Default to English/US if language not found
        return CULTURAL_ADAPTATIONS["en"]["US"]
    
    lang_adaptations = CULTURAL_ADAPTATIONS[language]
    
    if region and region in lang_adaptations:
        return lang_adaptations[region]
    
    # Return first available region for the language
    return next(iter(lang_adaptations.values()))

def get_appropriate_greeting(language: str, region: str = None) -> str:
    """Get culturally appropriate greeting."""
    adaptation = get_cultural_adaptation(language, region)
    return adaptation.get("greeting_style", "Dear Patient,")

def get_disclaimer_style(language: str, region: str = None) -> str:
    """Get culturally appropriate disclaimer style."""
    adaptation = get_cultural_adaptation(language, region)
    return adaptation.get("disclaimer_style", "comprehensive_legal")

def should_include_family_context(language: str, region: str = None) -> bool:
    """Determine if family context should be included based on culture."""
    adaptation = get_cultural_adaptation(language, region)
    family_involvement = adaptation.get("family_involvement", "medium")
    return family_involvement in ["high", "very_high"]