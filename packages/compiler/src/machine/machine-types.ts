import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type {
  StorageBinder,
  StorageProfile,
  StorageRequest,
  StorageInventory,
} from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { CpuFlag, CpuRegister, CpuFacts } from "../target/nmos6510.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { InterruptMaterializations } from "../semantic/interrupt-context-facts.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import type { BindingId, PlacementConstraints } from "../frontend/semantic-types.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import type { StoragePlacement } from "../storage/storage-types.js";
import type { C64StartupInput, C64StartupPolicy } from "../layout/startup.js";
import type { ClosedObjectFacts } from "../semantic/closed-object-facts.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type {
  SemanticFunction,
  SemanticBlock,
  SemanticOperation,
  SemanticPlace,
} from "../semantic/operations.js";
import type { SemanticPosition } from "../semantic/whole-program.js";
import type { LoweredValue } from "./lower-control.js";
import type { ValueLifetime } from "../semantic/whole-program.js";
import type { FunctionStorageSelection } from "../storage/selection.js";
import type { BooleanCallProof } from "./lower-call.js";
import type { ByteComplementFacts, ByteComplementProof } from "./byte-value-availability.js";
import type { OptimizationFacts } from "./optimization-facts.js";

/** Symbolic byte identity retained for final reference/candidate observer checks. */
export interface ByteWindowAddress {
  /** Existing SFA request or resident data symbol, never a provisional numeric address. */
  readonly kind: "home" | "symbol";
  /** Exact request or symbol identity. */
  readonly id: string;
  /** Byte displacement inside that original object. */
  readonly offset: number;
}

/** Conditional machine-edge retention, not proof that a physical memory reload is unobservable. */
export interface ByteAvailabilityProof {
  /** Exact source function binding shared with the checked program. */
  readonly function: BindingId;
  /** This early window is admitted only in an ordinary mainline execution context. */
  readonly domain: "main";
  /** Original comparison's source range. */
  readonly producer: SourceSpan;
  /** Original bitwise consumer's source range. */
  readonly consumer: SourceSpan;
  /** Block whose reference EOR is replaced by value-preserving CMP. */
  readonly from: string;
  /** Single-entry successor which consumes that same byte with AND. */
  readonly to: string;
  /** Memory value held in A, including the reload which was omitted. */
  readonly left: ByteWindowAddress;
  /** Unchanged comparison/AND operand. */
  readonly right: ByteWindowAddress;
  /** A/P differences until independent overwrite/return are also final observer obligations. */
  readonly changedState: readonly ("a" | "n" | "z" | "c")[];
  /** Final physical/source/async checks must discharge the omitted read and changed A/P interval. */
  readonly pendingObservers: true;
}

/** One actual shaped edge and its source/entry facts; no CFG or memory fact is guessed. */
export interface ByteAvailabilityInput {
  /** Actual checked source binding owning both machine blocks. */
  readonly function: BindingId;
  /** Actual lowering context; IRQ/NMI variants retain ordinary reloads in this slice. */
  readonly domain: ExecutionDomain;
  /** Existing comparison block. */
  readonly producer: MachineBlock;
  /** Existing immediate bitwise successor. */
  readonly consumer: MachineBlock;
  /** Complete unchanged shaped function, including the sibling edge and ordinary exits. */
  readonly blocks: ReadonlyMap<string, MachineBlock>;
  /** All direct incoming edges to the successor, including long and unconditional edges. */
  readonly incomingEdges: number;
  /** Entry/address references prevent treating this edge as the successor's sole entry. */
  readonly externallyEntered: boolean;
}

