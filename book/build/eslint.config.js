import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/** 禁止跨层乱引用：ui↛features；lib↛React/UI；feature 深路径禁止（只经 barrel）。 */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "projects/**", "web/dist/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["web/src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // 仅启用经典 hooks 规则；compiler 系列对迁移期 effect 过严。
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/features/*/components", "@/features/*/components/*", "@/features/*/hooks", "@/features/*/hooks/*", "@/features/*/lib", "@/features/*/lib/*"],
            message: "跨 feature 只经该 feature 的 index.ts 引用，不要深入 components/hooks/lib。",
          },
        ],
      }],
    },
  },
  {
    files: ["web/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features", "@/features/*", "**/features/**"],
          message: "components/ui 不得引用 features。",
        }],
      }],
    },
  },
  {
    files: ["web/src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["react", "react-dom", "react/*", "react-dom/*"],
            message: "lib 不得引用 React。",
          },
          {
            group: ["@/components", "@/components/*", "@/features", "@/features/*", "**/components/**", "**/features/**"],
            message: "lib 不得引用 UI / features。",
          },
        ],
      }],
    },
  },
);
