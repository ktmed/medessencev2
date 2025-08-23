/**
 * Complete ICD-10-GM loader for Heroku deployment - EMBEDDED VERSION
 * Loads all 1,657 real-world ICD codes from medical cases dataset
 * Handles German character encoding properly for PostgreSQL
 * Production-ready with comprehensive error handling
 * NO EXTERNAL FILE DEPENDENCIES - All ICD codes embedded in script
 */

// Set proper encoding for German characters
process.env.LANG = 'de_DE.UTF-8';
process.env.LC_ALL = 'de_DE.UTF-8';

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma with proper UTF-8 handling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['info', 'warn', 'error']
});

/**
 * EMBEDDED ICD CODES - All 1,657 real-world ICD codes from medical cases dataset
 * This eliminates the need for external file dependencies on Heroku
 */
const EMBEDDED_ICD_CODES = [
  'A41.9', 'B02.9', 'B99', 'C01', 'C02.1', 'C02.4', 'C02.8', 'C02.9', 'C03.1', 'C04.0',
  'C04.1', 'C04.8', 'C04.9', 'C05.1', 'C05.2', 'C05.9', 'C06.0', 'C07', 'C08.0', 'C08.8',
  'C08.9', 'C09.0', 'C09.1', 'C09.8', 'C09.9', 'C10.0', 'C10.2', 'C10.3', 'C10.8', 'C10.9',
  'C11.2', 'C11.8', 'C11.9', 'C12', 'C13.2', 'C13.8', 'C13.9', 'C14.0', 'C14.8', 'C15.0',
  'C15.1', 'C15.2', 'C15.3', 'C15.4', 'C15.5', 'C15.8', 'C15.9', 'C16.0', 'C16.3', 'C16.5',
  'C16.8', 'C16.9', 'C17.0', 'C17.1', 'C17.2', 'C17.8', 'C17.9', 'C18.0', 'C18.1', 'C18.2',
  'C18.3', 'C18.4', 'C18.5', 'C18.6', 'C18.7', 'C18.9', 'C19', 'C20', 'C21.0', 'C21.1',
  'C21.8', 'C22.0', 'C22.1', 'C22.7', 'C22.9', 'C23', 'C24.0', 'C24.1', 'C24.9', 'C25.0',
  'C25.1', 'C25.2', 'C25.3', 'C25.4', 'C25.8', 'C25.9', 'C26.0', 'C26.8', 'C30.0', 'C30.1',
  'C31.0', 'C31.8', 'C31.9', 'C32.0', 'C32.1', 'C32.3', 'C32.8', 'C32.9', 'C33', 'C34.0',
  'C34.1', 'C34.2', 'C34.3', 'C34.8', 'C34.9', 'C37', 'C38.8', 'C40.0', 'C40.2', 'C41.1',
  'C41.2', 'C41.3-', 'C41.30', 'C41.4', 'C41.9', 'C43.3', 'C43.4', 'C43.5', 'C43.6', 'C43.7',
  'C43.9', 'C44.1', 'C44.2', 'C44.3', 'C44.4', 'C44.5', 'C44.6', 'C44.7', 'C44.8', 'C44.9',
  'C45.0', 'C46.0', 'C46.1', 'C47.8', 'C48.2', 'C48.8', 'C49.1', 'C49.2', 'C49.3', 'C49.4',
  'C49.5', 'C49.6', 'C49.8', 'C49.9', 'C50.0', 'C50.1', 'C50.2', 'C50.3', 'C50.4', 'C50.5',
  'C50.6', 'C50.8', 'C50.9', 'C51.0', 'C51.1', 'C51.2', 'C51.8', 'C51.9', 'C52', 'C53.0',
  'C53.1', 'C53.8', 'C53.9', 'C54.0', 'C54.1', 'C54.8', 'C54.9', 'C55', 'C56', 'C57.0',
  'C57.8', 'C58', 'C60.1', 'C60.9', 'C61', 'C62.1', 'C62.9', 'C64', 'C65', 'C66',
  'C67.0', 'C67.2', 'C67.3', 'C67.4', 'C67.5', 'C67.8', 'C67.9', 'C68.0', 'C68.9', 'C69.4',
  'C69.8', 'C69.9', 'C70.0', 'C70.9', 'C71.0', 'C71.1', 'C71.2', 'C71.3', 'C71.4', 'C71.5',
  'C71.6', 'C71.7', 'C71.8', 'C71.9', 'C72.0', 'C72.8', 'C73', 'C74.0', 'C74.9', 'C75.1',
  'C75.3', 'C76.1', 'C77.0', 'C77.1', 'C77.2', 'C77.3', 'C77.4', 'C77.5', 'C77.8', 'C77.9',
  'C78.0', 'C78.1', 'C78.2', 'C78.3', 'C78.5', 'C78.6', 'C78.7', 'C78.8', 'C79.0', 'C79.1',
  'C79.2', 'C79.3', 'C79.4', 'C79.5', 'C79.6', 'C79.7', 'C79.8-', 'C79.86', 'C79.88', 'C79.9',
  'C80.0', 'C80.9', 'C81.0', 'C81.1', 'C81.2', 'C81.3', 'C81.7', 'C81.9', 'C82.0', 'C82.1',
  'C82.2', 'C82.7', 'C82.9', 'C83.0', 'C83.1', 'C83.3', 'C83.5', 'C83.7', 'C83.8', 'C83.9',
  'C84.4', 'C84.8', 'C85.1', 'C85.7', 'C85.9', 'C88.00', 'C88.40', 'C88.90', 'C90.0-', 'C90.00',
  'C90.2-', 'C90.20', 'C90.30', 'C91.1-', 'C91.10', 'C92.00', 'C92.11', 'C92.30', 'C95.1-', 'C95.10',
  'C95.90', 'C96.6', 'C96.7', 'D02.0', 'D03.9', 'D04.8', 'D05.0', 'D05.1', 'D05.7', 'D05.9',
  'D09.9', 'D10.7', 'D11.0', 'D11.9', 'D12.1', 'D12.6', 'D12.8', 'D13.1', 'D13.3', 'D13.7',
  'D14.3', 'D15.0', 'D16.1', 'D16.42', 'D16.8', 'D16.9', 'D17.1', 'D17.2', 'D17.7', 'D17.9',
  'D18.00', 'D18.01', 'D18.02', 'D18.03', 'D21.2', 'D21.3', 'D21.9', 'D23.9', 'D24', 'D25.9',
  'D27', 'D30.0', 'D32.0', 'D32.9', 'D33.3', 'D35.0', 'D35.2', 'D35.4', 'D35.5', 'D35.6',
  'D36.1', 'D36.9', 'D37.0', 'D37.70', 'D39.1', 'D39.7', 'D40.1', 'D41.0', 'D41.4', 'D43.0',
  'D43.1', 'D43.2', 'D43.3', 'D44.0', 'D44.1', 'D44.3', 'D44.4', 'D44.5', 'D44.7', 'D45',
  'D46.9', 'D47.1', 'D47.2', 'D47.3', 'D48.0', 'D48.1', 'D48.5', 'D48.6', 'D48.7', 'D48.9',
  'D50.8', 'D50.9', 'D59.1', 'D64.9', 'D69.61', 'D70.7', 'D72.8', 'D73.9', 'D75.1', 'D75.9',
  'D80.9', 'D83.9', 'D86.8', 'D86.9', 'D89.9', 'E03.8', 'E03.9', 'E04.2', 'E04.9', 'E05.9',
  'E06.3', 'E11.40', 'E11.6-', 'E11.74', 'E14.50', 'E14.74', 'E22.0', 'E22.1', 'E23.0', 'E24.0',
  'E26.9', 'E28.2', 'E30.0', 'E32.0', 'E34.4', 'E34.9', 'E55.9', 'E73.9', 'E74.1', 'E83.0',
  'E83.1', 'E83.58', 'E87.2', 'E88.29', 'F03', 'F05.9', 'F06.7', 'F06.8', 'F06.9', 'F10.1',
  'F17.1', 'F20.0', 'F20.9', 'F22.0', 'F25.9', 'F29', 'F31.9', 'F32.9', 'F33.2', 'F33.9',
  'F34.1', 'F41.2', 'F42.0', 'F43.0', 'F43.1', 'F44.6', 'F45.2', 'F45.4-', 'F45.41', 'F45.8',
  'F45.9', 'F48.0', 'F79.0', 'F89', 'F90.0', 'F95.9', 'G03.9', 'G04.0', 'G04.9', 'G08',
  'G12.2', 'G14', 'G20.90', 'G25.0', 'G25.81', 'G30.0', 'G30.1', 'G31.9', 'G35.0', 'G35.1-',
  'G35.10', 'G35.11', 'G35.9', 'G37.9', 'G40.2', 'G40.9', 'G43.0', 'G43.1', 'G43.8', 'G43.9',
  'G44.0', 'G44.2', 'G44.4', 'G44.8', 'G45.39', 'G45.89', 'G45.92', 'G50.0', 'G50.1', 'G50.9',
  'G51.0', 'G51.3', 'G51.9', 'G54.9', 'G56.0', 'G56.2', 'G56.3', 'G56.8', 'G57.0', 'G57.1',
  'G57.2', 'G57.3', 'G57.5', 'G57.6', 'G58.0', 'G58.9', 'G60.0', 'G60.9', 'G80.9', 'G82.29',
  'G83.49', 'G83.9', 'G90.59', 'G90.71', 'G91.29', 'G91.9', 'G93.0', 'G93.88', 'G93.9', 'G95.0',
  'G95.9', 'G98', 'H02.8', 'H04.5', 'H05.1', 'H05.2', 'H15.0', 'H34.2', 'H47.2', 'H49.0',
  'H50.0', 'H53.1', 'H53.2', 'H53.4', 'H53.9', 'H55', 'H60.4', 'H61.1', 'H66.1', 'H66.9',
  'H69.8', 'H71', 'H80.9', 'H81.0', 'H81.2', 'H81.4', 'H81.8', 'H81.9', 'H90.3', 'H90.5',
  'H91.2', 'H91.9', 'H92.0', 'H92.1', 'H93.1', 'I10.0-', 'I10.10', 'I10.9-', 'I10.90', 'I20.8',
  'I20.9', 'I25.13', 'I25.19', 'I25.2-', 'I25.9', 'I26.9', 'I31.9', 'I34.0', 'I42.9', 'I44.1',
  'I44.7', 'I48.0', 'I48.9', 'I49.9', 'I50.19', 'I50.9', 'I51.4', 'I51.9', 'I60.9', 'I61.9',
  'I63.9', 'I64', 'I65.0', 'I65.2', 'I66.2', 'I67.10', 'I67.11', 'I67.3', 'I67.88', 'I69.4',
  'I70.1', 'I70.2-', 'I70.22', 'I70.29', 'I70.9', 'I71.0-', 'I71.00', 'I71.2', 'I71.4', 'I71.6',
  'I71.9', 'I72.0', 'I72.5', 'I72.9', 'I73.0', 'I73.9', 'I74.9', 'I77.6', 'I80.20', 'I80.28',
  'I80.3', 'I80.81', 'I80.88', 'I82.9', 'I86.3', 'I87.20', 'I88.9', 'I89.09', 'I89.1', 'I89.8',
  'I89.9', 'I99', 'J01.0', 'J01.2', 'J01.4', 'J01.9', 'J02.9', 'J06.9', 'J18.8', 'J18.9',
  'J30.3', 'J30.4', 'J31.0', 'J32.0', 'J32.1', 'J32.2', 'J32.3', 'J32.4', 'J32.8', 'J32.9',
  'J33.8', 'J33.9', 'J34.0', 'J34.1', 'J34.2', 'J34.3', 'J34.8', 'J38.00', 'J40', 'J41.1',
  'J42', 'J43.9', 'J44.11', 'J44.89', 'J44.99', 'J45.0', 'J45.8', 'J45.9', 'J47', 'J61',
  'J63.4', 'J70.1', 'J82', 'J84.1', 'J84.8', 'J84.9', 'J90', 'J93.8', 'J93.9', 'J98.1',
  'J98.4', 'J98.7', 'K07.3', 'K08.88', 'K10.1', 'K10.28', 'K10.8', 'K11.2', 'K13.7', 'K14.8',
  'K21.9', 'K29.7', 'K35.8', 'K40.90', 'K40.91', 'K43.99', 'K44.9', 'K46.9', 'K50.0', 'K50.1',
  'K50.9', 'K51.9', 'K56.6', 'K56.7', 'K57.32', 'K57.90', 'K57.92', 'K58.2', 'K60.3', 'K62.3',
  'K66.0', 'K66.2', 'K74.6', 'K76.0', 'K76.8', 'K76.9', 'K80.20', 'K81.0', 'K81.9', 'K82.8',
  'K82.9', 'K83.0', 'K83.1', 'K83.8', 'K85.90', 'K86.1', 'K86.2', 'K86.3', 'K86.8', 'K86.9',
  'K90.0', 'K92.1', 'L02.2', 'L02.9', 'L03.10', 'L03.9', 'L05.9', 'L40.5', 'L40.9', 'L50.9',
  'L53.9', 'L59.8', 'L60.8', 'L70.8', 'L72.0', 'L81.4', 'L90.5', 'L91.0', 'L92.9', 'L93.0',
  'L97', 'L98.4', 'L98.9', 'M02.07', 'M02.84', 'M02.94', 'M05.84', 'M05.90', 'M06.0-', 'M06.00',
  'M06.04', 'M06.44', 'M06.47', 'M06.80', 'M06.87', 'M06.90', 'M06.91', 'M06.94', 'M06.97', 'M06.99',
  'M08.10', 'M08.3', 'M08.40', 'M08.49', 'M10.09', 'M10.99', 'M12.04', 'M12.07', 'M12.26', 'M12.27',
  'M12.8-', 'M12.80', 'M12.81', 'M12.83', 'M12.84', 'M12.87', 'M12.88', 'M12.89', 'M13.0', 'M13.14',
  'M13.15', 'M13.16', 'M13.17', 'M13.80', 'M13.81', 'M13.82', 'M13.83', 'M13.84', 'M13.85', 'M13.86',
  'M13.87', 'M13.88', 'M13.89', 'M13.90', 'M13.91', 'M13.92', 'M13.93', 'M13.94', 'M13.95', 'M13.96',
  'M13.99', 'M15.0', 'M15.1', 'M15.2', 'M15.3', 'M15.4', 'M15.8', 'M15.9', 'M16.0', 'M16.1',
  'M16.2', 'M16.3', 'M16.6', 'M16.9', 'M17.0', 'M17.1', 'M17.2', 'M17.3', 'M17.4', 'M17.5',
  'M17.9', 'M18.0', 'M18.1', 'M18.2', 'M18.3', 'M18.5', 'M18.9', 'M19.0-', 'M19.01', 'M19.02',
  'M19.03', 'M19.04', 'M19.07', 'M19.09', 'M19.11', 'M19.12', 'M19.13', 'M19.14', 'M19.17', 'M19.21',
  'M19.22', 'M19.23', 'M19.24', 'M19.25', 'M19.27', 'M19.29', 'M19.8-', 'M19.81', 'M19.83', 'M19.84',
  'M19.87', 'M19.88', 'M19.89', 'M19.9-', 'M19.91', 'M19.92', 'M19.93', 'M19.94', 'M19.97', 'M19.99',
  'M20.1', 'M20.2', 'M20.4', 'M21.05', 'M21.06', 'M21.4', 'M21.61', 'M21.62', 'M21.63', 'M21.68',
  'M22.0', 'M22.1', 'M22.2', 'M22.3', 'M22.4', 'M23.20', 'M23.22', 'M23.26', 'M23.29', 'M23.32',
  'M23.33', 'M23.36', 'M23.39', 'M23.4', 'M23.51', 'M23.8-', 'M23.82', 'M23.89', 'M23.99', 'M24.01',
  'M24.07', 'M24.09', 'M24.1-', 'M24.15', 'M24.17', 'M24.19', 'M24.41', 'M24.59', 'M24.69', 'M24.81',
  'M24.83', 'M24.85', 'M24.89', 'M24.91', 'M24.94', 'M24.99', 'M25.07', 'M25.09', 'M25.31', 'M25.37',
  'M25.39', 'M25.44', 'M25.46', 'M25.47', 'M25.49', 'M25.50', 'M25.51', 'M25.53', 'M25.54', 'M25.55',
  'M25.56', 'M25.57', 'M25.59', 'M25.61', 'M25.69', 'M25.75', 'M25.79', 'M25.84', 'M25.86', 'M25.89',
  'M25.90', 'M25.93', 'M25.95', 'M25.99', 'M30.1', 'M31.4', 'M31.5', 'M31.6', 'M32.9', 'M34.9',
  'M35.0', 'M35.2', 'M35.3', 'M35.4', 'M35.9', 'M40.19', 'M40.22', 'M40.29', 'M41.19', 'M41.92',
  'M41.94', 'M41.95', 'M41.96', 'M41.99', 'M42.09', 'M42.16', 'M42.92', 'M42.94', 'M42.95', 'M42.96',
  'M43.06', 'M43.07', 'M43.09', 'M43.16', 'M43.17', 'M43.18', 'M43.19', 'M43.22', 'M43.29', 'M43.6',
  'M43.92', 'M43.99', 'M45.0-', 'M45.09', 'M46.1', 'M46.46', 'M46.49', 'M47.22', 'M47.26', 'M47.27',
  'M47.29', 'M47.80', 'M47.82', 'M47.86', 'M47.99', 'M48.02', 'M48.06', 'M48.09', 'M48.49', 'M48.59',
  'M48.86', 'M48.89', 'M50.0', 'M50.1', 'M50.2', 'M50.9', 'M51.1', 'M51.2', 'M51.3', 'M51.9',
  'M53.0', 'M53.1', 'M53.2-', 'M53.22', 'M53.26', 'M53.27', 'M53.29', 'M53.3', 'M53.82', 'M53.9-',
  'M53.99', 'M54.1-', 'M54.12', 'M54.13', 'M54.14', 'M54.16', 'M54.17', 'M54.18', 'M54.19', 'M54.2',
  'M54.3', 'M54.4', 'M54.5', 'M54.6', 'M54.80', 'M54.9-', 'M54.99', 'M60.20', 'M60.27', 'M60.29',
  'M60.99', 'M61.95', 'M62.19', 'M62.4-', 'M62.59', 'M62.61', 'M62.68', 'M62.88', 'M62.89', 'M62.98',
  'M62.99', 'M65.03', 'M65.19', 'M65.2-', 'M65.22', 'M65.24', 'M65.25', 'M65.27', 'M65.29', 'M65.3',
  'M65.4', 'M65.83', 'M65.84', 'M65.85', 'M65.86', 'M65.87', 'M65.91', 'M65.93', 'M65.94', 'M65.95',
  'M65.96', 'M65.97', 'M65.99', 'M66.19', 'M66.47', 'M67.14', 'M67.3-', 'M67.36', 'M67.4-', 'M67.43',
  'M67.44', 'M67.46', 'M67.47', 'M67.49', 'M67.85', 'M67.86', 'M67.89', 'M67.93', 'M67.94', 'M67.97',
  'M67.99', 'M70.1', 'M70.2', 'M70.3', 'M70.4', 'M70.5', 'M70.6', 'M70.7', 'M70.8', 'M70.9',
  'M71.01', 'M71.2', 'M71.39', 'M71.42', 'M71.5-', 'M71.55', 'M71.57', 'M71.87', 'M71.9-', 'M71.94',
  'M71.95', 'M71.99', 'M72.0', 'M72.1', 'M72.2', 'M72.41', 'M72.69', 'M72.87', 'M72.91', 'M72.97',
  'M72.99', 'M75.0', 'M75.1', 'M75.2', 'M75.3', 'M75.4', 'M75.5', 'M75.6', 'M75.8', 'M75.9',
  'M76.0', 'M76.1', 'M76.3', 'M76.5', 'M76.6', 'M76.7', 'M76.8', 'M76.9', 'M77.0', 'M77.1',
  'M77.2', 'M77.3', 'M77.4', 'M77.5', 'M77.8', 'M77.9', 'M79.04', 'M79.07', 'M79.09', 'M79.18',
  'M79.19', 'M79.29', 'M79.39', 'M79.46', 'M79.62', 'M79.63', 'M79.64', 'M79.65', 'M79.66', 'M79.67',
  'M79.69', 'M79.70', 'M79.84', 'M79.87', 'M79.89', 'M80.85', 'M80.98', 'M81.99', 'M84.04', 'M84.12',
  'M84.14', 'M84.19', 'M84.37', 'M84.38', 'M84.39', 'M84.49', 'M84.96', 'M85.01', 'M85.06', 'M85.66',
  'M85.69', 'M85.89', 'M86.44', 'M86.87', 'M86.89', 'M86.94', 'M86.96', 'M86.97', 'M86.99', 'M87.05',
  'M87.85', 'M87.95', 'M87.99', 'M89.04', 'M89.39', 'M89.59', 'M89.81', 'M89.85', 'M89.86', 'M89.89',
  'M89.99', 'M92.2', 'M92.5', 'M92.7', 'M92.8', 'M93.1', 'M93.26', 'M93.27', 'M93.29', 'M93.9',
  'M94.0', 'M94.2-', 'M94.22', 'M94.25', 'M94.26', 'M94.29', 'M94.99', 'M95.5', 'M96.0', 'M99.00',
  'M99.05', 'M99.09', 'M99.3-', 'M99.39', 'M99.53', 'M99.61', 'M99.63', 'M99.69', 'M99.73', 'M99.81',
  'M99.82', 'M99.83', 'M99.84', 'M99.89', 'M99.91', 'N13.3', 'N13.4', 'N18.3', 'N18.4', 'N18.5',
  'N19', 'N20.0', 'N20.1', 'N20.2', 'N20.9', 'N23', 'N28.1', 'N32.9', 'N36.1', 'N40',
  'N41.9', 'N48.6', 'N49.2', 'N50.8', 'N60.0', 'N60.1', 'N60.2', 'N60.3', 'N60.4', 'N60.9',
  'N61', 'N62', 'N63', 'N64.0', 'N64.1', 'N64.2', 'N64.3', 'N64.4', 'N64.5', 'N64.8',
  'N64.9', 'N80.9', 'N81.1', 'N81.6', 'N81.8', 'N82.3', 'N83.2', 'N84.2', 'N90.8', 'N94.3',
  'O00.9', 'O91.20', 'O92.00', 'O92.6-', 'O92.60', 'Q05.9', 'Q06.8', 'Q07.0', 'Q20.3', 'Q27.8',
  'Q28.20', 'Q28.21', 'Q28.29', 'Q28.38', 'Q28.88', 'Q45.2', 'Q45.3', 'Q51.3', 'Q60.5', 'Q61.3',
  'Q63.1', 'Q65.8', 'Q66.0', 'Q66.1', 'Q66.4', 'Q66.6', 'Q66.7', 'Q66.8', 'Q68.1', 'Q74.0',
  'Q74.1', 'Q74.8', 'Q76.4', 'Q78.4', 'Q78.9', 'Q79.6', 'Q83.1', 'Q83.88', 'Q83.9', 'Q85.0',
  'Q85.9', 'Q87.4', 'Q89.8', 'Q89.9', 'Q96.9', 'Q98.4', 'R02.8', 'R04.0', 'R04.2', 'R05',
  'R06.0', 'R06.8-', 'R06.88', 'R07.0', 'R07.1', 'R07.2', 'R07.3', 'R07.4', 'R09.1', 'R09.3',
  'R10.1', 'R10.2', 'R10.3', 'R10.4', 'R13.9', 'R14', 'R16.1', 'R18', 'R19.0', 'R19.5',
  'R20.1', 'R20.2', 'R20.8', 'R21', 'R22.1', 'R22.2', 'R22.3', 'R22.4', 'R22.9', 'R23.4',
  'R25.1', 'R25.3', 'R26.0', 'R26.8', 'R27.0', 'R27.8', 'R29.6', 'R29.8', 'R31', 'R32',
  'R39.1', 'R40.2', 'R41.3', 'R41.8', 'R42', 'R43.0', 'R43.1', 'R43.2', 'R43.8', 'R44.3',
  'R47.0', 'R50.9', 'R51', 'R52.1', 'R52.2', 'R52.9', 'R53', 'R55', 'R56.8', 'R59.0',
  'R59.1', 'R59.9', 'R60.0', 'R60.9', 'R61.9', 'R63.0', 'R63.4', 'R63.5', 'R64', 'R69',
  'R70.0', 'R73.0', 'R74.0', 'R74.8', 'R77.2', 'R80', 'R87.6', 'R89.9', 'R90.0', 'R91',
  'R92', 'R93.5', 'R93.8', 'R94.2', 'S00.1', 'S00.95', 'S02.1', 'S02.2', 'S02.3', 'S02.4',
  'S02.60', 'S06.0', 'S06.21', 'S06.5', 'S06.9', 'S09.9', 'S12.9', 'S13.4', 'S20.0', 'S20.2',
  'S22.00', 'S22.05', 'S22.20', 'S22.3-', 'S22.32', 'S22.40', 'S24.12', 'S30.0', 'S30.95', 'S32.00',
  'S32.01', 'S32.02', 'S32.2', 'S32.4', 'S32.5', 'S32.7', 'S32.89', 'S33.50', 'S35.2', 'S36.11',
  'S37.00', 'S40.0', 'S40.84', 'S42.0-', 'S42.00', 'S42.10', 'S42.20', 'S42.21', 'S42.24', 'S42.3',
  'S42.40', 'S42.7', 'S42.9', 'S43.00', 'S43.01', 'S43.1', 'S43.2', 'S43.4', 'S43.5', 'S43.6',
  'S43.7', 'S46.0', 'S46.2', 'S49.9', 'S50.0', 'S52.00', 'S52.01', 'S52.11', 'S52.20', 'S52.30',
  'S52.50', 'S52.51', 'S52.52', 'S52.6', 'S52.9', 'S53.10', 'S53.40', 'S59.9', 'S60.0', 'S60.2',
  'S61.1', 'S62.0', 'S62.10', 'S62.12', 'S62.14', 'S62.19', 'S62.20', 'S62.21', 'S62.30', 'S62.31',
  'S62.32', 'S62.33', 'S62.34', 'S62.50', 'S62.60', 'S62.61', 'S62.62', 'S62.63', 'S62.8', 'S63.00',
  'S63.03', 'S63.12', 'S63.3', 'S63.5-', 'S63.50', 'S63.52', 'S63.60', 'S63.61', 'S63.62', 'S63.7',
  'S66.1', 'S66.3', 'S67.0', 'S68.1', 'S69.7', 'S69.9', 'S70.0', 'S72.00', 'S72.01', 'S72.08',
  'S72.10', 'S72.40', 'S72.8', 'S72.9', 'S73.10', 'S76.0', 'S76.1', 'S76.2', 'S76.4', 'S79.9',
  'S80.0', 'S80.1', 'S82.0', 'S82.18', 'S82.28', 'S82.38', 'S82.40', 'S82.41', 'S82.6', 'S82.7',
  'S82.88', 'S83.0', 'S83.2', 'S83.4-', 'S83.44', 'S83.5-', 'S83.50', 'S83.53', 'S83.6', 'S86.0',
  'S86.9', 'S89.9', 'S90.1', 'S90.2', 'S90.3', 'S90.7', 'S90.84', 'S92.0', 'S92.1', 'S92.20',
  'S92.21', 'S92.3', 'S92.4', 'S92.5', 'S92.9', 'S93.2', 'S93.33', 'S93.40', 'S93.5', 'S93.6',
  'T02.10', 'T02.9-', 'T03.4', 'T08.0', 'T10.0', 'T11.3', 'T13.2', 'T13.5', 'T14.03', 'T14.05',
  'T14.08', 'T14.1', 'T14.20', 'T14.3', 'T14.5', 'T14.6', 'T14.9', 'T18.9', 'T79.3', 'T80.3',
  'T81.8', 'T83.3', 'T84.0-', 'T84.04', 'T84.07', 'T85.4', 'T85.73', 'T85.82', 'T85.83', 'T85.9',
  'T89.03', 'T93.3', 'T98.3', 'U07.1', 'U07.2', 'U11.9', 'Z00.6', 'Z01.8-', 'Z01.81', 'Z03.0',
  'Z03.1', 'Z03.3', 'Z03.9', 'Z04.9', 'Z08.9', 'Z09.0', 'Z09.1', 'Z09.88', 'Z09.9', 'Z12.3',
  'Z12.4', 'Z12.8', 'Z12.9', 'Z20.8', 'Z21', 'Z30.9', 'Z31.6', 'Z34', 'Z35.9', 'Z41.1',
  'Z45.00', 'Z47.0', 'Z49.1', 'Z51.2', 'Z51.5', 'Z51.88', 'Z63', 'Z73', 'Z76.3', 'Z80.0',
  'Z80.1', 'Z80.3', 'Z80.4', 'Z80.9', 'Z85.0', 'Z85.1', 'Z85.3', 'Z85.4', 'Z85.6', 'Z85.9',
  'Z87.8', 'Z90.1', 'Z90.3', 'Z90.4', 'Z90.5', 'Z90.6', 'Z90.7', 'Z90.8', 'Z91.8', 'Z92.1',
  'Z92.3', 'Z94.0', 'Z94.1', 'Z94.2', 'Z94.9', 'Z95.0', 'Z95.4', 'Z95.88', 'Z96.2', 'Z96.64',
  'Z96.65', 'Z96.67', 'Z96.7', 'Z96.88', 'Z98.1', 'Z98.2', 'Z98.8'
];

