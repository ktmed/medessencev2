"""
German Medical Report Templates
Based on standard German radiology report structures
"""

from typing import Dict, Any

# Standard German Report Template
GERMAN_REPORT_TEMPLATE = {
    "header": """
<div class="report-header">
    <div class="clinic-logo">
        <h1>{{ clinic_name | default("Radiologische Allianz") }}</h1>
        <p>{{ clinic_address | default("Zentrum für medizinische Bildgebung") }}</p>
        <p>{{ clinic_contact | default("Tel: +49 (0)xxx xxx xxxx | Fax: +49 (0)xxx xxx xxxx") }}</p>
    </div>
    <div class="report-info">
        <h2>RADIOLOGISCHER BEFUNDBERICHT</h2>
        <table class="report-details">
            <tr>
                <td><strong>Patient:</strong></td>
                <td>{{ patient_name | default("Anonymisiert") }}</td>
            </tr>
            <tr>
                <td><strong>Geburtsdatum:</strong></td>
                <td>{{ patient_dob | default("xx.xx.xxxx") }}</td>
            </tr>
            <tr>
                <td><strong>Untersuchungsdatum:</strong></td>
                <td>{{ examination_date | strftime("%d.%m.%Y") }}</td>
            </tr>
            <tr>
                <td><strong>Untersuchungsart:</strong></td>
                <td>{{ examination_type }}</td>
            </tr>
            <tr>
                <td><strong>Befund-Nr.:</strong></td>
                <td>{{ report_id }}</td>
            </tr>
        </table>
    </div>
</div>
""",
    
    "clinical_indication": """
<div class="section clinical-indication">
    <h3>KLINISCHE FRAGESTELLUNG / INDIKATION:</h3>
    <p>{{ clinical_indication }}</p>
</div>
""",
    
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        {% for param_key, param_value in technical_parameters.items() %}
        <li><strong>{{ param_key }}:</strong> {{ param_value }}</li>
        {% endfor %}
    </ul>
</div>
""",
    
    "findings": """
<div class="section findings">
    <h3>BEFUND:</h3>
    <div class="findings-content">
        {{ findings }}
    </div>
</div>
""",
    
    "assessment": """
<div class="section assessment">
    <h3>BEURTEILUNG:</h3>
    <div class="assessment-content">
        {{ assessment }}
    </div>
    {% if icd_codes %}
    <div class="icd-codes">
        <h4>ICD-10 Codes:</h4>
        <ul>
        {% for code in icd_codes %}
            <li>{{ code.code }} - {{ code.description }}</li>
        {% endfor %}
        </ul>
    </div>
    {% endif %}
</div>
""",
    
    "recommendations": """
{% if recommendations %}
<div class="section recommendations">
    <h3>EMPFEHLUNGEN:</h3>
    <div class="recommendations-content">
        {{ recommendations }}
    </div>
</div>
{% endif %}
""",
    
    "signatures": """
<div class="section signatures">
    <div class="signature-block">
        <div class="dictating-physician">
            <p><strong>Diktiert:</strong></p>
            <p>{{ dictating_physician_name }}</p>
            <p>{{ dictated_at | strftime("%d.%m.%Y %H:%M") if dictated_at }}</p>
            {% if dictation_signature %}
            <div class="signature">{{ dictation_signature }}</div>
            {% endif %}
        </div>
        
        {% if reviewing_physician_name %}
        <div class="reviewing-physician">
            <p><strong>Befundet:</strong></p>
            <p>{{ reviewing_physician_name }}</p>
            <p>{{ reviewed_at | strftime("%d.%m.%Y %H:%M") if reviewed_at }}</p>
            {% if review_signature %}
            <div class="signature">{{ review_signature }}</div>
            {% endif %}
        </div>
        {% endif %}
    </div>
</div>
""",
    
    "footer": """
<div class="report-footer">
    <hr>
    <p class="footer-text">
        Dieser Befund wurde elektronisch erstellt und ist ohne Unterschrift gültig.
        <br>
        Erstellt am: {{ created_at | strftime("%d.%m.%Y %H:%M") }}
        <br>
        Version: {{ version }}
    </p>
</div>
"""
}

# MRI-specific template
MRI_TEMPLATE = {
    **GERMAN_REPORT_TEMPLATE,
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        <li><strong>Gerät:</strong> {{ device_name | default("1,5 Tesla MRT") }}</li>
        <li><strong>Sequenzen:</strong> {{ sequences | default("T1, T2, FLAIR, DWI") }}</li>
        <li><strong>Schichtdicke:</strong> {{ slice_thickness | default("5mm") }}</li>
        <li><strong>Kontrastmittel:</strong> {{ contrast_agent | default("Nein") }}</li>
        {% if contrast_agent != "Nein" %}
        <li><strong>KM-Dosis:</strong> {{ contrast_dose }}</li>
        {% endif %}
        <li><strong>Untersuchungsregion:</strong> {{ examination_region }}</li>
    </ul>
</div>
"""
}

