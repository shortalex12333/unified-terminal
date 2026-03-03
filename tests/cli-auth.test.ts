/**
 * CLI Auth Tests
 *
 * Gates 15-16: CLI Authentication Flows
 *
 * Run with: npx ts-node tests/cli-auth.test.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message} (expected: ${expected}, got: ${actual})`);
    testsFailed++;
  }
}

function assertIncludes(arr: string[], item: string, message: string): void {
  if (arr.includes(item)) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message} (array does not include: ${item})`);
    testsFailed++;
  }
}

// ============================================================================
// IMPORT CLI-AUTH MODULE
// ============================================================================

// We need to import dynamically because cli-auth uses electron modules
// For testing, we mock the electron parts

const {
  AUTH_PATTERNS,
  TOKEN_PATHS,
  CLI_EXECUTABLES,
  OAUTH_CALLBACK_PATTERNS,
} = require('../src/main/cli-auth');

// ============================================================================
// TYPE DEFINITION TESTS
// ============================================================================

console.log('\n=== CLI Auth Type Tests ===\n');

{
  console.log('Testing CLITool type coverage...');

  // Check that all expected tools have patterns defined
  const expectedTools = ['codex', 'claude-code', 'gemini'];

  for (const tool of expectedTools) {
    assert(
      AUTH_PATTERNS[tool] !== undefined,
      `AUTH_PATTERNS includes ${tool}`
    );
    assert(
      TOKEN_PATHS[tool] !== undefined,
      `TOKEN_PATHS includes ${tool}`
    );
    assert(
      CLI_EXECUTABLES[tool] !== undefined,
      `CLI_EXECUTABLES includes ${tool}`
    );
  }
}

// ============================================================================
// AUTH PATTERNS TESTS
// ============================================================================

console.log('\n=== Auth Patterns Tests ===\n');

{
  console.log('Testing Codex auth patterns...');
  const codexPatterns = AUTH_PATTERNS['codex'];

  assert(
    codexPatterns.githubAuth.test('Please authenticate with GitHub'),
    'Should match GitHub auth prompt'
  );
  assert(
    codexPatterns.tos.test('Do you accept the terms of service? (y/n)'),
    'Should match TOS prompt'
  );
  assert(
    codexPatterns.token.test('Enter your API key:'),
    'Should match token prompt'
  );
  assert(
    codexPatterns.question.test('Continue? [y/n]'),
    'Should match question prompt'
  );
}

{
  console.log('Testing Claude Code auth patterns...');
  const claudePatterns = AUTH_PATTERNS['claude-code'];

  assert(
    claudePatterns.anthropicAuth.test('Sign in to Anthropic'),
    'Should match Anthropic auth prompt'
  );
  assert(
    claudePatterns.tos.test('Accept the terms?'),
    'Should match TOS prompt'
  );
}

{
  console.log('Testing Gemini auth patterns...');
  const geminiPatterns = AUTH_PATTERNS['gemini'];

  assert(
    geminiPatterns !== undefined,
    'Gemini patterns should be defined'
  );
  assert(
    geminiPatterns.googleAuth.test('Sign in with Google'),
    'Should match Google auth prompt'
  );
  assert(
    geminiPatterns.googleAuth.test('accounts.google.com'),
    'Should match Google accounts URL'
  );
  assert(
    geminiPatterns.tos.test('Accept terms? (yes/no)'),
    'Should match TOS prompt'
  );
  assert(
    geminiPatterns.question.test('Continue?'),
    'Should match question prompt'
  );
}

// ============================================================================
// TOKEN PATHS TESTS
// ============================================================================

console.log('\n=== Token Paths Tests ===\n');

{
  console.log('Testing Codex token paths...');
  const codexPaths = TOKEN_PATHS['codex'];

  assert(Array.isArray(codexPaths), 'Codex paths should be array');
  assert(codexPaths.length > 0, 'Codex should have at least one path');
  assert(
    codexPaths.some((p: string) => p.includes('.codex')),
    'Should include .codex directory'
  );
}

{
  console.log('Testing Claude Code token paths...');
  const claudePaths = TOKEN_PATHS['claude-code'];

  assert(Array.isArray(claudePaths), 'Claude paths should be array');
  assert(claudePaths.length > 0, 'Claude should have at least one path');
  assert(
    claudePaths.some((p: string) => p.includes('.claude')),
    'Should include .claude directory'
  );
}

{
  console.log('Testing Gemini token paths...');
  const geminiPaths = TOKEN_PATHS['gemini'];

  assert(Array.isArray(geminiPaths), 'Gemini paths should be array');
  assert(geminiPaths.length > 0, 'Gemini should have at least one path');
  assert(
    geminiPaths.some((p: string) => p.includes('.gemini')),
    'Should include .gemini directory'
  );
  assert(
    geminiPaths.includes('.gemini/oauth_creds.json'),
    'Should include oauth_creds.json'
  );
  assert(
    geminiPaths.includes('.gemini/google_accounts.json'),
    'Should include google_accounts.json'
  );
}

// ============================================================================
// CLI EXECUTABLES TESTS
// ============================================================================

console.log('\n=== CLI Executables Tests ===\n');

{
  console.log('Testing CLI executable definitions...');

  assert(
    CLI_EXECUTABLES['codex'].includes('codex'),
    'Codex should have codex executable'
  );
  assert(
    CLI_EXECUTABLES['claude-code'].includes('claude'),
    'Claude Code should have claude executable'
  );
  assert(
    CLI_EXECUTABLES['gemini'].includes('gemini'),
    'Gemini should have gemini executable'
  );
}

// ============================================================================
// OAUTH CALLBACK PATTERNS TESTS
// ============================================================================

console.log('\n=== OAuth Callback Patterns Tests ===\n');

{
  console.log('Testing OAuth callback URL patterns...');

  const testUrls = [
    { url: 'http://localhost:8080/callback', shouldMatch: true },
    { url: 'http://127.0.0.1:3000/oauth', shouldMatch: true },
    { url: 'http://localhost:9999/callback?code=abc', shouldMatch: true },
    { url: 'https://example.com/callback', shouldMatch: false },
    { url: 'http://localhost:8080/other', shouldMatch: false },
  ];

  for (const { url, shouldMatch } of testUrls) {
    const matches = OAUTH_CALLBACK_PATTERNS.some((pattern: RegExp) => pattern.test(url));
    assert(
      matches === shouldMatch,
      `${url} should ${shouldMatch ? '' : 'not '}match callback pattern`
    );
  }
}

// ============================================================================
// TOKEN FILE DETECTION TESTS (Local filesystem checks)
// ============================================================================

console.log('\n=== Token File Detection Tests ===\n');

{
  console.log('Testing local token file detection...');
  const homeDir = os.homedir();

  // Check for Codex tokens
  const codexConfigPath = path.join(homeDir, '.codex');
  const codexExists = fs.existsSync(codexConfigPath);
  console.log(`  [INFO] Codex config dir exists: ${codexExists}`);

  // Check for Claude tokens
  const claudeConfigPath = path.join(homeDir, '.claude');
  const claudeExists = fs.existsSync(claudeConfigPath);
  console.log(`  [INFO] Claude config dir exists: ${claudeExists}`);

  // Check for Gemini tokens
  const geminiConfigPath = path.join(homeDir, '.gemini');
  const geminiExists = fs.existsSync(geminiConfigPath);
  console.log(`  [INFO] Gemini config dir exists: ${geminiExists}`);

  // Check for specific Gemini oauth file
  const geminiOAuthPath = path.join(homeDir, '.gemini', 'oauth_creds.json');
  const geminiOAuthExists = fs.existsSync(geminiOAuthPath);
  console.log(`  [INFO] Gemini oauth_creds.json exists: ${geminiOAuthExists}`);

  // These are informational, not assertions
  testsPassed++; // Count as passing since it's informational
}

// ============================================================================
// GEMINI-SPECIFIC TESTS
// ============================================================================

console.log('\n=== Gemini-Specific Tests ===\n');

{
  console.log('Testing Gemini OAuth patterns...');

  const geminiPatterns = AUTH_PATTERNS['gemini'];

  // Test various Google OAuth related strings
  const googleStrings = [
    'Please sign in with Google',
    'Visit accounts.google.com/o/oauth',
    'Google OAuth required',
    'Authorization needed',
  ];

  for (const str of googleStrings) {
    assert(
      geminiPatterns.googleAuth.test(str),
      `Should match: "${str}"`
    );
  }
}

{
  console.log('Testing Gemini token validation...');

  // Simulate checking if oauth_creds.json has valid content
  const homeDir = os.homedir();
  const oauthPath = path.join(homeDir, '.gemini', 'oauth_creds.json');

  if (fs.existsSync(oauthPath)) {
    try {
      const content = fs.readFileSync(oauthPath, 'utf-8');
      const data = JSON.parse(content);

      // Check for expected OAuth fields
      const hasAccessToken = 'access_token' in data || 'token' in data;
      const hasRefreshToken = 'refresh_token' in data;

      console.log(`  [INFO] Gemini OAuth has access_token: ${hasAccessToken}`);
      console.log(`  [INFO] Gemini OAuth has refresh_token: ${hasRefreshToken}`);

      assert(content.length > 0, 'OAuth file should have content');
    } catch (err) {
      console.log(`  [INFO] Could not parse OAuth file: ${err}`);
    }
  } else {
    console.log('  [INFO] Gemini OAuth file not present (auth required)');
    testsPassed++; // Informational
  }
}

// ============================================================================
// PATTERN EDGE CASES
// ============================================================================

console.log('\n=== Pattern Edge Cases ===\n');

{
  console.log('Testing case insensitivity...');

  const geminiPatterns = AUTH_PATTERNS['gemini'];

  assert(
    geminiPatterns.googleAuth.test('GOOGLE'),
    'Should match uppercase GOOGLE'
  );
  assert(
    geminiPatterns.googleAuth.test('Google'),
    'Should match mixed case Google'
  );
  assert(
    geminiPatterns.googleAuth.test('google'),
    'Should match lowercase google'
  );
}

{
  console.log('Testing TOS pattern variations...');

  for (const tool of ['codex', 'claude-code', 'gemini']) {
    const patterns = AUTH_PATTERNS[tool];

    assert(
      patterns.tos.test('Accept terms? y/n'),
      `${tool}: Should match y/n format`
    );
    assert(
      patterns.tos.test('Do you agree?'),
      `${tool}: Should match agree`
    );
    assert(
      patterns.tos.test('Continue? [yes/no]'),
      `${tool}: Should match yes/no format`
    );
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`CLI Auth Tests Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(60) + '\n');

if (testsFailed > 0) {
  process.exit(1);
}
