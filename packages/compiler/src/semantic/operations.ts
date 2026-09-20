import type { SemanticAsset } from "../assets/asset-types.js";
import type {
  BindingId,
  EffectSummary,
  IntegerFacts,
  ProfileEffect,
  SemanticType,
} from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";

/** Stable identity of one semantic basic block. */
export type BlockId = string;

/** Stable function-local identity of one computed semantic value. */
export type ValueId = string;

/** One source variable, parameter, or temporary with its exact type. */
export interface StorageValue {
  /** Source-based storage identity. */
  readonly id: BindingId;
  /** Exact value type retained from frontend analysis. */
  readonly type: SemanticType;
}

/** A field selected from an aggregate place. */
export interface SemanticFieldPath {
  /** Path discriminator. */
  readonly kind: "field";
  /** Exact source field name. */
  readonly name: string;
}

/** An array element selected by a previously evaluated ordinal. */
export interface SemanticIndexPath {
  /** Path discriminator. */
  readonly kind: "index";
  /** Word or byte ordinal evaluated exactly once. */
  readonly value: ValueId;
}

/** One already-evaluated step from a root binding to a concrete place. */
export type SemanticPlacePath = SemanticFieldPath | SemanticIndexPath;

/** Symbolic storage location kept independent from target addresses and layout. */
export interface SemanticPlace {
  /** Source declaration at the root of the place. */
  readonly root: BindingId;
  /** Ordered field/index selections from the root. */
  readonly path: readonly SemanticPlacePath[];
}

/** Fields shared by value-producing arithmetic operations. */
interface ValueOperation {
  /** Newly defined value, unique within its function or initializer. */
  readonly result: ValueId;
  /** Source-language result type. */
  readonly type: SemanticType;
  /** Runtime integer behavior, or null for non-integers. */
  readonly integer: IntegerFacts | null;
  /** Exact source expression that produced the value. */
  readonly span: SourceSpan;
}

/** A source constant retained with its mathematical value. */
export interface ConstantOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "constant";
  /** Exact integer or Boolean value. */
  readonly value: bigint | boolean;
}

/** An explicit source-language integer conversion. */
export interface ConvertOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "convert";
  /** Value before conversion. */
  readonly operand: ValueId;
  /** Exact conversion admitted by type analysis. */
  readonly conversion: "identity" | "zero-extend" | "sign-extend" | "truncate" | "reinterpret";
}

/** The symbolic address of a source place. */
export interface PlaceAddressOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "place-address";
  /** Addressed source place. */
  readonly place: SemanticPlace;
}

/** One ordered read from a symbolic source place. */
export interface LoadOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "load";
  /** Place read exactly once. */
  readonly place: SemanticPlace;
}

/** One ordered write to a symbolic source place. */
export interface StoreOperation {
  /** Operation discriminator. */
  readonly kind: "store";
  /** Place written exactly once. */
  readonly place: SemanticPlace;
  /** Value written to the place. */
  readonly value: ValueId;
  /** Exact stored type. */
  readonly type: SemanticType;
  /** Exact source assignment or declaration span. */
  readonly span: SourceSpan;
}

/** One typed unary value operation. */
export interface UnaryOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "unary";
  /** Exact source operator. */
  readonly operator: string;
  /** Evaluated operand. */
  readonly operand: ValueId;
}

/** One typed left-to-right binary value operation. */
export interface BinaryOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "binary";
  /** Exact source operator. */
  readonly operator: string;
  /** Left operand evaluated before the right operand. */
  readonly left: ValueId;
  /** Right operand evaluated after the left operand. */
  readonly right: ValueId;
}

/** One direct call after every argument has been staged. */
export interface CallOperation {
  /** Operation discriminator. */
  readonly kind: "call";
  /** Result value, or null for a void call. */
  readonly result: ValueId | null;
  /** Resolved source function identity. */
  readonly callee: BindingId;
  /** Staged argument values in source order. */
  readonly arguments: readonly ValueId[];
  /** Declared function result type. */
  readonly type: SemanticType;
  /** Complete call-expression span. */
  readonly span: SourceSpan;
}

/** One volatile byte or word read from a computed 16-bit address. */
export interface MemoryReadOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "memory-read";
  /** Computed address with modulo-65536 meaning. */
  readonly address: ValueId;
  /** Number of bytes read. */
  readonly width: 1 | 2;
  /** Required two-byte access order. */
  readonly byteOrder: "low-first";
  /** Raw-memory reads are never removed, duplicated, or reordered. */
  readonly volatile: true;
}

/** One volatile byte or word write to a computed 16-bit address. */
export interface MemoryWriteOperation {
  /** Operation discriminator. */
  readonly kind: "memory-write";
  /** Computed address with modulo-65536 meaning. */
  readonly address: ValueId;
  /** Value written after the address has been evaluated. */
  readonly value: ValueId;
  /** Number of bytes written. */
  readonly width: 1 | 2;
  /** Required two-byte access order. */
  readonly byteOrder: "low-first";
  /** Raw-memory writes are never removed, duplicated, or reordered. */
  readonly volatile: true;
  /** Complete intrinsic-call span. */
  readonly span: SourceSpan;
}

