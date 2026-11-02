/**
 * E2E Test Suite - Assertion Helpers
 * Provides clear, informative assertions with semantic error reporting.
 */

export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const msg =
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    const msg = message || `Expected value to differ from ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertContains(haystack, needle, message) {
  if (typeof haystack !== 'string' && !Array.isArray(haystack)) {
    throw new AssertionError(
      `Haystack must be string or array, got ${typeof haystack}`,
      haystack,
      needle,
    );
  }
  if (!haystack.includes(needle)) {
    const preview =
      typeof haystack === 'string' && haystack.length > 200
        ? haystack.slice(0, 200) + '...'
        : haystack;
    const msg =
      message ||
      `Expected to contain ${JSON.stringify(needle)}, but was not found in: ${JSON.stringify(preview)}`;
    throw new AssertionError(msg, haystack, needle);
  }
}

export function assertNotContains(haystack, needle, message) {
  if (typeof haystack === 'string' || Array.isArray(haystack)) {
    if (haystack.includes(needle)) {
      const msg = message || `Expected NOT to contain ${JSON.stringify(needle)}`;
      throw new AssertionError(msg, haystack, needle);
    }
  }
}

export function assertMatches(text, regex, message) {
  if (!regex.test(text)) {
    const preview =
      typeof text === 'string' && text.length > 200 ? text.slice(0, 200) + '...' : text;
    const msg = message || `Expected ${JSON.stringify(preview)} to match regex ${regex}`;
    throw new AssertionError(msg, text, regex.toString());
  }
}

export function assertTruthy(value, message = 'Expected value to be truthy') {
  if (!value) {
    throw new AssertionError(message, value, true);
  }
}

export function assertFalsy(value, message = 'Expected value to be falsy') {
  if (value) {
    throw new AssertionError(message, value, false);
  }
}

export function assertGreaterThan(actual, expected, message) {
  if (!(actual > expected)) {
    const msg = message || `Expected ${actual} > ${expected}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertGreaterThanOrEqual(actual, expected, message) {
  if (!(actual >= expected)) {
    const msg = message || `Expected ${actual} >= ${expected}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export async function assertRejects(asyncFn, message) {
  let threw = false;
  let caughtError = null;
  try {
    await asyncFn();
  } catch (err) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new AssertionError(
      message || 'Expected async operation to reject, but it resolved successfully',
      null,
      'Error',
    );
  }
  return caughtError;
}

export function assertThrows(fn, message) {
  let threw = false;
  let caughtError = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new AssertionError(
      message || 'Expected function to throw, but it succeeded',
      null,
      'Error',
    );
  }
  return caughtError;
}
