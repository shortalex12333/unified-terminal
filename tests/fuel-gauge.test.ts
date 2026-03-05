/**
 * Fuel Gauge Tests
 *
 * Tests for the fuel gauge functionality that tracks session budget/quota.
 * The fuel gauge shows users how much of their session budget remains and
 * warns when resources are running low.
 *
 * Run with: npx ts-node tests/fuel-gauge.test.ts
 */

// ============================================================================
// IMPORTS
// ============================================================================

import type { FuelState } from '../src/status-agent/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be non-null');
  }
}

function assertNull(value: unknown, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(message || `Expected null/undefined, got ${JSON.stringify(value)}`);
  }
}

function assertIncludes(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      message || `Expected string to include "${substring}", got: "${str.substring(0, 100)}..."`
    );
  }
}

// ============================================================================
// FUEL GAUGE HELPER FUNCTIONS
// ============================================================================

/**
 * Warning threshold - fuel below this percentage triggers a warning.
 */
const FUEL_WARNING_THRESHOLD = 20;

/**
 * Critical threshold - fuel below this percentage triggers critical warning.
 */
const FUEL_CRITICAL_THRESHOLD = 5;

/**
 * Calculate if fuel state should show warning based on percentage.
 */
function shouldShowWarning(percent: number): boolean {
  return percent < FUEL_WARNING_THRESHOLD;
}

/**
 * Calculate if fuel state is critical based on percentage.
 */
function isCritical(percent: number): boolean {
  return percent < FUEL_CRITICAL_THRESHOLD;
}

/**
 * Format fuel percentage for display label.
 */
function formatFuelLabel(percent: number): string {
  if (percent >= 100) {
    return 'Ready';
  } else if (percent >= FUEL_WARNING_THRESHOLD) {
    return `${percent}% remaining`;
  } else if (percent >= FUEL_CRITICAL_THRESHOLD) {
    return `Low: ${percent}% remaining`;
  } else if (percent > 0) {
    return `Critical: ${percent}% remaining`;
  } else {
    return 'Empty';
  }
}

/**
 * Format fuel detail string based on state.
 */
function formatFuelDetail(percent: number, tokensUsed?: number, tokenLimit?: number): string {
  if (tokensUsed !== undefined && tokenLimit !== undefined) {
    const remaining = tokenLimit - tokensUsed;
    return `${remaining.toLocaleString()} tokens remaining of ${tokenLimit.toLocaleString()}`;
  }
  return 'Session budget available';
}

/**
 * Generate warning text if applicable.
 */
function getWarningText(percent: number): string | null {
  if (percent < FUEL_CRITICAL_THRESHOLD) {
    return 'Session nearly exhausted. Consider completing current task.';
  } else if (percent < FUEL_WARNING_THRESHOLD) {
    return 'Session resources running low.';
  }
  return null;
}

/**
 * Create a FuelState object from parameters.
 */
function createFuelState(
  percent: number,
  options: { tokensUsed?: number; tokenLimit?: number } = {}
): FuelState {
  return {
    percent,
    label: formatFuelLabel(percent),
    detail: formatFuelDetail(percent, options.tokensUsed, options.tokenLimit),
    warning: shouldShowWarning(percent),
    warningText: getWarningText(percent),
  };
}

/**
 * Calculate fuel percentage from tokens.
 */
function calculateFuelPercent(tokensUsed: number, tokenLimit: number): number {
  if (tokenLimit <= 0) return 0;
  const remaining = tokenLimit - tokensUsed;
  const percent = Math.round((remaining / tokenLimit) * 100);
  return Math.max(0, Math.min(100, percent));
}

// ============================================================================
// EVENT SIMULATION
// ============================================================================

type FuelUpdateCallback = (fuel: FuelState) => void;

/**
 * Simple event emitter for fuel updates.
 */
class FuelGaugeEmitter {
  private listeners: FuelUpdateCallback[] = [];
  private currentState: FuelState;

  constructor(initialPercent: number = 100) {
    this.currentState = createFuelState(initialPercent);
  }

