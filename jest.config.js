module.exports = {
  preset: 'jest-expo',
  // Only *.test.ts(x) are suites. Fixture modules live beside them in
  // __tests__/fixtures/ and must not be collected as empty suites.
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
