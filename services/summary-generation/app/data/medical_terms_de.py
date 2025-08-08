"""German medical terminology dictionary."""

GERMAN_MEDICAL_TERMS = {
    # Radiology Terms
    "Röntgenaufnahme": {
        "simple": "Röntgenbild",
        "basic": "Ein Bild von Ihrem Körperinneren, das mit Röntgenstrahlen gemacht wurde",
        "intermediate": "Eine Röntgenaufnahme ist ein bildgebendes Verfahren, bei dem Röntgenstrahlen durch den Körper geschickt werden, um Knochen und Organe sichtbar zu machen",
        "advanced": "Röntgenaufnahmen nutzen elektromagnetische Strahlung zur Darstellung anatomischer Strukturen mit unterschiedlicher Strahlendurchlässigkeit",
        "category": "imaging"
    },
    "Computertomographie": {
        "simple": "CT-Scan",
        "basic": "Ein spezielles Röntgenverfahren, das Schnittbilder Ihres Körpers erstellt",
        "intermediate": "Die Computertomographie erstellt detaillierte Querschnittsbilder des Körpers mittels rotierender Röntgenröhre",
        "advanced": "CT-Verfahren mit computergestützter Bildrekonstruktion zur hochauflösenden Darstellung anatomischer Strukturen",
        "category": "imaging"
    },
    "Magnetresonanztomographie": {
        "simple": "MRT",
        "basic": "Ein Verfahren, das mit Magnetfeldern detaillierte Bilder Ihres Körperinneren macht",
        "intermediate": "MRT nutzt starke Magnetfelder und Radiowellen zur Darstellung von Weichgewebe und Organen",
        "advanced": "Kernspintomographie basiert auf der magnetischen Resonanz von Wasserstoffatomen in unterschiedlichen Gewebetypen",
        "category": "imaging"
    },
    "Ultraschall": {
        "simple": "Ultraschall",
        "basic": "Eine Untersuchung mit Schallwellen, die Bilder von Ihren Organen erstellt",
        "intermediate": "Sonographie verwendet hochfrequente Schallwellen zur Darstellung von Organen und Geweben",
        "advanced": "Echoortungsverfahren mittels Ultraschallwellen zur nicht-invasiven Gewebedarstellung",
        "category": "imaging"
    },
    
    # Anatomical Terms
    "Thorax": {
        "simple": "Brustkorb",
        "basic": "Der obere Teil Ihres Rumpfes, wo sich Herz und Lunge befinden",
        "intermediate": "Der Brustkorb umfasst den Raum zwischen Hals und Zwerchfell mit Herz, Lunge und anderen Organen",
        "advanced": "Thorakaler Körperabschnitt zwischen Zervikalregion und Abdomen mit kardiopulmonalen Strukturen",
        "category": "anatomy"
    },
    "Abdomen": {
        "simple": "Bauch",
        "basic": "Ihr Bauchraum, wo sich Magen, Leber und andere Verdauungsorgane befinden",
        "intermediate": "Der Bauchraum enthält die meisten Verdauungsorgane sowie Nieren und andere wichtige Strukturen",
        "advanced": "Abdominaler Körperabschnitt mit gastrointestinalen, hepatobiliären und urogenitalen Organsystemen",
        "category": "anatomy"
    },
    "Wirbelsäule": {
        "simple": "Rückgrat",
        "basic": "Die Knochen in Ihrem Rücken, die Ihr Rückenmark schützen",
        "intermediate": "Die Wirbelsäule besteht aus 24 beweglichen Wirbeln plus Kreuzbein und Steißbein",
        "advanced": "Columna vertebralis mit 33-34 Wirbeln in zervikaler, thorakaler, lumbaler, sakraler und kokzygealer Region",
        "category": "anatomy"
    },
    
    # Pathological Terms
    "Läsion": {
        "simple": "Veränderung",
        "basic": "Eine Stelle in Ihrem Körper, die anders aussieht als normal",
        "intermediate": "Krankhafte Veränderung von Gewebe oder Organen, die von der normalen Struktur abweicht",
        "advanced": "Pathologische Gewebeveränderung mit struktureller oder funktioneller Abweichung vom physiologischen Zustand",
        "category": "pathology"
    },
    "Tumor": {
        "simple": "Geschwulst",
        "basic": "Eine Ansammlung von Zellen, die sich ungewöhnlich vermehrt haben",
        "intermediate": "Gewebswucherung durch unkontrollierte Zellvermehrung, kann gutartig oder bösartig sein",
        "advanced": "Neoplasie mit autonomem, progressivem Wachstum, differenziert nach Dignität und Histologie",
        "category": "pathology"
    },
    "Entzündung": {
        "simple": "Entzündung",
        "basic": "Eine Reaktion Ihres Körpers auf Verletzung oder Infektion",
        "intermediate": "Körperreaktion auf schädigende Reize mit Rötung, Schwellung, Wärme und Schmerz",
        "advanced": "Inflammatorische Reaktion mit vaskulären und zellulären Komponenten zur Geweberegeneration",
        "category": "pathology"
    },
    
    # Organ Systems
    "Herzkreislaufsystem": {
        "simple": "Herz und Blutgefäße",
        "basic": "Ihr Herz und alle Blutgefäße, die Blut durch den Körper pumpen",
        "intermediate": "Das System aus Herz, Arterien, Venen und Kapillaren für den Bluttransport",
        "advanced": "Kardiovaskuläres System mit Herz als Pumporgan und Gefäßsystem für Zirkulation",
        "category": "systems"
    },
    "Atmungssystem": {
        "simple": "Lunge und Atemwege",
        "basic": "Ihre Lunge und alle Atemwege, die Sauerstoff in Ihren Körper bringen",
        "intermediate": "Respiratorisches System mit Lunge, Bronchien und Atemwegen für Gasaustausch",
        "advanced": "Pulmonales System für Ventilation und Gasaustausch zwischen Alveolen und Blut",
        "category": "systems"
    },
    
    # Diagnostic Terms
    "Diagnose": {
        "simple": "Befund",
        "basic": "Was der Arzt bei Ihrer Untersuchung herausgefunden hat",
        "intermediate": "Die medizinische Feststellung einer Krankheit basierend auf Symptomen und Tests",
        "advanced": "Klinische Schlussfolgerung über Art und Stadium einer Erkrankung nach diagnostischem Prozess",
        "category": "diagnosis"
    },
    "Prognose": {
        "simple": "Verlauf",
        "basic": "Wie sich Ihr Gesundheitszustand wahrscheinlich entwickeln wird",
        "intermediate": "Vorhersage über den zu erwartenden Krankheitsverlauf und die Heilungsaussichten",
        "advanced": "Medizinische Projektion bezüglich Krankheitsverlauf, Therapieansprechen und Langzeitprognose",
        "category": "diagnosis"
    },
    
    # Treatment Terms
    "Therapie": {
        "simple": "Behandlung",
        "basic": "Die Behandlung, die Sie bekommen, um gesund zu werden",
        "intermediate": "Medizinische Maßnahmen zur Heilung oder Linderung einer Krankheit",
        "advanced": "Therapeutische Intervention zur Wiederherstellung oder Erhaltung der Gesundheit",
        "category": "treatment"
    },
    "Operation": {
        "simple": "Operation",
        "basic": "Ein chirurgischer Eingriff, bei dem der Chirurg Sie behandelt",
        "intermediate": "Chirurgischer Eingriff zur Behandlung von Krankheiten oder Verletzungen",
        "advanced": "Invasive chirurgische Intervention mit operativer Therapie anatomischer Strukturen",
        "category": "treatment"
    }
}

