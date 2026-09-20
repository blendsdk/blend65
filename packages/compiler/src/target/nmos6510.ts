/** Addressing modes admitted by the documented NMOS 6502 instruction set. */
export type NmosAddressingMode =
  | "implied"
  | "accumulator"
  | "immediate"
  | "zero-page"
  | "zero-page-x"
  | "zero-page-y"
  | "absolute"
  | "absolute-x"
  | "absolute-y"
  | "indirect"
  | "indexed-indirect-x"
  | "indirect-indexed-y"
  | "relative";

/** Registers whose value or stack state can be observed by a machine instruction. */
export type CpuRegister = "a" | "x" | "y" | "s";

/** Processor-status flags tracked by mandatory lowering and resource binding. */
export type CpuFlag = "n" | "v" | "d" | "i" | "z" | "c";

/** Exact encoded size and documented path-cycle range for one opcode form. */
export interface NmosInstructionForm {
  /** Physical addressing mode. */
  readonly mode: NmosAddressingMode;
  /** Encoded instruction bytes. */
  readonly bytes: number;
  /** Cycles on the shortest documented path. */
  readonly minCycles: number;
  /** Cycles on the longest documented path, including branch/page variation. */
  readonly maxCycles: number;
}

/** Register and flag behavior common to every addressing form of an opcode. */
export interface NmosOpcodeFacts {
  /** Lowercase official mnemonic. */
  readonly opcode: string;
  /** Exact documented addressing forms. */
  readonly forms: readonly NmosInstructionForm[];
  /** Machine registers read before the instruction completes. */
  readonly usesRegisters: readonly CpuRegister[];
  /** Machine registers changed by the instruction. */
  readonly definesRegisters: readonly CpuRegister[];
  /** Status flags read before the instruction completes. */
  readonly usesFlags: readonly CpuFlag[];
  /** Status flags changed by the instruction. */
  readonly definesFlags: readonly CpuFlag[];
}

/** Register and flag behavior of one concrete opcode form. */
export interface NmosInstructionState {
  /** Machine registers read by this form. */
  readonly usesRegisters: readonly CpuRegister[];
  /** Machine registers changed by this form. */
  readonly definesRegisters: readonly CpuRegister[];
  /** Processor flags read by this form. */
  readonly usesFlags: readonly CpuFlag[];
  /** Processor flags changed by this form. */
  readonly definesFlags: readonly CpuFlag[];
}

/** Selected processor facts kept separate from C64 machine and packaging policy. */
export interface CpuFacts {
  /** Stable processor identity. */
  readonly id: "nmos6510";
  /** Official NMOS opcode grid, keyed by lowercase mnemonic. */
  readonly opcodes: Readonly<Record<string, NmosOpcodeFacts>>;
  /** Integrated processor-port direction register. */
  readonly portDirectionAddress: 0x0000;
  /** Integrated processor-port data register. */
  readonly portDataAddress: 0x0001;
}

type FormTuple = readonly [
  mode: NmosAddressingMode,
  bytes: number,
  minCycles: number,
  maxCycles?: number,
];

/** Freeze compact table entries into the public instruction-form record. */
function forms(entries: readonly FormTuple[]): readonly NmosInstructionForm[] {
  return Object.freeze(
    entries.map(([mode, bytes, minCycles, maxCycles = minCycles]) =>
      Object.freeze({ mode, bytes, minCycles, maxCycles }),
    ),
  );
}

/** Build one immutable official-opcode entry without a class or registry. */
function opcode(
  name: string,
  entries: readonly FormTuple[],
  usesRegisters: readonly CpuRegister[] = [],
  definesRegisters: readonly CpuRegister[] = [],
  usesFlags: readonly CpuFlag[] = [],
  definesFlags: readonly CpuFlag[] = [],
): NmosOpcodeFacts {
  return Object.freeze({
    opcode: name,
    forms: forms(entries),
    usesRegisters: Object.freeze(usesRegisters),
    definesRegisters: Object.freeze(definesRegisters),
    usesFlags: Object.freeze(usesFlags),
    definesFlags: Object.freeze(definesFlags),
  });
}

