const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: [path.join('<rootDir>', 'tests', 'integration', '**', '*.test.js')],
  testTimeout: 30000,
  verbose: true,
};