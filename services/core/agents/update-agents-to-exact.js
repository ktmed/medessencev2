#!/usr/bin/env node

/**
 * Script to update all remaining agents to use exact text extraction
 */

const fs = require('fs');
const path = require('path');

const agentsToUpdate = [
  'general-agent.js',
  'pathology-agent.js',
  'cardiac-agent.js',
  'oncology-agent.js',
  'ultrasound-agent.js'
];

const updateTemplate = `
  /**
   * Parse report using exact text extraction
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(\`\${this.name}: Processing report with exact text extraction\`);
    
    const result = {
      type: this.type,
      findings: '',
      impression: '',
      recommendations: '',
      technicalDetails: '',
      sections: {},
      exactSections: [],
      trainingExamples: [],
      metadata: {
        ...metadata,
        agent: this.name,
        language: language
      }
    };

    // Extract exact sections
    const exactSections = this.exactExtractor.extractSections(reportText);
    result.exactSections = exactSections;
    
    // Map sections to result fields
    for (const section of exactSections) {
      if (section.name.toLowerCase() === 'befund' || section.name.toLowerCase() === 'findings') {
        result.findings = section.content;
      } else if (section.name.toLowerCase() === 'beurteilung' || section.name.toLowerCase() === 'impression') {
        result.impression = section.content;
      } else if (section.name.toLowerCase() === 'empfehlung' || section.name.toLowerCase() === 'recommendation') {
        result.recommendations = section.content;
      } else if (section.name.toLowerCase() === 'technik' || section.name.toLowerCase() === 'technique') {
        result.technicalDetails = section.content;
      }
    }
    
    // Create training examples
    result.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    result.sections = {
      exactSections: exactSections,
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return result;
  }
`;

// Update each agent
agentsToUpdate.forEach(agentFile => {
  const filePath = path.join(__dirname, agentFile);
  
  if (fs.existsSync(filePath)) {
    console.log(`Updating ${agentFile}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already updated
    if (content.includes('exact text extraction')) {
      console.log(`  Already updated, skipping.`);
      return;
    }
    
    // Find the parseReport method and comment it out
    const parseReportRegex = /(\s*\/\*\*[\s\S]*?\*\/\s*)?async parseReport\([\s\S]*?\n  \}/;
    
    if (parseReportRegex.test(content)) {
      // Replace the parseReport method
      content = content.replace(parseReportRegex, updateTemplate);
      
      // Write back
      fs.writeFileSync(filePath, content);
      console.log(`  ✓ Updated successfully!`);
    } else {
      console.log(`  ⚠ Could not find parseReport method.`);
    }
  } else {
    console.log(`File not found: ${agentFile}`);
  }
});

console.log('\nDone!');