#!/usr/bin/env node

/**
 * Fix all agent files to use exact text extraction properly
 */

const fs = require('fs');
const path = require('path');

const agents = [
  {
    name: 'pathology-agent.js',
    className: 'PathologyAgent',
    type: 'pathology'
  },
  {
    name: 'cardiac-agent.js',
    className: 'CardiacAgent',
    type: 'cardiac'
  },
  {
    name: 'oncology-agent.js',
    className: 'OncologyAgent',
    type: 'oncology'
  },
  {
    name: 'ultrasound-agent.js',
    className: 'UltrasoundAgent',
    type: 'ultrasound'
  }
];

const template = (className, type) => `/**
 * ${className.replace('Agent', '')} Report Agent
 * Handles ${type} reports with exact text extraction
 */

const SpecializedAgent = require('./base-agent');

class ${className} extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('${type}', multiLLMService);
  }

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
}

module.exports = ${className};`;

// Fix each agent
agents.forEach(({ name, className, type }) => {
  const filePath = path.join(__dirname, name);
  const content = template(className, type);
  
  console.log(`Fixing ${name}...`);
  fs.writeFileSync(filePath, content);
  console.log(`✓ Fixed ${name}`);
});

console.log('\nAll agents fixed!');