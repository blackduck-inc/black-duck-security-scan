/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/unit/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true,
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^blackduck-security-action/(.*)$': '<rootDir>/src/blackduck-security-action/$1',
    '^application-constants$': '<rootDir>/src/application-constants'
  }
}
