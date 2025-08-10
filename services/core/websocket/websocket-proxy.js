require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const WebMStreamConverter = require('../transcription/webm-stream-converter');
const VADProcessor = require('../transcription/vad-processor');
const { ReportOrchestrator } = require('../llm/report-orchestrator');
const MultiLLMService = require('../llm/multi-llm-service');

const app = express();
const server = createServer(app);

// Initialize Multi-LLM Service
const multiLLMService = new MultiLLMService();

// Initialize Report Orchestrator with LLM service
const reportOrchestrator = new ReportOrchestrator(multiLLMService);

/**
 * Fix source spans by recalculating them against the actual content text
 */
function fixSourceSpans(structuredFindings, contentText) {
  console.log('DEBUG: Fixing source spans for', structuredFindings.length, 'findings');
  
  return structuredFindings.map((finding, index) => {
    const originalSpan = finding.sourceSpan;
    const searchText = finding.text;
    
    // Find the actual position of this text in the content
    const actualStart = contentText.indexOf(searchText);
    
    if (actualStart !== -1) {
      const actualEnd = actualStart + searchText.length;
      const correctedFinding = {
        ...finding,
        sourceSpan: {
          start: actualStart,
          end: actualEnd
        }
      };
      
      console.log(`Finding ${index}: "${searchText.substring(0, 30)}..." corrected from [${originalSpan.start}-${originalSpan.end}] to [${actualStart}-${actualEnd}]`);
      return correctedFinding;
    } else {
      console.log(`Finding ${index}: "${searchText.substring(0, 30)}..." not found in content, keeping original span [${originalSpan.start}-${originalSpan.end}]`);
      return finding;
    }
  });
}

// Socket.IO server for frontend
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3005", "http://localhost:3010", "file://", "*"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Function to check if two transcription texts are duplicates
function isDuplicateTranscription(newText, lastText) {
  if (!newText || !lastText) return false;
  
  // Normalize texts for comparison
  const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalizedNew = normalize(newText);
  const normalizedLast = normalize(lastText);
  
  // Check if texts are identical
  if (normalizedNew === normalizedLast) return true;
  
  // Check if new text is completely contained in last text (repetition)
  if (normalizedLast.includes(normalizedNew) && normalizedNew.length > 50) return true;
  
  // Check if new text contains the entire last text (accumulation bug)
  if (normalizedNew.includes(normalizedLast) && normalizedLast.length > 50) return true;
  
  // Check similarity ratio for very long repetitive texts
  if (normalizedNew.length > 1000 && normalizedLast.length > 1000) {
    const overlap = getTextOverlap(normalizedNew, normalizedLast);
    if (overlap > 0.8) return true; // 80% similarity threshold
  }
  
  return false;
}

// Function to calculate text overlap ratio
function getTextOverlap(text1, text2) {
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Function to generate structured report from transcription
function generateStructuredReport(transcriptionText, language = 'de') {
  // Use a smarter approach to parse different report types
  const report = parseSmartReport(transcriptionText, language);
  
  const sections = {
    title: language === 'de' ? 'Radiologischer Befund' : 'Radiology Report',
    sections: report
  };
  
  return sections;
}

// Smart report parser that adapts to different formats
function parseSmartReport(text, language = 'de') {
  const sections = {};
  
  // Split text into logical sections based on common patterns
  const lines = text.split(/(?:\r?\n|\.(?=\s*[A-Z]))/);
  let currentSection = null;
  let currentContent = [];
  
  // Common section headers in different languages
  const sectionHeaders = {
    de: {
      clinical: ['klinische angaben', 'indikationsstellung', 'klinik', 'anamnese', 'fragestellung'],
      technique: ['technik', 'sequenzen', 'untersuchungstechnik', 'methode'],
      findings: ['befund', 'befunde', 'bildgebung', 'diagnostik'],
      impression: ['beurteilung', 'zusammenfassung', 'diagnose', 'impression'],
      recommendation: ['empfehlung', 'procedere', 'weiteres vorgehen', 'empfehlungen']
    },
    en: {
      clinical: ['clinical', 'indication', 'history', 'reason'],
      technique: ['technique', 'protocol', 'sequences', 'method'],
      findings: ['findings', 'observation', 'description'],
      impression: ['impression', 'conclusion', 'assessment', 'diagnosis'],
      recommendation: ['recommendation', 'follow up', 'suggest', 'advise']
    }
  };
  
  const headers = sectionHeaders[language] || sectionHeaders.de;
  
  // Process each line
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    const lowerLine = trimmedLine.toLowerCase();
    
    // Check if this line is a section header
    let isHeader = false;
    
    for (const [sectionType, keywords] of Object.entries(headers)) {
      if (keywords.some(keyword => lowerLine.includes(keyword) && lowerLine.includes(':'))) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = formatSectionContent(currentContent.join(' '), currentSection);
        }
        
        // Start new section
        currentSection = sectionType;
        currentContent = [];
        
        // Extract content after the colon
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex !== -1 && colonIndex < trimmedLine.length - 1) {
          currentContent.push(trimmedLine.substring(colonIndex + 1).trim());
        }
        
        isHeader = true;
        break;
      }
    }
    
    // If not a header, add to current section
    if (!isHeader && currentSection) {
      currentContent.push(trimmedLine);
    } else if (!isHeader && !currentSection) {
      // Try to detect section by content
      if (lowerLine.includes('mrt') || lowerLine.includes('ct') || lowerLine.includes('röntgen')) {
        currentSection = 'findings';
        currentContent.push(trimmedLine);
      }
    }
  });
  
  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = formatSectionContent(currentContent.join(' '), currentSection);
  }
  
  // Check if this is a mammography report
  const isMammography = text.includes('Mammographie') && text.includes('Hochfrequenzsonographie');
  
  if (isMammography) {
    // For mammography, override any existing findings to extract both sections
    let allFindings = [];
    
    const mammoMatch = text.match(/Mammographie[^:]*:([\s\S]*?)(?:Hochfrequenzsonographie|Beurteilung:|$)/i);
    const sonoMatch = text.match(/Hochfrequenzsonographie[^:]*:([\s\S]*?)(?:Beurteilung:|$)/i);
    
    if (mammoMatch) {
      allFindings.push('**Mammographie:**\n' + mammoMatch[1].trim());
    }
    if (sonoMatch) {
      allFindings.push('**Sonographie:**\n' + sonoMatch[1].trim());
    }
    
    if (allFindings.length > 0) {
      sections.findings = allFindings.join('\n\n');
    }
  } else if (!sections.findings) {
    // Extract findings from the full text if not found
    // Look for various imaging report patterns
    const imagingPatterns = [
      /(?:MRT|CT|Röntgen)[^:]*:([\s\S]*?)(?:Beurteilung:|Empfehlung:|Mit freundlichen|$)/i,
      /Mammographie[^:]*:([\s\S]*?)(?:Hochfrequenzsonographie|Beurteilung:|Empfehlung:|$)/i,
      /Sonographie[^:]*:([\s\S]*?)(?:Beurteilung:|Empfehlung:|$)/i,
      /Hochfrequenzsonographie[^:]*:([\s\S]*?)(?:Beurteilung:|Empfehlung:|$)/i
    ];
    
    // Try other patterns
    for (const pattern of imagingPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.findings = formatStructuredFindings(match[1]);
        break;
      }
    }
  }
  
  // Extract assessment/impression
  if (!sections.impression) {
    const assessmentMatch = text.match(/Beurteilung:([\s\S]*?)(?:Empfehlung:|$)/i);
    if (assessmentMatch) {
      sections.impression = formatAssessment(assessmentMatch[1].trim());
    }
  }
  
  // Extract recommendations
  if (!sections.recommendation) {
    const recMatch = text.match(/Empfehlung:([\s\S]*?)(?:Mit freundlichen|$)/i);
    if (recMatch) {
      sections.recommendation = recMatch[1].trim();
    }
  }
  
  // Special handling for oncology/radiotherapy reports
  if (text.includes('Strahlentherapie') || text.includes('Chemotherapie') || text.includes('Radiotherapie')) {
    // Extract key sections from oncology report
    
    // Extract summary/course
    const summaryMatch = text.match(/Zusammenfassung und Verlauf:([\s\S]*?)(?=Medikation:|Mit freundlichen|$)/i);
    if (summaryMatch) {
      sections.impression = formatAssessment(summaryMatch[1].trim());
    }
    
    // Extract diagnosis and clinical info
    const diagnosisMatch = text.match(/Diagnose:([\s\S]*?)(?=Histologie|Maßnahmen|Begleitdiagnosen)/i);
    if (diagnosisMatch) {
      sections.clinical = diagnosisMatch[1].trim();
    }
    
    // Extract therapy information
    const therapyMatch = text.match(/Aktuelle Therapie:([\s\S]*?)(?=Spezifische|Aufnahme|PET\/CT|$)/i);
    if (therapyMatch) {
      sections.technique = therapyMatch[1].trim();
    }
    
    // Extract imaging findings
    const petMatch = text.match(/PET\/CT[^:]*:([\s\S]*?)(?=Computertomographie|Zusammenfassung|Mit freundlichen|$)/i);
    const ctMatch = text.match(/Computertomographie[^:]*:([\s\S]*?)(?=Zusammenfassung|Mit freundlichen|$)/i);
    
    let findingsText = '';
    if (petMatch) {
      findingsText += 'PET/CT Befunde:\n' + petMatch[1].trim();
    }
    if (ctMatch) {
      if (findingsText) findingsText += '\n\n';
      findingsText += 'CT Befunde:\n' + ctMatch[1].trim();
    }
    
    if (findingsText) {
      sections.findings = formatStructuredFindings(findingsText);
    }
    
    // Extract recommendations
    const medMatch = text.match(/Medikation:([\s\S]*?)(?=Mit freundlichen|$)/i);
    const empMatch = text.match(/Wir empfehlen[,:]([\s\S]*?)(?=\.|Mit der Patientin|$)/i);
    
    let recommendations = [];
    if (empMatch) {
      recommendations.push(empMatch[1].trim());
    }
    if (medMatch) {
      recommendations.push('Medikation: ' + medMatch[1].trim());
    }
    
    if (recommendations.length > 0) {
      sections.recommendation = recommendations.join('\n');
    }
  }
  
  // Map to German section names
  const germanSections = {};
  const sectionMap = {
    clinical: 'Klinische Angaben',
    technique: 'Technische Details',
    findings: 'Befund',
    impression: 'Beurteilung',
    recommendation: 'Empfehlung'
  };
  
  for (const [key, value] of Object.entries(sections)) {
    const germanKey = sectionMap[key] || key;
    germanSections[germanKey] = value;
  }
  
  // Add defaults for missing sections
  if (!germanSections['Befund']) {
    germanSections['Befund'] = text;
  }
  
  return germanSections;
}

