/**
 * `runCli` — the testable `blendc` entry point.
 *
 * Parses argv, dispatches to the `@blend65/compiler` facade (`build`/`compile`/
 * `emitAsm`/`emitIl`), renders results through {@link CliIo} (diagnostics + trailer
 * → stderr, summary/report → stdout), writes `--emit-*` artifacts, and returns the
 * process exit code. Never calls `process.exit` (bin.ts owns the lifecycle).
 */

import {
  build,
  compile,
  defaultCompilerEvidenceFacadeV1,
  emitAsm,
  emitIl,
  type BuildResult,
  type CompileResult,
  type CompilerOptions,
  type CompilerDiagnosticEvidenceV1,
  type CompilerEvidenceFacadeV1,
  type CompilerEvidenceObserverV1,
  type EmitResult,
} from "@blend65/compiler";
import { DiagCode, isIceCode, renderReportJson, type Diagnostic } from "@blend65/core";
import { parseArgs, type ParsedArgs } from "./args.js";
import { resolveColor } from "./color.js";
import {
  renderBuildSummary,
  renderDiagnostics,
  renderJsonReport,
  writeTextArtifact,
} from "./render.js";
import type { CliIo } from "./io.js";

/** Config-band + driver diagnostic codes that classify a run as exit 2. */
const EXIT2_CODES: ReadonlySet<string> = new Set<string>([
  DiagCode.ConfigFileNotFound,
  DiagCode.ConfigParseError,
  DiagCode.ConfigNotAnObject,
  DiagCode.ConfigInvalidValue,
  DiagCode.ConfigUnknownPlatform,
  DiagCode.ConfigMissingPlatform,
  DiagCode.ConfigPatternEscapesRoot,
  DiagCode.DriverSourceFileNotFound,
  DiagCode.DriverNoSourceFiles,
]);

/** Optional same-invocation compiler evidence dependencies for readiness adapters. */
export interface CliEvidenceDependenciesV1 {
  /** Evidence-producing compiler façade; defaults to the shipped compiler façade. */
  readonly compilerFacade?: CompilerEvidenceFacadeV1;
  /** Observer notified with the sidecar from the invocation rendered by this CLI call. */
  readonly evidenceObserver?: CompilerEvidenceObserverV1;
}

/**
 * Run the CLI end-to-end.
 *
 * @param argv The argument vector (already `hideBin`-stripped).
 * @param io The injectable process surface.
 * @returns The exit code (0 success / 1 compile errors / 2 config / 3 ICE).
 */
export async function runCli(
  argv: string[],
  io: CliIo,
  evidenceDependencies?: CliEvidenceDependenciesV1,
): Promise<number> {
  const outcome = parseArgs(argv);
  if (outcome.kind === "fail") {
    // Usage/flag error → stderr, exit 2.
    io.writeErr(ensureTrailingNewline(`blendc: ${outcome.text}`));
    return 2;
  }
  if (outcome.kind === "help") {
    // --help/--version text → stdout, exit 0 (routed through CliIo).
    io.writeOut(ensureTrailingNewline(outcome.text));
    return 0;
  }

  const parsed = outcome.args;
  const options = toOptions(parsed, io.cwd);
  const color = resolveColor(parsed.color, io.env, io.isTTY);

  try {
    if (parsed.command === "check") {
      if (evidenceDependencies === undefined) return finishCompile(io, compile(options), color);
      const observed = (
        evidenceDependencies.compilerFacade ?? defaultCompilerEvidenceFacadeV1
      ).compile(options);
      notifyEvidence(evidenceDependencies.evidenceObserver, observed.evidence);
      return finishCompile(io, observed.result, color);
    }
    if (parsed.emitIl === true) {
      if (evidenceDependencies === undefined) return finishEmit(io, emitIl(options), color, "il");
      const observed = (
        evidenceDependencies.compilerFacade ?? defaultCompilerEvidenceFacadeV1
      ).emitIl(options);
      notifyEvidence(evidenceDependencies.evidenceObserver, observed.evidence);
      return finishEmit(io, observed.result, color, "il");
    }
    if (parsed.emitAsm === true) {
      if (evidenceDependencies === undefined) return finishEmit(io, emitAsm(options), color, "asm");
      const observed = (
        evidenceDependencies.compilerFacade ?? defaultCompilerEvidenceFacadeV1
      ).emitAsm(options);
      notifyEvidence(evidenceDependencies.evidenceObserver, observed.evidence);
      return finishEmit(io, observed.result, color, "asm");
    }
    if (evidenceDependencies !== undefined) {
      const observed = await (
        evidenceDependencies.compilerFacade ?? defaultCompilerEvidenceFacadeV1
      ).build(options, undefined, io.buildDeps);
      notifyEvidence(evidenceDependencies.evidenceObserver, observed.evidence);
      return finishBuild(io, observed.result, parsed, color);
    }
    return finishBuild(io, await build(options, undefined, io.buildDeps), parsed, color);
  } catch (err) {
    // Artifact-write failure (bad --out-dir, etc.) — invocation-class → exit 2.
    io.writeErr(
      ensureTrailingNewline(`blendc: ${err instanceof Error ? err.message : String(err)}`),
    );
    return 2;
  }
}