/** Exact source/private/native-store window, conditional on complete final observers. */
export interface NativeStoreProof {
  /** Original source function whose arithmetic and variable are represented. */
  readonly function: BindingId;
  /** Only ordinary mainline contexts admit this selected store window. */
  readonly domain: "main";
  /** Actual selected code context after specialization. */
  readonly context: string;
  /** Actual owning machine block. */
  readonly block: string;
  /** Original scalar arithmetic; its captured source value remains identified. */
  readonly arithmetic: Extract<SemanticOperation, { readonly kind: "binary" }>;
  /** Source-variable write that remains in the selected output. */
  readonly write: Extract<SemanticOperation, { readonly kind: "store" }>;
  /** Original source reload replaced by the still-current accumulator. */
  readonly read: Extract<SemanticOperation, { readonly kind: "load" }>;
  /** Exact native indexed source consumer, whose store remains unchanged. */
  readonly consumer: Extract<SemanticOperation, { readonly kind: "store" }>;
  /** Original capture request remains in inventory until observer closure. */
  readonly captureRequestId: string;
  /** Actual source-variable home, not an inferred source-name match. */
  readonly variableRequestId: string;
  /** Complete removed capture/reload instructions, retaining their source and operand identities. */
  readonly removed: readonly MachineInstruction[];
  /** Whether ORA0 restores N/Z before the preserved stores. */
  readonly restoresFlags: boolean;
  /** Transient N/Z intervals remain an asynchronous observer obligation even with restoration. */
  readonly changedState: readonly ("n" | "z")[];
  /** No physical/source/raw/asynchronous observation is discharged by local matching. */
  readonly pendingObservers: true;
}

/** Source facts indexed once for one immutable function, shared by its machine contexts. */
export interface MachineFunctionSourceFacts {
  /** Exact source function; equal binding spellings are not enough after a rebuild. */
  readonly function: SemanticFunction;
  /** Shared whole-source object identities and still-pending observer obligations. */
  readonly objects: ClosedObjectFacts;
  /** Recognized induction facts owned by this exact source function. */
  readonly loops: readonly FixedLoopFacts[];
  /** Conditional private binding occupancy, not permission to overlay or remove a home. */
  readonly lifetimes: ReadonlyMap<string, ValueLifetime>;
  /** Explicit conditional representation; source facts alone never enable a rewrite. */
  readonly storage?: FunctionStorageSelection;
  /** Once-derived complement facts; field/cache selection remains an explicit Closed choice. */
  readonly complements?: ByteComplementFacts;
}

/** Optional internal handoff; carrying facts alone activates no representation change. */
export interface MachineSourceFacts {
  /** Original checked source, before the existing zero-page global placement reservation. */
  readonly program: WholeProgram;
  /** Explicit non-loop choice; omission keeps the existing register/flag selection. */
  readonly nonLoopBundle?: "direct" | "closed";
  /** Explicit finite loop construction; omission keeps original word lowering. */
  readonly loopPolicy?: FixedLoopPolicy;
  /** Selected cooperative startup construction; omission preserves the proof-derived default. */
  readonly startupPolicy?: C64StartupPolicy;
  /** Immutable function keys avoid deriving or scanning source facts per machine variant. */
  readonly functions: ReadonlyMap<SemanticFunction, MachineFunctionSourceFacts>;
}

/** The finite construction policies; these are internal recipes, not source options. */
export type FixedLoopPolicy =
  | "original"
  | "low-byte"
  | "x-first"
  | "y-first"
  | "flat-eight-x-first"
  | "flat-eight-y-first"
  | "mixed";

/** One emitted occurrence still belongs to the same checked source block and values. */
export interface FixedLoopOccurrence {
  /** Original immutable block, including original operations and storage positions. */
  readonly source: SemanticBlock;
  /** Source proof for an expanded body, absent for an ordinary block. */
  readonly loop: FixedLoopFacts | null;
  /** Source iteration, not a new SSA or storage identity. */
  readonly iteration: number | null;
}

