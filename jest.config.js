module.exports = {
  preset: '@react-native/jest-preset',
  // The insights server has its own tests (cd server && npm test).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/'],
};
