const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

/**
 * Report Analyzer - Analyzes medical reports to identify patterns and types
 */
class ReportAnalyzer {
  constructor() {
    this.reportTypes = new Map();
    this.sectionPatterns = new Map();
    this.statistics = {
      total: 0,
      byType: {},
      byLanguage: {},
      sectionFrequency: {}
    };
  }

  /**
   * Load and analyze Excel file
   */
  async loadExcelData(filePath) {
    console.log('Loading Excel file:', filePath);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`Loaded ${data.length} records from Excel`);
      
      return data;
    } catch (error) {
      console.error('Error loading Excel file:', error);
      throw error;
    }
  }

  /**
   * Analyze reports to identify patterns
   */
  async analyzeReports(reports, sampleSize = 10000) {
    console.log(`Analyzing ${Math.min(sampleSize, reports.length)} reports...`);
    
    const sample = reports.slice(0, sampleSize);
    
    for (const report of sample) {
      this.statistics.total++;
      
      // Get report text from ReportText field
      const reportText = report.ReportText || report.report || report.text || report.befund || '';
      
      if (!reportText) continue;
      
      // Detect report type
      const reportType = this.detectReportType(reportText);
      this.statistics.byType[reportType] = (this.statistics.byType[reportType] || 0) + 1;
      
      // Extract sections
      const sections = this.extractSections(reportText);
      for (const section of sections) {
        this.statistics.sectionFrequency[section] = (this.statistics.sectionFrequency[section] || 0) + 1;
      }
      
      // Store pattern examples
      if (!this.reportTypes.has(reportType)) {
        this.reportTypes.set(reportType, []);
      }
      
      const examples = this.reportTypes.get(reportType);
      if (examples.length < 10) {
        examples.push({
          text: reportText.substring(0, 500) + '...',
          sections: sections
        });
      }
    }
    
    return this.generateAnalysisReport();
  }

  /**
   * Detect report type based on content
   */
  detectReportType(text) {
    const textLower = text.toLowerCase();
    
    // Mammography
    if (textLower.includes('mammographie') && textLower.includes('birads')) {
      return 'mammography';
    }
    
    // Spine MRI
    if (/[lbh]wk\s*\d+/i.test(text) && (textLower.includes('mrt') || textLower.includes('bandscheibe'))) {
      return 'spine_mri';
    }
    
    // Oncology/Radiotherapy
    if (textLower.includes('strahlentherapie') || textLower.includes('chemotherapie') || 
        textLower.includes('radiotherapie')) {
      return 'oncology';
    }
    
    // Cardiac
    if (textLower.includes('herzecho') || textLower.includes('ekg') || 
        textLower.includes('koronar') || textLower.includes('myokard')) {
      return 'cardiac';
    }
    
    // Pathology
    if (textLower.includes('histologie') || textLower.includes('zytologie') || 
        textLower.includes('immunhistochemie')) {
      return 'pathology';
    }
    
    // CT
    if (textLower.includes('computertomographie') || textLower.includes(' ct ')) {
      return 'ct_scan';
    }
    
    // Ultrasound
    if (textLower.includes('sonographie') || textLower.includes('ultraschall')) {
      return 'ultrasound';
    }
    
    // General MRI
    if (textLower.includes('mrt') || textLower.includes('magnetresonanz')) {
      return 'mri_general';
    }
    
    return 'general_radiology';
  }

  /**
   * Extract section headers from report
   */
  extractSections(text) {
    const sections = [];
    
    // Common German medical report section keywords
    const knownSections = [
      'Klinische Angaben', 'Klinische Information', 'Klinik',
      'Anamnese', 'Fragestellung', 
      'Technik', 'Methode', 'Untersuchungstechnik',
      'Befund', 'Befunde', 'Findings',
      'Beurteilung', 'Zusammenfassung', 'Impression', 'Diagnose',
      'Empfehlung', 'Empfehlungen', 'Procedere',
      'Vergleich', 'Voraufnahmen',
      'Bemerkung', 'Bemerkungen', 'Hinweis', 'Hinweise'
    ];
    
    // Look for known sections
    for (const section of knownSections) {
      const pattern = new RegExp(`${section}[:\\s]`, 'gi');
      if (pattern.test(text)) {
        sections.push(section);
      }
    }
    
    // Also try to extract sections with colon pattern
    const colonPattern = /^([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ\s]+):\s*/gm;
    const matches = text.matchAll(colonPattern);
    
    for (const match of matches) {
      const section = match[1].trim();
      // Filter out noise
      if (section.length > 2 && 
          section.length < 50 && 
          !section.match(/^\d/) && // Not starting with number
          !section.includes('Dr.') && // Not doctor names
          !section.includes('med.') &&
          !section.includes('XXX')) {
        sections.push(section);
      }
    }
    
    return [...new Set(sections)]; // Remove duplicates
  }

  /**
   * Generate analysis report
   */
  generateAnalysisReport() {
    const report = {
      summary: {
        totalReports: this.statistics.total,
        reportTypes: Object.keys(this.statistics.byType).length,
        mostCommonType: this.getMostCommon(this.statistics.byType),
        uniqueSections: Object.keys(this.statistics.sectionFrequency).length
      },
      reportTypeDistribution: this.statistics.byType,
      topSections: this.getTopItems(this.statistics.sectionFrequency, 20),
      reportTypeExamples: {}
    };
    
    // Add examples for each report type
    for (const [type, examples] of this.reportTypes.entries()) {
      report.reportTypeExamples[type] = {
        count: this.statistics.byType[type],
        percentage: ((this.statistics.byType[type] / this.statistics.total) * 100).toFixed(2) + '%',
        exampleSections: this.extractCommonSections(examples)
      };
    }
    
    return report;
  }

  /**
   * Get most common item from frequency map
   */
  getMostCommon(frequencyMap) {
    let maxCount = 0;
    let mostCommon = null;
    
    for (const [item, count] of Object.entries(frequencyMap)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }
    
    return { item: mostCommon, count: maxCount };
  }

  /**
   * Get top N items from frequency map
   */
  getTopItems(frequencyMap, n = 10) {
    return Object.entries(frequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([item, count]) => ({ item, count, percentage: ((count / this.statistics.total) * 100).toFixed(2) + '%' }));
  }

  /**
   * Extract common sections from examples
   */
  extractCommonSections(examples) {
    const sectionCounts = {};
    
    for (const example of examples) {
      for (const section of example.sections) {
        sectionCounts[section] = (sectionCounts[section] || 0) + 1;
      }
    }
    
    return Object.entries(sectionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([section]) => section);
  }

  /**
   * Save analysis results
   */
  async saveAnalysis(outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report-analysis-${timestamp}.json`;
    const fullPath = path.join(outputPath, filename);
    
    await fs.writeFile(fullPath, JSON.stringify(this.generateAnalysisReport(), null, 2));
    console.log(`Analysis saved to: ${fullPath}`);
    
    return fullPath;
  }
}

// Export for use
module.exports = ReportAnalyzer;

// Run analysis if called directly
if (require.main === module) {
  async function main() {
    const analyzer = new ReportAnalyzer();
    
    try {
      // Load data
      const dataPath = path.join(__dirname, 'data', 'originaldata.xls');
      console.log('Looking for data file at:', dataPath);
      
      const reports = await analyzer.loadExcelData(dataPath);
      
      // Analyze reports
      const analysis = await analyzer.analyzeReports(reports);
      
      // Save results
      await analyzer.saveAnalysis(path.join(__dirname, 'data'));
      
      // Print summary
      console.log('\n=== Analysis Summary ===');
      console.log(JSON.stringify(analysis.summary, null, 2));
      
      console.log('\n=== Report Type Distribution ===');
      for (const [type, count] of Object.entries(analysis.reportTypeDistribution)) {
        const percentage = ((count / analysis.summary.totalReports) * 100).toFixed(2);
        console.log(`${type}: ${count} (${percentage}%)`);
      }
      
    } catch (error) {
      console.error('Analysis failed:', error);
      process.exit(1);
    }
  }

  main();
}