/** Conditional loop provenance which final physical observers and debug evidence must consume. */
export interface FixedLoopProof {
  /** Exact source loop and its still-pending counter/range/alias obligations. */
  readonly loop: FixedLoopFacts;
  /** Actual selected machine-function context, not only the source declaration. */
  readonly context: string;
  /** Selected finite policy, independent of the non-loop bundle. */
  readonly policy: FixedLoopPolicy;
  /** Expanded source body with explicit per-iteration provenance. */
  readonly representation: "flat-eight";
  /** Actual generated blocks for each original source iteration. */
  readonly occurrences: readonly {
    /** Zero-based source iteration. */
    readonly iteration: number;
    /** Complete selected blocks, including bounds and variable-operation continuations. */
    readonly blocks: readonly string[];
  }[];
  /** Registers and arithmetic flags whose removed control intervals need final observation proof. */
  readonly changedState: readonly ("a" | "x" | "y" | "n" | "z" | "c" | "v")[];
  /** Source homes, removed control accesses and changed A/P intervals are not discharged here. */
  readonly pendingObservers: true;
}

/** Closed-storage obligations for one selected source word represented by one byte. */
export interface FixedCounterProof {
  /** Actual source index views consumed by this counter, not a span-derived association. */
  readonly indexUses?: readonly { readonly value: string; readonly consumer: SemanticOperation }[];
  /** Original loop, exits and pending source range/alias observations. */
  readonly loop: FixedLoopFacts;
  /** Exact selected machine context after domain specialization. */
  readonly context: string;
  /** Current memory representation; later register choices carry their own exact register. */
  readonly representation: "low-byte" | "x" | "y";
  /** Reference source word home remains observable until final validation proves otherwise. */
  readonly originalRequestId: string;
  /** Predeclared byte counter, never anonymous target storage. */
  readonly requestId: string | null;
  /** The positive first comparison is omitted; its source state interval still needs final proof. */
  readonly firstTestElided?: boolean;
  /** Original source value reads and any retained two-byte argument stages. */
  readonly reads: readonly { readonly value: string; readonly stagingRequestId: string | null }[];
  /** Conservative control/read intervals whose architectural differences remain to be checked. */
  readonly changedState: readonly ("a" | "x" | "y" | "n" | "z" | "c" | "v")[];
  /** Removed high-byte/control reads and changed A/P intervals still require final validation. */
  readonly pendingObservers: true;
}

/** Context-local counter representation; only its explicit owner can define a held register. */
export interface FixedCounterRuntime {
  /** Original immutable source loop. */
  readonly loop: FixedLoopFacts;
  /** Reference word storage retained until final observer closure. */
  readonly originalRequestId: string;
  /** A predeclared byte home, absent for a held-register representation. */
  readonly home: Extract<LoweredValue, { readonly kind: "storage" }> | null;
  /** Held index register, absent for a byte home. */
  readonly register: "x" | "y" | null;
  /** Sole pure parent-plus-one initializer, if its redundant word arithmetic can be omitted. */
  readonly parentInitialization: SemanticPlace | null;
  /** Explicit initialization/update writes allowed by the register proof. */
  readonly ownWrites: Set<MachineInstruction>;
  /** Logical reads and their existing argument stages. */
  readonly reads: Map<string, string | null>;
}

