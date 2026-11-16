import base from "./jest.config.js"

export default async function config() {
  return {
    ...(await base()),
    testMatch: ["**/__tests__/storyWorkspace.test.tsx"],
    transformIgnorePatterns: ["node_modules/(?!@openpageflip/)"],
  }
}
