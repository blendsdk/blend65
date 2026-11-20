import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult, OptimizationGoal } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

/**
 * Calling a function through a variable that may hold one of several functions,
 * and then doing ordinary work afterwards, is an ordinary program. Whether it
 * compiles must depend only on what the program says, never on incidental
 * detail of the call — in particular not on how many arguments the call passes.
 *
 * The unusual candidates here are the ones that loop forever. A function that
 * never reaches its own end makes every statement after the call unreachable.
 * Unreachable code is not an error in this language, so such a program remains
 * legal and must still be accepted, with the same answer at every call shape.
 *
 * This oracle judges acceptance only. The instruction sequence a dispatch
 * lowers to, and the wording of any diagnostic, are deliberately not pinned
 * here: they belong to their own units, and repeating them would make a correct
 * change to either look like a regression.
 */

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must never decide whether a legal program compiles. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/** Whether a candidate function reaches its own end or loops forever instead. */
type Candidate = "returns" | "loops forever";

/** The structural knobs of one complete program under judgment. */
interface ProgramShape {
  /** Result type shared by the function variable and both of its candidates. */
  result: "void" | "byte";
  /** Whether the call passes an argument that the candidates then ignore. */
  arity: "no arguments" | "one argument";
  /** The two candidates in declaration order; the variable starts at the first. */
  candidates: readonly [Candidate, Candidate];
}

/** One legal program, written to a real temporary project and compiled for real. */
interface DispatchProgram {
  /** The exact combination of structural detail this program carries. */
  label: string;
  /** Complete legal source text. */
  source: string;
}

/** A function whose body loops forever never reaches its end, so it needs no return. */
const loopsForever = "while (true) { }";

/** A candidate that does reach its end leaves an observable mark of which one ran. */
function endingBody(result: ProgramShape["result"], mark: number): string {
  return result === "void" ? `poke($C200, ${mark});` : `return ${mark};`;
}

/** Declare one candidate with the signature the function variable expects. */
function candidateDeclaration(
  name: string,
  shape: ProgramShape,
  candidate: Candidate,
  mark: number,
): string {
  const parameters = shape.arity === "one argument" ? "n: byte" : "";
  const body = candidate === "returns" ? endingBody(shape.result, mark) : loopsForever;
  return `function ${name}(${parameters}): ${shape.result} { ${body} }`;
}

/** The function-variable type matching the shape's parameters and result. */
function variableType(shape: ProgramShape): string {
  return `fn(${shape.arity === "one argument" ? "byte" : ""}): ${shape.result}`;
}

/** Call through the variable, consuming the result when there is one to consume. */
function callStatement(shape: ProgramShape): string {
  const call = `hook(${shape.arity === "one argument" ? "7" : ""})`;
  return shape.result === "void" ? `${call};` : `poke($C100, ${call});`;
}

/**
 * Build the program the requirement is about: two candidate functions, a
 * variable that may hold either one depending on a value only known at run
 * time, a call through that variable, and then ordinary arithmetic and a write.
 */
function dispatchProgram(shape: ProgramShape): DispatchProgram {
  const [first, second] = shape.candidates;
  return {
    label: `a ${shape.result} result, ${shape.arity}, a first candidate that ${first} and a second that ${second}`,
    source: [
      "module Game;",
      candidateDeclaration("firstTarget", shape, first, 1),
      candidateDeclaration("secondTarget", shape, second, 2),
      "function main(): void {",
      `  let hook: ${variableType(shape)} = &firstTarget;`,
      "  if (peek($C000) == 1) { hook = &secondTarget; }",
      `  ${callStatement(shape)}`,
      "  let i: byte = peek($C002);",
      "  i = i + peek($C003);",
      "  poke($C101, i);",
      "}",
      "",
    ].join("\n"),
  };
}

/**
 * The same program at both call shapes. Argument count is the axis the
 * requirement forbids from deciding acceptance, so every candidate profile is
 * judged once with no arguments and once with a single ignored argument.
 */
function atBothCallShapes(
  result: ProgramShape["result"],
  candidates: readonly [Candidate, Candidate],
): readonly DispatchProgram[] {
  return [
    dispatchProgram({ result, arity: "no arguments", candidates }),
    dispatchProgram({ result, arity: "one argument", candidates }),
  ];
}

const programs: readonly DispatchProgram[] = [
  // Every candidate loops forever, so nothing written after the call can ever
  // run. The program is still legal and must compile at either call shape.
  ...atBothCallShapes("void", ["loops forever", "loops forever"]),
  // The same shape where the call also yields a value the caller consumes.
  ...atBothCallShapes("byte", ["loops forever", "loops forever"]),
  // Both candidates reach their end: the ordinary case that surrounds the one
  // above, and which no repair of it may break.
  ...atBothCallShapes("void", ["returns", "returns"]),
  // One candidate of each kind, in both declaration orders. Neither the mix nor
  // which candidate the variable starts at may decide the outcome.
  ...atBothCallShapes("void", ["returns", "loops forever"]),
  ...atBothCallShapes("void", ["loops forever", "returns"]),
];

/** Name the whole judgment in the failure message so a red case explains itself. */
function judgment(result: BuildResult | CheckResult): string {
  return `${result.kind}: ${JSON.stringify(result.diagnostics)}`;
}

/**
 * A legal program must be accepted outright. Warnings are allowed — ignoring a
 * parameter or writing code that cannot be reached is worth remarking on — but
 * no error may be reported and no service may stop short of a result.
 */
function expectAccepted(result: BuildResult | CheckResult, service: string): void {
  expect(result.kind, `${service} refused a legal program — ${judgment(result)}`).toBe("success");
  expect(
    result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    `${service} reported errors for a legal program`,
  ).toEqual([]);
}

const cases = programs.map((dispatch) => [dispatch.label, dispatch] as const);

describe.each(modes)("building a call through a function variable in mode %s", (mode) => {
  it.each(cases)(
    "should compile a program with %s",
    async (_label, dispatch) => {
      await withProfileProject(dispatch.source, target, async (project) => {
        expectAccepted(await buildProject({ project, optimization: mode }), "The build");
      });
    },
    60_000,
  );
});

describe("checking a call through a function variable", () => {
  // Checking and building must agree on whether a program is legal; a program
  // an author is told is fine must not be refused once they build it.
  it.each(cases)(
    "should report success for a program with %s",
    async (_label, dispatch) => {
      await withProfileProject(dispatch.source, target, async (project) => {
        expectAccepted(await checkProject({ project }), "The check");
      });
    },
    60_000,
  );
});