const READ_A: readonly CpuRegister[] = Object.freeze(["a"]);
const WRITE_A: readonly CpuRegister[] = Object.freeze(["a"]);
const READ_X: readonly CpuRegister[] = Object.freeze(["x"]);
const WRITE_X: readonly CpuRegister[] = Object.freeze(["x"]);
const READ_Y: readonly CpuRegister[] = Object.freeze(["y"]);
const WRITE_Y: readonly CpuRegister[] = Object.freeze(["y"]);
const READ_S: readonly CpuRegister[] = Object.freeze(["s"]);
const WRITE_S: readonly CpuRegister[] = Object.freeze(["s"]);
const NZ: readonly CpuFlag[] = Object.freeze(["n", "z"]);
const NVZC: readonly CpuFlag[] = Object.freeze(["n", "v", "z", "c"]);
const NZC: readonly CpuFlag[] = Object.freeze(["n", "z", "c"]);
const C: readonly CpuFlag[] = Object.freeze(["c"]);

const ALU_READ_FORMS: readonly FormTuple[] = Object.freeze([
  ["immediate", 2, 2],
  ["zero-page", 2, 3],
  ["zero-page-x", 2, 4],
  ["absolute", 3, 4],
  ["absolute-x", 3, 4, 5],
  ["absolute-y", 3, 4, 5],
  ["indexed-indirect-x", 2, 6],
  ["indirect-indexed-y", 2, 5, 6],
]);
const ACCUMULATOR_SHIFT_FORMS: readonly FormTuple[] = Object.freeze([
  ["accumulator", 1, 2],
  ["zero-page", 2, 5],
  ["zero-page-x", 2, 6],
  ["absolute", 3, 6],
  ["absolute-x", 3, 7],
]);
const BRANCH_FORM: readonly FormTuple[] = Object.freeze([["relative", 2, 2, 4]]);
const MEMORY_UPDATE_FORMS: readonly FormTuple[] = Object.freeze([
  ["zero-page", 2, 5],
  ["zero-page-x", 2, 6],
  ["absolute", 3, 6],
  ["absolute-x", 3, 7],
]);

