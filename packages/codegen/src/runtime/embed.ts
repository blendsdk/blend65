/**
 * Runtime-module embedding + dead-strip.
 *
 * The runtime routines live as hand-written `.asm` files under the package
 * root's `runtime/` directory. This module provides the three embedding
 * steps the driver composes around {@link "../instr/serialize-acme.js".serializeToAcme}:
 *
 *  1. {@link collectReferencedRoutines} — which registered routine symbols the
 *     final (post-peephole) Instr streams actually `JSR` (only *surviving*
 *     references count, so dead-stripping is free).
 *  2. {@link loadRuntimeModule} — the verbatim `.asm` text of one module,
 *     resolved against the package root with a path-traversal guard.
 *  3. {@link buildRuntimeSection} — the discrete `; --- runtime routines ---`
 *     section text passed to the serializer's `runtimeSection` option, keeping
 *     the serializer itself pure and deterministic.
 *
 * The module files reference the SFA allocator's existing `__zp_arg_N` symbols
 * directly and define no addresses of their own — the program's symbol header
 * provides them, so no new symbol definitions are emitted here.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/language-server).
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { IntrinsicDescriptor } from "@blend65/core";
import type { RuntimeModule } from "@blend65/core/platform";

import type { InstrProgram } from "../instr/instr-program.js";
import { isInstr } from "../instr/stream.js";

/** Section header introducing the embedded runtime modules. */
export const RUNTIME_SECTION_HEADER = "; --- runtime routines (referenced only) ---";

/**
 * The package root the `runtime/*.asm` modules resolve against: two levels up
 * from this module (`src/runtime/` in dev, `dist/runtime/` when built — both
 * sit at the same depth below the package root).
 */
const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Collect the runtime-routine symbols the program actually calls.
 *
 * Walks every final Instr stream (post-peephole, so only *surviving* call sites
 * count) for `JSR` targets that match a registered routine descriptor. The
 * result drives dead-stripping: unreferenced modules are simply never embedded.
 *
 * @param program The final instruction program (post-optimizer output).
 * @param descriptors The registered T3/T4 routine descriptors (with `asmModulePath`).
 * @param pluginModules The active plugin's T4 runtime modules — their `exports`
 *   extend the known-symbol set.
 * @returns The set of referenced routine names, iteration-ordered by first use.
 */
export function collectReferencedRoutines(
  program: InstrProgram,
  descriptors: readonly IntrinsicDescriptor[],
  pluginModules?: readonly RuntimeModule[],
): ReadonlySet<string> {
  const known = new Set(descriptors.filter((d) => d.asmModulePath !== undefined).map((d) => d.name));
  for (const module of pluginModules ?? []) {
    for (const symbol of module.exports) {
      known.add(symbol);
    }
  }
  const referenced = new Set<string>();
  for (const stream of program.streams) {
    for (const entry of stream.entries) {
      if (!isInstr(entry) || entry.opcode !== "JSR") {
        continue;
      }
      const op = entry.operand;
      const target =
        op.kind === "labelRef" ? op.label : op.kind === "symbolRef" ? op.name : null;
      if (target !== null && known.has(target)) {
        referenced.add(target);
      }
    }
  }
  return referenced;
}

/**
 * Load one runtime module's verbatim `.asm` text.
 *
 * The descriptor's `asmModulePath` is resolved against the owning package root.
 * Security guard (path traversal): the path must be relative, and its canonical
 * resolution must stay inside the package root — a violation is a packaging bug
 * and throws (the compiler layer surfaces it as an ICE).
 *
 * @param descriptor A T3/T4 routine descriptor carrying `asmModulePath`.
 * @returns The module's `.asm` source text, exactly as authored.
 * @throws {Error} When the descriptor has no `asmModulePath`, or the path is
 *   absolute / escapes the package root (packaging bug — never user input).
 */
