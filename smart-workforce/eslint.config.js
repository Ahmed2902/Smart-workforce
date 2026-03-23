import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        process: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        console: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        jest: "readonly",
      },
    },
  },
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
    ignores: ["dist/**"],
  },
];
