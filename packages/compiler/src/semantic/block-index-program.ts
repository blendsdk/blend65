import { bindingIdentityKey, semanticTypeKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
  StorageValue,
  ValueId,
} from "./operations.js";
import type { Definitions } from "./block-index-values.js";

/**
 * One scanned body together with the values it defines.
 *
 * A block number can be computed in one function and published in another, so the
 * proof that the video chip receives it walks bodies rather than stopping at the
 * edge of the one that did the arithmetic. Value identities are qualified by the
 * body that defines them, which is why a definition map belongs to a body rather
 * than to the program.
 */
export interface ScannedBody {
  /**
   * Identity of the function this body belongs to, or null for a module
   * initializer, whose result no call site can receive.
   */
  readonly owner: string | null;
  /** Basic blocks of this body in construction order. */
  readonly blocks: readonly SemanticBlock[];
  /** Values this body defines, for static address and index resolution. */
  readonly definitions: Definitions;
  /** Parameters in source order, which is what an argument position selects. */
  readonly parameters: readonly ScannedParameter[];
  /**
   * Shape of the function this body belongs to, or null for an initializer.
   *
   * A call made through an address can only reach a function of the same shape,
   * so the shape is what connects the two when no callee is named.
   */
  readonly shape: string | null;
}

/**
 * One parameter of a scanned body, described by the storage its name denotes.
 *
 * Array and struct parameters are zero-copy borrows of the caller's object, so
 * writing through one writes storage this body does not own, and the reads that
 * matter are in a caller this walk is not standing in. A scalar parameter is
 * the callee's own copy, and every read of it is here.
 */
interface ScannedParameter {
  /** Identity of the parameter binding, which a read of it is rooted at. */
  readonly key: string;
  /** Whether the name denotes the caller's object rather than a private copy. */
  readonly borrowed: boolean;
}

/** One object pinned to an explicit address, and the bytes it covers. */
export interface PlacedObject {
  /** First address the object occupies. */
  readonly start: number;
  /** Byte length of the object. */
  readonly size: number;
}

/** One call whose result a caller receives, kept with the body that receives it. */
interface CallSite {
  /** Body containing the call. */
  readonly body: ScannedBody;
  /** Value the caller receives. */
  readonly result: ValueId;
}

/**
 * Every body the walk may enter, with call sites indexed by callee.
 *
 * Leaving a body means resuming at the callers of its function. Rediscovering
 * those callers by scanning the program each time is the same answer computed
 * repeatedly, so they are indexed once, in the same traversal that indexes each
 * body's definitions.
 */
export interface ProgramWalk {
  /** Function and initializer bodies in declaration order. */
  readonly bodies: readonly ScannedBody[];
  /** Call sites that keep a result, by callee identity. */
  readonly callSites: ReadonlyMap<string, readonly CallSite[]>;
  /** Bodies by the identity of the function they belong to, which a call names. */
  readonly bodiesByOwner: ReadonlyMap<string, ScannedBody>;
  /** Module objects, whose storage any other body or an interrupt may read. */
  readonly moduleObjects: ReadonlySet<string>;
  /**
   * Objects the author pinned to an address, with the bytes each one covers.
   *
   * A write to a constant address is ordinary processor work until that address
   * is one an object was placed at, and then it is a write to that object —
   * which another body can read by name without any address appearing anywhere.
   */
  readonly placedObjects: readonly PlacedObject[];
  /**
   * Objects whose address is taken somewhere in the program.
   *
   * This walk recognizes a read as a load of a named place. Once an address
   * exists, a read can be made through it instead, by an operation this walk
   * does not match and possibly in a body it never visits — which is how an
   * array filled with block numbers and lent to a helper reaches the chip.
   */
  readonly addressTaken: ReadonlySet<string>;
  /**
   * Functions whose address is taken somewhere in the program.
   *
   * A call made through an address has no resolved callee at this stage, so for
   * one of these functions the named call sites are not all of the places its
   * result arrives.
   */
  readonly functionAddressTaken: ReadonlySet<string>;
  /**
   * Results of calls made through an address, by the shape that call accepts.
   *
   * These are where the result of an address-taken function may arrive. Every
   * call of that kind is one of these, so following the ones whose shape
   * matches answers the question without a call-target proof — and answers it
   * with the runs the chip reads instead of with the whole object.
   */
  readonly indirectResults: ReadonlyMap<string, readonly CallSite[]>;
}

/** One call made through an address, kept until the body it belongs to exists. */
interface IndirectCall {
  /** Shape the call accepts, which is what its target must have. */
  readonly shape: string;
  /** Value this body receives. */
  readonly result: ValueId;
}

/** One call this body makes, kept until the body it belongs to exists. */
interface BodyCall {
  /** Callee identity. */
  readonly callee: string;
  /** Value this body receives. */
  readonly result: ValueId;
}

/** One parameter's type as a signature states it. */
interface ShapedParameter {
  /** Declared parameter type. */
  readonly type: SemanticType;
  /** The caller also supplies a word-sized outer element count. */
  readonly outerUnsized?: true;
}

