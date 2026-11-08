/** Jest for the app and the shared packages (one runner for the whole workspace). */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/../../packages'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Matches tsconfig paths: assets live beside src, and images load as a plain stub under Jest.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.bun/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*))',
  ],
};
