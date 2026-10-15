import { describe, expect, it } from "vitest";
import type { TypedProgram } from "@blend65/compiler/frontend";
import { analyzeProfileSource } from "./profile-fixture.js";
import { sourceLibraryProfiles } from "./source-library-fixture.js";

const masks = {
  joystickUpMask: 1,
  joystickDownMask: 2,
  joystickLeftMask: 4,
  joystickRightMask: 8,
  joystickFireMask: 16,
  joystickControlsMask: 31,
};
// Columns name physical switches; the row ordinal supplies the low three bits.
const keys = [
  "DELETE RETURN CURSOR_LEFT_RIGHT F7 F1 F3 F5 CURSOR_UP_DOWN",
  "DIGIT_3 W A DIGIT_4 Z S E LEFT_SHIFT",
  "DIGIT_5 R D DIGIT_6 C F T X",
  "DIGIT_7 Y G DIGIT_8 B H U V",
  "DIGIT_9 I J DIGIT_0 M K O N",
  "PLUS P L MINUS PERIOD COLON AT COMMA",
  "POUND ASTERISK SEMICOLON HOME RIGHT_SHIFT EQUALS UP_ARROW SLASH",
  "DIGIT_1 LEFT_ARROW CONTROL DIGIT_2 SPACE COMMODORE Q RUN_STOP",
].flatMap((column) => column.split(" "));
const enums: Record<string, Record<string, number>> = {
  InputState: { OBSERVED_DOWN: 0, OBSERVED_UP: 1, UNCERTAIN: 2 },
  SnapshotQuality: { COMPLETE: 0, INTERRUPTED: 1, UNAVAILABLE: 2 },
  JoystickPort: { PORT_1: 1, PORT_2: 2 },
  JoystickControl: { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3, FIRE: 4 },
  Key: Object.fromEntries(keys.map((name, value) => [name, value])),
};
const publicNames = [
  ...Object.keys(masks),
  ...Object.keys(enums),
  "InputSnapshot",
  "readInputSnapshot",
  "keyState",
  "joystickState",
];

/** Check an ordinary installed-library caller and return only public analysis evidence. */
async function analyze(profile: string, declarations = "", main = "") {
  const result = await analyzeProfileSource(
    `module Game; import { ${publicNames.join(", ")} } from c64.input;
     ${declarations} function main(): void { ${main} }`,
    profile,
  );
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected a legal input-library caller");
  return result.program;
}

/** Require one published declaration identity rather than inferring it from source spelling. */
function binding(program: TypedProgram, name: string) {
  const found = program.bindings.filter((entry) => entry.qualifiedName === name);
  expect(found, name).toHaveLength(1);
  return found[0]!;
}

/** Read the evaluated value of a caller-owned constant, never a library function body. */
function constant(program: TypedProgram, name: string) {
  const id = binding(program, `Game.${name}`).id;
  const found = program.declarations.filter(
    (entry) => entry.binding.sourceId === id.sourceId && entry.binding.span.start === id.span.start,
  );
  expect(found, name).toHaveLength(1);
  return found[0]!.initializer?.constant;
}

