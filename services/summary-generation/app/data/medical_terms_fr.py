"""French medical terminology dictionary."""

FRENCH_MEDICAL_TERMS = {
    # Radiology Terms
    "Radiographie": {
        "simple": "Radio",
        "basic": "Une image de l'intérieur de votre corps prise avec des rayons X",
        "intermediate": "La radiographie utilise des rayons X pour créer des images des os et organes",
        "advanced": "Imagerie radiographique utilisant les rayonnements électromagnétiques pour la visualisation anatomique",
        "category": "imaging"
    },
    "Scanner": {
        "simple": "Scanner",
        "basic": "Un examen spécial qui prend des images détaillées en tranches de votre corps",
        "intermediate": "La tomodensitométrie crée des images détaillées en coupe grâce à un équipement rotatif",
        "advanced": "Tomographie axiale avec reconstruction assistée par ordinateur pour imagerie haute résolution",
        "category": "imaging"
    },
    "IRM": {
        "simple": "IRM",
        "basic": "Un examen qui utilise des champs magnétiques pour créer des images détaillées de votre corps",
        "intermediate": "L'IRM utilise des champs magnétiques puissants et des ondes radio pour imager les tissus mous",
        "advanced": "Imagerie par résonance magnétique nucléaire basée sur le comportement des atomes d'hydrogène",
        "category": "imaging"
    },
    "Échographie": {
        "simple": "Écho",
        "basic": "Un examen utilisant des ondes sonores pour créer des images de vos organes",
        "intermediate": "La sonographie utilise des ondes sonores haute fréquence pour visualiser organes et tissus",
        "advanced": "Imagerie échographique utilisant des ondes ultrasoniques pour visualisation tissulaire non-invasive",
        "category": "imaging"
    },
    
    # Anatomical Terms
    "Thorax": {
        "simple": "Poitrine",
        "basic": "La partie supérieure de votre corps où se trouvent le cœur et les poumons",
        "intermediate": "La cavité thoracique contenant le cœur, les poumons et autres organes vitaux",
        "advanced": "Cavité thoracique entre le cou et le diaphragme contenant les structures cardiopulmonaires",
        "category": "anatomy"
    },
    "Abdomen": {
        "simple": "Ventre",
        "basic": "Votre zone abdominale où se trouvent les organes digestifs",
        "intermediate": "La cavité abdominale contenant les organes digestifs, les reins et autres structures",
        "advanced": "Région abdominale avec les systèmes d'organes gastro-intestinaux, hépatobiliaires et urogénitaux",
        "category": "anatomy"
    },
    "Colonne vertébrale": {
        "simple": "Dos",
        "basic": "Les os de votre dos qui protègent votre moelle épinière",
        "intermediate": "La colonne vertébrale composée de 24 vertèbres mobiles plus le sacrum et le coccyx",
        "advanced": "Colonne vertébrale avec régions cervicale, thoracique, lombaire, sacrée et coccygienne",
        "category": "anatomy"
    },
    
    # Pathological Terms
    "Lésion": {
        "simple": "Anomalie",
        "basic": "Une zone de votre corps qui semble différente de la normale",
        "intermediate": "Changement anormal dans la structure d'un tissu ou organe qui dévie de l'apparence normale",
        "advanced": "Altération tissulaire pathologique avec déviation structurelle ou fonctionnelle de l'état normal",
        "category": "pathology"
    },
    "Tumeur": {
        "simple": "Grosseur",
        "basic": "Un amas de cellules qui ont grandi de manière inhabituelle",
        "intermediate": "Croissance tissulaire anormale due à une multiplication cellulaire incontrôlée, peut être bénigne ou maligne",
        "advanced": "Néoplasme avec croissance autonome et progressive, classé selon la dignité et l'histologie",
        "category": "pathology"
    },
    "Inflammation": {
        "simple": "Inflammation",
        "basic": "La réaction de votre corps à une blessure ou infection",
        "intermediate": "Réaction du corps aux stimuli nocifs avec rougeur, gonflement, chaleur et douleur",
        "advanced": "Réponse inflammatoire avec composants vasculaires et cellulaires pour la réparation tissulaire",
        "category": "pathology"
    },
    
    # Organ Systems
    "Système cardiovasculaire": {
        "simple": "Cœur et vaisseaux",
        "basic": "Votre cœur et tous les vaisseaux sanguins qui pompent le sang dans votre corps",
        "intermediate": "Le système composé du cœur, artères, veines et capillaires pour le transport sanguin",
        "advanced": "Système cardiovasculaire avec le cœur comme organe de pompage et système vasculaire pour circulation",
        "category": "systems"
    },
    "Système respiratoire": {
        "simple": "Poumons et voies respiratoires",
        "basic": "Vos poumons et toutes les voies respiratoires qui apportent l'oxygène dans votre corps",
        "intermediate": "Système respiratoire avec poumons, bronches et voies respiratoires pour l'échange gazeux",
        "advanced": "Système pulmonaire pour ventilation et échange gazeux entre alvéoles et sang",
        "category": "systems"
    },
    
    # Diagnostic Terms
    "Diagnostic": {
        "simple": "Résultat",
        "basic": "Ce que le médecin a découvert lors de votre examen",
        "intermediate": "Détermination médicale d'une maladie basée sur les symptômes et tests",
        "advanced": "Conclusion clinique sur le type et stade de maladie après processus diagnostique",
        "category": "diagnosis"
    },
    "Pronostic": {
        "simple": "Évolution",
        "basic": "Comment votre état de santé va probablement évoluer",
        "intermediate": "Prédiction sur l'évolution attendue de la maladie et les perspectives de guérison",
        "advanced": "Projection médicale concernant progression maladie, réponse traitement et issue à long terme",
        "category": "diagnosis"
    },
    
    # Treatment Terms
    "Thérapie": {
        "simple": "Traitement",
        "basic": "Le traitement que vous recevez pour aller mieux",
        "intermediate": "Mesures médicales pour guérir ou soulager une maladie",
        "advanced": "Intervention thérapeutique pour restaurer ou maintenir la santé",
        "category": "treatment"
    },
    "Chirurgie": {
        "simple": "Opération",
        "basic": "Une intervention chirurgicale où le chirurgien vous traite",
        "intermediate": "Intervention chirurgicale pour traiter des maladies ou blessures",
        "advanced": "Intervention chirurgicale invasive avec thérapie opératoire des structures anatomiques",
        "category": "treatment"
    }
}