const OPCODES: Readonly<Record<string, NmosOpcodeFacts>> = Object.freeze({
  adc: opcode("adc", ALU_READ_FORMS, READ_A, WRITE_A, C, NVZC),
  and: opcode("and", ALU_READ_FORMS, READ_A, WRITE_A, [], NZ),
  asl: opcode("asl", ACCUMULATOR_SHIFT_FORMS, READ_A, WRITE_A, [], NZC),
  bcc: opcode("bcc", BRANCH_FORM, [], [], C),
  bcs: opcode("bcs", BRANCH_FORM, [], [], C),
  beq: opcode("beq", BRANCH_FORM, [], [], ["z"]),
  bit: opcode(
    "bit",
    [
      ["zero-page", 2, 3],
      ["absolute", 3, 4],
    ],
    READ_A,
    [],
    [],
    ["n", "v", "z"],
  ),
  bmi: opcode("bmi", BRANCH_FORM, [], [], ["n"]),
  bne: opcode("bne", BRANCH_FORM, [], [], ["z"]),
  bpl: opcode("bpl", BRANCH_FORM, [], [], ["n"]),
  brk: opcode("brk", [["implied", 2, 7]], READ_S, WRITE_S, ["i"], ["i"]),
  bvc: opcode("bvc", BRANCH_FORM, [], [], ["v"]),
  bvs: opcode("bvs", BRANCH_FORM, [], [], ["v"]),
  clc: opcode("clc", [["implied", 1, 2]], [], [], [], ["c"]),
  cld: opcode("cld", [["implied", 1, 2]], [], [], [], ["d"]),
  cli: opcode("cli", [["implied", 1, 2]], [], [], [], ["i"]),
  clv: opcode("clv", [["implied", 1, 2]], [], [], [], ["v"]),
  cmp: opcode("cmp", ALU_READ_FORMS, READ_A, [], [], NZC),
  cpx: opcode(
    "cpx",
    [
      ["immediate", 2, 2],
      ["zero-page", 2, 3],
      ["absolute", 3, 4],
    ],
    READ_X,
    [],
    [],
    NZC,
  ),
  cpy: opcode(
    "cpy",
    [
      ["immediate", 2, 2],
      ["zero-page", 2, 3],
      ["absolute", 3, 4],
    ],
    READ_Y,
    [],
    [],
    NZC,
  ),
  dec: opcode("dec", MEMORY_UPDATE_FORMS, [], [], [], NZ),
  dex: opcode("dex", [["implied", 1, 2]], READ_X, WRITE_X, [], NZ),
  dey: opcode("dey", [["implied", 1, 2]], READ_Y, WRITE_Y, [], NZ),
  eor: opcode("eor", ALU_READ_FORMS, READ_A, WRITE_A, [], NZ),
  inc: opcode("inc", MEMORY_UPDATE_FORMS, [], [], [], NZ),
  inx: opcode("inx", [["implied", 1, 2]], READ_X, WRITE_X, [], NZ),
  iny: opcode("iny", [["implied", 1, 2]], READ_Y, WRITE_Y, [], NZ),
  jmp: opcode("jmp", [
    ["absolute", 3, 3],
    ["indirect", 3, 5],
  ]),
  jsr: opcode("jsr", [["absolute", 3, 6]], READ_S, WRITE_S),
  lda: opcode("lda", ALU_READ_FORMS, [], WRITE_A, [], NZ),
  ldx: opcode(
    "ldx",
    [
      ["immediate", 2, 2],
      ["zero-page", 2, 3],
      ["zero-page-y", 2, 4],
      ["absolute", 3, 4],
      ["absolute-y", 3, 4, 5],
    ],
    [],
    WRITE_X,
    [],
    NZ,
  ),
  ldy: opcode(
    "ldy",
    [
      ["immediate", 2, 2],
      ["zero-page", 2, 3],
      ["zero-page-x", 2, 4],
      ["absolute", 3, 4],
      ["absolute-x", 3, 4, 5],
    ],
    [],
    WRITE_Y,
    [],
    NZ,
  ),
  lsr: opcode("lsr", ACCUMULATOR_SHIFT_FORMS, READ_A, WRITE_A, [], NZC),
  nop: opcode("nop", [["implied", 1, 2]]),
  ora: opcode("ora", ALU_READ_FORMS, READ_A, WRITE_A, [], NZ),
  pha: opcode("pha", [["implied", 1, 3]], ["a", "s"], ["s"]),
  php: opcode("php", [["implied", 1, 3]], ["s"], ["s"], ["n", "v", "d", "i", "z", "c"]),
  pla: opcode("pla", [["implied", 1, 4]], READ_S, ["a", "s"], [], NZ),
  plp: opcode("plp", [["implied", 1, 4]], READ_S, WRITE_S, [], ["n", "v", "d", "i", "z", "c"]),
  rol: opcode("rol", ACCUMULATOR_SHIFT_FORMS, READ_A, WRITE_A, C, NZC),
  ror: opcode("ror", ACCUMULATOR_SHIFT_FORMS, READ_A, WRITE_A, C, NZC),
  rti: opcode("rti", [["implied", 1, 6]], READ_S, WRITE_S, [], ["n", "v", "d", "i", "z", "c"]),
  rts: opcode("rts", [["implied", 1, 6]], READ_S, WRITE_S),
  sbc: opcode("sbc", ALU_READ_FORMS, READ_A, WRITE_A, C, NVZC),
  sec: opcode("sec", [["implied", 1, 2]], [], [], [], ["c"]),
  sed: opcode("sed", [["implied", 1, 2]], [], [], [], ["d"]),
  sei: opcode("sei", [["implied", 1, 2]], [], [], [], ["i"]),
  sta: opcode(
    "sta",
    [
      ["zero-page", 2, 3],
      ["zero-page-x", 2, 4],
      ["absolute", 3, 4],
      ["absolute-x", 3, 5],
      ["absolute-y", 3, 5],
      ["indexed-indirect-x", 2, 6],
      ["indirect-indexed-y", 2, 6],
    ],
    READ_A,
  ),
  stx: opcode(
    "stx",
    [
      ["zero-page", 2, 3],
      ["zero-page-y", 2, 4],
      ["absolute", 3, 4],
    ],
    READ_X,
  ),
  sty: opcode(
    "sty",
    [
      ["zero-page", 2, 3],
      ["zero-page-x", 2, 4],
      ["absolute", 3, 4],
    ],
    READ_Y,
  ),
  tax: opcode("tax", [["implied", 1, 2]], READ_A, WRITE_X, [], NZ),
  tay: opcode("tay", [["implied", 1, 2]], READ_A, WRITE_Y, [], NZ),
  tsx: opcode("tsx", [["implied", 1, 2]], READ_S, WRITE_X, [], NZ),
  txa: opcode("txa", [["implied", 1, 2]], READ_X, WRITE_A, [], NZ),
  txs: opcode("txs", [["implied", 1, 2]], READ_X, WRITE_S),
  tya: opcode("tya", [["implied", 1, 2]], READ_Y, WRITE_A, [], NZ),
});

