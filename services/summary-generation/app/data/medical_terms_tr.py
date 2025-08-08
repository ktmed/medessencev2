"""Turkish medical terminology dictionary."""

TURKISH_MEDICAL_TERMS = {
    # Radiology Terms
    "Röntgen": {
        "simple": "Röntgen",
        "basic": "Röntgen ışınları kullanılarak vücudunuzun içinin görüntüsü",
        "intermediate": "Röntgen görüntüleme, kemikleri ve organları göstermek için elektromanyetik radyasyon kullanır",
        "advanced": "Anatomik yapıların görselleştirilmesi için elektromanyetik radyasyon kullanan radyografik görüntüleme",
        "category": "imaging"
    },
    "BT": {
        "simple": "BT",
        "basic": "Vücudunuzun kesit görüntülerini alan özel bir röntgen yöntemi",
        "intermediate": "Bilgisayarlı tomografi, dönen röntgen ekipmanı kullanarak detaylı kesit görüntüleri oluşturur",
        "advanced": "Yüksek çözünürlüklü görüntüleme için bilgisayar destekli rekonstrüksyonlu aksiyel tomografi",
        "category": "imaging"
    },
    "MR": {
        "simple": "MR",
        "basic": "Manyetik alanlar kullanarak vücudunuzun detaylı görüntülerini oluşturan tarama",
        "intermediate": "Manyetik rezonans görüntüleme, yumuşak dokuları görüntülemek için güçlü manyetik alanlar ve radyo dalgaları kullanır",
        "advanced": "Manyetik alanlarda hidrojen atomlarının davranışına dayalı nükleer manyetik rezonans görüntüleme",
        "category": "imaging"
    },
    "Ultrason": {
        "simple": "Ultrason",
        "basic": "Organlarınızın görüntülerini oluşturmak için ses dalgaları kullanan muayene",
        "intermediate": "Sonografi, organ ve dokuları görselleştirmek için yüksek frekanslı ses dalgaları kullanır",
        "advanced": "Non-invaziv doku görselleştirmesi için ultrasonik dalgalar kullanan ekolokasyon görüntüleme",
        "category": "imaging"
    },
    
    # Anatomical Terms
    "Toraks": {
        "simple": "Göğüs",
        "basic": "Kalp ve akciğerlerinizin bulunduğu vücudunuzun üst kısmı",
        "intermediate": "Kalp, akciğerler ve diğer hayati organları içeren göğüs boşluğu",
        "advanced": "Boyun ve diyafram arasında kardiyopulmoner yapıları içeren torasik kavite",
        "category": "anatomy"
    },
    "Karın": {
        "simple": "Karın",
        "basic": "Sindirim organlarının bulunduğu karın bölgeniz",
        "intermediate": "Sindirim organları, böbrekler ve diğer yapıları içeren karın boşluğu",
        "advanced": "Gastrointestinal, hepatobiliyer ve ürogenital organ sistemleri ile karın bölgesi",
        "category": "anatomy"
    },
    "Omurga": {
        "simple": "Omurga",
        "basic": "Omurilik sinirinizi koruyan sırtınızdaki kemikler",
        "intermediate": "Sakrum ve koksiks ile birlikte 24 hareketli omurdan oluşan omurga",
        "advanced": "Servikal, torasik, lumber, sakral ve koksigeal bölgelerden oluşan vertebral kolon",
        "category": "anatomy"
    },
    
    # Pathological Terms
    "Lezyon": {
        "simple": "Anormallik",
        "basic": "Vücudunuzda normalden farklı görünen bir bölge",
        "intermediate": "Normal görünümden sapan doku veya organ yapısında anormal değişiklik",
        "advanced": "Normal durumdan yapısal veya fonksiyonel sapma gösteren patolojik doku değişikliği",
        "category": "pathology"
    },
    "Tümör": {
        "simple": "Şişlik",
        "basic": "Alışılmadık şekilde çoğalmış hücre topluluğu",
        "intermediate": "Kontrolsüz hücre çoğalması nedeniyle anormal doku büyümesi, iyi huylu veya kötü huylu olabilir",
        "advanced": "Histoloji ve malignite derecesine göre sınıflandırılan otonom, progresif büyüme gösteren neoplazm",
        "category": "pathology"
    },
    "İltihap": {
        "simple": "İltihap",
        "basic": "Vücudunuzun yaralanma veya enfeksiyona verdiği tepki",
        "intermediate": "Zararlı uyaranlara karşı kızarıklık, şişlik, ısı ve ağrı ile karakterize vücut tepkisi",
        "advanced": "Doku onarımı için vasküler ve hücresel bileşenleri olan inflamatuar yanıt",
        "category": "pathology"
    },
    
    # Organ Systems
    "Kalp-damar sistemi": {
        "simple": "Kalp ve damarlar",
        "basic": "Kalp ve vücudunuz boyunca kan pompalayan tüm kan damarları",
        "intermediate": "Kan taşınması için kalp, arterler, venler ve kılcal damarlardan oluşan sistem",
        "advanced": "Dolaşım için pompa organı olarak kalp ve vasküler sistem ile kardiyovasküler sistem",
        "category": "systems"
    },
    "Solunum sistemi": {
        "simple": "Akciğerler ve solunum yolları",
        "basic": "Vücudunuza oksijen getiren akciğerler ve tüm solunum yolları",
        "intermediate": "Gaz değişimi için akciğerler, bronşlar ve solunum yolları ile solunum sistemi",
        "advanced": "Alveol ve kan arasında ventilasyon ve gaz değişimi için pulmoner sistem",
        "category": "systems"
    },
    
    # Diagnostic Terms
    "Tanı": {
        "simple": "Bulgu",
        "basic": "Doktorun muayenenizde keşfettiği şey",
        "intermediate": "Semptom ve testlere dayalı hastalığın tıbbi belirlenmesi",
        "advanced": "Tanısal süreç sonrası hastalık tipi ve evresi hakkında klinik sonuç",
        "category": "diagnosis"
    },
    "Prognoz": {
        "simple": "Seyir",
        "basic": "Sağlık durumunuzun nasıl gelişeceği tahmin",
        "intermediate": "Beklenen hastalık seyri ve iyileşme olasılıkları hakkında öngörü",
        "advanced": "Hastalık ilerlemesi, tedavi yanıtı ve uzun vadeli sonuç ile ilgili tıbbi projeksiyon",
        "category": "diagnosis"
    },
    
    # Treatment Terms
    "Terapi": {
        "simple": "Tedavi",
        "basic": "İyileşmeniz için aldığınız tedavi",
        "intermediate": "Hastalığı iyileştirmek veya hafifletmek için tıbbi önlemler",
        "advanced": "Sağlığı restore etmek veya korumak için terapötik müdahale",
        "category": "treatment"
    },
    "Ameliyat": {
        "simple": "Ameliyat",
        "basic": "Cerrahın sizi tedavi ettiği cerrahi işlem",
        "intermediate": "Hastalık veya yaralanmaları tedavi etmek için cerrahi müdahale",
        "advanced": "Anatomik yapıların operatif tedavisi ile invaziv cerrahi müdahale",
        "category": "treatment"
    }
}