export function loadRuntimeModule(descriptor: IntrinsicDescriptor): string {
  const rel = descriptor.asmModulePath;
  if (rel === undefined) {
    throw new Error(`runtime module: descriptor '${descriptor.name}' has no asmModulePath`);
  }
  if (isAbsolute(rel)) {
    throw new Error(`runtime module: absolute asmModulePath '${rel}' is not allowed`);
  }
  const full = resolve(PACKAGE_ROOT, rel);
  // Canonical prefix check — rejects `..` traversal after resolution.
  if (!full.startsWith(resolve(PACKAGE_ROOT) + sep)) {
    throw new Error(`runtime module: asmModulePath '${rel}' escapes the package root`);
  }
  return readFileSync(full, "utf8");
}

/**
 * Load a plugin-contributed T4 runtime module's verbatim `.asm` text.
 *
 * The module's `asmPath` is resolved against its self-locating `baseUrl`
 * (`import.meta.url` of the declaring plugin module). Security guard: the
 * canonical resolved path must stay under the owning package's root — the
 * directory containing the nearest `package.json` above `baseUrl` — otherwise
 * this is a packaging bug and throws (surfaced as an ICE by the compiler layer).
 *
 * @param module The plugin's runtime-module entry (must carry `baseUrl`).
 * @returns The module's `.asm` source text, exactly as authored.
 * @throws {Error} When `baseUrl` is missing, no owning `package.json` is found,
 *   or the resolution escapes the owning package root.
 */
export function loadPluginRuntimeModule(module: RuntimeModule): string {
  if (module.baseUrl === undefined) {
    throw new Error(`runtime module: plugin module '${module.name}' has no baseUrl (PF-017)`);
  }
  const full = fileURLToPath(new URL(module.asmPath, module.baseUrl));
  const packageRoot = findPackageRoot(dirname(fileURLToPath(module.baseUrl)));
  if (packageRoot === null) {
    throw new Error(`runtime module: no package.json above '${module.baseUrl}'`);
  }
  if (!resolve(full).startsWith(resolve(packageRoot) + sep)) {
    throw new Error(
      `runtime module: asmPath '${module.asmPath}' escapes the owning package root`,
    );
  }
  return readFileSync(full, "utf8");
}

/**
 * The nearest directory at or above `dir` containing a `package.json`, or
 * `null` when the filesystem root is reached without one.
 */
function findPackageRoot(dir: string): string | null {
  let current = resolve(dir);
  for (;;) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Compose the discrete runtime section for the serializer.
 *
 * Embeds exactly the referenced modules, verbatim: codegen-owned T3 modules
 * first in the descriptors' catalog order, then plugin T4 modules in their
 * declared order (deterministic output). Returns `null` when nothing is
 * referenced — the caller then passes no `runtimeSection` option and the
 * serialized output stays byte-identical to the shape with no runtime section
 * embedded at all.
 *
 * @param referenced The routine names in use (from {@link collectReferencedRoutines}).
 * @param descriptors The registered routine descriptors (defines T3 embedding order).
 * @param pluginModules The active plugin's T4 runtime modules (loaded via `baseUrl`).
 * @returns The section text (header + module bodies), or `null` when empty.
 */
export function buildRuntimeSection(
  referenced: ReadonlySet<string>,
  descriptors: readonly IntrinsicDescriptor[],
  pluginModules?: readonly RuntimeModule[],
): string | null {
  const used = descriptors.filter((d) => referenced.has(d.name) && d.asmModulePath !== undefined);
  const usedPlugin = (pluginModules ?? []).filter((m) =>
    m.exports.some((symbol) => referenced.has(symbol)),
  );
  if (used.length === 0 && usedPlugin.length === 0) {
    return null;
  }
  const parts = [RUNTIME_SECTION_HEADER];
  for (const d of used) {
    parts.push(loadRuntimeModule(d).trimEnd());
  }
  for (const m of usedPlugin) {
    parts.push(loadPluginRuntimeModule(m).trimEnd());
  }
  return parts.join("\n");
}
