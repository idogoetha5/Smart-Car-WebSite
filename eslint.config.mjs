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
    // A leading underscore is the explicit "declared but intentionally
    // unused" marker (an unused callback parameter kept to document the
    // signature, a deliberately ignored destructured field). Without this
    // the only way to express that intent is a disable comment, which is
    // noisier and easier to over-apply.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // The accessibility scan tooling in scripts/ is plain CommonJS run
    // directly by Node, not part of the Next.js bundle. Applying the
    // TypeScript ruleset to it flagged every require() as an error. Scoped
    // to these files only — application code still gets the full ruleset.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  {
    // Long-form Hebrew legal and policy prose. In Hebrew the ASCII double
    // quote stands in for the gershayim in abbreviations and citations
    // (בע"מ, תשל"ה-1975), so react/no-unescaped-entities fires on the body
    // text rather than on a genuine JSX mistake — 81 times across these
    // five pages.
    //
    // Escaping each one to &quot; would render identically but means 81
    // hand edits inside legal copy, and the typographically correct fix
    // (the real gershayim character, U+05F4) changes the characters of a
    // published legal document. Neither is a lint decision, so the rule is
    // switched off for these prose files only and left fully enabled
    // everywhere else.
    // NB: the route directory is literally named "[locale]", and square
    // brackets are a glob character class — matching it literally needs
    // a wildcard segment here, not the real directory name.
    files: [
      "src/app/*/terms/page.tsx",
      "src/app/*/privacy/page.tsx",
      "src/app/*/cookies/page.tsx",
      "src/app/*/accessibility/page.tsx",
      "src/app/*/insurance/page.tsx",
    ],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