// Format section content based on type
function formatSectionContent(content, sectionType) {
  const cleaned = content.trim();
  
  if (sectionType === 'findings') {
    return formatStructuredFindings(cleaned);
  } else if (sectionType === 'impression') {
    return formatAssessment(cleaned);
  }
  
  return cleaned;
}

// Format findings with structure
function formatStructuredFindings(text) {
  // Handle object input - convert to string first
  if (text && typeof text === 'object') {
    // Check if it's a structured findings object with mammography/ultrasound sections
    if (text.mammographyFindings || text.ultrasoundFindings) {
      let formattedText = '';
      
      if (text.mammographyFindings) {
        formattedText += '**Digitale Mammographie:**\n';
        formattedText += text.mammographyFindings.trim() + '\n\n';
      }
      
      if (text.ultrasoundFindings) {
        formattedText += '**Hochfrequenzsonographie:**\n';
        formattedText += text.ultrasoundFindings.trim();
      }
      
      return formattedText.trim();
    }
    
    // Handle new enhanced findings structure
    if (text.content && text.structuredFindings) {
      // This is the new enhanced structure
      return text.content; // For now, just return the content - frontend will handle structuredFindings
    }
    
    // If it's an object with other properties, try to extract meaningful content
    if (text.content) {
      text = text.content;
    } else if (text.text) {
      text = text.text;
    } else if (text.value) {
      text = text.value;
    } else if (text.findings) {
      text = text.findings;
    } else {
      // Try to format the object as structured findings
      try {
        const keys = Object.keys(text);
        if (keys.length > 0) {
          let formattedText = '';
          for (const key of keys) {
            if (text[key] && typeof text[key] === 'string') {
              // Format the key nicely
              const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
              formattedText += `**${formattedKey}:**\n${text[key]}\n\n`;
            }
          }
          if (formattedText) {
            return formattedText.trim();
          }
        }
        
        // Last resort - stringify but make it more readable
        console.log('DEBUG: Formatting object as findings:', JSON.stringify(text, null, 2));
        const stringified = JSON.stringify(text, null, 2);
        if (stringified && stringified !== '{}' && stringified !== '[]') {
          // Make JSON more readable for medical reports
          text = stringified
            .replace(/"/g, '')
            .replace(/\{|\}/g, '')
            .replace(/,$/gm, '')
            .split('\n')
            .filter(line => line.trim())
            .join('\n');
        } else {
          text = 'Keine Befunde verfügbar.';
        }
      } catch (e) {
        text = String(text);
      }
    }
  }
  
  // Ensure text is a string
  if (!text || typeof text !== 'string') {
    return String(text || 'Keine Befunde verfügbar.');
  }
  
  // First, remove any technical details that might have been included
  let cleanedText = text;
  
  // Remove technique information that might be at the beginning
  cleanedText = cleanedText.replace(/^Technik:.*?(?=In Untersuchung|LWK|BWK|HWK|[A-Z][a-z])/si, '');
  cleanedText = cleanedText.replace(/^\d+,\d+\s*Tesla.*?(?=In Untersuchung|LWK|BWK|HWK|[A-Z][a-z])/si, '');
  
  // Check if it's a spine report
  if (cleanedText.includes('LWK') || cleanedText.includes('BWK') || cleanedText.includes('HWK')) {
    const sections = [];
    
    // First, add space after periods followed by level patterns
    const processedText = cleanedText.replace(/\.([LBCH]WK)/g, '.\n$1');
    
    // Split by anatomical levels - handle both "LWK 5/SWK 1:" and "LWK 2/3:" patterns
    const parts = processedText.split(/(?=(?:[LBCH]WK\s*\d+(?:\/\d+)?|[LBCH]WK\s*\d+\/[SBC]WK\s*\d+)\s*:)/);
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.length > 10) {
        // Check if it starts with a level (including mixed levels like LWK 5/SWK 1)
        const levelMatch = trimmed.match(/^((?:[LBCH]WK\s*\d+(?:\/\d+)?|[LBCH]WK\s*\d+\/[SBC]WK\s*\d+))\s*:\s*(.+)/s);
        if (levelMatch) {
          const level = levelMatch[1].replace(/\s+/g, ' ');
          const finding = levelMatch[2].trim().replace(/\n/g, ' ');
          sections.push(`\n**${level}:**\n${finding}`);
        } else if (!sections.length && !trimmed.toLowerCase().includes('technik')) {
          // General findings before first level (exclude technique info)
          sections.push(trimmed);
        }
      }
    });
    
    return sections.join('\n\n');
  }
  
  // Check if it's an oncology/imaging report with specific sections
  if (cleanedText.includes('PET/CT') || cleanedText.includes('Computertomographie')) {
    // Format with proper structure
    let formatted = cleanedText;
    
    // Add headers for imaging types
    formatted = formatted.replace(/(PET\/CT[^:]*:)/g, '\n**$1**\n');
    formatted = formatted.replace(/(Computertomographie[^:]*:)/g, '\n**$1**\n');
    
    // Format findings as bullet points for common patterns
    const bulletPatterns = [
      'Bekanntes', 'Kein Nachweis', 'Keine erkennbaren', 'Weiterer', 'Unklare',
      'Neu aufgetretene', 'Größenregredienter', 'Narbige', 'Verdacht',
      'Divertikulose', 'Arteriosklerose', 'Degenerative'
    ];
    
    bulletPatterns.forEach(pattern => {
      formatted = formatted.replace(new RegExp(`([.!]\\s*)(${pattern})`, 'g'), '$1\n• $2');
      formatted = formatted.replace(new RegExp(`^(${pattern})`, 'gm'), '• $1');
    });
    
    return formatted.trim();
  }
  
  // For non-spine reports, just clean up formatting
  return cleanedText
    .split(/\.\s+/)
    .filter(s => s.length > 10)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('.\n');
}

