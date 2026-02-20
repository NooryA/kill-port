module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "script", project: null },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  env: { node: true, es2022: true },
  overrides: [
    {
      files: ["tests/**/*.ts"],
      rules: { "@typescript-eslint/no-explicit-any": "off" }
    }
  ],
  rules: {
    "max-lines": ["warn", { max: 1000 }],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ]
  }
};
