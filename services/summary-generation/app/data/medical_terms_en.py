"""English medical terminology dictionary."""

ENGLISH_MEDICAL_TERMS = {
    # Radiology Terms
    "X-ray": {
        "simple": "X-ray",
        "basic": "A picture of the inside of your body using X-ray beams",
        "intermediate": "X-ray imaging uses electromagnetic radiation to create images of bones and organs",
        "advanced": "Radiographic imaging utilizing electromagnetic radiation for anatomical visualization",
        "category": "imaging"
    },
    "CT scan": {
        "simple": "CT scan",
        "basic": "A special X-ray that takes detailed pictures of cross-sections of your body",
        "intermediate": "Computed tomography creates detailed cross-sectional images using rotating X-ray equipment",
        "advanced": "Axial tomography with computer-assisted reconstruction for high-resolution imaging",
        "category": "imaging"
    },
    "MRI": {
        "simple": "MRI",
        "basic": "A scan that uses magnetic fields to create detailed pictures of your body",
        "intermediate": "Magnetic resonance imaging uses strong magnetic fields and radio waves to image soft tissues",
        "advanced": "Nuclear magnetic resonance imaging based on hydrogen atom behavior in magnetic fields",
        "category": "imaging"
    },
    "Ultrasound": {
        "simple": "Ultrasound",
        "basic": "An examination using sound waves to create pictures of your organs",
        "intermediate": "Sonography uses high-frequency sound waves to visualize organs and tissues",
        "advanced": "Echographic imaging using ultrasonic waves for non-invasive tissue visualization",
        "category": "imaging"
    },
    
    # Anatomical Terms
    "Thorax": {
        "simple": "Chest",
        "basic": "The upper part of your body where your heart and lungs are located",
        "intermediate": "The chest cavity containing the heart, lungs, and other vital organs",
        "advanced": "Thoracic cavity between the neck and diaphragm containing cardiopulmonary structures",
        "category": "anatomy"
    },
    "Abdomen": {
        "simple": "Belly",
        "basic": "Your stomach area where digestive organs are located",
        "intermediate": "The abdominal cavity containing digestive organs, kidneys, and other structures",
        "advanced": "Abdominal region with gastrointestinal, hepatobiliary, and urogenital organ systems",
        "category": "anatomy"
    },
    "Spine": {
        "simple": "Backbone",
        "basic": "The bones in your back that protect your spinal cord",
        "intermediate": "The vertebral column consisting of 24 movable vertebrae plus sacrum and coccyx",
        "advanced": "Vertebral column with cervical, thoracic, lumbar, sacral, and coccygeal regions",
        "category": "anatomy"
    },
    
    # Pathological Terms
    "Lesion": {
        "simple": "Abnormal area",
        "basic": "An area in your body that looks different from normal",
        "intermediate": "Abnormal change in tissue or organ structure that deviates from normal appearance",
        "advanced": "Pathological tissue alteration with structural or functional deviation from normal state",
        "category": "pathology"
    },
    "Tumor": {
        "simple": "Growth",
        "basic": "A collection of cells that have grown unusually",
        "intermediate": "Abnormal tissue growth due to uncontrolled cell multiplication, can be benign or malignant",
        "advanced": "Neoplasm with autonomous, progressive growth, classified by dignity and histology",
        "category": "pathology"
    },
    "Inflammation": {
        "simple": "Inflammation",
        "basic": "Your body's response to injury or infection",
        "intermediate": "Body's reaction to harmful stimuli with redness, swelling, heat, and pain",
        "advanced": "Inflammatory response with vascular and cellular components for tissue repair",
        "category": "pathology"
    },
    
    # Organ Systems
    "Cardiovascular system": {
        "simple": "Heart and blood vessels",
        "basic": "Your heart and all blood vessels that pump blood through your body",
        "intermediate": "The system of heart, arteries, veins, and capillaries for blood transport",
        "advanced": "Cardiovascular system with heart as pump organ and vascular system for circulation",
        "category": "systems"
    },
    "Respiratory system": {
        "simple": "Lungs and airways",
        "basic": "Your lungs and all airways that bring oxygen into your body",
        "intermediate": "Respiratory system with lungs, bronchi, and airways for gas exchange",
        "advanced": "Pulmonary system for ventilation and gas exchange between alveoli and blood",
        "category": "systems"
    },
    
    # Diagnostic Terms
    "Diagnosis": {
        "simple": "Finding",
        "basic": "What the doctor discovered during your examination",
        "intermediate": "Medical determination of a disease based on symptoms and tests",
        "advanced": "Clinical conclusion about disease type and stage after diagnostic process",
        "category": "diagnosis"
    },
    "Prognosis": {
        "simple": "Outlook",
        "basic": "How your health condition is likely to develop",
        "intermediate": "Prediction about expected disease course and healing prospects",
        "advanced": "Medical projection regarding disease progression, treatment response, and long-term outcome",
        "category": "diagnosis"
    },
    
    # Treatment Terms
    "Therapy": {
        "simple": "Treatment",
        "basic": "The treatment you receive to get better",
        "intermediate": "Medical measures to cure or alleviate a disease",
        "advanced": "Therapeutic intervention to restore or maintain health",
        "category": "treatment"
    },
    "Surgery": {
        "simple": "Operation",
        "basic": "A surgical procedure where the surgeon treats you",
        "intermediate": "Surgical intervention to treat diseases or injuries",
        "advanced": "Invasive surgical intervention with operative therapy of anatomical structures",
        "category": "treatment"
    }
}

