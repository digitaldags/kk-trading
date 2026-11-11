import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Only repositories (and the db scripts) touch the Drizzle tables.
const SCHEMA_IMPORTS = {
  group: ["@/lib/db/schema", "**/db/schema"],
  message:
    "Only repositories use the Drizzle tables. Add a repository method instead.",
};

const EXCELJS_MESSAGE =
  "Only lib/spreadsheet loads exceljs. Call a function from there instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow `const { omitted, ...rest } = props` to drop props before spreading.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true },
      ],
    },
  },
  // Layers (CLAUDE.md): app -> lib/services -> lib/repositories -> lib/db.
  // A later block replaces an earlier block's options for the same rule, so the
  // app/components block comes last and repeats the schema pattern.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: [
      "lib/db/**",
      "lib/repositories/**",
      "scripts/**",
      "**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SCHEMA_IMPORTS] }],
    },
  },
  {
    files: ["app/**", "components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            SCHEMA_IMPORTS,
            {
              group: [
                "@/lib/db",
                "@/lib/db/*",
                "@/lib/repositories",
                "@/lib/repositories/*",
                "**/lib/db",
                "**/lib/db/*",
                "**/lib/repositories",
                "**/lib/repositories/*",
              ],
              message: "Call a service from lib/services instead.",
            },
          ],
        },
      ],
    },
  },
  // exceljs is large and only for the browser's file work, so only lib/spreadsheet loads
  // it (ticket 42). e2e builds and reads workbooks to check that layer from outside.
  // no-restricted-imports can't do this: it doesn't see `import()`, the way it's loaded.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["lib/spreadsheet/**", "e2e/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='exceljs']",
          message: EXCELJS_MESSAGE,
        },
        {
          selector: "ImportExpression[source.value='exceljs']",
          message: EXCELJS_MESSAGE,
        },
      ],
    },
  },
  // Keep last: turns off rules that conflict with Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output:
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