/** Per-function emission schedule and finite counter recipes; source IR remains immutable. */
export interface FixedLoopRuntime {
  /** Preserve source-block/index associations only for explicitly instrumented size closure. */
  readonly observerEvidence?: boolean;
  /** Selected CPU. */
  readonly cpu: CpuFacts;
  /** Source-admitted counters. */
  readonly counterFacts: readonly FixedLoopFacts[];
  /** Chosen register policy after joint nest proof. */
  readonly registers: Map<FixedLoopFacts, "x" | "y">;
  /** Counter-control operation owners. */
  readonly counterOperations: Map<SemanticOperation, FixedCounterRuntime>;
  /** Actual selected counter roots. */
  readonly counters: Map<string, FixedCounterRuntime>;
  /** Sole typed index consumers of held-register values. */
  readonly indexViews: Map<
    string,
    { readonly counter: FixedCounterRuntime; readonly consumer: SemanticOperation }
  >;
  /** Actual use of each native index view. */
  readonly consumedIndices: Set<string>;
  /** Complete source uses, indexed once; null represents a terminator use. */
  readonly consumers: ReadonlyMap<string, readonly (SemanticOperation | null)[]>;
  /** Existing argument-stage identities, indexed once. */
  readonly stageIds: ReadonlySet<string>;
  /** Actual blocks emitted for each original source block. */
  readonly sourceBlocks: Map<SemanticBlock, readonly string[]>;
  /** Original source order. */
  readonly blockIndexes: ReadonlyMap<string, number>;
  /** Original predecessor edges. */
  readonly predecessors: ReadonlyMap<string, readonly string[]>;
  /** Original storage positions. */
  readonly positions: readonly SemanticPosition[];
  /** Emission-only block schedule. */
  readonly blocks: readonly SemanticBlock[];
  /** Each scheduled block's original source occurrence. */
  readonly occurrences: ReadonlyMap<string, FixedLoopOccurrence>;
  /** Removed pure initialization operations. */
  readonly omitted: ReadonlySet<SemanticOperation>;
  /** Body-defined values cleared at an expanded occurrence. */
  readonly expanded: ReadonlyMap<FixedLoopFacts, ReadonlySet<string>>;
  /** Counter-dependent values admitted for constant specialization. */
  readonly ordinalValues: ReadonlyMap<FixedLoopFacts, ReadonlySet<string>>;
  /** Explicit finite construction policy. */
  readonly policy: FixedLoopPolicy | undefined;
  /** Current source occurrence. */
  current: FixedLoopOccurrence | undefined;
  /** Actual blocks of each expanded iteration. */
  readonly emitted: Map<FixedLoopFacts, { iteration: number; blocks: readonly string[] }[]>;
}

/** Machine flags whose validity is tracked across structured instructions. */
export type MachineFlag = CpuFlag;

/** Machine registers whose values or stack state can be read or changed. */
export type MachineRegister = CpuRegister;

/** Registers and status flags read or changed by one machine operation. */
export interface MachineStateUse {
  /** Registers in stable architectural order. */
  readonly registers: readonly MachineRegister[];
  /** Status flags in stable architectural order. */
  readonly flags: readonly MachineFlag[];
}

/** Exact encoded size and path-cycle range for one selected instruction. */
export interface MachineCost {
  /** Encoded bytes. */
  readonly bytes: number;
  /** Cycles on the shortest documented path. */
  readonly minCycles: number;
  /** Cycles on the longest documented path. */
  readonly maxCycles: number;
}

/** Original source association, not a substitute for decoding the final CPU bus accesses. */
export interface MachineObserverOrigin {
  /** Existing source family whose producer emitted this sequence. */
  readonly kind: "raw" | "platform" | "typed";
  /** Exact original operation, retained through deferral, expansion and physical sharing. */
  readonly operation: Extract<
    SemanticOperation,
    { readonly kind: "memory-read" | "memory-write" | "platform" | "load" | "store" }
  >;
  /** Actual producer addressing recipe, before resource binding. */
  readonly recipe:
    | "raw-fixed"
    | "raw-indirect"
    | "raw-indexed"
    | "platform"
    | "typed-fixed"
    | "typed-indexed"
    | "typed-indirect";
  /** Producer position: raw/platform include setup; typed records enumerate effective bytes. */
  readonly position: number;
  /** Producer sequence length, including setup for raw/platform recipes. */
  readonly length: number;
  /** Low-first effective source byte; null identifies setup or a platform sequence member. */
  readonly byte: number | null;
  /** Exact selected platform variant, absent when this is not a platform sequence. */
  readonly variant?: string | null;
  /** Original logical typed place, distinct from any ABI pointer's home. */
  readonly place?: SemanticPlace;
  /** Register actually used by the selected typed index construction. */
  readonly indexRegister?: "x" | "y" | null;
  /** Packed displacement actually used by this typed construction, before byte addition. */
  readonly displacement?: number;
  /** Source element stride actually scaled for a direct indexed construction. */
  readonly stride?: number;
  /** Existing use-site unsigned maxima; conditional loop premises still need final closure. */
  readonly indexBounds?: ReadonlyMap<string, bigint>;
  /** Evaluated source address value before binding; never the generated raw pointer's home. */
  readonly addressInput?: LoweredValue;
}