ENGLISH_ABBREVIATIONS = {
    "CT": {
        "full_form": "Computed Tomography",
        "explanation": "A special X-ray procedure for cross-sectional images",
        "specialty": "radiology"
    },
    "MRI": {
        "full_form": "Magnetic Resonance Imaging",
        "explanation": "Imaging with magnetic fields",
        "specialty": "radiology"
    },
    "ECG": {
        "full_form": "Electrocardiogram",
        "explanation": "Recording of heart electrical activity",
        "specialty": "cardiology"
    },
    "EEG": {
        "full_form": "Electroencephalogram",
        "explanation": "Measurement of brain electrical activity",
        "specialty": "neurology"
    },
    "US": {
        "full_form": "Ultrasound",
        "explanation": "Examination with sound waves",
        "specialty": "radiology"
    },
    "ER": {
        "full_form": "Emergency Room",
        "explanation": "Hospital department for urgent care",
        "specialty": "emergency"
    },
    "ICU": {
        "full_form": "Intensive Care Unit",
        "explanation": "Hospital unit for critically ill patients",
        "specialty": "critical_care"
    }
}

ENGLISH_EMERGENCY_KEYWORDS = {
    "emergency": {
        "urgency_level": "critical",
        "emergency_type": "general",
        "patient_warning": "This requires immediate medical attention",
        "immediate_actions": ["Call emergency services (911)", "Do not leave alone"],
        "when_to_seek_help": "Immediately"
    },
    "acute": {
        "urgency_level": "high",
        "emergency_type": "acute_condition",
        "patient_warning": "This is an acute situation requiring prompt treatment",
        "immediate_actions": ["Contact doctor", "Go to hospital"],
        "when_to_seek_help": "Within a few hours"
    },
    "heart attack": {
        "urgency_level": "critical",
        "emergency_type": "cardiac",
        "patient_warning": "Suspected heart attack - life-threatening condition",
        "immediate_actions": ["Call 911 immediately", "Give aspirin if available", "Stay calm"],
        "when_to_seek_help": "Immediately"
    },
    "stroke": {
        "urgency_level": "critical",
        "emergency_type": "neurological",
        "patient_warning": "Suspected stroke - every minute counts",
        "immediate_actions": ["Call 911 immediately", "Perform FAST test"],
        "when_to_seek_help": "Immediately"
    },
    "bleeding": {
        "urgency_level": "high",
        "emergency_type": "bleeding",
        "patient_warning": "Bleeding can become dangerous",
        "immediate_actions": ["Stop bleeding", "Call 911 for severe bleeding"],
        "when_to_seek_help": "Depending on severity, immediately to within hours"
    }
}