// Helper functions for extracting information
function extractClinicalInfo(text) {
  const patterns = [
    /familiär.*belastung/i,
    /clinical.*indication/i,
    /überweisung.*wegen/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const context = text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + 50));
      return context.trim();
    }
  }
  return null;
}

function extractExaminationType(text) {
  const examTypes = {
    'MRT': ['MRT', 'Magnetresonanztomographie', 'MRI'],
    'CT': ['CT', 'Computertomographie'],
    'Röntgen': ['Röntgen', 'X-ray'],
    'Sonografie': ['Sonografie', 'Ultraschall', 'Ultrasound'],
    'Mammographie': ['Mammographie', 'Mammography']
  };
  
  for (const [examName, keywords] of Object.entries(examTypes)) {
    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        return examName;
      }
    }
  }
  return null;
}

function formatFindings(text) {
  // Clean up and format the findings text
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\.\s+/)
    .filter(s => s.length > 10)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('. ') + '.';
}


// Format assessment with numbered points
function formatAssessment(text) {
  // Clean up the text first
  let cleanedText = text.trim();
  
  // Special handling for mammography reports with categories
  if (cleanedText.includes('Kategorie') || cleanedText.includes('Kein Hinweis')) {
    // Don't try to add numbers, just clean up the text
    return cleanedText
      .replace(/\s+/g, ' ')
      .replace(/;\s*/g, '; ')
      .replace(/\(\s*/g, ' (')
      .replace(/\s*\)/g, ')')
      .trim();
  }
  
  // Special handling for pathology reports - don't auto-number
  if (cleanedText.includes('Histologisches Grading') || 
      cleanedText.includes('Hormonrezeptorstatus') || 
      cleanedText.includes('HER2-Status') ||
      cleanedText.includes('Ki-67') ||
      cleanedText.includes('Invasives') ||
      cleanedText.includes('nicht-speziellen Typ')) {
    // Just clean up spacing for pathology reports
    return cleanedText
      .replace(/\s+/g, ' ')
      .replace(/;\s*/g, '; ')
      .trim();
  }
  
  // Fix missing dots after numbers (e.g., "1 LWK" -> "1. LWK")
  cleanedText = cleanedText.replace(/(\d+)\s+([A-Z])/g, '$1. $2');
  
  // Fix "z T." to "z.T."
  cleanedText = cleanedText.replace(/z\s+T\./g, 'z.T.');
  
  // Check if already properly numbered
  if (/^\d+\./.test(cleanedText)) {
    // Just clean up spacing
    return cleanedText
      .replace(/\s+/g, ' ')
      .replace(/(\d+\.)\s*/g, '\n$1 ')
      .trim();
  }
  
  // Split by numbered patterns
  const numbered = cleanedText.match(/(\d+)\s*[.)]?\s*([^\d]+)/g);
  if (numbered && numbered.length > 1) {
    return numbered
      .map(item => {
        const match = item.match(/(\d+)\s*[.)]?\s*(.+)/);
        if (match) {
          return `${match[1]}. ${match[2].trim()}`;
        }
        return item;
      })
      .join('\n');
  }
  
  // Otherwise just clean up spacing
  return cleanedText
    .replace(/\s+/g, ' ')
    .replace(/([.!?])([A-Z])/g, '$1 $2');
}