  /**
   * Subscribe to fuel updates.
   */
  onFuelUpdate(callback: FuelUpdateCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update fuel state and notify listeners.
   */
  updateFuel(percent: number, options: { tokensUsed?: number; tokenLimit?: number } = {}): void {
    this.currentState = createFuelState(percent, options);
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }

  /**
   * Get current fuel state.
   */
  getFuelState(): FuelState {
    return this.currentState;
  }
}

// ============================================================================
// TESTS
// ============================================================================

function runTests(): void {
  console.log('='.repeat(60));
  console.log('Fuel Gauge Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // Test Category 1: Fuel Percentage Calculation
  // ==========================================================================
  console.log('1. Fuel Percentage Calculation:');

  test('100% fuel when no tokens used', () => {
    const percent = calculateFuelPercent(0, 100000);
    assertEqual(percent, 100, 'Should be 100% when no tokens used');
  });

  test('50% fuel when half tokens used', () => {
    const percent = calculateFuelPercent(50000, 100000);
    assertEqual(percent, 50, 'Should be 50% when half tokens used');
  });

  test('0% fuel when all tokens used', () => {
    const percent = calculateFuelPercent(100000, 100000);
    assertEqual(percent, 0, 'Should be 0% when all tokens used');
  });

  test('Fuel percentage rounds to nearest integer', () => {
    const percent = calculateFuelPercent(33333, 100000);
    assertEqual(percent, 67, 'Should round to nearest integer');
  });

  test('Fuel percentage clamps to 0-100 range', () => {
    const overUsed = calculateFuelPercent(150000, 100000);
    assertEqual(overUsed, 0, 'Should clamp to 0 when over limit');

    const negative = calculateFuelPercent(-1000, 100000);
    // Negative usage means more than 100% remaining
    assertTrue(negative <= 100, 'Should not exceed 100');
  });

  test('Handles zero token limit gracefully', () => {
    const percent = calculateFuelPercent(0, 0);
    assertEqual(percent, 0, 'Should return 0 for zero limit');
  });

  // ==========================================================================
  // Test Category 2: Warning Threshold (Below 20%)
  // ==========================================================================
  console.log('\n2. Warning Threshold (Below 20%):');

  test('No warning at 100% fuel', () => {
    assertFalse(shouldShowWarning(100), 'Should not warn at 100%');
  });

  test('No warning at 50% fuel', () => {
    assertFalse(shouldShowWarning(50), 'Should not warn at 50%');
  });

  test('No warning at exactly 20% fuel', () => {
    assertFalse(shouldShowWarning(20), 'Should not warn at exactly 20%');
  });

  test('Warning at 19% fuel', () => {
    assertTrue(shouldShowWarning(19), 'Should warn at 19%');
  });

  test('Warning at 10% fuel', () => {
    assertTrue(shouldShowWarning(10), 'Should warn at 10%');
  });

  test('Warning at 1% fuel', () => {
    assertTrue(shouldShowWarning(1), 'Should warn at 1%');
  });

  // ==========================================================================
  // Test Category 3: Critical Threshold (Below 5%)
  // ==========================================================================
  console.log('\n3. Critical Threshold (Below 5%):');

  test('Not critical at 10% fuel', () => {
    assertFalse(isCritical(10), 'Should not be critical at 10%');
  });

  test('Not critical at exactly 5% fuel', () => {
    assertFalse(isCritical(5), 'Should not be critical at exactly 5%');
  });

  test('Critical at 4% fuel', () => {
    assertTrue(isCritical(4), 'Should be critical at 4%');
  });

  test('Critical at 1% fuel', () => {
    assertTrue(isCritical(1), 'Should be critical at 1%');
  });

  test('Critical at 0% fuel', () => {
    assertTrue(isCritical(0), 'Should be critical at 0%');
  });

  // ==========================================================================
  // Test Category 4: Fuel Update Event Emission
  // ==========================================================================
  console.log('\n4. Fuel Update Event Emission:');

  test('Emitter notifies listeners on update', () => {
    const emitter = new FuelGaugeEmitter();
    let receivedState: FuelState | null = null;

    emitter.onFuelUpdate((fuel) => {
      receivedState = fuel;
    });

    emitter.updateFuel(75);
    assertNotNull(receivedState);
    assertEqual(receivedState!.percent, 75, 'Should receive updated percentage');
  });

  test('Emitter supports multiple listeners', () => {
    const emitter = new FuelGaugeEmitter();
    let callCount = 0;

    emitter.onFuelUpdate(() => { callCount++; });
    emitter.onFuelUpdate(() => { callCount++; });
    emitter.onFuelUpdate(() => { callCount++; });

    emitter.updateFuel(50);
    assertEqual(callCount, 3, 'Should notify all listeners');
  });

  test('Unsubscribe removes listener', () => {
    const emitter = new FuelGaugeEmitter();
    let callCount = 0;

    const unsubscribe = emitter.onFuelUpdate(() => { callCount++; });
    emitter.updateFuel(80);
    assertEqual(callCount, 1, 'Should be called once');

    unsubscribe();
    emitter.updateFuel(60);
    assertEqual(callCount, 1, 'Should not be called after unsubscribe');
  });

  test('Emitter starts at 100% by default', () => {
    const emitter = new FuelGaugeEmitter();
    const state = emitter.getFuelState();
    assertEqual(state.percent, 100, 'Should start at 100%');
    assertEqual(state.label, 'Ready', 'Label should be Ready');
  });

  test('Emitter can start with custom percentage', () => {
    const emitter = new FuelGaugeEmitter(50);
    const state = emitter.getFuelState();
    assertEqual(state.percent, 50, 'Should start at specified percentage');
  });

  // ==========================================================================
  // Test Category 5: Label and Detail Formatting
  // ==========================================================================
  console.log('\n5. Label and Detail Formatting:');

  test('Label shows "Ready" at 100%', () => {
    const label = formatFuelLabel(100);
    assertEqual(label, 'Ready', 'Should show Ready at 100%');
  });

  test('Label shows percentage at normal levels', () => {
    const label = formatFuelLabel(75);
    assertIncludes(label, '75%', 'Should include percentage');
    assertIncludes(label, 'remaining', 'Should include "remaining"');
  });

  test('Label shows "Low" below 20%', () => {
    const label = formatFuelLabel(15);
    assertIncludes(label, 'Low', 'Should indicate low fuel');
    assertIncludes(label, '15%', 'Should include percentage');
  });

  test('Label shows "Critical" below 5%', () => {
    const label = formatFuelLabel(3);
    assertIncludes(label, 'Critical', 'Should indicate critical fuel');
    assertIncludes(label, '3%', 'Should include percentage');
  });

  test('Label shows "Empty" at 0%', () => {
    const label = formatFuelLabel(0);
    assertEqual(label, 'Empty', 'Should show Empty at 0%');
  });

  test('Detail shows token counts when provided', () => {
    const detail = formatFuelDetail(75, 25000, 100000);
    assertIncludes(detail, '75,000', 'Should show remaining tokens');
    assertIncludes(detail, '100,000', 'Should show total tokens');
  });

  test('Detail shows generic message without token info', () => {
    const detail = formatFuelDetail(75);
    assertIncludes(detail, 'Session budget available', 'Should show generic message');
  });

  // ==========================================================================
  // Test Category 6: Warning Text Generation
  // ==========================================================================
  console.log('\n6. Warning Text Generation:');

  test('No warning text above 20%', () => {
    const text = getWarningText(50);
    assertNull(text, 'Should not have warning text above 20%');
  });

  test('No warning text at exactly 20%', () => {
    const text = getWarningText(20);
    assertNull(text, 'Should not have warning text at 20%');
  });

  test('Warning text at 15%', () => {
    const text = getWarningText(15);
    assertNotNull(text);
    assertIncludes(text!, 'running low', 'Should mention running low');
  });

  test('Critical warning text at 3%', () => {
    const text = getWarningText(3);
    assertNotNull(text);
    assertIncludes(text!, 'nearly exhausted', 'Should mention nearly exhausted');
  });

  // ==========================================================================
  // Test Category 7: FuelState Object Creation
  // ==========================================================================
  console.log('\n7. FuelState Object Creation:');

  test('FuelState has all required fields', () => {
    const state = createFuelState(75);
    assertTrue('percent' in state, 'Should have percent');
    assertTrue('label' in state, 'Should have label');
    assertTrue('detail' in state, 'Should have detail');
    assertTrue('warning' in state, 'Should have warning');
    assertTrue('warningText' in state, 'Should have warningText');
  });

  test('FuelState at 100% is correct', () => {
    const state = createFuelState(100);
    assertEqual(state.percent, 100);
    assertEqual(state.label, 'Ready');
    assertFalse(state.warning);
    assertNull(state.warningText);
  });

  test('FuelState at 15% shows warning', () => {
    const state = createFuelState(15);
    assertEqual(state.percent, 15);
    assertTrue(state.warning, 'Should show warning');
    assertNotNull(state.warningText);
  });

  test('FuelState at 3% is critical', () => {
    const state = createFuelState(3);
    assertEqual(state.percent, 3);
    assertTrue(state.warning, 'Should show warning');
    assertIncludes(state.warningText!, 'exhausted', 'Should have critical warning');
    assertIncludes(state.label, 'Critical', 'Label should indicate critical');
  });

  test('FuelState includes token details when provided', () => {
    const state = createFuelState(60, { tokensUsed: 40000, tokenLimit: 100000 });
    assertIncludes(state.detail, '60,000', 'Detail should show remaining tokens');
  });

  // ==========================================================================
  // Test Category 8: Type Validation
  // ==========================================================================
  console.log('\n8. Type Validation:');

  test('FuelState type has correct structure', () => {
    const validState: FuelState = {
      percent: 50,
      label: '50% remaining',
      detail: 'Session budget available',
      warning: false,
      warningText: null,
    };

    assertEqual(typeof validState.percent, 'number');
    assertEqual(typeof validState.label, 'string');
    assertEqual(typeof validState.detail, 'string');
    assertEqual(typeof validState.warning, 'boolean');
    assertTrue(validState.warningText === null || typeof validState.warningText === 'string');
  });

  test('FuelState percent is a number between 0 and 100', () => {
    const states = [
      createFuelState(0),
      createFuelState(50),
      createFuelState(100),
    ];

    for (const state of states) {
      assertTrue(state.percent >= 0, 'Percent should be >= 0');
      assertTrue(state.percent <= 100, 'Percent should be <= 100');
    }
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests();
