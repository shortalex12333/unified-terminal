// Source: HARDCODED-ENFORCEMENT-VALUES.md section 21

export const SCOPE_WHITELIST = {
  EXACT: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  PREFIXES: [
    ".next/",
    "node_modules/",
    "__pycache__/",
    "dist/", // build output is expected side effect
    ".git/",
  ],
};
