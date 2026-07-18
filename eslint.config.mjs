import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only directories:
    ".worktrees/**",
    "branding/**",
    "postgres_data/**",
  ]),
  {
    rules: {
      // Legacy debt: serialized quote payloads are still typed as `any`.
      // Kept visible as warnings; do not add new ones.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Jest custom-matcher declarations require namespace merging.
    files: ["tests/setup.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
]);

export default eslintConfig;
