// Manual mock for utils
module.exports = {
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' ')),
  formatTimestamp: jest.fn((timestamp) => new Date(timestamp).toLocaleString()),
  generateId: jest.fn(() => 'test-id-123'),
  debounce: jest.fn((func) => func),
  isValidEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  truncateText: jest.fn((text, maxLength) => text.length <= maxLength ? text : text.substring(0, maxLength) + '...'),
  getConfidenceColor: jest.fn((confidence) => {
    if (confidence >= 0.9) return 'text-success-600';
    if (confidence >= 0.7) return 'text-warning-600';
    return 'text-error-600';
  }),
  formatFileSize: jest.fn((bytes) => `${bytes} Bytes`),
  sleep: jest.fn((ms) => Promise.resolve())
};