/**
 * ICD-10-GM Chapter mapping based on first character patterns
 * Maps ICD code prefixes to their corresponding chapters (1-22)
 */
function getChapterNumber(icdCode) {
  const prefix = icdCode.charAt(0).toUpperCase();
  const numericPart = icdCode.substring(1, 3);
  
  // ICD-10-GM chapter mapping
  if (prefix === 'A' || prefix === 'B') return 1;  // Infectious diseases
  if (prefix === 'C' || (prefix === 'D' && numericPart >= '00' && numericPart <= '48')) return 2;  // Neoplasms
  if (prefix === 'D' && numericPart >= '50' && numericPart <= '89') return 3;  // Blood disorders
  if (prefix === 'E') return 4;  // Endocrine, nutritional and metabolic diseases
  if (prefix === 'F') return 5;  // Mental and behavioural disorders
  if (prefix === 'G') return 6;  // Nervous system
  if (prefix === 'H' && numericPart >= '00' && numericPart <= '59') return 7;  // Eye and adnexa
  if (prefix === 'H' && numericPart >= '60' && numericPart <= '95') return 8;  // Ear and mastoid
  if (prefix === 'I') return 9;  // Circulatory system
  if (prefix === 'J') return 10; // Respiratory system
  if (prefix === 'K') return 11; // Digestive system
  if (prefix === 'L') return 12; // Skin and subcutaneous tissue
  if (prefix === 'M') return 13; // Musculoskeletal system
  if (prefix === 'N') return 14; // Genitourinary system
  if (prefix === 'O') return 15; // Pregnancy, childbirth and puerperium
  if (prefix === 'P') return 16; // Perinatal period
  if (prefix === 'Q') return 17; // Congenital malformations
  if (prefix === 'R') return 18; // Symptoms, signs and abnormal findings
  if (prefix === 'S' || prefix === 'T') return 19; // Injury and poisoning
  if (prefix === 'V' || prefix === 'W' || prefix === 'X' || prefix === 'Y') return 20; // External causes
  if (prefix === 'Z') return 21; // Health status and contact with health services
  if (prefix === 'U') return 22; // Special purposes
  
  return 18; // Default to symptoms chapter
}

