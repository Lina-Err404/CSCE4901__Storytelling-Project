/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Allows tests to use the same @/ path alias as the project.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  testMatch: ["**/__tests__/**/*.test.ts"],
};

module.exports = config;