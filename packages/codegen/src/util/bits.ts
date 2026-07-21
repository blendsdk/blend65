/**
 * Small bit-level helpers shared across the code generator.
 *
 * These live outside `il/` and `instr/` because both tiers need them and the
 * dependency runs one way: IL lowering must not import from instruction
 * selection. Pure functions over numbers — no state, no diagnostics.
 */

/**
 * The exact base-2 logarithm of `n` when `n` is a power of two (≥ 1), else
 * `null`.
 *
 * Callers use it to decide whether a constant divisor or multiplier collapses
 * to a shift. Note the argument is taken unmasked: a caller that only supports
 * byte-wide values must mask before calling, and a caller working in 16 bits
 * must not — masking there would silently reject every value from 256 up.
 *
 * @param n The candidate constant.
 * @returns `k` such that `n === 2**k`, or `null` when `n` is not a power of two.
 * @example
 * log2Exact(64); // 6
 * log2Exact(40); // null
 */
export function log2Exact(n: number): number | null {
  if (n < 1 || (n & (n - 1)) !== 0) {
    return null;
  }
  let k = 0;
  let v = n;
  while (v > 1) {
    v >>= 1;
    k++;
  }
  return k;
}