/** One target-neutral operation supplied by the selected declaration profile. */
export interface PlatformOperation {
  /** Operation discriminator. */
  readonly kind: "platform";
  /** Result value, or null for a void operation. */
  readonly result: ValueId | null;
  /** Fully qualified declaration capability. */
  readonly capability: string;
  /** Staged arguments in source order. */
  readonly arguments: readonly ValueId[];
  /** Source-language result type. */
  readonly type: SemanticType;
  /** Target-neutral ordering behavior. */
  readonly effect: ProfileEffect;
  /** Complete source call span. */
  readonly span: SourceSpan;
}

/** An immutable compile-time asset address kept symbolic until layout. */
export interface EmbeddedAddressOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "embedded-address";
  /** Compiler-owned immutable asset identity. */
  readonly asset: string;
}

/** One directly constructed fixed aggregate with source-ordered element values. */
export interface AggregateOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "aggregate";
  /** Explicit array elements or named struct fields in source order. */
  readonly elements: readonly {
    /** Struct field name, or null for an array element. */
    readonly field: string | null;
    /** Already evaluated element value. */
    readonly value: ValueId;
  }[];
  /** Remaining-element fill value for an array, or null when absent. */
  readonly fill: ValueId | null;
}

/** A value selected from mutually exclusive predecessor blocks. */
export interface MergeOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "merge";
  /** One incoming value for each control-flow predecessor. */
  readonly incoming: readonly {
    /** Predecessor block. */
    readonly block: BlockId;
    /** Value produced along that predecessor. */
    readonly value: ValueId;
  }[];
}

/** Every target-neutral operation admitted by the current semantic stage. */
export type SemanticOperation =
  | ConstantOperation
  | ConvertOperation
  | PlaceAddressOperation
  | LoadOperation
  | StoreOperation
  | UnaryOperation
  | BinaryOperation
  | CallOperation
  | MemoryReadOperation
  | MemoryWriteOperation
  | PlatformOperation
  | EmbeddedAddressOperation
  | AggregateOperation
  | MergeOperation;

/** Unconditional control transfer. */
export interface JumpTerminator {
  /** Terminator discriminator. */
  readonly kind: "jump";
  /** Sole successor block. */
  readonly target: BlockId;
}

/** Conditional control transfer with explicit selected successors. */
export interface BranchTerminator {
  /** Terminator discriminator. */
  readonly kind: "branch";
  /** Evaluated Boolean condition. */
  readonly condition: ValueId;
  /** Successor selected for true. */
  readonly whenTrue: BlockId;
  /** Successor selected for false. */
  readonly whenFalse: BlockId;
}

/** Function return with an optional result value. */
export interface ReturnTerminator {
  /** Terminator discriminator. */
  readonly kind: "return";
  /** Returned value, or null for void. */
  readonly value: ValueId | null;
}

/** A block with no executable successor. */
export interface UnreachableTerminator {
  /** Terminator discriminator. */
  readonly kind: "unreachable";
}

/** Complete control transfer ending one semantic basic block. */
export type SemanticTerminator =
  | JumpTerminator
  | BranchTerminator
  | ReturnTerminator
  | UnreachableTerminator;

/** One immutable basic block in a source function. */
export interface SemanticBlock {
  /** Stable function-local block identity. */
  readonly id: BlockId;
  /** Operations in exact execution order. */
  readonly operations: readonly SemanticOperation[];
  /** Required terminal control transfer. */
  readonly terminator: SemanticTerminator;
}

/** One source function lowered to target-neutral operations and explicit control flow. */
export interface SemanticFunction {
  /** Stable source declaration identity. */
  readonly id: BindingId;
  /** Source display name used when a later diagnostic must identify the function. */
  readonly name?: string;
  /** Parameters in source order. */
  readonly parameters: readonly StorageValue[];
  /** Declared return type. */
  readonly result: SemanticType;
  /** Entry basic block. */
  readonly entry: BlockId;
  /** Basic blocks in deterministic construction order. */
  readonly blocks: readonly SemanticBlock[];
  /** Complete source function span. */
  readonly source: SourceSpan;
}

/** One module or constant binding and its explicit initialization control flow. */
export interface SemanticGlobal {
  /** Stable source declaration identity. */
  readonly id: BindingId;
  /** Declared global type. */
  readonly type: SemanticType;
  /** Initializer entry block, or null when no runtime initializer exists. */
  readonly entry: BlockId | null;
  /** Initializer blocks in deterministic construction order. */
  readonly blocks: readonly SemanticBlock[];
  /** Source declaration span. */
  readonly source: SourceSpan;
}

/** Complete target-neutral semantic input for whole-program analysis. */
export interface SemanticProgram {
  /** Unique selected source entry function. */
  readonly main: BindingId;
  /** Module and constant storage in semantic identity order. */
  readonly globals: readonly SemanticGlobal[];
  /** Ordinary source functions in semantic identity order. */
  readonly functions: readonly SemanticFunction[];
  /** Frontend-proved transitive effects, retained for reachable-program filtering. */
  readonly effects?: readonly EffectSummary[];
  /** Immutable resident assets, still without physical placement. */
  readonly assets: readonly SemanticAsset[];
  /** Runtime global initializer roots in proved execution order. */
  readonly initializerOrder: readonly BindingId[];
}
