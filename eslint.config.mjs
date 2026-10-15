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
  ]),
  {
    // docker/healthcheck.js is a plain CommonJS script copied into the image
    // and run as `node healthcheck.js`, outside Next and any bundler. require()
    // is correct there; rewriting it as ESM to satisfy a TypeScript rule would
    // risk the container healthcheck for no gain.
    files: ["docker/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
