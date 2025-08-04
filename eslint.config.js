import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        WebSocket: "readonly",
        RTCPeerConnection: "readonly",
        RTCSessionDescription: "readonly",
        RTCIceCandidate: "readonly",
        CryptoJS: "readonly",
        crypto: "readonly",
        navigator: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      prettier,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...prettierConfig.rules,
      "prettier/prettier": "error",
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["**/*.test.{js,ts}", "test/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
  },
];
