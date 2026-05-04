/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  clearMocks: false,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/contract/**/*.e2e.test.ts'],
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