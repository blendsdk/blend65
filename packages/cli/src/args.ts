import { parseArgs } from "node:util";

/** Commands exposed by the Blend65 command-line interface. */
export type CliCommand = "check" | "build" | "run" | "evidence";

/** Project selections shared by every compiler command. */
export interface ProjectSelections {
  /** Optional manifest path or project directory. */
  readonly project?: string;
  /** Optional target-profile override. */
  readonly target?: string;
  /** Optional entry-module override. */
  readonly entry?: string;
}

/** Build selections accepted by `build` and `run`. */
export interface BuildSelections extends ProjectSelections {
  /** Optional direct-lowering, balanced, speed or size optimization override. */
  readonly optimization?: "none" | "balanced" | "speed" | "size";
  /** Optional bounds-check override. */
  readonly boundsCheck?: boolean;
  /** Optional division-by-zero-check override. */
  readonly divisionZeroCheck?: boolean;
}

/** A valid informational or compiler-command invocation. */
export type CliArguments =
  | { readonly kind: "help"; readonly json: boolean }
  | { readonly kind: "version"; readonly json: boolean }
  | { readonly kind: "check"; readonly options: ProjectSelections; readonly json: boolean }
  | { readonly kind: "evidence"; readonly options: ProjectSelections; readonly json: boolean }
  | { readonly kind: "build" | "run"; readonly options: BuildSelections; readonly json: boolean };

/** Parse an exact command name from a positional token. */
function commandFrom(value: string): CliCommand | null {
  return value === "check" || value === "build" || value === "run" || value === "evidence"
    ? value
    : null;
}

/** Parse a strict command-line Boolean without numeric or friendly aliases. */
function booleanFrom(value: string | undefined): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * Parse the complete public CLI allowlist without interpreting option values.
 * Node performs tokenization and unknown-option rejection. This layer adds the
 * command-specific option rules and rejects duplicates before values can be
 * overwritten. A null result is safe to render as a usage error.
 * @param argv Literal arguments without executable or script names.
 * @returns One accepted invocation, or null when any token is invalid.
 */
export function parseArguments(argv: readonly string[]): CliArguments | null {
  if (!argv.every((argument) => typeof argument === "string")) return null;

  try {
    const { values, positionals, tokens } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      tokens: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        json: { type: "boolean" },
        project: { type: "string" },
        target: { type: "string" },
        entry: { type: "string" },
        optimization: { type: "string" },
        "bounds-check": { type: "string" },
        "division-zero-check": { type: "string" },
      },
    });

    const seen = new Set<string>();
    for (const token of tokens) {
      if (token.kind === "option-terminator") return null;
      if (token.kind !== "option") continue;
      if (seen.has(token.name)) return null;
      seen.add(token.name);
    }

    const json = values.json === true;
    const informationalCount = Number(values.help === true) + Number(values.version === true);
    if (informationalCount > 0) {
      const extra = [...seen].filter(
        (name) => name !== "help" && name !== "version" && name !== "json",
      );
      if (informationalCount !== 1 || positionals.length !== 0 || extra.length !== 0) return null;
      return values.help === true ? { kind: "help", json } : { kind: "version", json };
    }

    if (positionals.length !== 1) return null;
    const command = commandFrom(positionals[0]!);
    if (command === null) return null;

    const projectOptions: ProjectSelections = {
      ...(values.project === undefined ? {} : { project: values.project }),
      ...(values.target === undefined ? {} : { target: values.target }),
      ...(values.entry === undefined ? {} : { entry: values.entry }),
    };
    const hasBuildOptions =
      values.optimization !== undefined ||
      values["bounds-check"] !== undefined ||
      values["division-zero-check"] !== undefined;
    if (command === "check") {
      return hasBuildOptions ? null : { kind: "check", options: projectOptions, json };
    }
    if (command === "evidence") {
      return hasBuildOptions ? null : { kind: "evidence", options: projectOptions, json };
    }

    if (
      values.optimization !== undefined &&
      values.optimization !== "none" &&
      values.optimization !== "balanced" &&
      values.optimization !== "speed" &&
      values.optimization !== "size"
    )
      return null;
    const boundsCheck = booleanFrom(values["bounds-check"]);
    const divisionZeroCheck = booleanFrom(values["division-zero-check"]);
    if (boundsCheck === null || divisionZeroCheck === null) return null;

    return {
      kind: command,
      json,
      options: {
        ...projectOptions,
        ...(values.optimization === undefined ? {} : { optimization: values.optimization }),
        ...(boundsCheck === undefined ? {} : { boundsCheck }),
        ...(divisionZeroCheck === undefined ? {} : { divisionZeroCheck }),
      },
    };
  } catch {
    return null;
  }
}
