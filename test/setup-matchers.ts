import { expect } from "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    /** Assert that the received value equals one of the listed alternatives. */
    toBeOneOf(allowed: readonly T[]): void;
  }
}

/**
 * Assert that a received value is one of an explicit finite set.
 *
 * Several release oracles use this Jest-style helper, which is not part of the
 * stock Chai assertion surface. Registering it here keeps those assertions
 * exact: the received value must still equal one of the listed values.
 */
expect.extend({
  toBeOneOf(received: unknown, allowed: readonly unknown[]) {
    const pass = allowed.some((value) => Object.is(value, received));
    return {
      pass,
      message: () =>
        `expected ${String(received)} to be one of ${allowed.map(String).join(", ")}`,
    };
  },
});