/** Operand of one structured machine instruction before or after resource binding. */
export type MachineOperand =
  | { readonly kind: "register"; readonly register: MachineRegister }
  | { readonly kind: "immediate"; readonly value: number }
  | { readonly kind: "absolute"; readonly value: number }
  | {
      readonly kind: "label";
      readonly label: string;
      readonly offset?: number;
      readonly addressByte?: "low" | "high";
      readonly transform?: "vic-sprite-block";
    }
  | {
      readonly kind: "storage";
      readonly requestId: string;
      readonly offset?: number;
      readonly addressByte?: "low" | "high";
    }
  | { readonly kind: "indirect-y"; readonly requestId: string; readonly offset?: number };

/** Address observed by a structured memory effect. */
export type MachineMemoryAddress =
  | { readonly kind: "absolute"; readonly value: number }
  | { readonly kind: "symbolic"; readonly label: string; readonly offset?: number }
  | { readonly kind: "storage"; readonly requestId: string; readonly offset?: number }
  | { readonly kind: "indirect-y"; readonly requestId: string; readonly offset?: number }
  | { readonly kind: "indirect-y-bound"; readonly pointer: number; readonly displacement: number };

/** One ordered memory access retained independently from opcode spelling. */
export interface MachineMemoryEffect {
  /** Read or write direction. */
  readonly kind: "read" | "write";
  /** Address identity before or after final resource binding. */
  readonly address: MachineMemoryAddress;
  /** Access width in bytes. */
  readonly width: 1 | 2;
  /** Whether the access count and order are observable. */
  readonly volatile: boolean;
  /** Zero-based order among accesses belonging to the source operation. */
  readonly order: number;
}

/** One legal or bindable NMOS instruction with explicit effects and cost. */
export interface MachineInstruction {
  /** Opt-in original access associations; optional memory effects are not their bus oracle. */
  readonly observerOrigins?: readonly MachineObserverOrigin[];
  /** Lowercase mnemonic; validation rejects anything outside the selected CPU grid. */
  readonly opcode: string;
  /** Physical addressing mode, or `storage` before final home binding. */
  readonly mode: string;
  /** Structured operand, never assembly text. */
  readonly operand: MachineOperand | null;
  /** Architectural state read by the instruction. */
  readonly uses: MachineStateUse;
  /** Architectural state changed by the instruction. */
  readonly defines: MachineStateUse;
  /** Ordered memory effects caused by this instruction. */
  readonly memory: readonly MachineMemoryEffect[];
  /** Exact selected form cost. */
  readonly cost: MachineCost;
  /** Source span which selected the instruction, when one exists. */
  readonly source: SourceSpan | null;
  /** Original source iteration for an expanded body; not a new source value or scope. */
  readonly sourceIteration?: number;
}

/** Unconditional transfer to another structured block. */
export interface MachineJumpTerminator {
  /** Terminator discriminator. */
  readonly kind: "jump";
  /** Official jump mnemonic. */
  readonly opcode: "jmp";
  /** Destination block or function label. */
  readonly target: string;
  /** Exact jump cost. */
  readonly cost: MachineCost;
}

