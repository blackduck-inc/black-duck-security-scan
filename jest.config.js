/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/unit/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': ['ts-jest', { useESM: false }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*@octokit/(request-error|plugin-paginate-rest))/)'
  ],
  verbose: true,
  "moduleDirectories": [
    "node_modules",
    "src"
  ]
}