TURKISH_ABBREVIATIONS = {
    "BT": {
        "full_form": "Bilgisayarlı Tomografi",
        "explanation": "Kesit görüntüleri için özel röntgen prosedürü",
        "specialty": "radiology"
    },
    "MR": {
        "full_form": "Manyetik Rezonans",
        "explanation": "Manyetik alanlarla görüntüleme",
        "specialty": "radiology"
    },
    "EKG": {
        "full_form": "Elektrokardiyogram",
        "explanation": "Kalp elektriksel aktivitesinin kaydı",
        "specialty": "cardiology"
    },
    "EEG": {
        "full_form": "Elektroensefalogram",
        "explanation": "Beyin elektriksel aktivitesinin ölçümü",
        "specialty": "neurology"
    },
    "US": {
        "full_form": "Ultrason",
        "explanation": "Ses dalgalarıyla muayene",
        "specialty": "radiology"
    },
    "ACİL": {
        "full_form": "Acil Servis",
        "explanation": "Acil bakım için hastane bölümü",
        "specialty": "emergency"
    },
    "YBÜ": {
        "full_form": "Yoğun Bakım Ünitesi",
        "explanation": "Kritik hastalar için hastane ünitesi",
        "specialty": "critical_care"
    }
}

TURKISH_EMERGENCY_KEYWORDS = {
    "acil": {
        "urgency_level": "critical",
        "emergency_type": "general",
        "patient_warning": "Bu durum acil tıbbi müdahale gerektirir",
        "immediate_actions": ["Acil servisi arayın (112)", "Yalnız bırakmayın"],
        "when_to_seek_help": "Hemen"
    },
    "akut": {
        "urgency_level": "high",
        "emergency_type": "acute_condition",
        "patient_warning": "Bu hızlı tedavi gerektiren akut bir durumdur",
        "immediate_actions": ["Doktora başvurun", "Hastaneye gidin"],
        "when_to_seek_help": "Birkaç saat içinde"
    },
    "kalp krizi": {
        "urgency_level": "critical",
        "emergency_type": "cardiac",
        "patient_warning": "Kalp krizi şüphesi - yaşamı tehdit eden durum",
        "immediate_actions": ["Hemen 112'yi arayın", "Mümkünse aspirin verin", "Sakin kalın"],
        "when_to_seek_help": "Hemen"
    },
    "felç": {
        "urgency_level": "critical",
        "emergency_type": "neurological",
        "patient_warning": "Felç şüphesi - her dakika önemli",
        "immediate_actions": ["Hemen 112'yi arayın", "FAST testini uygulayın"],
        "when_to_seek_help": "Hemen"
    },
    "kanama": {
        "urgency_level": "high",
        "emergency_type": "bleeding",
        "patient_warning": "Kanamalar tehlikeli hale gelebilir",
        "immediate_actions": ["Kanamayı durdurun", "Şiddetli kanama için 112'yi arayın"],
        "when_to_seek_help": "Ciddiyete göre hemen veya birkaç saat içinde"
    }
}