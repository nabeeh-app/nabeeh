module.exports = {
  testMatch: [
    '**/__tests__/**/*.spec.js',
    '**/__tests__/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    'real-db\\.integration\\.spec\\.js',
  ],
  testEnvironment: 'node',
  verbose: true,
};