GERMAN_ABBREVIATIONS = {
    "CT": {
        "full_form": "Computertomographie",
        "explanation": "Ein spezielles Röntgenverfahren für Schnittbilder",
        "specialty": "radiology"
    },
    "MRT": {
        "full_form": "Magnetresonanztomographie",
        "explanation": "Bildgebung mit Magnetfeldern",
        "specialty": "radiology"
    },
    "EKG": {
        "full_form": "Elektrokardiogramm",
        "explanation": "Aufzeichnung der Herzströme",
        "specialty": "cardiology"
    },
    "EEG": {
        "full_form": "Elektroenzephalogramm",
        "explanation": "Messung der Gehirnströme",
        "specialty": "neurology"
    },
    "US": {
        "full_form": "Ultraschall",
        "explanation": "Untersuchung mit Schallwellen",
        "specialty": "radiology"
    },
    "HWS": {
        "full_form": "Halswirbelsäule",
        "explanation": "Die Wirbel in Ihrem Hals",
        "specialty": "orthopedics"
    },
    "BWS": {
        "full_form": "Brustwirbelsäule",
        "explanation": "Die Wirbel in Ihrem Brustbereich",
        "specialty": "orthopedics"
    },
    "LWS": {
        "full_form": "Lendenwirbelsäule",
        "explanation": "Die Wirbel in Ihrem unteren Rücken",
        "specialty": "orthopedics"
    }
}

GERMAN_EMERGENCY_KEYWORDS = {
    "Notfall": {
        "urgency_level": "critical",
        "emergency_type": "general",
        "patient_warning": "Dies erfordert sofortige medizinische Aufmerksamkeit",
        "immediate_actions": ["Sofort den Notarzt rufen (112)", "Nicht allein lassen"],
        "when_to_seek_help": "Sofort"
    },
    "akut": {
        "urgency_level": "high",
        "emergency_type": "acute_condition",
        "patient_warning": "Dies ist eine akute Situation, die schnelle Behandlung erfordert",
        "immediate_actions": ["Arzt kontaktieren", "Krankenhaus aufsuchen"],
        "when_to_seek_help": "Innerhalb weniger Stunden"
    },
    "Herzinfarkt": {
        "urgency_level": "critical",
        "emergency_type": "cardiac",
        "patient_warning": "Verdacht auf Herzinfarkt - lebensbedrohlicher Zustand",
        "immediate_actions": ["Sofort 112 anrufen", "Aspirin geben falls verfügbar", "Ruhe bewahren"],
        "when_to_seek_help": "Sofort"
    },
    "Schlaganfall": {
        "urgency_level": "critical",
        "emergency_type": "neurological",
        "patient_warning": "Verdacht auf Schlaganfall - jede Minute zählt",
        "immediate_actions": ["Sofort 112 anrufen", "FAST-Test durchführen"],
        "when_to_seek_help": "Sofort"
    },
    "Blutung": {
        "urgency_level": "high",
        "emergency_type": "bleeding",
        "patient_warning": "Blutungen können gefährlich werden",
        "immediate_actions": ["Blutung stillen", "Bei starker Blutung 112 anrufen"],
        "when_to_seek_help": "Je nach Schwere sofort bis innerhalb weniger Stunden"
    }
}