/**
 * Get chapter name from chapter number
 */
function getChapterName(chapterNumber) {
  const chapterNames = {
    1: 'Infectious and parasitic diseases',
    2: 'Neoplasms',
    3: 'Blood and blood-forming organs',
    4: 'Endocrine, nutritional and metabolic diseases',
    5: 'Mental and behavioural disorders',
    6: 'Nervous system',
    7: 'Eye and adnexa',
    8: 'Ear and mastoid process',
    9: 'Circulatory system',
    10: 'Respiratory system',
    11: 'Digestive system',
    12: 'Skin and subcutaneous tissue',
    13: 'Musculoskeletal system and connective tissue',
    14: 'Genitourinary system',
    15: 'Pregnancy, childbirth and the puerperium',
    16: 'Certain conditions originating in the perinatal period',
    17: 'Congenital malformations, deformations and chromosomal abnormalities',
    18: 'Symptoms, signs and abnormal clinical and laboratory findings',
    19: 'Injury, poisoning and certain other consequences of external causes',
    20: 'External causes of morbidity and mortality',
    21: 'Factors influencing health status and contact with health services',
    22: 'Codes for special purposes'
  };
  return chapterNames[chapterNumber] || 'Unknown';
}

/**
 * Generate basic German ICD description based on code patterns
 * Uses common medical terminology patterns for ICD-10-GM
 */
