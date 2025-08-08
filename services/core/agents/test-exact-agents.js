#!/usr/bin/env node

/**
 * Test script to verify all agents use exact text extraction
 */

const fs = require('fs');
const path = require('path');

// Import agents
const CTScanAgent = require('./ct-scan-agent');
const SpineMRIAgent = require('./spine-mri-agent');
const MammographyAgent = require('./mammography-agent');
const GeneralAgent = require('./general-agent');
const PathologyAgent = require('./pathology-agent');
const CardiacAgent = require('./cardiac-agent');
const OncologyAgent = require('./oncology-agent');
const UltrasoundAgent = require('./ultrasound-agent');

// Sample report for testing
const sampleReport = `
Klinik und rechtfertigende Indikation: Rückenschmerzen, V.a. Bandscheibenvorfall

Technik: MRT der LWS, 1.5 Tesla, T1 und T2 gewichtete Sequenzen in sagittaler und axialer Schnittführung.

Befund: LWK 5/SWK 1 mit breitbasiger Bandscheibenprotrusion, die zu einer mittelgradigen Spinalkanalstenose führt. Keine Nervenwurzelkompression nachweisbar. Die übrigen Bandscheibenfächer zeigen sich regelrecht.

Beurteilung: Mittelgradige Spinalkanalstenose bei LWK 5/SWK 1 durch Bandscheibenprotrusion. Kein Nachweis einer Nervenwurzelkompression.

Empfehlung: Bei persistierenden Beschwerden ggf. neurochirurgische Vorstellung zur Besprechung der Therapieoptionen.
`;

async function testAgent(AgentClass, agentName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${agentName}`);
  console.log('='.repeat(80));
  
  try {
    const agent = new AgentClass();
    const result = await agent.parseReport(sampleReport);
    
    console.log('\n✓ Agent initialized successfully');
    console.log(`✓ Report type: ${result.type}`);
    console.log(`✓ Exact sections found: ${result.exactSections?.length || 0}`);
    console.log(`✓ Training examples created: ${result.trainingExamples?.length || 0}`);
    
    // Check if exact text extraction is used
    if (result.exactSections && result.exactSections.length > 0) {
      console.log('\n✅ Using exact text extraction!');
      
      // Verify sections
      result.exactSections.forEach(section => {
        console.log(`\n  Section: ${section.name}`);
        console.log(`  Position: ${section.startPos}-${section.endPos}`);
        console.log(`  Content length: ${section.content.length} chars`);
        
        // Verify exact match
        const extractedText = sampleReport.substring(section.startPos, section.endPos);
        if (extractedText.includes(section.content)) {
          console.log('  ✓ Exact text match verified');
        } else {
          console.log('  ✗ Text mismatch!');
        }
      });
    } else {
      console.log('\n❌ Not using exact text extraction or no sections found');
    }
    
    // Check training examples
    if (result.trainingExamples && result.trainingExamples.length > 0) {
      console.log('\nTraining examples:');
      result.trainingExamples.forEach((example, i) => {
        console.log(`\n  Example ${i + 1}:`);
        console.log(`  Instruction: ${example.instruction}`);
        console.log(`  Output in input: ${example.validation?.outputInInput || false}`);
      });
    }
    
  } catch (error) {
    console.log(`\n❌ Error testing ${agentName}:`, error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing All Medical Report Agents with Exact Text Extraction');
  
  // Test all agents
  await testAgent(CTScanAgent, 'CT Scan Agent');
  await testAgent(SpineMRIAgent, 'Spine MRI Agent');
  await testAgent(MammographyAgent, 'Mammography Agent');
  await testAgent(GeneralAgent, 'General Agent');
  await testAgent(PathologyAgent, 'Pathology Agent');
  await testAgent(CardiacAgent, 'Cardiac Agent');
  await testAgent(OncologyAgent, 'Oncology Agent');
  await testAgent(UltrasoundAgent, 'Ultrasound Agent');
  
  console.log('\n\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error);