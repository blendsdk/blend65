import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { StorageBinder, StorageProfile, StorageRequest } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { CpuFlag, CpuRegister } from "../target/nmos6510.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { PlacementConstraints } from "../frontend/semantic-types.js";
import type { StoragePlacement } from "../storage/storage-types.js";

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
  /** Stable link label. */
  readonly label: string;
  /** Exact physical origin after final block layout. */
  readonly origin?: number;
  /** Instructions in exact execution order. */
  readonly instructions: readonly MachineInstruction[];
  /** Final structured transfer. */
  readonly terminator: MachineTerminator;
}

/** One reachable source/startup function in structured machine form. */
export interface MachineFunction {
  /** Stable link identity. */
  readonly id: string;
  /** Fixed origin when platform startup owns it. */
  readonly origin?: number;
  /** Blocks in selected layout order. */
  readonly blocks: readonly MachineBlock[];
  /** Optional source placement retained until final layout. */
  readonly placement?: PlacementConstraints;
}

/** Immutable, mutable or zero-initialized non-function object. */
export interface MachineDataObject {
  /** Stable object identity. */
  readonly id: string;
  /** Platform-layout ownership class. */
  readonly kind: "immutable" | "global" | "bss" | "asset";
  /** Semantic asset identity for an asset object. */
  readonly assetId?: string;
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
  /** Reachable ordinary functions in semantic order. */
  readonly functions: readonly MachineFunction[];
  /** Resident globals and immutable data. */
  readonly data: readonly MachineDataObject[];
  /** Selected platform startup and return owner. */
  readonly startup: MachineFunction;
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
  /** Closed reachable semantic program. */
  readonly program: WholeProgram;
  /** Current provisional static homes. */
  readonly placement: StoragePlacement;
  /** Exact selected target facts. */
  readonly profile: TargetProfile;
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