describe.each(sourceLibraryProfiles)("saved input declarations on %s", (profile) => {
  // The library exposes only the approved data and ordinary callable names.
  it("should export exactly the input API and preserve all six byte masks", async () => {
    const program = await analyze(
      profile,
      Object.keys(masks)
        .map((name) => `const mask_${name}: byte = ${name};`)
        .join("\n"),
    );
    const exports = program.bindings.filter(
      (entry) =>
        entry.id.sourceId === "@blend65/stdlib/c64/input.blend" &&
        entry.exported &&
        entry.qualifiedName?.startsWith("c64.input."),
    );
    expect(exports.map((entry) => entry.name).sort()).toEqual([...publicNames].sort());
    for (const [name, value] of Object.entries(masks)) {
      expect(binding(program, `c64.input.${name}`).storage).toBe("constant");
      expect(binding(program, `c64.input.${name}`).type).toEqual({ kind: "scalar", name: "byte" });
      expect(constant(program, `mask_${name}`), name).toBe(BigInt(value));
    }
  });

  // Enum members have exact byte values, with no aliases for absent physical switches.
  it("should expose exactly the declared enum members and all 64 physical key values", async () => {
    const probes = Object.entries(enums).flatMap(([name, members]) => [
      `const size_${name}: word = sizeof(${name});`,
      ...Object.keys(members).map(
        (member) => `const value_${name}_${member}: byte = ${name}.${member};`,
      ),
    ]);
    const program = await analyze(profile, probes.join("\n"));
    const module = program.modules.find((entry) => entry.name === "c64.input");
    expect(module).toBeDefined();
    const declarations = module!.units.flatMap((unit) => unit.declarations);
    for (const [name, members] of Object.entries(enums)) {
      expect(binding(program, `c64.input.${name}`).type).toMatchObject({ kind: "enum", name });
      expect(constant(program, `size_${name}`), name).toBe(1n);
      const declaration = declarations.find(
        (entry) => entry.kind === "enum" && entry.name === name,
      );
      if (declaration?.kind !== "enum") throw new Error(`Missing enum declaration: ${name}`);
      expect(declaration.members.map((member) => member.name).sort()).toEqual(
        Object.keys(members).sort(),
      );
      for (const [member, value] of Object.entries(members))
        expect(constant(program, `value_${name}_${member}`), `${name}.${member}`).toBe(
          BigInt(value),
        );
    }
  });

  // The saved object is packed, and ordinary source callers borrow it through const signatures.
  it("should pack the snapshot into 11 bytes and provide the exact ordinary function signatures", async () => {
    const fields = ["rows", "joystick1", "joystick2", "quality"];
    const program = await analyze(
      profile,
      [
        `const size_snapshot: word = sizeof(InputSnapshot);`,
        ...fields.map(
          (field) => `const offset_${field}: word = offsetof(InputSnapshot, ${field});`,
        ),
      ].join("\n"),
      `let saved: InputSnapshot = readInputSnapshot();
       let keyResult: InputState = keyState(saved, Key.DELETE);
       let joystickResult: InputState = joystickState(saved, JoystickPort.PORT_1, JoystickControl.UP);`,
    );
    const snapshot = binding(program, "c64.input.InputSnapshot").type;
    const state = binding(program, "c64.input.InputState").type;
    expect(snapshot).toMatchObject({
      kind: "struct",
      size: 11,
      fields: [
        {
          name: "rows",
          offset: 0,
          type: { kind: "array", length: 8, size: 8, element: { kind: "scalar", name: "byte" } },
        },
        { name: "joystick1", offset: 8, type: { kind: "scalar", name: "byte" } },
        { name: "joystick2", offset: 9, type: { kind: "scalar", name: "byte" } },
        { name: "quality", offset: 10, type: binding(program, "c64.input.SnapshotQuality").type },
      ],
    });
    expect(constant(program, "size_snapshot")).toBe(11n);
    fields.forEach((field, index) =>
      expect(constant(program, `offset_${field}`)).toBe(BigInt([0, 8, 9, 10][index]!)),
    );
    const signatures = [
      ["readInputSnapshot", [], snapshot],
      ["keyState", ["InputSnapshot", "Key"], state],
      ["joystickState", ["InputSnapshot", "JoystickPort", "JoystickControl"], state],
    ] as const;
    const mainId = binding(program, "Game.main").id;
    const mainDeclarations = program.declarations.filter(
      (entry) =>
        entry.binding.sourceId === mainId.sourceId &&
        entry.binding.span.start === mainId.span.start &&
        entry.binding.span.end === mainId.span.end,
    );
    expect(mainDeclarations).toHaveLength(1);
    const main = mainDeclarations[0];
    if (main?.kind !== "typed" || main.body === null)
      throw new Error("Expected the checked caller body");
    for (const [name, parameters, returnType] of signatures) {
      const callable = binding(program, `c64.input.${name}`);
      expect(callable.functionMode, name).toBe("ordinary");
      expect(callable.operationEffect, name).toBeUndefined();
      expect(callable.type, name).toEqual(returnType);
      const calls = main.body.statements.flatMap((statement) =>
        statement.kind === "variable" &&
        statement.initializer?.kind === "call" &&
        statement.initializer.callee?.kind === "name" &&
        statement.initializer.callee.binding?.sourceId === callable.id.sourceId &&
        statement.initializer.callee.binding.span.start === callable.id.span.start &&
        statement.initializer.callee.binding.span.end === callable.id.span.end
          ? [statement.initializer]
          : [],
      );
      expect(calls, name).toHaveLength(1);
      expect(calls[0]!.signature, name).toMatchObject({
        returnType,
        parameters: parameters.map((type, index) => ({
          type: binding(program, `c64.input.${type}`).type,
          readonly: index === 0,
        })),
      });
    }
  });

  // Every byte remains a legal enum value, including values without a member name.
  it("should preserve every byte value through explicit casts to each input enum", async () => {
    const probes = Object.keys(enums).flatMap((name) =>
      Array.from(
        { length: 256 },
        (_, value) => `const cast_${name}_${value}: ${name} = ${name}(${value});`,
      ),
    );
    const program = await analyze(profile, probes.join("\n"));
    for (const name of Object.keys(enums))
      for (let value = 0; value < 256; value += 1) {
        const probe = `cast_${name}_${value}`;
        expect(binding(program, `Game.${probe}`).type).toEqual(
          binding(program, `c64.input.${name}`).type,
        );
        expect(constant(program, probe), probe).toBe(BigInt(value));
      }
  });
});
