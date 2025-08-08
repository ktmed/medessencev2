#!/usr/bin/env node

/**
 * Analyze medical reports from Excel file
 * This script will help understand the structure of your 190k patient reports
 */

const ReportAnalyzer = require('./report-analyzer');
const path = require('path');
const fs = require('fs').promises;

async function main() {
  console.log('=== Medical Report Analysis Tool ===\n');
  
  const analyzer = new ReportAnalyzer();
  const dataPath = path.join(__dirname, 'data', 'originaldata.xlsx');
  
  // Check if file exists
  try {
    await fs.access(dataPath);
    console.log('✓ Found data file:', dataPath);
  } catch (error) {
    console.error('✗ Data file not found at:', dataPath);
    console.log('\nPlease place your originaldata.xls file in the data/ directory');
    process.exit(1);
  }
  
  try {
    // Load data
    console.log('\nLoading Excel data...');
    const reports = await analyzer.loadExcelData(dataPath);
    console.log(`✓ Loaded ${reports.length} reports\n`);
    
    // Show sample of data structure
    if (reports.length > 0) {
      console.log('Sample data structure:');
      console.log('Fields found:', Object.keys(reports[0]));
      console.log('\nFirst report sample:');
      console.log('ExamDescription:', reports[0].ExamDescription);
      console.log('ReportText length:', reports[0].ReportText?.length || 0);
      console.log('ReportText preview:', reports[0].ReportText?.substring(0, 200) || 'No text');
      console.log('\n');
    }
    
    // Analyze reports
    console.log('Analyzing report patterns (this may take a few minutes)...');
    const analysis = await analyzer.analyzeReports(reports, 10000); // Analyze first 10k
    
    // Save detailed analysis
    const outputPath = await analyzer.saveAnalysis(path.join(__dirname, 'data'));
    console.log(`\n✓ Detailed analysis saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n=== Analysis Summary ===');
    console.log(`Total Reports Analyzed: ${analysis.summary.totalReports}`);
    console.log(`Report Types Found: ${analysis.summary.reportTypes}`);
    console.log(`Most Common Type: ${analysis.summary.mostCommonType.item} (${analysis.summary.mostCommonType.count} reports)`);
    console.log(`Unique Section Headers: ${analysis.summary.uniqueSections}`);
    
    // Report type distribution
    console.log('\n=== Report Type Distribution ===');
    for (const [type, count] of Object.entries(analysis.reportTypeDistribution)) {
      const percentage = ((count / analysis.summary.totalReports) * 100).toFixed(2);
      console.log(`${type.padEnd(20)} ${count.toString().padStart(6)} (${percentage}%)`);
    }
    
    // Top section headers
    console.log('\n=== Most Common Section Headers ===');
    analysis.topSections.forEach((section, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${section.item.padEnd(30)} ${section.count} (${section.percentage})`);
    });
    
    // Example sections by report type
    console.log('\n=== Common Sections by Report Type ===');
    for (const [type, info] of Object.entries(analysis.reportTypeExamples)) {
      if (info.exampleSections.length > 0) {
        console.log(`\n${type}: ${info.count} reports (${info.percentage})`);
        console.log('  Common sections:', info.exampleSections.join(', '));
      }
    }
    
    console.log('\n✓ Analysis complete!');
    
  } catch (error) {
    console.error('\n✗ Analysis failed:', error.message);
    console.error('\nPlease check that your Excel file has the correct format.');
    console.error('Expected columns might include: report, text, befund, or similar.');
    process.exit(1);
  }
}

// Run the analysis
main().catch(console.error);