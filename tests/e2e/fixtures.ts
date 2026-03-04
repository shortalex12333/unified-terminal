/**
 * E2E Test Fixtures
 *
 * Provides Electron app launch/teardown helpers and shared test utilities.
 * Uses the same custom test framework pattern as all other test files.
 *
 * The launchTestApp/closeTestApp helpers use Playwright's _electron API
 * for real Electron lifecycle testing. The test()/assert helpers are used
 * by all E2E tests for consistent output format.
 *
 * Run E2E tests with: npx ts-node tests/e2e/electron-dispatch.test.ts
 */

import * as path from 'path';

// ============================================================================
// PLAYWRIGHT ELECTRON HELPERS (for future real-app testing)
// ============================================================================

/**
 * Launch the Electron app in test mode via Playwright.
 * Requires a built dist/main/index.js and a display (not CI-friendly).
 *
 * Usage:
 *   const app = await launchTestApp();
 *   // ... interact with app ...
 *   await closeTestApp(app);
 */
export async function launchTestApp(): Promise<any> {
  const { _electron: electron } = await import('playwright');
  const projectRoot = path.resolve(__dirname, '../..');

  const app = await electron.launch({
    args: [path.join(projectRoot, 'dist/main/index.js'), '--test-mode'],
    cwd: projectRoot,
    timeout: 30_000,
  });

  return app;
}

/**
 * Close a launched Electron app safely.
 */
export async function closeTestApp(app: any): Promise<void> {
  try {
    await app.close();
  } catch (err) {
    console.warn('[fixtures] Error closing app:', err instanceof Error ? err.message : err);
  }
}

// ============================================================================
// CUSTOM TEST FRAMEWORK (consistent with all other test files)
// ============================================================================

export let testsPassed = 0;
export let testsFailed = 0;

/**
 * Run a single test case with pass/fail reporting.
 */
export async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    testsPassed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Assert strict equality between actual and expected values.
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Assert a condition is true.
 */
export function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

/**
 * Assert a condition is false.
 */
export function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

/**
 * Assert that a value is defined (not null/undefined).
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected defined value, got ${value}`);
  }
}

/**
 * Assert that a string contains a substring.
 */
export function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(
      message || `Expected "${haystack.substring(0, 80)}" to contain "${needle}"`
    );
  }
}

/**
 * Print test results summary and exit with appropriate code.
 */
export function printResults(suiteName: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`${suiteName}: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60) + '\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}
