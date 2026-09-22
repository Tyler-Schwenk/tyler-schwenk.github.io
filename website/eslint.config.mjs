import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // the react compiler flags every setState-in-effect, including two
      // patterns we want: Footer's random fact (doing it during render
      // would cause a hydration mismatch) and the setLoading(true) that
      // precedes each page's async fetch. warn so CI still gates on real
      // errors; revisit if we ever move fetching to Suspense.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
