module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "no-restricted-syntax": 0,
    "no-unused-vars": 1,
    "no-await-in-loop": 0,
    "no-continue": 0,
    "no-plusplus": 0,
    "no-unused-expressions": [2, {
      "allowShortCircuit": true,
      "allowTernary": true,
    }],
    "no-console": 0,
  },
};
