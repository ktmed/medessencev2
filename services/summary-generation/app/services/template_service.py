"""Template service for managing patient communication templates."""

import logging
from typing import Dict, Optional, Any
from jinja2 import Template, Environment, BaseLoader

from app.data.cultural_adaptations import get_cultural_adaptation
from app.core.exceptions import TemplateRenderingException

logger = logging.getLogger(__name__)


class TemplateService:
    """Service for managing and rendering patient communication templates."""
    
    def __init__(self):
        """Initialize the template service."""
        self.jinja_env = Environment(loader=BaseLoader())
        self.disclaimer_templates = self._load_disclaimer_templates()
        self.greeting_templates = self._load_greeting_templates()
        self.emergency_templates = self._load_emergency_templates()
    
    async def get_medical_disclaimer(
        self,
        language: str,
        cultural_adaptation: Dict[str, Any]
    ) -> str:
        """Get appropriate medical disclaimer for language and culture."""
        try:
            disclaimer_template = self.disclaimer_templates.get(
                language,
                self.disclaimer_templates["en"]  # Default to English
            )
            
            disclaimer_style = cultural_adaptation.get("disclaimer_style", "comprehensive_legal")
            
            # Select appropriate disclaimer based on style
            disclaimer_text = disclaimer_template.get(
                disclaimer_style,
                disclaimer_template["comprehensive_legal"]  # Default style
            )
            
            # Render template with cultural context
            template = Template(disclaimer_text)
            rendered_disclaimer = template.render(
                healthcare_system=cultural_adaptation.get("healthcare_system_info", {}),
                communication_style=cultural_adaptation.get("communication_style", {})
            )
            
            logger.info(f"Generated medical disclaimer for language: {language}, style: {disclaimer_style}")
            return rendered_disclaimer
            
        except Exception as e:
            logger.error(f"Error generating medical disclaimer: {e}")
            raise TemplateRenderingException(f"Failed to generate medical disclaimer: {str(e)}")
    
    async def get_greeting(
        self,
        language: str,
        cultural_adaptation: Dict[str, Any],
        patient_name: Optional[str] = None
    ) -> str:
        """Get culturally appropriate greeting."""
        try:
            greeting_template = self.greeting_templates.get(
                language,
                self.greeting_templates["en"]
            )
            
            communication_style = cultural_adaptation.get("communication_style", {})
            formality = communication_style.get("formality", "formal")
            
            greeting_text = greeting_template.get(formality, greeting_template["formal"])
            
            template = Template(greeting_text)
            rendered_greeting = template.render(
                patient_name=patient_name or "",
                formality=formality
            )
            
            return rendered_greeting
            
        except Exception as e:
            logger.error(f"Error generating greeting: {e}")
            raise TemplateRenderingException(f"Failed to generate greeting: {str(e)}")
    
    async def format_emergency_warning(
        self,
        emergency_type: str,
        urgency_level: str,
        language: str,
        cultural_adaptation: Dict[str, Any]
    ) -> str:
        """Format emergency warning message."""
        try:
            emergency_template = self.emergency_templates.get(
                language,
                self.emergency_templates["en"]
            )
            
            warning_template = emergency_template.get(
                urgency_level,
                emergency_template["high"]
            )
            
            healthcare_info = cultural_adaptation.get("healthcare_system_info", {})
            emergency_number = healthcare_info.get("emergency_number", "112")
            
            template = Template(warning_template)
            rendered_warning = template.render(
                emergency_type=emergency_type,
                emergency_number=emergency_number,
                healthcare_system=healthcare_info
            )
            
            return rendered_warning
            
        except Exception as e:
            logger.error(f"Error formatting emergency warning: {e}")
            raise TemplateRenderingException(f"Failed to format emergency warning: {str(e)}")
    
    def _load_disclaimer_templates(self) -> Dict[str, Dict[str, str]]:
        """Load medical disclaimer templates for all languages."""
        return {
            "de": {
                "comprehensive_legal": """
**Medizinischer Haftungsausschluss**

Diese Zusammenfassung dient nur zu Informationszwecken und ersetzt nicht die professionelle medizinische Beratung, Diagnose oder Behandlung. Wenden Sie sich bei Fragen zu Ihrem Gesundheitszustand immer an Ihren Arzt oder andere qualifizierte Gesundheitsdienstleister.

Suchen Sie bei medizinischen Notfällen sofort ärztliche Hilfe auf. Die Informationen in dieser Zusammenfassung wurden sorgfältig erstellt, jedoch können Fehler oder Unvollständigkeiten nicht ausgeschlossen werden.

{% if healthcare_system.insurance_system %}Informationen zur Kostenübernahme erhalten Sie bei Ihrer Krankenversicherung.{% endif %}
                """,
                "formal_comprehensive": """
**Wichtiger Hinweis**

Diese patientenfreundliche Zusammenfassung wurde computergestützt erstellt und dient ausschließlich Ihrer Information. Sie ersetzt nicht das persönliche Gespräch mit Ihrem behandelnden Arzt.

Bei Rückfragen oder Unklarheiten wenden Sie sich bitte an Ihre Ärztin oder Ihren Arzt. Bei akuten Beschwerden zögern Sie nicht, umgehend medizinische Hilfe in Anspruch zu nehmen.
                """,
                "warm_comprehensive": """
**Wichtige Information für Sie**

Diese Zusammenfassung soll Ihnen helfen, Ihren Befund besser zu verstehen. Sie wurde sorgfältig erstellt, kann aber das Gespräch mit Ihrem Arzt nicht ersetzen.

Bitte sprechen Sie bei Fragen oder Sorgen mit Ihrem behandelnden Arzt. Bei dringenden gesundheitlichen Problemen suchen Sie sofort ärztliche Hilfe auf.
                """
            },
            "en": {
                "comprehensive_legal": """
**Medical Disclaimer**

This summary is for informational purposes only and does not replace professional medical advice, diagnosis, or treatment. Always consult your physician or other qualified healthcare providers with questions about your health condition.

In case of medical emergencies, seek immediate medical help. The information in this summary has been carefully prepared, but errors or omissions cannot be excluded.

{% if healthcare_system.insurance_system %}For information about coverage, contact your health insurance provider.{% endif %}
                """,
                "liability_focused": """
**Important Medical Notice**

This AI-generated summary is not a substitute for professional medical judgment. Your healthcare provider remains responsible for all medical decisions. This information should not be used for self-diagnosis or treatment decisions.

If you have concerns about your health, contact your healthcare provider immediately. In emergencies, call 911 or go to your nearest emergency room.
                """,
                "polite_comprehensive": """
**Important Information**

This summary has been prepared to help you understand your medical report. Please note that it cannot replace a consultation with your doctor.

Should you have any questions or concerns, please do not hesitate to contact your healthcare provider. For urgent matters, please seek immediate medical attention.
                """
            },
            "fr": {
                "formal_legal": """
**Avertissement Médical**

Ce résumé est fourni à titre informatif uniquement et ne remplace pas les conseils, diagnostics ou traitements médicaux professionnels. Consultez toujours votre médecin ou d'autres professionnels de santé qualifiés pour toute question concernant votre état de santé.

En cas d'urgence médicale, demandez immédiatement une aide médicale. Les informations de ce résumé ont été soigneusement préparées, mais des erreurs ou omissions ne peuvent être exclues.
                """,
                "warm_comprehensive": """
**Information Importante**

Ce résumé a été préparé pour vous aider à mieux comprendre votre rapport médical. Il ne peut cependant pas remplacer une consultation avec votre médecin.

N'hésitez pas à contacter votre médecin pour toute question ou préoccupation. En cas de problème urgent, consultez immédiatement un professionnel de santé.
                """
            },
            "tr": {
                "religious_medical": """
**Önemli Tıbbi Bilgilendirme**

Bu özet yalnızca bilgilendirme amaçlıdır ve profesyonel tıbbi tavsiye, teşhis veya tedavinin yerini alamaz. Sağlık durumunuzla ilgili sorularınız için mutlaka doktorunuza veya diğer nitelikli sağlık uzmanlarına başvurun.

Allah şifalar versin. Acil durumlarda derhal tıbbi yardım alın. Sağlığınız bizim için çok değerlidir.
                """,
                "respectful_family_oriented": """
**Saygıdeğer Hastamız ve Aileniz için Önemli Bilgi**

Bu özet, raporunuzu daha iyi anlamanız için hazırlanmıştır. Ancak doktorunuzla yapacağınız görüşmenin yerini alamaz.

Sorularınız veya endişeleriniz için lütfen doktorunuzla iletişime geçin. Acil durumda tereddüt etmeden tıbbi yardım alın.
                """
            },
            "es": {
                "warm_comprehensive": """
**Información Importante**

Este resumen ha sido preparado para ayudarle a entender mejor su informe médico. Sin embargo, no puede reemplazar una consulta con su médico.

Por favor, contacte a su médico si tiene preguntas o preocupaciones. En caso de urgencia, busque atención médica inmediata.
                """
            },
            "it": {
                "warm_comprehensive": """
**Informazione Importante**

Questo riassunto è stato preparato per aiutarla a comprendere meglio il suo referto medico. Tuttavia, non può sostituire una consultazione con il suo medico.

La preghiamo di contattare il suo medico per qualsiasi domanda o preoccupazione. In caso di urgenza, cerchi immediatamente assistenza medica.
                """
            }
        }
    
    def _load_greeting_templates(self) -> Dict[str, Dict[str, str]]:
        """Load greeting templates for different formality levels."""
        return {
            "de": {
                "very_formal": "Sehr geehrte{% if patient_name %} {{ patient_name }}{% else %} Patientin, sehr geehrter Patient{% endif %},",
                "formal": "Liebe{% if patient_name %} {{ patient_name }}{% else %} Patientin, lieber Patient{% endif %},",
                "warm_formal": "Geschätzte{% if patient_name %} {{ patient_name }}{% else %} Patientin, geschätzter Patient{% endif %},",
                "informal_friendly": "Hallo{% if patient_name %} {{ patient_name }}{% endif %},"
            },
            "en": {
                "formal": "Dear{% if patient_name %} {{ patient_name }}{% else %} Patient{% endif %},",
                "informal_friendly": "Hello{% if patient_name %} {{ patient_name }}{% endif %},",
                "polite_reserved": "Dear{% if patient_name %} {{ patient_name }}{% else %} Patient{% endif %},"
            },
            "fr": {
                "formal": "Chère{% if patient_name %} {{ patient_name }}{% else %} Patiente, Cher Patient{% endif %},",
                "warm_formal": "Chère{% if patient_name %} {{ patient_name }}{% else %} Patiente, Cher Patient{% endif %},"
            },
            "tr": {
                "respectful": "Değerli{% if patient_name %} {{ patient_name }}{% else %} Hastamız{% endif %},",
                "respectful_warm": "Sayın{% if patient_name %} {{ patient_name }}{% else %} Hastamız{% endif %},"
            },
            "es": {
                "warm_formal": "Estimado/a{% if patient_name %} {{ patient_name }}{% else %} Paciente{% endif %},",
                "respectful_warm": "Querido/a{% if patient_name %} {{ patient_name }}{% else %} Paciente{% endif %},"
            },
            "it": {
                "warm_formal": "Gentile{% if patient_name %} {{ patient_name }}{% else %} Paziente{% endif %},",
                "warm_expressive": "Caro/a{% if patient_name %} {{ patient_name }}{% else %} Paziente{% endif %},"
            }
        }
    
    def _load_emergency_templates(self) -> Dict[str, Dict[str, str]]:
        """Load emergency warning templates."""
        return {
            "de": {
                "critical": """
🚨 **NOTFALL** 🚨

Diese Befunde deuten auf einen medizinischen Notfall hin. Rufen Sie sofort den Notarzt ({{ emergency_number }}) oder begeben Sie sich unverzüglich in die Notaufnahme!

**Zögern Sie nicht - jede Minute kann wichtig sein!**
                """,
                "high": """
⚠️ **DRINGEND**

Diese Befunde erfordern eine zeitnahe ärztliche Behandlung. Kontaktieren Sie innerhalb der nächsten Stunden Ihren Arzt oder begeben Sie sich ins Krankenhaus.
                """,
                "medium": """
ℹ️ **WICHTIG**

Diese Befunde sollten zeitnah mit Ihrem Arzt besprochen werden. Vereinbaren Sie in den nächsten Tagen einen Termin.
                """
            },
            "en": {
                "critical": """
🚨 **EMERGENCY** 🚨

These findings indicate a medical emergency. Call emergency services ({{ emergency_number }}) immediately or go to the emergency room right away!

**Do not delay - every minute may be critical!**
                """,
                "high": """
⚠️ **URGENT**

These findings require prompt medical attention. Contact your doctor within the next few hours or go to the hospital.
                """,
                "medium": """
ℹ️ **IMPORTANT**

These findings should be discussed with your doctor soon. Schedule an appointment within the next few days.
                """
            },
            "fr": {
                "critical": """
🚨 **URGENCE** 🚨

Ces résultats indiquent une urgence médicale. Appelez les services d'urgence ({{ emergency_number }}) immédiatement ou rendez-vous aux urgences!

**N'attendez pas - chaque minute peut être critique!**
                """,
                "high": """
⚠️ **URGENT**

Ces résultats nécessitent une attention médicale rapide. Contactez votre médecin dans les prochaines heures ou rendez-vous à l'hôpital.
                """
            },
            "tr": {
                "critical": """
🚨 **ACİL DURUM** 🚨

Bu bulgular tıbbi acil durum olduğunu gösteriyor. Hemen acil servisi ({{ emergency_number }}) arayın veya acile gidin!

**Gecikmeyin - her dakika önemli olabilir!**
                """,
                "high": """
⚠️ **ACİL**

Bu bulgular hızlı tıbbi müdahale gerektiriyor. Önümüzdeki birkaç saat içinde doktorunuza başvurun veya hastaneye gidin.
                """
            },
            "es": {
                "critical": """
🚨 **EMERGENCIA** 🚨

Estos hallazgos indican una emergencia médica. ¡Llame a los servicios de emergencia ({{ emergency_number }}) inmediatamente o vaya a urgencias!

**No demore - cada minuto puede ser crítico!**
                """,
                "high": """
⚠️ **URGENTE**

Estos hallazgos requieren atención médica inmediata. Contacte a su médico en las próximas horas o vaya al hospital.
                """
            },
            "it": {
                "critical": """
🚨 **EMERGENZA** 🚨

Questi risultati indicano un'emergenza medica. Chiami i servizi di emergenza ({{ emergency_number }}) immediatamente o si rechi al pronto soccorso!

**Non ritardi - ogni minuto può essere critico!**
                """,
                "high": """
⚠️ **URGENTE**

Questi risultati richiedono attenzione medica rapida. Contatti il suo medico nelle prossime ore o si rechi in ospedale.
                """
            }
        }