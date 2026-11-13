import base from "./jest.config.js"

// The official packages ship ESM. Transform them only in this isolated suite;
// the existing StPageFlip test configuration remains untouched.
export default async function config() {
  return {
    ...(await base()),
    testMatch: ["**/__tests__/openPageFlip*.test.tsx"],
    transformIgnorePatterns: ["node_modules/(?!@openpageflip/)"],
  }
}
