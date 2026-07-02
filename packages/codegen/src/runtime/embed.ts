/**
 * RD-17 runtime-module embedding + dead-strip (`03-04-t3-runtime-marshalling.md`,
 * R15/R16, AC-11, AR-100, PF-018).
 *
 * The T3 runtime routines live as hand-written `.asm` files under the package
 * root's `runtime/` directory (AR-P8). This module provides the three embedding
 * steps the driver composes around {@link "../instr/serialize-acme.js".serializeToAcme}:
 *
 *  1. {@link collectReferencedRoutines} — which registered routine symbols the
 *     final (post-peephole) Instr streams actually `JSR` (only *surviving*
 *     references count, so dead-stripping is free — R16).
 *  2. {@link loadRuntimeModule} — the verbatim `.asm` text of one module,
 *     resolved against the package root with a path-traversal guard.
 *  3. {@link buildRuntimeSection} — the discrete `; --- runtime routines ---`
 *     section text passed to the serializer's `runtimeSection` option, keeping
 *     the serializer itself pure and deterministic (PF-016, R5).
 *
 * The module files reference the SFA allocator's existing `__zp_arg_N` symbols
 * directly and define no addresses of their own (PF-018) — the program's symbol
 * header provides them, so no new symbol definitions are emitted here.
 *
 * Lives in `@blend65/codegen` (R15/AR-20: never imported by the frontend/
 * language-server).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve, sep } from "node:path";
import type { IntrinsicDescriptor } from "@blend65/core";

import type { InstrProgram } from "../instr/instr-program.js";
import { isInstr } from "../instr/stream.js";

/** Section header introducing the embedded runtime modules (AR-100). */
export const RUNTIME_SECTION_HEADER = "; --- runtime routines (referenced only) ---";

/**
 * The package root the `runtime/*.asm` modules resolve against: two levels up
 * from this module (`src/runtime/` in dev, `dist/runtime/` when built — both
 * sit at the same depth below the package root).
 */
const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Collect the runtime-routine symbols the program actually calls (R16).
 *
 * Walks every final Instr stream (post-peephole, so only *surviving* call sites
 * count) for `JSR` targets that match a registered routine descriptor. The
 * result drives dead-stripping: unreferenced modules are simply never embedded.
 *
 * @param program The final instruction program (RD-08 output).
 * @param descriptors The registered T3/T4 routine descriptors (with `asmModulePath`).
 * @returns The set of referenced routine names, iteration-ordered by first use.
 */
export function collectReferencedRoutines(
  program: InstrProgram,
  descriptors: readonly IntrinsicDescriptor[],
): ReadonlySet<string> {
  const known = new Set(descriptors.filter((d) => d.asmModulePath !== undefined).map((d) => d.name));
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
 * Load one runtime module's verbatim `.asm` text (§4.6).
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
 * Compose the discrete runtime section for the serializer (PF-016, AR-100).
 *
 * Embeds exactly the referenced modules, verbatim, in the descriptors' catalog
 * order (deterministic output, R5). Returns `null` when nothing is referenced —
 * the caller then passes no `runtimeSection` option and the serialized output
 * stays byte-identical to the pre-RD-17 shape (R16, AC-11).
 *
 * @param referenced The routine names in use (from {@link collectReferencedRoutines}).
 * @param descriptors The registered routine descriptors (defines embedding order).
 * @returns The section text (header + module bodies), or `null` when empty.
 */
export function buildRuntimeSection(
  referenced: ReadonlySet<string>,
  descriptors: readonly IntrinsicDescriptor[],
): string | null {
  const used = descriptors.filter((d) => referenced.has(d.name) && d.asmModulePath !== undefined);
  if (used.length === 0) {
    return null;
  }
  const parts = [RUNTIME_SECTION_HEADER];
  for (const d of used) {
    parts.push(loadRuntimeModule(d).trimEnd());
  }
  return parts.join("\n");
}
