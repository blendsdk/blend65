import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";

/** Fixed production limits for one complete compile-time analysis. */
export const COMPTIME_BUDGET_V1 = Object.freeze({
  maxSteps: 16_777_216,
  maxLiveBytes: 16_777_216,
  maxActiveCalls: 512,
});

/** Internal reduced limits used to prove the same production accounting boundary. */
export interface ComptimeBudgetLimits {
  /** Maximum selected semantic operations across all roots. */
  readonly maxSteps: number;
  /** Maximum simultaneously live logical Blend65 value bytes. */
  readonly maxLiveBytes: number;
  /** Maximum active compile-time calls, with the first call at depth one. */
  readonly maxActiveCalls: number;
}

/** A rejected semantic operation carries its source proof without a partial result. */
export class ComptimeBudgetFailure extends Error {
  /** The one diagnostic which poisons the active compile-time root. */
  readonly diagnostic: ProjectDiagnostic;

  constructor(diagnostic: ProjectDiagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

/**
 * Count semantic work rather than host allocations or cached execution.
 * Failed charges never change the counters, so a caller can discard its root safely.
 */
export class ComptimeBudget {
  private steps = 0;
  private liveBytes = 0;
  private activeCalls = 0;

  constructor(readonly limits: ComptimeBudgetLimits = COMPTIME_BUDGET_V1) {}

  /** Mark retained storage before an outermost expression begins. */
  liveCheckpoint(): number {
    return this.liveBytes;
  }

  /** Discard every temporary from a failed root without erasing work already charged. */
  abandonRoot(checkpoint: number): void {
    if (checkpoint < 0 || checkpoint > this.liveBytes) {
      throw new Error("Invalid compile-time storage checkpoint");
    }
    this.liveBytes = checkpoint;
  }

  /** Charge one selected expression, statement, iteration, call entry, or aggregate byte. */
  step(span: SourceSpan, root: SourceSpan): void {
    const attempted = this.steps + 1;
    if (attempted > this.limits.maxSteps) {
      throw this.failure(
        "E10269",
        `comptime-budget-v1 allows ${this.limits.maxSteps} abstract steps; root would attempt ${attempted}`,
        span,
        root,
      );
    }
    this.steps = attempted;
  }

  /** Reserve logical value bytes before initialization or mutation. */
  allocate(bytes: number, span: SourceSpan, root: SourceSpan): void {
    const attempted = this.liveBytes + bytes;
    if (attempted > this.limits.maxLiveBytes) {
      throw this.failure(
        "E10270",
        `comptime-budget-v1 allows ${this.limits.maxLiveBytes} live logical bytes; root would require ${attempted}`,
        span,
        root,
      );
    }
    this.liveBytes = attempted;
  }

  /** Release a value at its semantic full-expression, block, or call boundary. */
  release(bytes: number): void {
    this.liveBytes -= bytes;
    if (this.liveBytes < 0) throw new Error("Compile-time logical storage was released twice");
  }

  /** Enter a direct call before its arguments or body can have effects. */
  enterCall(span: SourceSpan, root: SourceSpan): void {
    const attempted = this.activeCalls + 1;
    if (attempted > this.limits.maxActiveCalls) {
      throw this.failure(
        "E10271",
        `comptime-budget-v1 allows ${this.limits.maxActiveCalls} active calls; root would enter depth ${attempted}`,
        span,
        root,
      );
    }
    this.step(span, root);
    this.activeCalls = attempted;
  }

  /** Leave one completed or aborted direct call. */
  leaveCall(): void {
    this.activeCalls -= 1;
    if (this.activeCalls < 0) throw new Error("Compile-time call depth was released twice");
  }

  private failure(
    code: string,
    message: string,
    span: SourceSpan,
    root: SourceSpan,
  ): ComptimeBudgetFailure {
    return new ComptimeBudgetFailure(
      projectDiagnostic(code, message, span, null, [
        { span: root, message: "Outermost compile-time evaluation starts here" },
      ]),
    );
  }
}
