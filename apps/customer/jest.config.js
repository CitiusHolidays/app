/** Jest for the customer app; the shared packages' own tests run in the Connect suite. */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/src'],
  // tsconfig maps @/assets/* to the app's assets folder, beside src.
  moduleNameMapper: { '^@/assets/(.*)$': '<rootDir>/assets/$1' },
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.bun/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*))',
  ],
};
