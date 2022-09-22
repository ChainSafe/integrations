module.exports = {
  "roots": [
    "<rootDir>"
  ],
  "testMatch": [
    "**/tests/**/*.+(spec|test).+(ts|tsx|js)",
  ],
  "transform": {
    "\\.[j]sx?$": "babel-jest",
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  "transformIgnorePatterns": [
    "node_modules/(?!@polkadot|@babel/runtime/helpers/esm/)"
  ],
  testEnvironment: 'jsdom'
};