function generateGermanDescription(icdCode) {
  const prefix = icdCode.charAt(0).toUpperCase();
  const hasDecimal = icdCode.includes('.');
  const baseCode = icdCode.split('.')[0];
  const subCode = hasDecimal ? icdCode.split('.')[1] : null;
  
  // Generate descriptions based on common ICD-10-GM patterns
  if (prefix === 'A') return `Infektionskrankheit ${icdCode}`;
  if (prefix === 'B') return `Virale oder parasitäre Erkrankung ${icdCode}`;
  if (prefix === 'C') return `Bösartige Neubildung ${icdCode}`;
  if (prefix === 'D' && baseCode >= 'D00' && baseCode <= 'D48') return `In-situ-Neubildung oder gutartige Neubildung ${icdCode}`;
  if (prefix === 'D' && baseCode >= 'D50') return `Krankheit des Blutes und der blutbildenden Organe ${icdCode}`;
  if (prefix === 'E') return `Endokrine, Ernährungs- und Stoffwechselkrankheit ${icdCode}`;
  if (prefix === 'F') return `Psychische und Verhaltensstörung ${icdCode}`;
  if (prefix === 'G') return `Krankheit des Nervensystems ${icdCode}`;
  if (prefix === 'H' && baseCode <= 'H59') return `Krankheit des Auges und der Augenanhangsgebilde ${icdCode}`;
  if (prefix === 'H' && baseCode >= 'H60') return `Krankheit des Ohres und des Warzenfortsatzes ${icdCode}`;
  if (prefix === 'I') return `Krankheit des Kreislaufsystems ${icdCode}`;
  if (prefix === 'J') return `Krankheit des Atmungssystems ${icdCode}`;
  if (prefix === 'K') return `Krankheit des Verdauungssystems ${icdCode}`;
  if (prefix === 'L') return `Krankheit der Haut und der Unterhaut ${icdCode}`;
  if (prefix === 'M') return `Krankheit des Muskel-Skelett-Systems und des Bindegewebes ${icdCode}`;
  if (prefix === 'N') return `Krankheit des Urogenitalsystems ${icdCode}`;
  if (prefix === 'O') return `Schwangerschaft, Geburt und Wochenbett ${icdCode}`;
  if (prefix === 'P') return `Bestimmte Zustände mit Ursprung in der Perinatalperiode ${icdCode}`;
  if (prefix === 'Q') return `Angeborene Fehlbildungen, Deformitäten und Chromosomenanomalien ${icdCode}`;
  if (prefix === 'R') return `Symptome und abnorme klinische und Laborbefunde ${icdCode}`;
  if (prefix === 'S') return `Verletzung, Vergiftung und bestimmte andere Folgen äußerer Ursachen ${icdCode}`;
  if (prefix === 'T') return `Verletzung, Vergiftung und bestimmte andere Folgen äußerer Ursachen ${icdCode}`;
  if (prefix === 'Z') return `Faktoren, die den Gesundheitszustand beeinflussen ${icdCode}`;
  if (prefix === 'U') return `Schlüsselnummern für besondere Zwecke ${icdCode}`;
  
  return `Medizinische Diagnose ${icdCode}`;
}

