module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/db/__tests__/setup.ts'],
  moduleNameMapper: {
    '^gun$': '<rootDir>/node_modules/gun',
    '^gun/(.*)$': '<rootDir>/node_modules/gun/$1'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(gun|gun-util)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleDirectories: ['node_modules', 'src'],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true
}; 