# CT-specific template
CT_TEMPLATE = {
    **GERMAN_REPORT_TEMPLATE,
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        <li><strong>Gerät:</strong> {{ device_name | default("Mehrzeilen-CT") }}</li>
        <li><strong>Schichtdicke:</strong> {{ slice_thickness | default("1-5mm") }}</li>
        <li><strong>kV/mAs:</strong> {{ kvp | default("120") }}kV / {{ mas | default("Auto") }}mAs</li>
        <li><strong>Kontrastmittel:</strong> {{ contrast_agent | default("Nein") }}</li>
        {% if contrast_agent != "Nein" %}
        <li><strong>KM-Art:</strong> {{ contrast_type | default("Iodhaltiges KM i.v.") }}</li>
        <li><strong>KM-Menge:</strong> {{ contrast_volume | default("100ml") }}</li>
        {% endif %}
        <li><strong>Untersuchungsregion:</strong> {{ examination_region }}</li>
        <li><strong>DLP:</strong> {{ dlp }}mGy*cm (wenn verfügbar)</li>
    </ul>
</div>
"""
}

# X-Ray template
XRAY_TEMPLATE = {
    **GERMAN_REPORT_TEMPLATE,
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        <li><strong>Aufnahmetechnik:</strong> {{ technique | default("Digitale Radiographie") }}</li>
        <li><strong>Strahlengang:</strong> {{ projection | default("a.p. und seitlich") }}</li>
        <li><strong>kV/mAs:</strong> {{ kvp }}kV / {{ mas }}mAs</li>
        <li><strong>Untersuchungsregion:</strong> {{ examination_region }}</li>
        <li><strong>Besonderheiten:</strong> {{ special_notes | default("Keine") }}</li>
    </ul>
</div>
"""
}