function extractAssessment(text) {
  const patterns = [
    /beurteilung[:\s]+([^.]+\.[^.]+)/i,
    /impression[:\s]+([^.]+\.[^.]+)/i,
    /diagnose[:\s]+([^.]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractRecommendations(text) {
  const patterns = [
    /empfehlung[:\s]+([^.]+)/i,
    /recommendation[:\s]+([^.]+)/i,
    /weitere[:\s]+([^.]+)/i,
    /intervall[:\s]+([^.]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Function to generate patient-friendly summary
function generatePatientFriendlySummary(reportText, language = 'de') {
  const summaryTemplates = {
    de: {
      title: 'Zusammenfassung für Patienten',
      sections: {
        'Was wurde untersucht?': 'Es wurde eine bildgebende Untersuchung durchgeführt, um Ihre Beschwerden genauer zu untersuchen.',
        'Was wurde gefunden?': simplifyFindings(reportText, 'de'),
        'Was bedeutet das für Sie?': 'Die Untersuchung zeigt einige Befunde, die Ihr Arzt mit Ihnen besprechen wird. Es ist wichtig, dass Sie diese Ergebnisse im Zusammenhang mit Ihren Symptomen und Ihrer Krankengeschichte betrachten.',
        'Nächste Schritte': 'Bitte besprechen Sie diese Ergebnisse mit Ihrem behandelnden Arzt. Er wird Ihnen erklären, was die Befunde für Ihre Gesundheit bedeuten und ob weitere Untersuchungen oder Behandlungen notwendig sind.'
      }
    },
    en: {
      title: 'Patient Summary',
      sections: {
        'What was examined?': 'An imaging examination was performed to investigate your symptoms in more detail.',
        'What was found?': simplifyFindings(reportText, 'en'),
        'What does this mean for you?': 'The examination shows some findings that your doctor will discuss with you. It\'s important to consider these results in the context of your symptoms and medical history.',
        'Next steps': 'Please discuss these results with your treating physician. They will explain what the findings mean for your health and whether further examinations or treatments are necessary.'
      }
    },
    tr: {
      title: 'Hasta Özeti',
      sections: {
        'Ne incelendi?': 'Şikayetlerinizi daha detaylı araştırmak için görüntüleme incelemesi yapıldı.',
        'Ne bulundu?': simplifyFindings(reportText, 'tr'),
        'Bu sizin için ne anlama geliyor?': 'İnceleme, doktorunuzun sizinle görüşeceği bazı bulgular gösteriyor. Bu sonuçları semptomlarınız ve tıbbi geçmişiniz bağlamında değerlendirmek önemlidir.',
        'Sonraki adımlar': 'Lütfen bu sonuçları tedavi eden doktorunuzla görüşün. Size bulguların sağlığınız için ne anlama geldiğini ve başka inceleme veya tedavilerin gerekli olup olmadığını açıklayacaktır.'
      }
    }
  };
  
  return summaryTemplates[language] || summaryTemplates.en;
}

// Function to simplify medical findings for patients
function simplifyFindings(text, language = 'de') {
  // Create a simple, understandable summary for patients
  
  // Extract the main medical issues
  const hasHighGrade = /hochgradig|high-grade|severe/i.test(text);
  const hasMediumGrade = /mittelgradig|medium-grade|moderate/i.test(text);
  const hasDiscIssues = /bandscheibenvorfall|disc herniation|bulging|extrusion/i.test(text);
  const hasStenosis = /stenose|stenosis/i.test(text);
  const hasPseudospondylolisthesis = /pseudospondylolisthesis/i.test(text);
  
  // Language-specific summaries
  const summaries = {
    de: {
      intro: 'Die Untersuchung Ihrer Wirbelsäule zeigt mehrere Veränderungen. ',
      highGradeStenosis: 'Es wurden deutliche Verengungen im Wirbelkanal festgestellt, besonders im unteren Bereich der Lendenwirbelsäule. ',
      stenosis: 'Es wurden Verengungen im Wirbelkanal festgestellt. ',
      discIssues: 'Einige Bandscheiben zeigen Vorwölbungen oder Vorfälle. ',
      spondylolisthesis: 'Ein Wirbel hat sich gegenüber dem anderen verschoben. ',
      conclusion: 'Diese Veränderungen können Ihre Beschwerden verursachen. Ihr Arzt wird mit Ihnen die beste Behandlung besprechen.'
    },
    en: {
      intro: 'The examination of your spine shows several changes. ',
      highGradeStenosis: 'Significant narrowing was found in the spinal canal, especially in the lower lumbar spine. ',
      stenosis: 'Narrowing was found in the spinal canal. ',
      discIssues: 'Some discs show bulging or herniation. ',
      spondylolisthesis: 'One vertebra has shifted relative to another. ',
      conclusion: 'These changes may be causing your symptoms. Your doctor will discuss the best treatment options with you.'
    },
    tr: {
      intro: 'Omurganızın incelemesi birkaç değişiklik gösteriyor. ',
      highGradeStenosis: 'Omurilik kanalında, özellikle bel omurlarının alt kısmında belirgin daralma tespit edildi. ',
      stenosis: 'Omurilik kanalında daralma tespit edildi. ',
      discIssues: 'Bazı diskler fıtıklaşma veya taşma gösteriyor. ',
      spondylolisthesis: 'Bir omur diğerine göre kaymış durumda. ',
      conclusion: 'Bu değişiklikler şikayetlerinize neden olabilir. Doktorunuz sizinle en iyi tedavi seçeneklerini görüşecektir.'
    }
  };
  
  // Use the appropriate language or default to English
  const lang = summaries[language] || summaries.en;
  
  let summary = lang.intro;
  
  if (hasHighGrade && hasStenosis) {
    summary += lang.highGradeStenosis;
  } else if (hasStenosis) {
    summary += lang.stenosis;
  }
  
  if (hasDiscIssues) {
    summary += lang.discIssues;
  }
  
  if (hasPseudospondylolisthesis) {
    summary += lang.spondylolisthesis;
  }
  
  summary += lang.conclusion;
  
  return summary;
}

// Function to extract key findings as a list
function extractKeyFindings(text, language = 'de') {
  const findings = [];
  
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Look for key medical terms and findings - these are universal terms that appear in the source text
  const criticalTerms = ['hochgradig', 'mittelgradig', 'geringgradig', 'bandscheibenvorfall', 'stenose', 
                         'pseudospondylolisthesis', 'extrusion', 'bulging', 'degeneration', 'hypertrophie',
                         'severe', 'moderate', 'mild', 'disc herniation', 'stenosis'];
  
  // First pass: Extract critical findings from the original text
  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase().trim();
    if (criticalTerms.some(term => lowerSentence.includes(term)) && sentence.length > 20) {
      findings.push(sentence.trim());
    }
  });
  
  // Second pass: Add other relevant findings if we don't have enough
  if (findings.length < 3) {
    // Define key terms for findings
    const keyTerms = ['zeigt', 'findet', 'nachweis', 'befund', 'unauffällig', 'auffällig', 
                      'normal', 'regelrecht', 'verändert', 'shows', 'demonstrates', 'reveals'];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase().trim();
      if (keyTerms.some(term => lowerSentence.includes(term)) && sentence.length > 20 && !findings.includes(sentence.trim())) {
        findings.push(sentence.trim());
      }
    });
  }
  
  // If still no findings, extract from specific sections
  if (findings.length === 0) {
    const beurteilungMatch = text.match(/Beurteilung:([\s\S]*?)(?:Mit freundlichen|$)/i);
    if (beurteilungMatch) {
      const beurteilungSentences = beurteilungMatch[1].split(/[.!?]+/).filter(s => s.trim().length > 20);
      findings.push(...beurteilungSentences.slice(0, 3));
    }
  }
  
  // Return top 3-5 findings
  return findings.slice(0, 5);
}

/**
 * Clean medical findings by extracting only relevant medical content
 */
function cleanMedicalFindings(findings, originalText) {
  if (!findings || typeof findings !== 'string') {
    return '';
  }

  // If the findings contain the entire document, extract only relevant parts
  if (findings.length > 500 && findings.includes('Sehr geehrte')) {
    // This is likely the entire letter, extract only medical findings
    
    let cleanedFindings = '';
    
    // Get clinical information
    const clinicalMatch = findings.match(/Klinik und rechtfertigende Indikationsstellung:([\s\S]*?)(?=Eine letzte|Digitale|Hochfrequenz|Übriger|$)/i);
    if (clinicalMatch) {
      const clinicalInfo = clinicalMatch[1].trim();
      cleanedFindings += `**Klinische Indikation:**\n${clinicalInfo}\n\n`;
    }
    
    // Extract mammography findings
    const mammographyMatch = findings.match(/Digitale Mammographie[^:]*:([\s\S]*?)(?=Hochfrequenz|Beurteilung:|$)/i);
    if (mammographyMatch) {
      const mammographyFindings = mammographyMatch[1].trim();
      cleanedFindings += `**Digitale Mammographie:**\n${mammographyFindings}\n\n`;
    }
    
    // Extract the ultrasound findings section
    const ultrasoundMatch = findings.match(/Hochfrequenzsonographie[^:]*:([\s\S]*?)(?=Beurteilung:|$)/i);
    if (ultrasoundMatch) {
      const ultrasoundFindings = ultrasoundMatch[1].trim();
      cleanedFindings += `**Hochfrequenzsonographie:**\n${ultrasoundFindings}`;
    }
    
    if (cleanedFindings) {
      return cleanedFindings;
    }
    
    // If no specific ultrasound section found, try to extract medical content
    const medicalParts = [];
    
    // Look for imaging findings patterns
    const patterns = [
      /(?:sonographie|mammographie|computertomographie)[^:]*:([\s\S]*?)(?=beurteilung|empfehlung|mit freundlichen|$)/gi,
      /parenchymdichte[\s\S]*?lymphknoten[\s\S]*?axillär/gi,
      /keine.*befunde[\s\S]*?/gi
    ];
    
    for (const pattern of patterns) {
      const matches = findings.match(pattern);
      if (matches) {
        medicalParts.push(...matches);
      }
    }
    
    if (medicalParts.length > 0) {
      return medicalParts.join('\n').trim();
    }
  }
  
  return findings;
}

// Format technical details for display
function formatTechnicalDetails(sections, language = 'de') {
  const details = [];
  
  // Only include technical details, not the findings
  if (sections['technique']) {
    // Extract only the actual technique info, not the findings
    let techInfo = sections['technique'];
    
    // Remove redundant "Technik:" prefix if it exists
    techInfo = techInfo.replace(/^Technik:\s*/i, '');
    
    // Only take the first part before any anatomical findings
    techInfo = techInfo.split(/(?:In Untersuchung|LWK|BWK|HWK|Antelisthesis|S-förmig)/)[0];
    
    if (techInfo && techInfo.trim()) {
      details.push(`${language === 'de' ? 'Technik' : 'Technique'}: ${techInfo.trim()}`);
    }
  }
  
  if (sections['clinical']) {
    details.push(`${language === 'de' ? 'Klinische Angaben' : 'Clinical Information'}: ${sections['clinical']}`);
  }
  
  // If no technical details found, check for examination type
  if (details.length === 0) {
    const befund = sections['Befund'];
    if (befund && typeof befund === 'string') {
      if (befund.includes('Mammographie')) {
        return 'Digitale Mammographie bds. in 2 Ebenen';
      } else if (befund.includes('MRT')) {
        return 'MRT Untersuchung durchgeführt';
      }
    }
  }
  
  return details.join('\n') || 'Standard examination performed';
}

// Function to extract recommendations as a list
function extractRecommendationsList(text, language = 'de') {
  const recommendations = [];
  
  // Look for recommendation patterns in the source text (which might be in German)
  const patterns = [/empfehlung[:\s]+([^.]+)/i, /empfohlen[:\s]+([^.]+)/i, /kontrolle[:\s]+([^.]+)/i, 
                    /weitere[:\s]+([^.]+)/i, /recommend[:\s]+([^.]+)/i, /advised[:\s]+([^.]+)/i, 
                    /follow-up[:\s]+([^.]+)/i, /further[:\s]+([^.]+)/i];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches && matches[1]) {
      recommendations.push(matches[1].trim());
    }
  });
  
  // Default recommendations by language
  const defaultRecommendations = {
    de: 'Besprechen Sie die Befunde mit Ihrem behandelnden Arzt',
    en: 'Discuss these findings with your treating physician',
    tr: 'Bu bulguları tedavi eden doktorunuzla görüşün'
  };
  
  // Add default recommendation if none found
  if (recommendations.length === 0) {
    recommendations.push(defaultRecommendations[language] || defaultRecommendations.en);
  }
  
  return recommendations;
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'websocket-proxy',
    connections: io.engine.clientsCount
  });
});

