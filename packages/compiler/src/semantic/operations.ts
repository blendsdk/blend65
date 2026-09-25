import type { SemanticAsset } from "../assets/asset-types.js";
import type {
  BindingId,
  EffectSummary,
  FunctionType,
  IntegerFacts,
  PlacementConstraints,
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
  /** The caller also supplies a word-sized outer element count. */
  readonly outerUnsized?: true;
}

/** Runtime count carried beside one borrowed outer-unsized array. */
export type ArrayCountSource =
  | { readonly kind: "fixed"; readonly count: number }
  | { readonly kind: "parameter"; readonly binding: BindingId };

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
  /** Declared packed root type, retained for field offsets and element scaling. */
  readonly rootType?: SemanticType;
  /** Ordered field/index selections from the root. */
  readonly path: readonly SemanticPlacePath[];
}

/** An already chosen home for a fixed aggregate result. */
export type AggregateDestination =
  | { readonly kind: "place"; readonly place: SemanticPlace }
  | { readonly kind: "caller" };

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
  /** Materialize the object's bytes now when a later member expression may change them. */
  readonly captureValue?: true;
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
  /** Exact right-hand source expression, when available for user-facing diagnostics. */
  readonly rightSpan?: SourceSpan;
}

/** One exact, ordered processor-control instruction with no source result. */
export interface CpuControlOperation {
  /** Operation discriminator. */
  readonly kind: "cpu-control";
  /** Closed source spelling, retained independently of surrounding calls. */
  readonly control: "asm_sei" | "asm_cli" | "asm_php" | "asm_plp" | "asm_nop";
  /** Exact source call. */
  readonly span: SourceSpan;
}

/** Decimal arithmetic whose carry and D-flag lifetime are owned by lowering. */
export interface BcdOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "bcd";
  /** Exact decimal operation. */
  readonly operator: "add" | "sub";
  /** Operands evaluated in source order. */
  readonly left: ValueId;
  readonly right: ValueId;
  /** Number of packed bytes. */
  readonly width: 1 | 2;
  /** Whether each operand's decimal digits were proved valid at compile time. */
  readonly validLeft: boolean;
  readonly validRight: boolean;
  /** SED, carry initialization, ADC/SBC and CLD are inseparable flag effects. */
  readonly flagEffects: "owned-decimal-region";
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
  /** Count source for each array argument, aligned with `arguments`. */
  readonly argumentArrayCounts?: readonly (ArrayCountSource | null)[];
  /** Declared function result type. */
  readonly type: SemanticType;
  /** Final object selected before the call, when a fixed result need not use a temporary. */
  readonly aggregateDestination?: AggregateDestination;
  /** Complete call-expression span. */
  readonly span: SourceSpan;
}

/** A source function or callback-only handler address, kept symbolic until final layout. */
export interface FunctionAddressOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "function-address";
  /** Source identity whose entry kind agrees with the value type. */
  readonly function: BindingId;
}

/** A call whose already-evaluated typed target needs whole-program target proof. */
export interface IndirectCallOperation {
  /** Operation discriminator. */
  readonly kind: "indirect-call";
  /** Result value, or null for a void call. */
  readonly result: ValueId | null;
  /** Target evaluated once before any arguments. */
  readonly target: ValueId;
  /** Exact call-target source spelling retained for a proving diagnostic. */
  readonly targetDisplay?: string;
  /** Argument values evaluated in source order. */
  readonly arguments: readonly ValueId[];
  /** Count source for each outer-unsized array argument. */
  readonly argumentArrayCounts?: readonly (ArrayCountSource | null)[];
  /** Exact ordinary function signature. */
  readonly signature: FunctionType;
  /** Declared result type. */
  readonly type: SemanticType;
  /** Caller-owned destination for a fixed aggregate result. */
  readonly aggregateDestination?: AggregateDestination;
  /** Source call span. */
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
  /** Final object available for direct construction without an intermediate copy. */
  readonly destination?: AggregateDestination;
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

/** Read the caller-supplied word count of an outer-unsized array parameter. */
export interface ArrayCountOperation extends ValueOperation {
  /** Operation discriminator. */
  readonly kind: "array-count";
  /** Borrowed parameter whose frame holds address then count. */
  readonly parameter: BindingId;
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
  | CpuControlOperation
  | BcdOperation
  | CallOperation
  | FunctionAddressOperation
  | IndirectCallOperation
  | MemoryReadOperation
  | MemoryWriteOperation
  | PlatformOperation
  | EmbeddedAddressOperation
  | AggregateOperation
  | ArrayCountOperation
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
  /** Public source declaration retained as an independently callable entry. */
  readonly exported?: boolean;
  /** Ordinary call body or callback-only interrupt handler body. */
  readonly entryKind?: "ordinary" | "interrupt";
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
  /** Optional source constraint on this emitted routine. */
  readonly placement?: PlacementConstraints | null;
}

/** One module or constant binding and its explicit initialization control flow. */
export interface SemanticGlobal {
  /** Stable source declaration identity. */
  readonly id: BindingId;
  /** Whether the source binding is mutable module storage or an immutable constant. */
  readonly storage: "module" | "constant";
  /** Declared global type. */
  readonly type: SemanticType;
  /** Complete compile-time initial bytes, or null when startup must execute the initializer. */
  readonly initialBytes: readonly number[] | null;
  /** Constant bytes a side-effect-free runtime initializer may store directly, when known. */
  readonly runtimeInitialBytes: readonly number[] | null;
  /** Initializer entry block, or null when no runtime initializer exists. */
  readonly entry: BlockId | null;
  /** Initializer blocks in deterministic construction order. */
  readonly blocks: readonly SemanticBlock[];
  /** Source declaration span. */
  readonly source: SourceSpan;
  /** Optional source constraint on this resident object. */
  readonly placement?: PlacementConstraints | null;
  /** Mutable storage must occupy the selected zero-page window. */
  readonly zeropage?: boolean;
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
