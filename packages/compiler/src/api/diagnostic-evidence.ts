import { createHash } from "node:crypto";

import type { Diagnostic, DiagnosticBagAcceptedEntry, Severity } from "@blend65/core";

/** Frontend phases whose diagnostics are observed at their real acceptance boundary. */
export type CompilerDiagnosticPhaseV1 = "lexer" | "parser" | "semantic" | "sfa";

/** One accepted diagnostic joined to its final severity-policy output. */
export interface CompilerDiagnosticEvidenceEntryV1 {
  /** Stable identity of the accepted bag entry. */
  readonly acceptedEntryId: string;
  /** Accepted diagnostic code. */
  readonly code: string;
  /** Real frontend phase active when the bag accepted the entry. */
  readonly phase: CompilerDiagnosticPhaseV1;
  /** Severity after suppression and promotion policy. */
  readonly finalSeverity: Severity;
}

/** Separate passive diagnostic-provenance sidecar for one compiler invocation. */
export interface CompilerDiagnosticEvidenceV1 {
  /** Closed evidence record revision. */
  readonly revision: "compiler-diagnostic-evidence-v1";
  /** Accepted, non-suppressed frontend entries in final diagnostic order. */
  readonly entries: readonly CompilerDiagnosticEvidenceEntryV1[];
}

/** Optional observer used by same-invocation CLI evidence routing. */
export interface CompilerEvidenceObserverV1 {
  /** Receives the complete immutable sidecar after severity policy. */
  onDiagnosticEvidence(evidence: CompilerDiagnosticEvidenceV1): void;
}

interface CapturedDiagnostic {
  readonly phase: CompilerDiagnosticPhaseV1;
  readonly acceptedEntryId: string;
  readonly diagnostic: Diagnostic;
}

/** Internal phase-aware recorder wired directly to diagnostic-bag acceptance. */
export interface CompilerDiagnosticCaptureV1 {
  /** Activates one real frontend phase before its producer runs. */
  setPhase(phase: CompilerDiagnosticPhaseV1): void;
  /** Stops accepting entries when the observed frontend boundary has ended. */
  deactivate(): void;
  /** Diagnostic-bag callback invoked only for accepted entries. */
  onAccepted(entry: DiagnosticBagAcceptedEntry): void;
  /** Joins captured entries to final, policy-adjusted diagnostics. */
  finalize(diagnostics: readonly Diagnostic[]): CompilerDiagnosticEvidenceV1;
}

function diagnosticKey(diagnostic: Diagnostic): string {
  const sourceId = diagnostic.primarySpan?.sourceId ?? -1;
  const start = diagnostic.primarySpan?.start ?? -1;
  return `${diagnostic.code}\u0000${sourceId}\u0000${start}`;
}

function acceptedEntryId(
  phase: CompilerDiagnosticPhaseV1,
  entry: DiagnosticBagAcceptedEntry,
): string {
  const span = entry.diagnostic.primarySpan;
  const preimage = JSON.stringify({
    domain: "blend65-accepted-diagnostic-v1",
    phase,
    acceptanceOrdinal: entry.acceptanceOrdinal,
    code: entry.diagnostic.code,
    severity: entry.diagnostic.severity,
    sourceId: span?.sourceId ?? null,
    start: span?.start ?? null,
    end: span?.end ?? null,
  });
  return `sha256:${createHash("sha256").update(preimage, "utf8").digest("hex")}`;
}

/** Creates a fresh recorder for one compiler-facade invocation. */
export function createCompilerDiagnosticCaptureV1(): CompilerDiagnosticCaptureV1 {
  const captured: CapturedDiagnostic[] = [];
  let activePhase: CompilerDiagnosticPhaseV1 | undefined;

  return {
    setPhase(phase): void {
      activePhase = phase;
    },
    deactivate(): void {
      activePhase = undefined;
    },
    onAccepted(entry): void {
      if (activePhase === undefined) return;
      captured.push(
        Object.freeze({
          phase: activePhase,
          acceptedEntryId: acceptedEntryId(activePhase, entry),
          diagnostic: entry.diagnostic,
        }),
      );
    },
    finalize(diagnostics): CompilerDiagnosticEvidenceV1 {
      const byKey = new Map(captured.map((entry) => [diagnosticKey(entry.diagnostic), entry]));
      const entries: CompilerDiagnosticEvidenceEntryV1[] = [];
      for (const diagnostic of diagnostics) {
        const accepted = byKey.get(diagnosticKey(diagnostic));
        if (accepted === undefined) continue;
        entries.push(
          Object.freeze({
            acceptedEntryId: accepted.acceptedEntryId,
            code: diagnostic.code,
            phase: accepted.phase,
            finalSeverity: diagnostic.severity,
          }),
        );
      }
      return Object.freeze({
        revision: "compiler-diagnostic-evidence-v1" as const,
        entries: Object.freeze(entries),
      });
    },
  };
}
