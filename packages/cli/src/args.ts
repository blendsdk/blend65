import { parseArgs } from "node:util";
import type { ProjectLoadOptions } from "@blend65/compiler";

/** Accepted informational selection or literal options for the public project loader. */
export interface CliArguments {
  /** Show usage without reading project input. */
  readonly help: boolean;
  /** Show the build version without reading project input. */
  readonly version: boolean;
  /** Invocation-only values; the loader owns their project semantics. */
  readonly options: ProjectLoadOptions;
}

/**
 * Parse only the implemented flags, rejecting repetition and positional commands.
 * Node validates option names and missing values; tokens detect repeated aliases
 * before their values can silently overwrite each other. Invalid input is null,
 * not a native parser exception containing a private path or terminal sequence.
 * @param argv Literal command-line arguments, without executable/script names.
 * @param cwd Discovery directory forwarded unchanged to the project loader.
 * @returns Accepted arguments or null for an invalid invocation.
 */
export function parseArguments(argv: readonly string[], cwd: string): CliArguments | null {
  if (!argv.every((argument) => typeof argument === "string")) return null;
  try {
    const { values, tokens } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      tokens: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        project: { type: "string" },
        target: { type: "string" },
        entry: { type: "string" },
      },
    });
    const seen = new Set<string>();
    for (const token of tokens) {
      if (token.kind !== "option") continue;
      if (seen.has(token.name)) return null;
      seen.add(token.name);
    }
    if (values.help && values.version) return null;
    return {
      help: values.help === true,
      version: values.version === true,
      options: {
        cwd,
        ...(values.project === undefined ? {} : { project: values.project }),
        ...(values.target === undefined ? {} : { target: values.target }),
        ...(values.entry === undefined ? {} : { entry: values.entry }),
      },
    };
  } catch {
    return null;
  }
}
