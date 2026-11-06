/** Jest for the app and the shared packages (one runner for the whole workspace). */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/../../packages'],
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.bun/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*))',
  ],
};