/** In-range conditional transfer with one explicit fallthrough block. */
export interface MachineBranchTerminator {
  /** Terminator discriminator. */
  readonly kind: "branch";
  /** Official conditional-branch mnemonic. */
  readonly opcode: string;
  /** Taken destination. */
  readonly target: string;
  /** Untaken destination. */
  readonly fallthrough: string;
  /** Flag consumed by the branch. */
  readonly uses: MachineStateUse;
  /** Exact path cost. */
  readonly cost: MachineCost;
}

/** Monotonic inverse-branch-over-jump replacement for an out-of-range branch. */
export interface MachineLongBranchTerminator {
  /** Terminator discriminator. */
  readonly kind: "long-branch";
  /** Inverse branch which skips the following absolute jump. */
  readonly opcode: string;
  /** Original untaken destination reached by the inverse branch. */
  readonly fallthrough: string;
  /** Structured absolute jump to the original taken destination. */
  readonly jump: {
    readonly opcode: "jmp";
    readonly target: string;
    readonly cost: MachineCost;
  };
  /** Flag consumed by the inverse branch. */
  readonly uses: MachineStateUse;
  /** Combined five-byte path cost. */
  readonly cost: MachineCost;
}

/** Function return through the hardware call stack. */
export interface MachineReturnTerminator {
  /** Terminator discriminator. */
  readonly kind: "return";
  /** Official return mnemonic. */
  readonly opcode?: "rts";
  /** Exact return cost when already selected. */
  readonly cost?: MachineCost;
}

/** Deliberate adjacent transfer with no emitted instruction. */
export interface MachineFallthroughTerminator {
  /** Terminator discriminator. */
  readonly kind: "fallthrough";
  /** Required immediately adjacent destination. */
  readonly target: string;
}

/** Terminal block which cannot execute another instruction. */
export interface MachineUnreachableTerminator {
  /** Terminator discriminator. */
  readonly kind: "unreachable";
}

/** Structured control transfer ending one machine block. */
export type MachineTerminator =
  | MachineJumpTerminator
  | MachineBranchTerminator
  | MachineLongBranchTerminator
  | MachineReturnTerminator
  | MachineFallthroughTerminator
  | MachineUnreachableTerminator;

/** Ordered instruction sequence with one structured terminator. */
export interface MachineBlock {
  /** Construction origins of a shared helper block, not an execution or preemption proof. */
  readonly observerBodies?: readonly MachineBodyOrigin[];
  /** Stable link label. */
  readonly label: string;
  /** Exact physical origin after final block layout. */
  readonly origin?: number;
  /** Instructions in exact execution order. */
  readonly instructions: readonly MachineInstruction[];
  /** Final structured transfer. */
  readonly terminator: MachineTerminator;
}

/** One original body/ABI association retained when physically identical code is shared. */
export interface MachineBodyOrigin {
  /** Exact source body, never a generated-name match. */
  readonly sourceFunction: BindingId;
  /** Construction descriptor only; actual invocation requires the original execution proof. */
  readonly executionContext: InterruptExecutionContext;
}

/** Compile-time identity of the indexed aggregate base held in the shared address pair. */
export interface AggregateAddressCache {
  /** Stable identity of the aggregate root and scaled index sources. */
  readonly key: string;
  /** Source binding whose packed bytes the pointer addresses. */
  readonly rootBindingKey: string;
  /** Storage homes whose current values contributed dynamic index terms. */
  readonly indexRequestIds: readonly string[];
}

