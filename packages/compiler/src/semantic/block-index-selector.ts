import { vicConsumerBytes } from "../target/vic-fetch.js";

/**
 * Bytes the video chip fetches once it receives a block number from this pass.
 *
 * Every argument the consumer map recognizes selects a sprite image, so one
 * footprint answers for all of them. The capabilities that select a character
 * set, a bitmap or the screen matrix reach further, and they take an address
 * rather than a block number, which is why they prove their own constraints
 * when they are lowered.
 */
export const FETCHED_BYTES = vicConsumerBytes("vic-sprite-block");

/**
 * Unary operators that leave a block selector's value untouched.
 *
 * `lo` narrows a selector to the byte the register takes, and a unary plus is
 * the value itself, so a chip receiving either still fetches from the address
 * this block number was computed from.
 */
export const SELECTOR_PRESERVING_UNARY: ReadonlySet<string> = new Set(["lo", "+"]);

/** A sprite pointer is one byte, so every selector step is taken modulo this. */
export const SELECTOR_MODULUS = 256;

/**
 * Past this many addressable elements, listing them is no longer cheaper than
 * the span that covers them, so the span is demanded instead. A dimension whose
 * stride equals the fetched footprint merges into that span anyway.
 */
export const ENUMERATED_ELEMENT_LIMIT = 64;

/**
 * One addressed place proved to satisfy a required alignment, with the runtime
 * dimensions that decide which element it names.
 */
export interface ProvedPlace {
  /** Static byte offset from the object's first byte. */
  readonly offset: number;
  /** Dimensions an index chooses at run time, outermost first. */
  readonly selected: readonly { readonly stride: number; readonly length: number }[];
}

/**
 * What the chip would receive, written as `sign * block + offset` over the block
 * number this pass recognized.
 *
 * Tracking the arithmetic rather than refusing to follow it is what lets one
 * walk answer three questions that look different and are not. Adding a
 * constant selects a later block of the same object, which is how an author
 * names frame one of a sheet. Complementing the number names an unrelated
 * block — and complementing it again restores the original exactly, so a step
 * the walk would otherwise abandon can come back. Reaching the chip with a
 * negated selector proves nothing about this object, while reaching it with a
 * displacement of `k` proves the chip reads the block `k` further in.
 */
export interface SelectorState {
  /** `1` while the selector still rises with the block number, `-1` once negated. */
  readonly sign: 1 | -1;
  /** Constant added to the selector so far, in blocks. */
  readonly offset: number;
}

/** The selector exactly as the recognized block index produced it. */
export const UNSHIFTED: SelectorState = Object.freeze({ sign: 1, offset: 0 });

/** Apply one complement, which negates the selector and shifts it. */
export function complemented(state: SelectorState): SelectorState {
  return Object.freeze({
    sign: state.sign === 1 ? -1 : 1,
    offset: (SELECTOR_MODULUS - 1 - state.offset + SELECTOR_MODULUS) % SELECTOR_MODULUS,
  });
}

/** Apply one negation, which negates the selector without shifting the block. */
export function negated(state: SelectorState): SelectorState {
  return Object.freeze({
    sign: state.sign === 1 ? -1 : 1,
    offset: (SELECTOR_MODULUS - state.offset) % SELECTOR_MODULUS,
  });
}

/** Add a constant number of blocks to the selector. */
export function displaced(state: SelectorState, blocks: number): SelectorState {
  return Object.freeze({
    sign: state.sign,
    offset: (((state.offset + blocks) % SELECTOR_MODULUS) + SELECTOR_MODULUS) % SELECTOR_MODULUS,
  });
}

/**
 * Where the video chip reads this object, collected while walking one selector.
 *
 * Several publications of one object contribute several displacements, and they
 * all hold: satisfying the first says nothing about the second. A displacement
 * decided at run time cannot be named, so it is recorded as such and widens the
 * demand instead of adding to it.
 */
export interface SelectorReach {
  /** Block displacements at which the chip provably receives this selector. */
  readonly displacements: Set<number>;
  /** Whether some publication's displacement is only known at run time. */
  runtimeSelected: boolean;
  /**
   * Whether the selector left along a route this proof does not follow, so no
   * answer about it is complete.
   *
   * Passing the number to a function, storing it where another body can read
   * it, holding it in an object whose address exists, and writing it through a
   * borrowed parameter into the caller's object all put it beyond what this
   * walk inspects, as does returning it from a function reachable through an
   * address. Concluding "the chip never
   * receives it" would then be a guess in the one direction that leaves a
   * sprite unreadable, so an escape falls back to demanding the whole object —
   * which is exactly what the proof demanded before it learned to measure
   * extents, and is the honest answer until the missing routes are followed.
   */
  escaped: boolean;
}