function notifyEvidence(
  observer: CompilerEvidenceObserverV1 | undefined,
  evidence: CompilerDiagnosticEvidenceV1,
): void {
  try {
    observer?.onDiagnosticEvidence(evidence);
  } catch {
    // Evidence observation is additive and cannot change CLI output or exit behavior.
  }
}

/** `check`: render diagnostics, no artifacts, no summary. */
function finishCompile(io: CliIo, result: CompileResult, color: boolean): number {
  renderDiagnostics(
    io,
    result.diagnostics,
    result.sourceMap,
    result.config.diagnosticsFormat,
    color,
  );
  return classifyExit(result.diagnostics);
}

/** `--emit-il`/`--emit-asm`: write the artifact (if produced), render diagnostics. */
function finishEmit(io: CliIo, result: EmitResult, color: boolean, ext: "il" | "asm"): number {
  if (result.text !== undefined) {
    writeTextArtifact(result.config.outDir, `${result.config.outName}.${ext}`, result.text);
  }
  renderDiagnostics(
    io,
    result.diagnostics,
    result.sourceMap,
    result.config.diagnosticsFormat,
    color,
  );
  return classifyExit(result.diagnostics);
}

/** Full `build`: diagnostics, then summary/report/emit-report on success. */
function finishBuild(io: CliIo, result: BuildResult, parsed: ParsedArgs, color: boolean): number {
  renderDiagnostics(
    io,
    result.diagnostics,
    result.sourceMap,
    result.config.diagnosticsFormat,
    color,
  );
  const exit = classifyExit(result.diagnostics);

  if (exit === 0 && result.resourceReport !== undefined) {
    if (parsed.report === "json") {
      renderJsonReport(io, result.resourceReport); // implies table suppression
    } else if (!result.config.quiet) {
      renderBuildSummary(io, result.resourceReport); // suppressed by --quiet
    }
    if (parsed.emitReport === true) {
      writeTextArtifact(
        result.config.outDir,
        `${result.config.outName}.report.json`,
        renderReportJson(result.resourceReport),
      );
    }
  }
  return exit;
}

/**
 * Classify the exit code from the final diagnostics. Order:
 * config-band/driver → 2; any ICE-band code → 3; any error → 1; else 0.
 */
function classifyExit(diagnostics: readonly Diagnostic[]): number {
  if (diagnostics.some((d) => EXIT2_CODES.has(d.code))) {
    return 2;
  }
  if (diagnostics.some((d) => isIceCode(d.code))) {
    return 3;
  }
  if (diagnostics.some((d) => d.severity === "error")) {
    return 1;
  }
  return 0;
}

/** Map {@link ParsedArgs} + cwd to {@link CompilerOptions} (cwd routing). */
function toOptions(parsed: ParsedArgs, cwd: string): CompilerOptions {
  return {
    // Empty when --platform is absent → config supplies it (or E10245). See
    // `optionsToOverrides`: "" is the config's no-platform marker, not an override.
    platform: parsed.platform ?? "",
    cwd,
    ...(parsed.files.length > 0 ? { sourceFiles: parsed.files } : {}),
    ...(parsed.config !== undefined ? { configPath: parsed.config } : {}),
    ...(parsed.include !== undefined ? { include: parsed.include } : {}),
    ...(parsed.exclude !== undefined ? { exclude: parsed.exclude } : {}),
    ...(parsed.acmePath !== undefined ? { acmePath: parsed.acmePath } : {}),
    ...(parsed.outDir !== undefined ? { outDir: parsed.outDir } : {}),
    ...(parsed.outName !== undefined ? { outName: parsed.outName } : {}),
    ...(parsed.maxErrors !== undefined ? { maxErrors: parsed.maxErrors } : {}),
    ...(parsed.warnAsError !== undefined ? { warnAsError: parsed.warnAsError } : {}),
    ...(parsed.suppressWarnings !== undefined ? { suppressWarnings: parsed.suppressWarnings } : {}),
    ...(parsed.diagnosticsFormat !== undefined
      ? { diagnosticsFormat: parsed.diagnosticsFormat }
      : {}),
    ...(parsed.optimize !== undefined ? { optimize: parsed.optimize } : {}),
    ...(parsed.quiet !== undefined ? { quiet: parsed.quiet } : {}),
    ...(parsed.startup !== undefined ? { startup: parsed.startup } : {}),
  };
}

/** Ensure `text` ends with exactly one trailing newline. */
function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
