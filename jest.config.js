const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
    '<rootDir>/convex/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/convex/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'convex/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
    '!convex/_generated/**',
  ],
};

module.exports = createJestConfig(customJestConfig);
