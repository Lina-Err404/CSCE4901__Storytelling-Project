const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // provide the path to Next.js app to load next.config.js and .env files in test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  // Allows tests to use the same @/ path alias as the project.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