/** Exact selected NMOS 6510 CPU facts. */
export const NMOS_6510: CpuFacts = Object.freeze({
  id: "nmos6510",
  opcodes: OPCODES,
  portDirectionAddress: 0x0000,
  portDataAddress: 0x0001,
});

/**
 * Look up one documented physical opcode form.
 * @param cpu Selected NMOS CPU facts.
 * @param opcodeName Lowercase mnemonic.
 * @param mode Physical addressing mode.
 * @returns The exact form, or null when the pair is not legal on this CPU.
 * @example nmosInstructionForm(NMOS_6510, "lda", "immediate")?.bytes === 2
 */
export function nmosInstructionForm(
  cpu: CpuFacts,
  opcodeName: string,
  mode: string,
): NmosInstructionForm | null {
  const facts = cpu.opcodes[opcodeName];
  return facts?.forms.find((candidate) => candidate.mode === mode) ?? null;
}

const REGISTER_ORDER: readonly CpuRegister[] = Object.freeze(["a", "x", "y", "s"]);
const FLAG_ORDER: readonly CpuFlag[] = Object.freeze(["n", "v", "d", "i", "z", "c"]);

/**
 * Return architectural state facts for one physical instruction form.
 *
 * Indexed operands consume their index register, memory shifts do not read or replace the
 * accumulator, and decimal mode is an input to binary-coded addition and subtraction.
 *
 * @param cpu Selected NMOS CPU facts.
 * @param opcodeName Lowercase mnemonic.
 * @param mode Physical addressing mode.
 * @returns Exact state facts, or null when the opcode form is not admitted.
 * @example nmosInstructionState(NMOS_6510, "lda", "absolute-x")?.usesRegisters.includes("x")
 */
export function nmosInstructionState(
  cpu: CpuFacts,
  opcodeName: string,
  mode: string,
): NmosInstructionState | null {
  const facts = cpu.opcodes[opcodeName];
  if (facts === undefined || nmosInstructionForm(cpu, opcodeName, mode) === null) return null;

  const usesRegisters = new Set(facts.usesRegisters);
  const definesRegisters = new Set(facts.definesRegisters);
  const usesFlags = new Set(facts.usesFlags);
  if (mode === "zero-page-x" || mode === "absolute-x" || mode === "indexed-indirect-x") {
    usesRegisters.add("x");
  }
  if (mode === "zero-page-y" || mode === "absolute-y" || mode === "indirect-indexed-y") {
    usesRegisters.add("y");
  }
  if (
    (opcodeName === "asl" ||
      opcodeName === "lsr" ||
      opcodeName === "rol" ||
      opcodeName === "ror") &&
    mode !== "accumulator"
  ) {
    usesRegisters.delete("a");
    definesRegisters.delete("a");
  }
  if (opcodeName === "adc" || opcodeName === "sbc") usesFlags.add("d");

  return Object.freeze({
    usesRegisters: Object.freeze(REGISTER_ORDER.filter((register) => usesRegisters.has(register))),
    definesRegisters: Object.freeze(
      REGISTER_ORDER.filter((register) => definesRegisters.has(register)),
    ),
    usesFlags: Object.freeze(FLAG_ORDER.filter((flag) => usesFlags.has(flag))),
    definesFlags: Object.freeze(FLAG_ORDER.filter((flag) => facts.definesFlags.includes(flag))),
  });
}
