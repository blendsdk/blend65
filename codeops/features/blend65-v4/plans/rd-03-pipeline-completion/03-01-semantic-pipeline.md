# Semantic Pipeline: RD-03 Pipeline Completion

> **Document**: 03-01-semantic-pipeline.md
> **Parent**: [Index](00-index.md)

## Overview

Turn the completed frontend's checked declarations into an executable, target-neutral operation
graph. This component owns exact evaluation order, explicit CFG, whole-program roots/calls/effects,
lifetimes and source provenance. It does not know C64 addresses, 6510 instructions, ACME syntax,
PRG format or physical placement (AR-C3, AR-C5).

## Architecture

### Input Completion Boundary

The frontend remains a pure service. Add one explicit optional environment rather than teaching it
filesystem or backend behavior (AR-C3, AR-C6):

```ts
/** Target-independent declarations and resolved compile-time values available to analysis. */
export interface FrontendEnvironment {
  readonly profileModules: readonly FrontendProfileModule[];
  readonly embeddedValues: readonly EmbeddedValue[];
}

/** Analyze one immutable snapshot, optionally replacing open source text for editor diagnostics. */
export function analyzeProject(
  snapshot: ProjectSnapshot,
  options?: FrontendAnalysisOptions,
): AnalysisResult;
```

`FrontendProfileModule` contains only named declarations, types, effects and capability identities.
The single admitted profile is selected through a direct `switch`; there is no provider registry.
`EmbeddedValue` binds one already validated literal call site to its immutable type, byte length and
content hash. The frontend never opens the asset (AR-C5, AR-C6).

`FrontendAnalysisOptions` admits either no overlay or a finite list of exact `{ sourceId, text }`
replacements for an editor-owned open document. The service validates each source identity,
recomputes raw UTF-8 bytes/hash for analysis and builds a separate analysis identity. It never
mutates or relabels the RD-02 disk snapshot and never returns the overlay as a build snapshot
(AR-C9, AR-C14).

Without an environment, profile and asset forms remain truthful incomplete obligations. With a
complete matching environment, unresolved obligations or any diagnostic error prevent semantic
operations from being built. This is the only poison gate into the backend (AR-C3, AR-C14).

### Semantic Representation

Use immutable discriminated records and direct builders (AR-C3):

```ts
interface SemanticProgram {
  readonly modules: readonly SemanticModule[];
  readonly globals: readonly SemanticGlobal[];
  readonly functions: readonly SemanticFunction[];
  readonly assets: readonly SemanticAsset[];
  readonly initializerOrder: readonly BindingId[];
}

interface SemanticFunction {
  readonly id: FunctionId;
  readonly parameters: readonly StorageValue[];
  readonly result: SemanticType;
  readonly entry: BlockId;
  readonly blocks: readonly SemanticBlock[];
  readonly source: SourceSpan;
}

interface SemanticBlock {
  readonly id: BlockId;
  readonly operations: readonly SemanticOperation[];
  readonly terminator: SemanticTerminator;
}
```

`SemanticOperation` has only current consumers: constants/conversions; place address and ordered
load/store; unary/binary value operations; direct call plus ordered argument staging; aggregate
field/index address; volatile byte/word memory access; literal embedded-data address; and named
platform operation. `SemanticTerminator` is `jump`, `branch`, `return` or `unreachable`.

Every value/operation retains its exact type, width/signedness/wrap context, source span, place or
value identity, alias/borrow identity where admitted, volatility, ordered memory/call effects,
symbolic storage need and target capability identity until its owning consumer discharges the fact
(AR-C3, AR-C7).

### CFG Rules

- Linear expression operations preserve the frontend's left-to-right order.
- `&&`, `||` and `?:` create selected-arm blocks; an unselected arm emits no operation.
- `if`, `while` and three-clause `for` use explicit blocks. `continue` reaches the update block;
  `break` and `return` do not.
- Calls stage each argument result before marshalling; nested calls never write the eventual
  callee's parameter homes early.
- Dynamic `PEEK`/`POKE` evaluate the address and value once, then emit one ordered volatile access.
- No optional optimization, induction recovery, inlining or peephole occurs here. Required constant
  evaluation and unreachable-edge exclusion retain Specification 4 semantics (AR-C3, AR-C13).

### Whole-Program Result

```ts
interface WholeProgram {
  readonly semantic: SemanticProgram;
  readonly roots: readonly ProgramRoot[];
  readonly callGraph: readonly CallGraphNode[];
  readonly effects: readonly WholeProgramEffect[];
  readonly lifetimes: readonly ValueLifetime[];
  readonly reachableFunctions: readonly FunctionId[];
  readonly reachableAssets: readonly AssetId[];
}
```

Roots are startup, ordered module initializers and selected `main`. RD-03 has no application IRQ,
NMI, escaped callback or unknown external call. The analysis still represents those root kinds so
an encountered unsupported edge receives a source diagnostic rather than disappearing. Direct and
finite resolved edges are closed; a recursive SCC is rejected before SFA (AR-C4).

Lifetimes use operation/block positions, CFG reachability, calls crossed and alias/effect facts.
Conservative whole-function lifetime is permitted only where a smaller lifetime cannot be proved;
the report names that cost. Globals/assets are program-lifetime layout objects and never SFA inputs
(AR-C4, AR-C6).

## Transition Contracts

| Transition | Consumes | Produces | Rejects / must not own | AR Ref |
|---|---|---|---|---|
| Frontend completion | Snapshot, profile declarations, resolved embed values | Complete typed program or diagnostics | Filesystem asset reads, addresses, opcodes | AR-C3, AR-C6 |
| Semantic lowering | Complete typed program/effects | Ordered operations and explicit CFG | Target legality, storage addresses, ACME | AR-C3 |
| Whole-program close | Semantic program and explicit roots | Reachability, effects, calls, SCCs, lifetimes | Silent unknown edges, allocation | AR-C4 |
| SFA handoff | Reachable functions and lifetimes | Complete provisional storage requests | Global/asset placement | AR-C4 |

## Error Handling

| Error case | Handling | AR Ref |
|---|---|---|
| Error/poison/incomplete frontend input reaches builder | Return existing diagnostics/obligations; construct no semantic program | AR-C3, AR-C14 |
| Profile declaration or embedded binding does not match the selected source call | Structured proving diagnostic on the call/import; no fallback by name | AR-C5, AR-C6 |
| Unknown/escaped call target in admitted M1 path | Diagnose unsupported closure with the shortest source edge; never omit it | AR-C4 |
| Recursive SCC | Normative recursion diagnostic before allocation | AR-C4 |
| CFG builder sees an admitted typed form without an operation | Internal completeness failure in tests; never a placeholder or successful artifact | AR-C3, AR-C14 |

## Testing Requirements

- Independent tests assert operation order and CFG edges for short circuit, `for`, early return,
  nested calls and dynamic `POKE`.
- Transition tests prove profile/asset obligations complete only with exact external facts.
- Whole-program cases prove initializer/startup roots, reachable/unreachable functions, direct call
  effects and recursion rejection.
- Tests inspect semantic records only; assembly is a separate oracle in later components.