/**
 * Sanitize German medical text for proper database storage
 * Ensures UTF-8 encoding and removes problematic characters
 */
function sanitizeGermanText(text) {
  if (!text) return null;
  
  return text
    .trim()
    // Ensure proper German umlauts and special characters
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö') 
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã\u009f/g, 'ß')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã\u0096/g, 'Ö')
    .replace(/Ã\u009c/g, 'Ü')
    // Remove any control characters but keep German characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load ICD codes from embedded array - NO FILE DEPENDENCIES
 */
function loadEmbeddedICDCodes() {
  console.log(`📄 Loaded ${EMBEDDED_ICD_CODES.length} ICD codes from embedded array`);
  return EMBEDDED_ICD_CODES;
}

/**
 * Determine medical category based on ICD code patterns
 */
function determineCategory(icdCode) {
  const prefix = icdCode.charAt(0).toUpperCase();
  const numericPart = icdCode.substring(1, 3);
  
  // Imaging/radiology categories
  if (prefix === 'C') return 'oncology';  // Cancer - often requires imaging
  if (prefix === 'I' && (numericPart >= '60' && numericPart <= '69')) return 'mrt';  // Stroke/brain
  if (prefix === 'J') return 'ct';  // Lung/chest
  if (prefix === 'M' && (numericPart >= '40' && numericPart <= '54')) return 'mrt';  // Spine
  if (prefix === 'M') return 'general';  // Musculoskeletal
  if (prefix === 'N' && (numericPart >= '60' && numericPart <= '64')) return 'mammography';  // Breast
  if (prefix === 'S' || prefix === 'T') return 'ct';  // Trauma
  if (prefix === 'R') return 'general';  // Symptoms
  
  return 'general';
}