# Ultrasound template
ULTRASOUND_TEMPLATE = {
    **GERMAN_REPORT_TEMPLATE,
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        <li><strong>Gerät:</strong> {{ device_name | default("Ultraschallgerät") }}</li>
        <li><strong>Schallkopf:</strong> {{ transducer | default("Konvexschallkopf 2-5 MHz") }}</li>
        <li><strong>Untersuchungsregion:</strong> {{ examination_region }}</li>
        <li><strong>Kontrastmittel:</strong> {{ contrast_agent | default("Nein") }}</li>
        <li><strong>Doppler:</strong> {{ doppler_used | default("Nein") }}</li>
        <li><strong>Besonderheiten:</strong> {{ special_notes | default("Keine") }}</li>
    </ul>
</div>
"""
}

# Mammography template
MAMMOGRAPHY_TEMPLATE = {
    **GERMAN_REPORT_TEMPLATE,
    "technical_parameters": """
<div class="section technical-parameters">
    <h3>TECHNISCHE DURCHFÜHRUNG:</h3>
    <ul>
        <li><strong>Gerät:</strong> {{ device_name | default("Digitale Mammographie") }}</li>
        <li><strong>Aufnahmen:</strong> {{ projections | default("CC und MLO beidseits") }}</li>
        <li><strong>Kompression:</strong> {{ compression_force }}N (wenn verfügbar)</li>
        <li><strong>Brustdrüsentyp:</strong> {{ breast_density | default("ACR Typ") }}</li>
        <li><strong>Voraufnahmen:</strong> {{ previous_exams | default("Nicht verfügbar") }}</li>
    </ul>
</div>
""",
    "assessment": """
<div class="section assessment">
    <h3>BEURTEILUNG:</h3>
    <div class="assessment-content">
        {{ assessment }}
    </div>
    {% if birads_category %}
    <div class="birads">
        <h4>BI-RADS Kategorie:</h4>
        <p><strong>{{ birads_category }}</strong> - {{ birads_description }}</p>
    </div>
    {% endif %}
    {% if icd_codes %}
    <div class="icd-codes">
        <h4>ICD-10 Codes:</h4>
        <ul>
        {% for code in icd_codes %}
            <li>{{ code.code }} - {{ code.description }}</li>
        {% endfor %}
        </ul>
    </div>
    {% endif %}
</div>
"""
}

# Template mapping
TEMPLATES = {
    "MRI": MRI_TEMPLATE,
    "CT": CT_TEMPLATE,
    "X-Ray": XRAY_TEMPLATE,
    "Ultrasound": ULTRASOUND_TEMPLATE,
    "Mammography": MAMMOGRAPHY_TEMPLATE,
    "Standard": GERMAN_REPORT_TEMPLATE
}

# CSS styles for report formatting
REPORT_CSS = """
<style>
.report-container {
    font-family: 'Arial', sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.6;
    color: #333;
}

.report-header {
    border-bottom: 2px solid #0066cc;
    padding-bottom: 20px;
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.clinic-logo h1 {
    color: #0066cc;
    margin: 0;
    font-size: 24px;
}

.clinic-logo p {
    margin: 5px 0;
    color: #666;
    font-size: 14px;
}

.report-info h2 {
    color: #0066cc;
    margin: 0 0 15px 0;
    font-size: 20px;
}

.report-details {
    border-collapse: collapse;
    width: 100%;
}

.report-details td {
    padding: 5px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
}

.section {
    margin-bottom: 25px;
}

.section h3 {
    color: #0066cc;
    border-bottom: 1px solid #0066cc;
    padding-bottom: 5px;
    margin-bottom: 15px;
    font-size: 16px;
}

.section h4 {
    color: #333;
    margin: 15px 0 10px 0;
    font-size: 14px;
}

.findings-content, .assessment-content, .recommendations-content {
    background-color: #f9f9f9;
    padding: 15px;
    border-left: 4px solid #0066cc;
    margin: 10px 0;
}

.technical-parameters ul {
    list-style: none;
    padding: 0;
}

.technical-parameters li {
    padding: 5px 0;
    border-bottom: 1px solid #eee;
}

.icd-codes {
    background-color: #fff5f5;
    border: 1px solid #ffcccc;
    padding: 10px;
    margin: 15px 0;
    border-radius: 4px;
}

.icd-codes ul {
    margin: 10px 0 0 0;
    padding-left: 20px;
}

.signature-block {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #ccc;
}

.dictating-physician, .reviewing-physician {
    width: 45%;
}

.signature {
    height: 50px;
    border-bottom: 1px solid #333;
    margin-top: 20px;
    font-style: italic;
    color: #666;
}

.report-footer {
    margin-top: 30px;
    text-align: center;
}

.footer-text {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
}

.birads {
    background-color: #f0f8ff;
    border: 1px solid #0066cc;
    padding: 15px;
    margin: 15px 0;
    border-radius: 4px;
}

.birads p {
    margin: 0;
    font-size: 16px;
}

@media print {
    .report-container {
        margin: 0;
        padding: 0;
    }
    
    .section {
        page-break-inside: avoid;
    }
    
    .report-header {
        page-break-after: avoid;
    }
}
</style>
"""

# Medical terminology for German reports
GERMAN_MEDICAL_TERMS = {
    "anatomy": {
        "Schädel": "skull",
        "Gehirn": "brain",
        "Wirbelsäule": "spine",
        "Thorax": "chest",
        "Abdomen": "abdomen",
        "Becken": "pelvis",
        "Extremitäten": "extremities"
    },
    "findings": {
        "unauffällig": "unremarkable",
        "pathologisch": "pathological",
        "Raumforderung": "space-occupying lesion",
        "Verkalkung": "calcification",
        "Ödem": "edema",
        "Einblutung": "hemorrhage",
        "Nekrose": "necrosis"
    },
    "measurements": {
        "mm": "millimeter",
        "cm": "centimeter", 
        "ml": "milliliter",
        "HU": "Hounsfield units"
    }
}