/** One reachable source/startup function in structured machine form. */
export interface MachineFunction {
  /** Actual full-object capture demands, not a proof that their copies or consumers are safe. */
  readonly observerCaptures?: readonly {
    /** Exact original evaluated aggregate operation. */
    readonly operation: Extract<SemanticOperation, { readonly kind: "place-address" }>;
    /** Actual producer-created temporary; never reconstructed from its generated spelling. */
    readonly requestId: string;
  }[];
  /** Original source blocks and their actual emitted blocks, including conditional Original loops. */
  readonly observerBlocks?: readonly (readonly [SemanticBlock, readonly string[]])[];
  /** All body-construction associations retained by physical sharing, not an invocation proof. */
  readonly observerBodies?: readonly MachineBodyOrigin[];
  /**
   * Body-construction/ABI provenance, possibly for retained or shared code, not execution proof.
   * Observers must also use the original complete execution analysis.
   */
  readonly executionContext?: InterruptExecutionContext;
  /** Original source owner, independent of display names and context-specific code labels. */
  readonly sourceFunction?: BindingId;
  /** Stable link identity. */
  readonly id: string;
  /** Source display name retained only for readable assembly and evidence. */
  readonly sourceName?: string;
  /** Fixed origin when platform startup owns it. */
  readonly origin?: number;
  /** Blocks in selected layout order. */
  readonly blocks: readonly MachineBlock[];
  /** Conditional byte-retention observers to validate before accepting the complete candidate. */
  readonly byteAvailabilityProofs?: readonly ByteAvailabilityProof[];
  /** Conditional capture/reload coalescing before proved native indexed stores. */
  readonly nativeStoreProofs?: readonly NativeStoreProof[];
  /** Pending old-home/new-read/cache/A/P obligations from selected complement recipes. */
  readonly byteComplementProofs?: readonly ByteComplementProof[];
  /** Pending reference capture/read and asynchronous state obligations at selected Boolean calls. */
  readonly booleanCallProofs?: readonly BooleanCallProof[];
  /** Conditional source/control/home and occurrence records from fixed-loop selection. */
  readonly fixedLoopProofs?: readonly FixedLoopProof[];
  /** Pending original/new counter homes, word reconstruction and changed-state observations. */
  readonly fixedCounterProofs?: readonly FixedCounterProof[];
  /** Optional source placement retained until final layout. */
  readonly placement?: PlacementConstraints;
  /** Qualified cooperative NMI entries must publish at the profile's common low byte. */
  readonly nmiPublicationEntry?: true;
  /** CPU frame plus the actual register/status saves of this selected NMI entry. */
  readonly nmiEntryStackBytes?: number;
}

/** Immutable, mutable or zero-initialized non-function object. */
export interface MachineDataObject {
  /** Stable object identity. */
  readonly id: string;
  /** Source display name retained only for readable assembly and evidence. */
  readonly sourceName?: string;
  /** Platform-layout ownership class. */
  readonly kind: "immutable" | "global" | "bss" | "asset";
  /** Semantic asset identity for an asset object. */
  readonly assetId?: string;
  /** False for ordinary raw data that does not feed a VIC sprite-block operand. */
  readonly vicSpriteBlocks?: boolean;
  /** Required byte alignment. */
  readonly alignment: number;
  /** Exact resident bytes; BSS bytes are explicit zeroes in this phase. */
  readonly bytes: readonly number[];
  /** Optional source placement retained until final layout. */
  readonly placement?: PlacementConstraints;
  /** Mutable global storage is allocated from the selected zero-page window. */
  readonly zeropage?: boolean;
}

/** Closed structured machine program before terminal serialization. */
export interface MachineProgram {
  /** Conditional demand/occupancy changes and original authority for final observer checks. */
  readonly storageSelection?: {
    /** Complete original declarations and discovered requests before projection. */
    readonly originalInventory: StorageInventory;
    /** Exact original source packets, including sealed replacement authority. */
    readonly sourceFacts: MachineSourceFacts;
    /** Requests removed only by explicit replacement and complete reference absence. */
    readonly omitted: readonly StorageRequest[];
    /** Physical/raw/alias/asynchronous observers remain a separate acceptance gate. */
    readonly pendingObservers: true;
  };
  /** Reachable ordinary functions in semantic order. */
  readonly functions: readonly MachineFunction[];
  /** Resident globals and immutable data. */
  readonly data: readonly MachineDataObject[];
  /** Selected platform startup and return owner. */
  readonly startup: MachineFunction;
  /** Compiler-proved startup choice; final layout binds actual borrowed caller bytes. */
  readonly c64Startup?: Omit<C64StartupInput, "profile">;
  /** Complete finite storage demand discovered by lowering/binding. */
  readonly requiredStorage: readonly StorageRequest[];
  /** Complete request set covered by the expected final certificate. */
  readonly certifiedStorage?: readonly StorageRequest[];
  /** Expected final inventory certificate identity for compiler-produced programs. */
  readonly storageInventoryHash?: string;
  /** Target profile identity against which final storage must be certified. */
  readonly storageProfileId?: string;
  /** Exact admitted address windows used to validate every certified home. */
  readonly storageProfile?: StorageProfile;
}