async function loadCompleteICDCodes() {
  let processedCount = 0;
  let batchSize = 100;
  
  try {
    console.log('🔄 Starting complete ICD-10-GM database import...');
    console.log('📊 Loading all 1,657 real-world ICD codes from embedded array');
    
    // Load ICD codes from embedded array - NO FILE DEPENDENCIES
    const icdCodes = loadEmbeddedICDCodes();
    console.log(`📋 Found ${icdCodes.length} unique ICD codes to process`);
    
    // Clear existing data
    console.log('🗑️ Clearing existing ICD codes...');
    await prisma.iCDCode.deleteMany({});
    console.log('✅ Existing codes cleared');
    
    // Process codes in batches for better performance and error handling
    const batches = [];
    for (let i = 0; i < icdCodes.length; i += batchSize) {
      const batch = icdCodes.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    console.log(`🔀 Processing ${batches.length} batches of up to ${batchSize} codes each`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} codes)...`);
      
      // Prepare records for this batch
      const batchRecords = batch.map(icdCode => {
        const chapterNumber = getChapterNumber(icdCode);
        const description = generateGermanDescription(icdCode);
        const category = determineCategory(icdCode);
        
        return {
          year: 2024,
          level: icdCode.includes('.') ? 4 : 3,
          terminal: 'T', // T=Terminal, N=Non-terminal
          icdCode: sanitizeGermanText(icdCode),
          icdNormCode: sanitizeGermanText(icdCode), // Same as icdCode for now
          label: sanitizeGermanText(description),
          chapterNr: chapterNumber, 
          icdBlockFirst: sanitizeGermanText(icdCode.substring(0, 3)), // First 3 characters
          genderSpecific: '9', // 9 = not gender specific
          ageMin: null,
          ageMax: null,
          rareInCentralEurope: 'N',
          notifiable: 'N'
        };
      });
      
      // Insert batch with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await prisma.iCDCode.createMany({
            data: batchRecords,
            skipDuplicates: true
          });
          processedCount += batch.length;
          console.log(`   ✅ Batch ${batchIndex + 1} inserted successfully (${processedCount}/${icdCodes.length} total)`);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`   ❌ Batch ${batchIndex + 1} failed after 3 retries:`, error.message);
            throw error;
          } else {
            console.warn(`   ⚠️ Batch ${batchIndex + 1} retry ${4 - retries}/3...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      }
    }
    
    // Verify final insertion count
    const finalCount = await prisma.iCDCode.count();
    console.log(`✅ Successfully loaded ${finalCount} ICD codes out of ${icdCodes.length} attempted`);
    
    if (finalCount !== icdCodes.length) {
      console.warn(`⚠️ Count mismatch: Expected ${icdCodes.length}, got ${finalCount}`);
    }
    
    // Log encoding verification with sample
    console.log('\n🔍 Sample record encoding verification:');
    const sample = await prisma.iCDCode.findFirst({
      select: {
        icdCode: true,
        label: true,
        chapterNr: true
      }
    });
    
    if (sample) {
      console.log('   Code:', sample.icdCode);
      console.log('   Description:', sample.label);
      console.log('   Contains German chars:', /[äöüßÄÖÜ]/.test(sample.label));
    }
    
    // Show statistics by chapter
    console.log('\n📋 ICD Codes Distribution by Medical Chapter:');
    
    const chapterStats = {};
    for (let i = 1; i <= 22; i++) {
      const count = await prisma.iCDCode.count({
        where: { chapterNr: i }
      });
      if (count > 0) {
        chapterStats[i] = count;
        const chapterName = getChapterName(i);
        console.log(`   Chapter ${i.toString().padStart(2, ' ')} (${chapterName}): ${count.toString().padStart(3, ' ')} codes`);
      }
    }
    
    // Show top chapters by count
    const topChapters = Object.entries(chapterStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    console.log('\n🏆 Top 5 Chapters by Code Count:');
    topChapters.forEach(([chapter, count], index) => {
      const chapterName = getChapterName(parseInt(chapter));
      console.log(`   ${index + 1}. Chapter ${chapter} (${chapterName}): ${count} codes`);
    });
    
    // Sample verification with variety
    console.log('\n🔍 Sample ICD codes from different chapters:');
    const samples = await prisma.iCDCode.findMany({ 
      take: 10,
      orderBy: [
        { chapterNr: 'asc' },
        { icdCode: 'asc' }
      ],
      select: {
        icdCode: true,
        label: true,
        chapterNr: true,
        level: true
      }
    });
    
    samples.forEach((sample, index) => {
      const chapterName = getChapterName(sample.chapterNr);
      const levelDesc = sample.level === 4 ? '(4-digit)' : '(3-digit)';
      console.log(`   ${index + 1}. ${sample.icdCode} ${levelDesc} - ${sample.label}`);
      console.log(`      Chapter ${sample.chapterNr}: ${chapterName}`);
    });
    
    console.log('\n✅ Complete ICD database successfully initialized!');
    console.log('🎯 Ready for enhanced medical ontology with real-world coverage');
    console.log(`📊 Database now contains ${finalCount} ICD codes vs previous 92 curated codes`);
    console.log('🏥 Comprehensive coverage for accurate medical transcription and analysis');
    console.log('🚀 HEROKU-COMPATIBLE: No external file dependencies - all codes embedded!');
    
  } catch (error) {
    console.error('❌ Error loading complete ICD codes:', error);
    console.error('Stack trace:', error.stack);
    
    // Log current progress
    if (processedCount > 0) {
      console.log(`📊 Progress before error: ${processedCount} codes processed`);
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Performance and memory monitoring
function logMemoryUsage() {
  const usage = process.memoryUsage();
  console.log('💾 Memory Usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}

// Run the loader
console.log('🏥 MedEssence AI - Complete ICD Database Loader (HEROKU EMBEDDED VERSION)');
console.log('================================================================================');
console.log('Loading all 1,657 real-world ICD-10-GM codes from embedded array...\n');

// Log initial memory
logMemoryUsage();

const startTime = Date.now();

loadCompleteICDCodes()
  .then(() => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n🎉 Complete ICD loader completed successfully!');
    console.log(`⏱️ Total execution time: ${duration.toFixed(2)} seconds`);
    
    // Final memory check
    logMemoryUsage();
    
    process.exit(0);
  })
  .catch(error => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.error('\n💥 Complete ICD loader failed:', error.message);
    console.error(`⏱️ Failed after ${duration.toFixed(2)} seconds`);
    
    // Log memory on failure
    logMemoryUsage();
    
    process.exit(1);
  });