/**
 * Render an over-approximation of the shape a call made through an address
 * accepts.
 *
 * The language requires a function value's parameter qualifiers to match its
 * target exactly, so two functions differing only in a `const` borrow really
 * are different types and one address can never denote both. This key erases
 * qualifiers anyway, which merges those genuinely distinct signatures into one
 * group. That direction is deliberate: a group too large adds receivers that
 * cannot actually be called, which widens a demand, while a key that disagreed
 * with the call's own spelling would drop a receiver that can — and a dropped
 * receiver is what leaves a sprite reading character ROM. The precision cost is
 * recorded rather than hidden: a selector returned by one of several
 * same-shape-after-erasure functions is demanded for every call in the group.
 */
function callableShape(parameters: readonly ShapedParameter[], result: SemanticType): string {
  const shapes = parameters.map(({ type, outerUnsized }) =>
    outerUnsized === true && type.kind === "array"
      ? `${semanticTypeKey(type.element)}[]`
      : semanticTypeKey(type),
  );
  return `fn(${shapes.join(",")}):${semanticTypeKey(result)}`;
}

/** Describe one parameter by the storage its name denotes. */
function scannedParameter(parameter: StorageValue): ScannedParameter {
  const kind = parameter.type.kind;
  return Object.freeze({
    key: bindingIdentityKey(parameter.id),
    borrowed: kind === "array" || kind === "struct",
  });
}

/**
 * Index one body's value definitions, the calls it makes and the addresses it
 * takes, in one traversal of its operations. Everything but the definitions
 * comes back separately, because each belongs to the program rather than to
 * this body — and a call site is recorded against the body that makes it, which
 * does not exist until this returns.
 */
function scannedBody(
  owner: string | null,
  blocks: readonly SemanticBlock[],
  parameters: readonly StorageValue[],
  shape: string | null,
): {
  readonly body: ScannedBody;
  readonly calls: readonly BodyCall[];
  readonly addressTaken: readonly string[];
  readonly functionAddressTaken: readonly string[];
  readonly indirectCalls: readonly IndirectCall[];
} {
  const definitions = new Map<string, SemanticOperation>();
  const calls: BodyCall[] = [];
  const addressTaken: string[] = [];
  const functionAddressTaken: string[] = [];
  const indirectCalls: IndirectCall[] = [];
  for (const block of blocks)
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
      if (operation.kind === "call" && operation.result !== null)
        calls.push(
          Object.freeze({ callee: bindingIdentityKey(operation.callee), result: operation.result }),
        );
      if (operation.kind === "place-address")
        addressTaken.push(bindingIdentityKey(operation.place.root));
      if (operation.kind === "function-address")
        functionAddressTaken.push(bindingIdentityKey(operation.function));
      if (operation.kind === "indirect-call" && operation.result !== null)
        indirectCalls.push(
          Object.freeze({
            shape: callableShape(operation.signature.parameters, operation.signature.returnType),
            result: operation.result,
          }),
        );
    }
  return {
    body: Object.freeze({
      owner,
      blocks,
      definitions,
      parameters: Object.freeze(parameters.map(scannedParameter)),
      shape,
    }),
    calls,
    addressTaken,
    functionAddressTaken,
    indirectCalls,
  };
}

/**
 * Index every body of one program, and the call sites that keep a result.
 *
 * Both indexes come out of the one traversal of the operations: the walk needs
 * each body's definitions anyway, and a caller search that rescans the program
 * is the same answer computed again for every value that leaves a body.
 */
export function scanProgram(
  functions: readonly SemanticFunction[],
  globals: readonly SemanticGlobal[],
): ProgramWalk {
  const scanned = [
    ...functions.map((fn) =>
      scannedBody(
        bindingIdentityKey(fn.id),
        fn.blocks,
        fn.parameters,
        callableShape(fn.parameters, fn.result),
      ),
    ),
    ...globals.map((global) => scannedBody(null, global.blocks, [], null)),
  ];
  const callSites = new Map<string, CallSite[]>();
  const bodiesByOwner = new Map<string, ScannedBody>();
  const addressTaken = new Set<string>();
  const functionAddressTaken = new Set<string>();
  const indirectResults = new Map<string, CallSite[]>();
  for (const entry of scanned) {
    if (entry.body.owner !== null) bodiesByOwner.set(entry.body.owner, entry.body);
    for (const taken of entry.addressTaken) addressTaken.add(taken);
    for (const taken of entry.functionAddressTaken) functionAddressTaken.add(taken);
    for (const call of entry.indirectCalls) {
      const sites = indirectResults.get(call.shape) ?? [];
      sites.push(Object.freeze({ body: entry.body, result: call.result }));
      indirectResults.set(call.shape, sites);
    }
    for (const call of entry.calls) {
      const sites = callSites.get(call.callee) ?? [];
      sites.push(Object.freeze({ body: entry.body, result: call.result }));
      callSites.set(call.callee, sites);
    }
  }
  return Object.freeze({
    bodies: Object.freeze(scanned.map(({ body }) => body)),
    callSites,
    bodiesByOwner,
    moduleObjects: new Set(globals.map((global) => bindingIdentityKey(global.id))),
    placedObjects: Object.freeze(
      globals.flatMap((global) =>
        typeof global.placement?.at === "number"
          ? [Object.freeze({ start: global.placement.at, size: semanticTypeSize(global.type) })]
          : [],
      ),
    ),
    addressTaken,
    functionAddressTaken,
    indirectResults,
  });
}