/** Inputs required by direct machine lowering. */
export interface MachineLoweringInput {
  /** Retain internal source/access evidence for size reference/candidate closure; none omits it. */
  readonly observerEvidence?: boolean;
  /** Source binding identities mapped to display names; never used for semantic lookup. */
  readonly bindingNames?: ReadonlyMap<string, string>;
  /** Closed reachable semantic program. */
  readonly program: WholeProgram;
  /** Precomputed source facts for a selected attempt; absent on direct none lowering. */
  readonly sourceFacts?: MachineSourceFacts;
  /** Optimized-candidate facts; absent keeps the canonical direct lowering path inert. */
  readonly optimizationFacts?: OptimizationFacts;
  /** Actual provisional physical facts, absent during allocation-independent construction. */
  readonly placement?: StoragePlacement;
  /** Complete original logical declarations; selected demand is closed after lowering. */
  readonly logicalStorage?: StorageInventory;
  /** Size mode may place ordinary function homes in spare zero-page bytes. */
  readonly preferZeroPage?: boolean;
  /** Exact selected target facts. */
  readonly profile: TargetProfile;
  /** Precomputed raw ABI/storage demands, never execution or capture evidence. */
  readonly retainedInterrupts?: InterruptMaterializations;
  /** Emit a pre-division zero test and non-returning target stop when selected. */
  readonly divisionZeroCheck?: boolean;
  /** Check dynamic fixed-array ordinals before forming their machine addresses. */
  readonly boundsCheck?: boolean;
  /** Read one already-loaded source span for a user-facing arithmetic diagnostic. */
  readonly sourceText?: (span: SourceSpan) => string;
}

/** Complete lowering result, or a terminal unsupported/invalid input reason. */
export type MachineLoweringResult =
  | {
      readonly kind: "complete";
      /** Exact complete requests/results used for this machine's certification and allocation. */
      readonly inventory: StorageInventory;
      readonly program: MachineProgram;
      readonly binder: StorageBinder;
      /** Warnings that depend on the machine sequence actually selected. */
      readonly diagnostics: readonly ProjectDiagnostic[];
    }
  | { readonly kind: "error"; readonly reason: string; readonly source: SourceSpan | null };

/** Bound machine program or a terminal post-closure-storage failure. */
export type MachineBindingResult =
  | { readonly kind: "complete"; readonly program: MachineProgram }
  | {
      readonly kind: "error";
      readonly reason: "certificate" | "missing-storage" | "invalid-storage";
      readonly requestId: string | null;
    };

/** Legal instruction validation or a rejected candidate without partial output. */
export type MachineValidationResult =
  | { readonly kind: "complete"; readonly instruction: MachineInstruction }
  | { readonly kind: "error"; readonly reason: "opcode-mode" | "cost" | "operand" | "flag" };

/** Final branch layout or a terminal malformed-label failure. */
export type BranchRepairResult =
  | {
      readonly kind: "complete";
      readonly function: MachineFunction;
      readonly byteLength: number;
    }
  | { readonly kind: "error"; readonly reason: "missing-label" | "invalid-size" };
