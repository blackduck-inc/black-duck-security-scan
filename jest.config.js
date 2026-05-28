/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/unit/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|js)$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!uuid)/'
  ],
  verbose: true,
  "moduleDirectories": [
    "node_modules",
    "src"
  ]
}