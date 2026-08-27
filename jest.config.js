/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Several models have both a legacy .js and the current .ts implementation.
  // Jest resolves .js first by default, which picks up the wrong module — put
  // .ts ahead of it so tests exercise the TypeScript models the API uses.
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Spinning up an in-memory mongod on first run can take a while.
  testTimeout: 60000,
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