// Handle Socket.IO connections from frontend
io.on('connection', (socket) => {
  console.log('Frontend connected via Socket.IO:', socket.id);
  
  // Emit initial connection status
  socket.emit('connection', { status: 'connected' });
  
  let transcriptionWs = null;
  const streamConverter = new WebMStreamConverter();
  const vadProcessor = new VADProcessor();
  socket.lastAudioTime = Date.now();
  socket.lastPCMCheck = Date.now();
  socket.audioAccumulator = Buffer.alloc(0);
  socket.transcriptionHistory = []; // Initialize transcription history
  
  // Send heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    socket.emit('heartbeat', { timestamp: Date.now() });
  }, 20000);
  
  // Connect to the real transcription service
  const connectToTranscriptionService = () => {
    try {
      // Use environment variable to choose transcription service
      const transcriptionUrl = process.env.USE_VOSK === 'true' 
        ? 'ws://localhost:8002/ws/transcribe'  // Vosk service
        : 'ws://localhost:8001/ws/transcribe'; // Whisper service
      
      console.log(`Connecting to transcription service at ${transcriptionUrl} (USE_VOSK=${process.env.USE_VOSK})`)
      
      transcriptionWs = new WebSocket(transcriptionUrl);
      
      transcriptionWs.on('open', () => {
        console.log('Connected to transcription service');
        socket.emit('transcription_connected', { status: 'connected' });
      });
      
      transcriptionWs.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received from transcription service:', message);
          
          // Forward transcription updates to frontend
          if (message.type === 'transcription' && message.data) {
            const transcriptionData = message.data;
            console.log('Transcription received:', {
              text: transcriptionData.text,
              confidence: transcriptionData.confidence,
              quality_score: transcriptionData.quality_score,
              segments_count: transcriptionData.segments?.length || 0
            });
            const transcriptionResult = {
              id: `trans-${Date.now()}`,
              text: transcriptionData.text || '',
              isFinal: false, // Will be set to true when session ends
              confidence: transcriptionData.confidence || 0,
              language: transcriptionData.language || 'de',
              timestamp: new Date()
            };
            
            // Store in history for report generation - prevent duplicates
            if (transcriptionResult.text && transcriptionResult.text.trim()) {
              // Check if this transcription is significantly different from the last one
              const lastTranscription = socket.transcriptionHistory[socket.transcriptionHistory.length - 1];
              
              if (!lastTranscription || !isDuplicateTranscription(transcriptionResult.text, lastTranscription.text)) {
                socket.transcriptionHistory.push(transcriptionResult);
                console.log('Stored transcription in history. Total:', socket.transcriptionHistory.length);
              } else {
                console.log('Skipping duplicate transcription');
              }
            }
            
            socket.emit('transcription', transcriptionResult);
          } else if (message.type === 'partial_transcription' && message.data) {
            // Handle partial transcriptions for real-time feedback
            const partialData = message.data;
            console.log('Partial transcription:', partialData.text);
            
            socket.emit('partial_transcription', {
              text: partialData.text || '',
              language: partialData.language || 'de',
              isPartial: true,
              timestamp: new Date()
            });
          } else if (message.type === 'error') {
            socket.emit('transcription_error', message);
          } else if (message.type === 'config_updated') {
            console.log('Config updated:', message.session_id);
          } else if (message.type === 'session_ended') {
            console.log('Session ended:', message);
            
            // Create a final transcription from accumulated history if we have transcriptions
            if (socket.transcriptionHistory && socket.transcriptionHistory.length > 0) {
              // Mark all existing transcriptions as partial
              socket.transcriptionHistory.forEach((t, index) => {
                if (index < socket.transcriptionHistory.length - 1) {
                  socket.emit('transcription', { ...t, isFinal: false });
                }
              });
              
              const combinedText = socket.transcriptionHistory
                .map(t => t.text)
                .join(' ')
                .trim();
              
              if (combinedText) {
                const finalTranscription = {
                  id: `final-trans-${Date.now()}`,
                  text: combinedText,
                  isFinal: true,
                  confidence: 0.8,
                  language: socket.transcriptionHistory[0]?.language || 'de',
                  timestamp: new Date()
                };
                
                console.log('Creating final transcription from session:', {
                  length: finalTranscription.text.length,
                  preview: finalTranscription.text.substring(0, 100) + '...'
                });
                socket.emit('transcription', finalTranscription);
              }
            }
          }
        } catch (err) {
          console.error('Error parsing transcription message:', err);
        }
      });
      
      transcriptionWs.on('error', (error) => {
        console.error('Transcription service error:', error);
        socket.emit('transcription_error', { message: 'Connection to transcription service failed' });
      });
      
      transcriptionWs.on('close', () => {
        console.log('Disconnected from transcription service');
        socket.emit('transcription_disconnected');
      });
      
    } catch (error) {
      console.error('Failed to connect to transcription service:', error);
      socket.emit('transcription_error', { message: 'Failed to connect to transcription service' });
    }
  };
  
  // Handle audio data from frontend
  socket.on('audio_data', async (data) => {
    console.log('Received audio data chunk, size:', data.data?.byteLength || 0, 'type:', typeof data.data);
    
    if (!data.data) return;
    
    // Feed WebM data to streaming converter
    const audioChunk = Buffer.from(data.data);
    streamConverter.addData(socket.id, audioChunk);
    
    // Check for available PCM data more frequently
    const timeSinceLastCheck = Date.now() - socket.lastPCMCheck;
    const shouldCheckPCM = timeSinceLastCheck > 50; // Further reduced for lower latency
    
    // Try to send PCM data if available
    if (shouldCheckPCM && transcriptionWs && transcriptionWs.readyState === WebSocket.OPEN && socket.transcriptionActive) {
      const pcmData = streamConverter.getPCMData(socket.id);
      
      if (pcmData && pcmData.length > 0) {
        // Accumulate PCM data
        socket.audioAccumulator = Buffer.concat([socket.audioAccumulator, pcmData]);
        
        // Process through VAD for better speech detection
        const hasSpeech = vadProcessor.processPCM(socket.audioAccumulator);
        
        // Send data when we have enough audio (300ms) for better accuracy with context
        const minChunkSize = 9600; // ~300ms at 16kHz for better accuracy
        const hasEnoughData = socket.audioAccumulator.length >= minChunkSize;
        
        // Send when we have enough data AND (speech detected OR buffer is getting large)
        if (hasEnoughData && (hasSpeech || socket.audioAccumulator.length >= 16000)) {
          console.log('Sending audio to transcription, size:', socket.audioAccumulator.length, 'speech:', hasSpeech);
          
          const base64Audio = socket.audioAccumulator.toString('base64');
          
          // Send to transcription service with metadata
          transcriptionWs.send(JSON.stringify({
            type: 'audio',
            data: base64Audio,
            language: data.language || 'de',
            timestamp: Date.now(),
            hasSpeech: hasSpeech
          }));
          
          // Store transcription timestamp
          socket.lastTranscriptionTime = Date.now();
          
          // Clear accumulator
          socket.audioAccumulator = Buffer.alloc(0);
        }
        
        // If accumulator is too large (>1.5 seconds), send anyway to prevent overflow
        if (socket.audioAccumulator.length > 48000) {
          console.log('Sending accumulated audio (overflow protection), size:', socket.audioAccumulator.length);
          const base64Audio = socket.audioAccumulator.toString('base64');
          
          transcriptionWs.send(JSON.stringify({
            type: 'audio',
            data: base64Audio,
            language: data.language || 'de',
            timestamp: Date.now(),
            hasSpeech: false
          }));
          
          socket.audioAccumulator = Buffer.alloc(0);
        }
      }
      
      socket.lastPCMCheck = Date.now();
    }
    
    // Connect to real service immediately if not connected
    if (!transcriptionWs || transcriptionWs.readyState !== WebSocket.OPEN) {
      if (!socket.transcriptionStarted) {
        console.log('Audio data received, connecting to transcription service immediately...');
        connectToTranscriptionService();
        socket.transcriptionStarted = true;
        
        // Send config after a short delay
        setTimeout(() => {
          if (transcriptionWs && transcriptionWs.readyState === WebSocket.OPEN) {
            transcriptionWs.send(JSON.stringify({
              type: 'config',
              config: {
                language: data.language || 'de',
                model_size: 'base',
                medical_context: true,
                quality_threshold: 0.7
              }
            }));
          }
        }, 100);
      }
    }
  });
  
  // Handle transcription start
  socket.on('start_transcription', (data) => {
    console.log('Starting transcription:', data);
    
    // Initialize transcription state
    socket.transcriptionActive = true;
    socket.transcriptionStarted = false;
    socket.mockTranscriptionWords = [];
    socket.mockTranscriptionIndex = 0;
    // CRITICAL FIX: Clear history on new transcription to prevent multi-document concatenation
    socket.transcriptionHistory = [];
    console.log('Transcription history cleared for new session');
    
    // Initialize streaming converter for this session
    streamConverter.initSession(socket.id);
    
    // Initialize mock words for German medical transcription
    const mockPhrases = {
      de: [
        'Patient zeigt', 'keine Auffälligkeiten', 'in der', 'Lendenwirbelsäule.',
        'Bandscheiben', 'normal konfiguriert,', 'keine Protrusion', 'oder Prolaps.',
        'Wirbelkörper', 'regelrecht,', 'keine Frakturen', 'erkennbar.',
        'Spinalkanal', 'normal weit,', 'keine Stenose.',
        'Nervenwurzeln', 'beidseits frei.',
        'Beurteilung:', 'Normalbefund der', 'Lendenwirbelsäule.'
      ],
      en: [
        'Patient shows', 'no abnormalities', 'in the', 'lumbar spine.',
        'Intervertebral discs', 'normally configured,', 'no protrusion', 'or prolapse.',
        'Vertebral bodies', 'regular,', 'no fractures', 'detected.',
        'Spinal canal', 'normal width,', 'no stenosis.',
        'Nerve roots', 'free bilaterally.',
        'Assessment:', 'Normal findings of', 'the lumbar spine.'
      ]
    };
    
    socket.mockTranscriptionWords = mockPhrases[data.language] || mockPhrases.de;
    
    // Connect to real transcription service
    if (!transcriptionWs || transcriptionWs.readyState !== WebSocket.OPEN) {
      connectToTranscriptionService();
      
      // Wait for connection then send config
      setTimeout(() => {
        if (transcriptionWs && transcriptionWs.readyState === WebSocket.OPEN) {
          // Send configuration
          transcriptionWs.send(JSON.stringify({
            type: 'config',
            config: {
              language: data.language || 'de',
              model_size: 'base',
              medical_context: true,
              quality_threshold: 0.7
            }
          }));
        }
      }, 500);
    } else {
      // Send configuration immediately if already connected
      transcriptionWs.send(JSON.stringify({
        type: 'config',
        config: {
          language: data.language || 'de',
          model_size: 'base',
          medical_context: true,
          quality_threshold: 0.7
        }
      }));
    }
  });
  
  // Handle transcription stop
  socket.on('stop_transcription', async () => {
    console.log('Stopping transcription');
    
    // Get any remaining PCM data
    if (transcriptionWs && transcriptionWs.readyState === WebSocket.OPEN) {
      const pcmData = streamConverter.getPCMData(socket.id);
      if (pcmData && pcmData.length > 0) {
        console.log('Processing final audio buffer, PCM size:', pcmData.length);
        const base64Audio = pcmData.toString('base64');
        
        transcriptionWs.send(JSON.stringify({
          type: 'audio',
          data: base64Audio,
          language: 'de'
        }));
      }
    }
    
    // Send any remaining audio
    if (socket.audioAccumulator && socket.audioAccumulator.length > 0) {
      console.log('Sending remaining audio on stop, size:', socket.audioAccumulator.length);
      const base64Audio = socket.audioAccumulator.toString('base64');
      
      transcriptionWs.send(JSON.stringify({
        type: 'audio',
        data: base64Audio,
        language: 'de'
      }));
    }
    
    // Clear transcription state
    socket.transcriptionActive = false;
    socket.mockTranscriptionWords = [];
    socket.mockTranscriptionIndex = 0;
    socket.audioAccumulator = Buffer.alloc(0);
    vadProcessor.reset();
    
    // End streaming session
    streamConverter.endSession(socket.id);
    
    // Send end_session command to transcription service
    if (transcriptionWs && transcriptionWs.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        transcriptionWs.send(JSON.stringify({
          type: 'end_session'
        }));
      }, 500); // Small delay to allow final audio processing
    }
    
    socket.emit('transcription_stopped');
  });
  
  // Handle report generation request
  socket.on('generate_report', async (data) => {
    console.log('Report generation requested:', data);
    
    try {
      let combinedText = '';
      
      // Check if transcription text was provided directly (for pasted content)
      if (data.transcriptionText) {
        combinedText = data.transcriptionText;
        console.log('Using provided transcription text, length:', combinedText.length);
      } else {
        // Get all transcriptions for this session
        const transcriptions = socket.transcriptionHistory || [];
        console.log('Report generation - transcription history length:', transcriptions.length);
        combinedText = transcriptions
          .filter(t => t.text && t.text.trim())
          .map(t => t.text)
          .join(' ');
      }
      
      console.log('Combined transcription text length:', combinedText.length);
      
      if (!combinedText) {
        socket.emit('error', { 
          type: 'report_generation',
          message: 'No transcription text available for report generation' 
        });
        return;
      }
      
      // CRITICAL VALIDATION: Check for multi-document contamination
      const genderIndicators = {
        male: /\b(herr|herrn)\s+\w+/gi, // Only actual salutations, not random words
        female: /\b(frau)\s+\w+/gi      // Only actual salutations, not random words
      };
      
      const maleMatches = (combinedText.match(genderIndicators.male) || []).length;
      const femaleMatches = (combinedText.match(genderIndicators.female) || []).length;
      const multipleHeaders = (combinedText.match(/sehr geehrte?[rn]?.*kollege/gi) || []).length;
      const multipleDates = (combinedText.match(/\d{2}\.\d{2}\.\d{4}/g) || []).length;
      
      // Only flag if clear evidence of multiple different patients
      if ((maleMatches > 1 && femaleMatches > 1) || multipleHeaders > 1) {
        console.error('Multi-document contamination detected:', {
          maleMatches, femaleMatches, multipleHeaders, multipleDates
        });
        socket.emit('error', { 
          type: 'multi_document_error',
          message: 'Report contains multiple patients or documents. Please clear history and start with a single report.',
          details: { maleMatches, femaleMatches, multipleHeaders, multipleDates }
        });
        return;
      }
      
      // Use Report Orchestrator as primary system
      let structuredReport = null;
      
      try {
        // Process report through orchestrator with processing mode
        console.log('Processing report through orchestrator with mode:', data.processingMode || 'cloud');
        const orchestratorResult = await reportOrchestrator.processReport(
          combinedText, 
          data.language || 'de',
          { source: 'transcription', timestamp: new Date().toISOString(), processingMode: data.processingMode || 'cloud' }
        );
        
        console.log('Orchestrator result:', {
          type: orchestratorResult.type,
          agent: orchestratorResult.metadata?.agent,
          aiGenerated: orchestratorResult.metadata?.aiGenerated,
          aiProvider: orchestratorResult.metadata?.aiProvider,
          confidence: orchestratorResult.classification?.confidence,
          findings_preview: (orchestratorResult.findings && typeof orchestratorResult.findings === 'string') ? orchestratorResult.findings.substring(0, 100) + '...' : 'none'
        });
        
        // Debug the full metadata structure
        console.log('Full orchestrator metadata:', JSON.stringify(orchestratorResult.metadata, null, 2));
        console.log('Full orchestrator classification:', JSON.stringify(orchestratorResult.classification, null, 2));
        
        // Convert orchestrator result to structured format
        structuredReport = {
          sections: {
            'Technik': orchestratorResult.technicalDetails || '',
            'Befund': orchestratorResult.findings || '',
            'Beurteilung': orchestratorResult.impression || '',
            'Empfehlung': orchestratorResult.recommendations || ''
          },
          // Also store at top level for fallback access
          findings: orchestratorResult.findings || '',
          impression: orchestratorResult.impression || '',
          recommendations: orchestratorResult.recommendations || '',
          technicalDetails: orchestratorResult.technicalDetails || '',
          // Include enhanced findings from orchestrator
          enhancedFindings: orchestratorResult.enhancedFindings,
          // Include ICD predictions from orchestrator
          icdPredictions: orchestratorResult.icdPredictions,
          // Include metadata
          metadata: orchestratorResult.metadata
        };
        
      } catch (error) {
        console.error('Orchestrator failed:', error.message);
        console.error('Full orchestrator error:', error);
        console.error('Error stack:', error.stack);
        
        // Fallback to basic parsing
        console.log('Using basic fallback report generation');
        structuredReport = {
          sections: {
            'Befund': combinedText,
            'Beurteilung': 'Automatische Analyse fehlgeschlagen',
            'Empfehlung': 'Manuelle Überprüfung erforderlich',
            'Technik': ''
          },
          metadata: {
            error: error.message,
            fallback: true
          }
        };
      }
      
      // Store for summary generation
      socket.lastReportContent = combinedText;
      
      // Convert structured report to frontend format with better formatting
      const sections = structuredReport.sections;
      
      // Extract findings and check if it contains subsections
      const findingsData = sections['findings'] || sections['Befund'] || sections['Findings'] || structuredReport.findings;
      let dynamicSections = {};
      let mainFindings = '';
      
      // Check if findings is an object with subsections or structured findings
      if (findingsData && typeof findingsData === 'object' && !Array.isArray(findingsData)) {
        // Check if it's the new structured findings format with content + structuredFindings
        if (findingsData.content && findingsData.structuredFindings) {
          console.log('DEBUG: Using structured findings format');
          mainFindings = findingsData.content;
        } else {
          // Extract subsections from findings object (legacy format)
          const subsectionMap = {
            'mammographyFindings': 'Digitale Mammographie',
            'ultrasoundFindings': 'Hochfrequenzsonographie', 
            'ctFindings': 'Computertomographie',
            'mriFindings': 'Magnetresonanztomographie',
            'xrayFindings': 'Röntgen',
            'petFindings': 'PET/CT'
          };
          
          Object.entries(findingsData).forEach(([key, value]) => {
            if (subsectionMap[key] && value) {
              dynamicSections[subsectionMap[key]] = value;
            } else if (key === 'main' || key === 'general' || key === 'content') {
              mainFindings = value;
            }
          });
          
          // If no main findings but we have subsections, don't include empty findings
          if (!mainFindings && Object.keys(dynamicSections).length > 0) {
            mainFindings = null;
          }
        }
      } else {
        // Findings is a string or needs to be formatted
        const rawFindings = findingsData || combinedText;
        const cleanedFindings = cleanMedicalFindings(rawFindings, combinedText);
        mainFindings = formatStructuredFindings(cleanedFindings);
      }
      
      // Extract and clean recommendations
      let recommendations = sections['recommendation'] || sections['Empfehlung'] || sections['Recommendations'] || 'Weitere klinische Korrelation empfohlen.';
      // Remove greetings from recommendations
      recommendations = recommendations.replace(/Mit freundlichen.*$/si, '').trim();
      
      // Build sections array for frontend
      const sectionsList = [];
      
      // Add technical details if present
      const technicalDetails = formatTechnicalDetails(sections, data.language);
      if (technicalDetails && technicalDetails !== 'Standard examination performed') {
        sectionsList.push({
          title: data.language === 'de' ? 'Technik' : 'Technical Details',
          content: technicalDetails,
          order: 0
        });
      }
      
      // Add main findings if present
      if (mainFindings) {
        sectionsList.push({
          title: data.language === 'de' ? 'Befund' : 'Findings',
          content: mainFindings,
          order: 1
        });
      } else if (structuredReport.findings) {
        // Fallback: use the raw findings from the structured report, but clean it first
        console.log('DEBUG: Using fallback findings from structuredReport.findings');
        const cleanedFindings = cleanMedicalFindings(structuredReport.findings, data.transcription || '');
        sectionsList.push({
          title: data.language === 'de' ? 'Befund' : 'Findings',
          content: formatStructuredFindings(cleanedFindings),
          order: 1
        });
      }
      
      // Add dynamic subsections
      let order = 2;
      Object.entries(dynamicSections).forEach(([title, content]) => {
        sectionsList.push({
          title,
          content: typeof content === 'string' ? content : formatStructuredFindings(content),
          order: order++
        });
      });
      
      // Add impression
      const impression = formatAssessment(sections['impression'] || sections['Beurteilung'] || sections['Impression'] || structuredReport.impression || 'Siehe Befund.');
      sectionsList.push({
        title: data.language === 'de' ? 'Beurteilung' : 'Impression',
        content: impression,
        order: order++
      });
      
      // Add recommendations
      sectionsList.push({
        title: data.language === 'de' ? 'Empfehlung' : 'Recommendations',
        content: recommendations,
        order: order++
      });
      
      // DEBUG: Check structured report metadata
      console.log('DEBUG structured report for frontend construction:');
      console.log('- structuredReport.type:', structuredReport.type);
      console.log('- structuredReport.agent:', structuredReport.agent);
      console.log('- structuredReport.metadata:', JSON.stringify(structuredReport.metadata, null, 2));
      
      // Extract enhanced findings data if available
      const enhancedFindingsData = sections['findings'] || sections['Befund'] || sections['Findings'] || structuredReport.findings;
      let enhancedFindings = null;
      let originalTranscriptionText = data.transcriptionText || data.transcription;
      
      console.log('DEBUG: Enhanced findings data check:');
      console.log('- originalTranscriptionText length:', originalTranscriptionText?.length);
      console.log('- originalTranscriptionText preview:', originalTranscriptionText?.substring(0, 100) + '...');
      console.log('- enhancedFindingsData type:', typeof enhancedFindingsData);
      console.log('- enhancedFindingsData:', JSON.stringify(enhancedFindingsData, null, 2));
      console.log('- structuredReport.findings:', JSON.stringify(structuredReport.findings, null, 2));
      console.log('- structuredReport.enhancedFindings:', JSON.stringify(structuredReport.enhancedFindings, null, 2));
      
      // Priority 1: Check for enhancedFindings from orchestrator with nested or direct structure
      if (structuredReport.enhancedFindings) {
        let findingsArray = null;
        let findingsContent = null;
        
        console.log('DEBUG: Enhanced findings structure analysis:');
        console.log('- Has content:', !!structuredReport.enhancedFindings.content);
        console.log('- Content has structuredFindings:', !!structuredReport.enhancedFindings.content?.structuredFindings);
        console.log('- Content structuredFindings length:', structuredReport.enhancedFindings.content?.structuredFindings?.length || 0);
        console.log('- Has direct structuredFindings:', !!structuredReport.enhancedFindings.structuredFindings);
        console.log('- Direct structuredFindings length:', structuredReport.enhancedFindings.structuredFindings?.length || 0);
        
        // Try nested structure first (content.structuredFindings)
        if (structuredReport.enhancedFindings.content && structuredReport.enhancedFindings.content.structuredFindings && structuredReport.enhancedFindings.content.structuredFindings.length > 0) {
          console.log('DEBUG: Using nested enhanced findings from orchestrator result');
          findingsArray = structuredReport.enhancedFindings.content.structuredFindings;
          findingsContent = structuredReport.enhancedFindings.content.content || mainFindings || originalTranscriptionText;
        }
        // Fall back to direct structure (structuredFindings)
        else if (structuredReport.enhancedFindings.structuredFindings && structuredReport.enhancedFindings.structuredFindings.length > 0) {
          console.log('DEBUG: Using direct enhanced findings from orchestrator result');
          findingsArray = structuredReport.enhancedFindings.structuredFindings;
          findingsContent = structuredReport.enhancedFindings.content || mainFindings || originalTranscriptionText;
        }
        
        if (findingsArray && findingsArray.length > 0) {
          console.log('DEBUG: Processing', findingsArray.length, 'findings for source span correction');
          const correctedFindings = fixSourceSpans(findingsArray, findingsContent);
          enhancedFindings = {
            content: findingsContent,
            structuredFindings: correctedFindings,
            originalText: findingsContent  // Use same text for span calculations and display
          };
        } else {
          console.log('DEBUG: No valid findings array found or array is empty');
        }
      } else if (enhancedFindingsData && typeof enhancedFindingsData === 'object' && enhancedFindingsData.structuredFindings) {
        console.log('DEBUG: Creating enhanced findings with structured data');
        const content = enhancedFindingsData.content || mainFindings;
        const correctedFindings = fixSourceSpans(enhancedFindingsData.structuredFindings, content);
        enhancedFindings = {
          content: content,
          structuredFindings: correctedFindings,
          originalText: content  // Use same text for span calculations and display
        };
      } else if (structuredReport.findings && typeof structuredReport.findings === 'object' && structuredReport.findings.structuredFindings) {
        console.log('DEBUG: Using structured findings from structuredReport');
        const content = structuredReport.findings.content || mainFindings;
        const correctedFindings = fixSourceSpans(structuredReport.findings.structuredFindings, content);
        enhancedFindings = {
          content: content,
          structuredFindings: correctedFindings,
          originalText: content  // Use same text for span calculations and display
        };
      }

      // DEBUG: Check if structuredReport has ICD predictions
      console.log('🔍 WebSocket Debug - structuredReport keys:', Object.keys(structuredReport));
      console.log('🔍 WebSocket Debug - structuredReport.icdPredictions:', !!structuredReport.icdPredictions);
      if (structuredReport.icdPredictions) {
        console.log('🔍 WebSocket Debug - ICD codes count:', structuredReport.icdPredictions.codes?.length || 0);
      }

      const reportForFrontend = {
        id: `report-${Date.now()}`,
        transcriptionId: data.transcriptionId || `trans-${Date.now()}`,
        sections: sectionsList.sort((a, b) => a.order - b.order),
        // Keep legacy fields for backward compatibility
        findings: mainFindings || (Object.keys(dynamicSections).length > 0 ? 'See individual sections' : ''),
        impression: impression,
        recommendations: recommendations,
        technicalDetails: technicalDetails,
        generatedAt: Date.now(),
        language: data.language || 'de',
        // Include agent metadata and classification information
        type: structuredReport.type || 'general',
        classification: structuredReport.classification || null,
        // NEW: Enhanced findings with significance highlighting and grounding
        enhancedFindings: enhancedFindings,
        // NEW: ICD-10-GM predictions from agent processing
        icdPredictions: structuredReport.icdPredictions || null,
        metadata: {
          agent: structuredReport.metadata?.agent || structuredReport.agent || 'unknown_agent',
          aiGenerated: structuredReport.aiGenerated || structuredReport.metadata?.aiGenerated || false,
          aiProvider: structuredReport.aiProvider || structuredReport.metadata?.aiProvider || 'rule-based',
          fallback_used: !(structuredReport.aiGenerated || structuredReport.metadata?.aiGenerated),
          language: data.language || 'de',
          hasEnhancedFindings: !!enhancedFindings
        }
      };
      
      console.log('Report generated:', {
        id: reportForFrontend.id,
        orchestrator_type: structuredReport.agent || structuredReport.metadata?.agent || 'unknown',
        ai_generated: structuredReport.metadata?.aiGenerated || false,
        provider: structuredReport.metadata?.aiProvider || 'rule-based',
        sections: Object.keys(sections)
      });
      
      // Log report content for debugging
      console.log('Sending report to frontend:', {
        findings_length: reportForFrontend.findings?.length,
        impression_length: reportForFrontend.impression?.length,
        has_recommendations: !!reportForFrontend.recommendations,
        has_technical: !!reportForFrontend.technicalDetails
      });
      
      // Log exact structure being sent
      console.log('Report structure:', JSON.stringify({
        id: reportForFrontend.id,
        transcriptionId: reportForFrontend.transcriptionId,
        findings: reportForFrontend.findings?.substring(0, 50) + '...',
        impression: reportForFrontend.impression?.substring(0, 50) + '...',
        recommendations: reportForFrontend.recommendations?.substring(0, 50) + '...',
        technicalDetails: reportForFrontend.technicalDetails?.substring(0, 50) + '...',
        generatedAt: reportForFrontend.generatedAt,
        language: reportForFrontend.language,
        // ENHANCED FIELDS DEBUG
        hasEnhancedFindings: !!reportForFrontend.enhancedFindings,
        enhancedFindingsStructured: reportForFrontend.enhancedFindings?.structuredFindings?.length || 0,
        metadataHasEnhancedFindings: reportForFrontend.metadata?.hasEnhancedFindings
      }, null, 2));
      
      // Send report to frontend
      socket.emit('report', reportForFrontend);
      console.log('Report emitted to frontend');
      
      // CRITICAL FIX: Clear transcription history to prevent concatenation of multiple reports
      socket.transcriptionHistory = [];
      console.log('Transcription history cleared to prevent multi-document concatenation');
      
    } catch (error) {
      console.error('Error generating report:', error);
      socket.emit('error', { 
        type: 'report_generation',
        message: 'Report generation service error',
        details: error.message 
      });
    }
  });
  
  // Handle summary generation request
  socket.on('generate_summary', async (data) => {
    console.log('Summary generation requested:', data);
    
    try {
      // Get the report content from the stored data
      const reportText = socket.lastReportContent || '';
      
      let aiSummary = null;
      let aiProvider = null;
      
      // Try AI-powered summary generation first
      try {
        console.log('Attempting AI-powered summary generation...');
        const llmSummary = await multiLLMService.generatePatientSummary(reportText, data.language || 'de');
        
        aiSummary = {
          examination: llmSummary.examination || '',
          findings: llmSummary.findings || '',
          meaning: llmSummary.meaning || '',
          nextSteps: llmSummary.nextSteps || ''
        };
        
        aiProvider = llmSummary.provider;
        console.log(`Successfully generated AI summary with ${aiProvider}`);
        
      } catch (llmError) {
        console.error('AI summary generation failed:', llmError.message);
      }
      
      // If AI summary succeeded, use it
      if (aiSummary) {
        // Build a comprehensive summary from all parts
        let overallSummary = '';
        if (aiSummary.examination) {
          overallSummary += aiSummary.examination + ' ';
        }
        if (aiSummary.findings) {
          overallSummary += aiSummary.findings + ' ';
        }
        if (aiSummary.meaning) {
          overallSummary += aiSummary.meaning;
        }
        
        const formattedSummary = {
          id: `summary-${Date.now()}`,
          reportId: data.reportId,
          summary: overallSummary.trim() || simplifyFindings(reportText, data.language || 'de'),
          keyFindings: [
            aiSummary.examination ? `✓ ${aiSummary.examination}` : null,
            aiSummary.findings ? `✓ ${aiSummary.findings}` : null,
            aiSummary.meaning ? `✓ ${aiSummary.meaning}` : null
          ].filter(f => f !== null),
          recommendations: aiSummary.nextSteps ? [aiSummary.nextSteps] : extractRecommendationsList(reportText, data.language || 'de'),
          language: data.language || 'de',
          generatedAt: Date.now(),
          metadata: {
            ai_generated: true,
            ai_provider: aiProvider
          }
        };
        
        socket.emit('summary', formattedSummary);
        
      } else {
        // Fallback to rule-based summary generation
        console.log('Using fallback summary generation');
        
        // Generate patient-friendly summary
        const summary = generatePatientFriendlySummary(reportText, data.language || 'de');
        
        console.log('Summary generated successfully');
        
        // Convert to PatientSummary format expected by frontend
        // Get the correct section key based on language
        const sectionKey = data.language === 'tr' ? 'Ne bulundu?' : 
                          data.language === 'de' ? 'Was wurde gefunden?' : 
                          'What was found?';
        
        const formattedSummary = {
          id: `summary-${Date.now()}`,
          reportId: data.reportId,
          summary: summary.sections[sectionKey] || '',
          keyFindings: extractKeyFindings(reportText, data.language || 'de'),
          recommendations: extractRecommendationsList(reportText, data.language || 'de'),
          language: data.language || 'de',
          generatedAt: Date.now(),
          metadata: {
            ai_generated: false,
            fallback_used: true
          }
        };
        
        // Send summary to frontend
        socket.emit('summary', formattedSummary);
      }
      
    } catch (error) {
      console.error('Error generating summary:', error);
      socket.emit('error', { 
        type: 'summary_generation',
        message: 'Summary generation service error',
        details: error.message 
      });
    }
  });
  
  // Handle clear transcription history (for starting new reports)
  socket.on('clear_history', () => {
    console.log('Clearing transcription history on client request');
    socket.transcriptionHistory = [];
    socket.emit('history_cleared', { success: true });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Frontend disconnected:', socket.id);
    clearInterval(heartbeatInterval);
    streamConverter.endSession(socket.id);
    if (transcriptionWs) {
      transcriptionWs.close();
    }
  });
});

// Error handlers
io.on('connection_error', (err) => {
  console.error('Socket.IO connection error:', err);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Handle process errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process for now
});

// Start server
const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebSocket proxy running on http://localhost:${PORT}`);
  console.log('Proxying between:');
  console.log('  - Frontend (Socket.IO) on port 8080');
  console.log(`  - Transcription service (WebSocket) on port ${process.env.USE_VOSK === 'true' ? '8002 (Vosk Large Model)' : '8001 (Whisper)'}`);
  console.log(`  DEBUG: USE_VOSK env var is: "${process.env.USE_VOSK}"`);
});