FRENCH_ABBREVIATIONS = {
    "TDM": {
        "full_form": "Tomodensitométrie",
        "explanation": "Procédure spéciale de rayons X pour images en coupe",
        "specialty": "radiology"
    },
    "IRM": {
        "full_form": "Imagerie par Résonance Magnétique",
        "explanation": "Imagerie avec champs magnétiques",
        "specialty": "radiology"
    },
    "ECG": {
        "full_form": "Électrocardiogramme",
        "explanation": "Enregistrement de l'activité électrique du cœur",
        "specialty": "cardiology"
    },
    "EEG": {
        "full_form": "Électroencéphalogramme",
        "explanation": "Mesure de l'activité électrique du cerveau",
        "specialty": "neurology"
    },
    "SAU": {
        "full_form": "Service d'Accueil des Urgences",
        "explanation": "Service hospitalier pour soins urgents",
        "specialty": "emergency"
    },
    "USI": {
        "full_form": "Unité de Soins Intensifs",
        "explanation": "Unité hospitalière pour patients en état critique",
        "specialty": "critical_care"
    }
}

FRENCH_EMERGENCY_KEYWORDS = {
    "urgence": {
        "urgency_level": "critical",
        "emergency_type": "general",
        "patient_warning": "Ceci nécessite une attention médicale immédiate",
        "immediate_actions": ["Appeler les services d'urgence (15)", "Ne pas laisser seul"],
        "when_to_seek_help": "Immédiatement"
    },
    "aigu": {
        "urgency_level": "high",
        "emergency_type": "acute_condition",
        "patient_warning": "C'est une situation aiguë nécessitant un traitement rapide",
        "immediate_actions": ["Contacter le médecin", "Se rendre à l'hôpital"],
        "when_to_seek_help": "Dans quelques heures"
    },
    "infarctus": {
        "urgency_level": "critical",
        "emergency_type": "cardiac",
        "patient_warning": "Suspicion d'infarctus - condition potentiellement mortelle",
        "immediate_actions": ["Appeler le 15 immédiatement", "Donner de l'aspirine si disponible", "Rester calme"],
        "when_to_seek_help": "Immédiatement"
    },
    "AVC": {
        "urgency_level": "critical",
        "emergency_type": "neurological",
        "patient_warning": "Suspicion d'AVC - chaque minute compte",
        "immediate_actions": ["Appeler le 15 immédiatement", "Effectuer le test FAST"],
        "when_to_seek_help": "Immédiatement"
    },
    "hémorragie": {
        "urgency_level": "high",
        "emergency_type": "bleeding",
        "patient_warning": "Les saignements peuvent devenir dangereux",
        "immediate_actions": ["Arrêter le saignement", "Appeler le 15 pour saignement sévère"],
        "when_to_seek_help": "Selon la gravité, immédiatement à quelques heures"
    }
}