/**
 * The shared frontend pipeline core.
 *
 * One internal function — `runFrontend` — drives config → host → discovery →
 * lex/parse → analyze → SFA, accumulating diagnostics into two bags (config +
 * pipeline) and deriving the effective `outName` exactly once. Both
 * `compile()` and the emit/build paths consume its {@link FrontendRun}. Thin
 * wiring only — every stage is a shipped entry point. Not exported from the
 * package barrel.
 */

import {
  createDiagnosticBag,
  createIntrinsicRegistry,
  createSourceMap,
  DEFAULT_PROFILE,
  DiagCode,
  type AllocationPlan,
  type CompilerHost,
  type Diagnostic,
  type DiagnosticBag,
  type IntrinsicRegistry,
  type ProgramNode,
  type SemanticModel,
  type SourceId,
  type SourceMap,
} from "@blend65/core";
import type { PlatformPlugin } from "@blend65/core/platform";
import { loadConfig, type BlendConfig } from "@blend65/config";
import { PLATFORM_REGISTRY, loadPlatform } from "@blend65/platforms";
import {
  analyze,
  lex,
  modelNeedsIrqPointerScratch,
  modelNeedsPointerScratch,
  modelToZpUserVars,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { basename, extname, relative, resolve, sep } from "node:path";
import { createDiskCompilerHost } from "../host/index.js";
import { createDiskAssetReader } from "./asset-reader.js";
import { optionsToOverrides, type CompilerOptions } from "./options.js";

/** The accumulated result of the shared frontend pipeline. */
export interface FrontendRun {
  /** The resolved configuration (defaults ← file ← overrides). */
  config: BlendConfig;
  /** Diagnostics from the config bag (rendered first). */
  configDiagnostics: Diagnostic[];
  /** The source map (empty when aborted before interning). */
  sourceMap: SourceMap;
  /** The pipeline diagnostic bag (cap = `config.maxErrors`). */
  bag: DiagnosticBag;
  /** The platform plugin — absent on a config error. */
  plugin?: PlatformPlugin;
  /** The intrinsic registry — absent on a config error. */
  registry?: IntrinsicRegistry;
  /** The parsed programs — absent when discovery aborted. */
  programs?: ProgramNode[];
  /** The semantic model — absent when the frontend did not reach analysis. */
  semanticModel?: SemanticModel;
  /** The SFA allocation plan — absent when the frontend did not reach planning. */
  allocationPlan?: AllocationPlan;
  /** The derived effective output base name. */
  outName: string;
  /** `true` when a config or discovery error aborted the pipeline before lexing. */
  aborted: boolean;
}

/**
 * Run the shared frontend pipeline over `options` (the normative pipeline
 * sequence).
 *
 * @param options The caller's compiler options.
 * @param host An optional injected host; the language server's file set is
 *   used verbatim. When absent, a {@link createDiskCompilerHost | disk host}
 *   is built from config.
 * @returns The {@link FrontendRun} — never throws.
 */
export function runFrontend(options: CompilerOptions, host?: CompilerHost): FrontendRun {
  // 1. Config (bootstrap bag at the default cap 20).
  const configBag = createDiagnosticBag();
  const { config, hasErrors: configFailed } = loadConfig({
    bag: configBag,
    cwd: options.cwd ?? process.cwd(),
    configPath: options.configPath,
    overrides: optionsToOverrides(options),
    knownPlatforms: [...PLATFORM_REGISTRY.keys()],
  });
  const configDiagnostics = configBag.getAll();

  // 2. Pipeline bag at the config's `maxErrors`.
  const bag = createDiagnosticBag({ maxErrors: config.maxErrors });
  const sourceMap = createSourceMap();

  // Config error short-circuits before the pipeline (exit-2 class).
  if (configFailed) {
    return {
      config,
      configDiagnostics,
      sourceMap,
      bag,
      outName: config.outName,
      aborted: true,
    };
  }

  // 3. Host: injected verbatim, else a disk host from resolved config.
  const activeHost =
    host ??
    createDiskCompilerHost({
      projectRoot: config.projectRoot,
      include: config.include,
      exclude: config.exclude,
    });

  // 4. File set (three-tier discovery) + one-time `outName` derivation.
  const files = discoverFiles(options, activeHost, config, bag);
  if (files === null) {
    return {
      config,
      configDiagnostics,
      sourceMap,
      bag,
      outName: config.outName,
      aborted: true,
    };
  }
  const outName = deriveOutName(config, files);

  // 5. Platform (unknown names already rejected in step 1 — cannot throw here).
  const plugin = loadPlatform(config.platform);
  const registry = createIntrinsicRegistry(plugin.intrinsics, plugin.id);

  // 6+7. Read → intern → lex → parse each file. The SourceId → absolute-path
  // map built here backs source-relative `embed()` resolution — the frontend
  // itself owns no paths (spans carry SourceIds; the source map interns
  // display paths).
  const programs: ProgramNode[] = [];
  const sourcePaths = new Map<SourceId, string>();
  for (const path of files) {
    const content = activeHost.readFile(path);
    if (content === undefined) {
      // TOCTOU: a listed/resolved file vanished before read (R14 + R48 class).
      bag.addError(DiagCode.DriverSourceFileNotFound, null, `Source file not found: '${path}'`);
      continue;
    }
    const displayPath = toDisplayPath(config.projectRoot, path);
    const sourceId = sourceMap.intern(displayPath, content);
    sourcePaths.set(sourceId, resolve(path));
    const { tokens } = lex(sourceId, content, bag);
    const { ast } = parse({ tokens, source: content, sourceId, bag });
    programs.push(ast);
  }

  // 8. Semantic analysis.
  const semanticModel = analyze({
    programs,
    bag,
    profile: DEFAULT_PROFILE,
    registry,
    targetProfile: plugin.profile,
    assetReader: createDiskAssetReader({
      sources: sourcePaths,
      projectRoot: config.projectRoot,
    }),
  });

  // 9. SFA — gated on a clean frontend: an errored model must never reach
  // frame planning (coloring over a rejected — e.g. cyclic — call graph is
  // meaningless), and the gate also skips the adapter projections whose
  // reachability walks assume analyzer invariants. `planAllocation` consumes
  // the interim semantics `PlatformProfile` (the same `DEFAULT_PROFILE`
  // `analyze` receives), not the canonical `plugin.profile` — the two
  // `PlatformProfile` types differ, and per-platform semantics profiles land
  // later. The canonical `maxBinarySize` reaches the budget check via
  // `build.ts`.
  const allocationPlan = bag.hasErrors()
    ? undefined
    : planAllocation(
        {
          functions: modelToFunctionInfo(semanticModel),
          moduleVars: modelToModuleVars(semanticModel), // real module scalars
          zpUserVars: modelToZpUserVars(semanticModel),
          upstreamErrors: false, // gated: planning only runs on a clean frontend
          needsPointerScratch: modelNeedsPointerScratch(semanticModel),
          needsIrqPointerScratch: modelNeedsIrqPointerScratch(semanticModel),
        },
        DEFAULT_PROFILE,
        bag,
      );

  return {
    config,
    configDiagnostics,
    sourceMap,
    bag,
    plugin,
    registry,
    programs,
    semanticModel,
    ...(allocationPlan !== undefined ? { allocationPlan } : {}),
    outName,
    aborted: false,
  };
}

/**
 * Resolve the source-file set via the three-tier strategy, emitting
 * E10250/E10251 on failure.
 *
 * @returns The absolute file paths, or `null` when discovery failed (abort).
 */
function discoverFiles(
  options: CompilerOptions,
  host: CompilerHost,
  config: BlendConfig,
  bag: DiagnosticBag,
): string[] | null {
  // Tier 1: explicit source files bypass discovery; each is existence-checked.
  if (options.sourceFiles !== undefined && options.sourceFiles.length > 0) {
    const resolved: string[] = [];
    let anyMissing = false;
    for (const given of options.sourceFiles) {
      const abs = host.resolvePath(given);
      if (host.readFile(abs) === undefined) {
        // The path AS GIVEN by the user.
        bag.addError(DiagCode.DriverSourceFileNotFound, null, `Source file not found: '${given}'`);
        anyMissing = true;
      } else {
        resolved.push(abs);
      }
    }
    return anyMissing ? null : resolved;
  }

  // Tiers 2/3: the host's discovered file set (R13). Empty → E10251 (R49).
  const listed = host.listSourceFiles();
  if (listed.length === 0) {
    bag.addError(
      DiagCode.DriverNoSourceFiles,
      null,
      `No .blend source files found (project root: '${config.projectRoot}')`,
    );
    return null;
  }
  return listed;
}

/**
 * Derive the effective output base name exactly once.
 *
 * @returns `config.outName` when non-empty, else the basename (minus extension)
 *   of the lexicographically-first discovered file.
 */
function deriveOutName(config: BlendConfig, files: string[]): string {
  if (config.outName !== "") {
    return config.outName;
  }
  const first = [...files].sort()[0]!;
  return basename(first, extname(first));
}

/** Relativize an absolute path to `projectRoot` with forward slashes. */
function toDisplayPath(projectRoot: string, path: string): string {
  const rel = relative(projectRoot, path);
  return sep === "/" ? rel : rel.split(sep).join("/");
}
