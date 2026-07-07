/**
 * Minimal NMOS 6502 interpreter — test support only.
 *
 * Executes assembled runtime-routine binaries against arithmetic test vectors
 * so the hand-written `runtime/*.asm` modules are functionally verified ahead
 * of full emulator-based verification (this closes the interim functional
 * gap until that tier is available).
 *
 * Scope: exactly the documented/legal opcode+mode pairs the runtime routines
 * and their call sites use (loads/stores, transfers, stack, ALU, shifts,
 * compares, branches, JSR/RTS). Anything else throws — an unimplemented opcode
 * in a routine is a signal to extend the interpreter deliberately, not a
 * silent skip. Decimal mode and cycle counting are intentionally out of scope.
 *
 * NOT part of the public `@blend65/compiler` API (not exported from `index.ts`);
 * the real test-harness/emulator tier supersedes this.
 */

/** The observable machine state after a {@link runRoutine} call. */
export interface CpuState {
  /** 64 KiB memory image (zero page, stack, code, data). */
  readonly mem: Uint8Array;
  /** Accumulator. */
  a: number;
  /** X index register. */
  x: number;
  /** Y index register. */
  y: number;
  /** Stack pointer (offset into $0100). */
  sp: number;
  /** Program counter. */
  pc: number;
  /** Carry flag (0/1). */
  c: number;
  /** Zero flag (0/1). */
  z: number;
  /** Negative flag (0/1). */
  n: number;
  /** Overflow flag (0/1). */
  v: number;
}

/** Inputs for a routine run: entry registers and pre-set zero-page bytes. */
export interface RoutineInput {
  /** Entry accumulator. */
  readonly a?: number;
  /** Entry X register. */
  readonly x?: number;
  /** Entry Y register. */
  readonly y?: number;
  /** Zero-page bytes to set before the run, keyed by address. */
  readonly zp?: Readonly<Record<number, number>>;
}

/** Where routine binaries are loaded (matches the ACME-validity harness prelude). */
export const ROUTINE_ORG = 0x8000;

/** Step budget — generous for the slowest routine (div16 ≈ 1k cycles). */
const MAX_STEPS = 200_000;

/**
 * Execute one instruction, mutating `s`.
 *
 * @param s The machine state (pc at the opcode byte).
 * @throws {Error} On an opcode outside the implemented subset.
 */
function step(s: CpuState): void {
  const m = s.mem;
  const op = m[s.pc++] ?? 0;
  const imm = (): number => m[s.pc++] ?? 0;
  const abs = (): number => {
    const lo = m[s.pc++] ?? 0;
    const hi = m[s.pc++] ?? 0;
    return lo | (hi << 8);
  };
  const setzn = (value: number): number => {
    const v = value & 0xff;
    s.z = v === 0 ? 1 : 0;
    s.n = (v >> 7) & 1;
    return v;
  };
  const adc = (v: number): void => {
    const r = s.a + v + s.c;
    s.v = (~(s.a ^ v) & (s.a ^ r) & 0x80) !== 0 ? 1 : 0;
    s.c = r > 0xff ? 1 : 0;
    s.a = setzn(r);
  };
  const cmp = (reg: number, v: number): void => {
    const r = reg - v;
    s.c = r >= 0 ? 1 : 0;
    setzn(r & 0xff);
  };
  const branch = (cond: boolean): void => {
    const off = imm();
    if (cond) {
      s.pc = (s.pc + ((off << 24) >> 24)) & 0xffff;
    }
  };
  const push = (v: number): void => {
    m[0x100 + s.sp] = v & 0xff;
    s.sp = (s.sp - 1) & 0xff;
  };
  const pop = (): number => {
    s.sp = (s.sp + 1) & 0xff;
    return m[0x100 + s.sp] ?? 0;
  };
  const rmw = (addr: number, f: (v: number) => number): void => {
    m[addr] = setzn(f(m[addr] ?? 0));
  };

  switch (op) {
    // Loads / stores
    case 0xa9: s.a = setzn(imm()); break;                        // LDA #
    case 0xa5: s.a = setzn(m[imm()] ?? 0); break;                // LDA zp
    case 0xad: s.a = setzn(m[abs()] ?? 0); break;                // LDA abs
    case 0xa2: s.x = setzn(imm()); break;                        // LDX #
    case 0xa6: s.x = setzn(m[imm()] ?? 0); break;                // LDX zp
    case 0xae: s.x = setzn(m[abs()] ?? 0); break;                // LDX abs
    case 0xa0: s.y = setzn(imm()); break;                        // LDY #
    case 0xa4: s.y = setzn(m[imm()] ?? 0); break;                // LDY zp
    case 0x85: m[imm()] = s.a; break;                            // STA zp
    case 0x8d: m[abs()] = s.a; break;                            // STA abs
    case 0x86: m[imm()] = s.x; break;                            // STX zp
    case 0x8e: m[abs()] = s.x; break;                            // STX abs
    case 0x84: m[imm()] = s.y; break;                            // STY zp
    // Transfers / stack
    case 0xaa: s.x = setzn(s.a); break;                          // TAX
    case 0x8a: s.a = setzn(s.x); break;                          // TXA
    case 0xa8: s.y = setzn(s.a); break;                          // TAY
    case 0x98: s.a = setzn(s.y); break;                          // TYA
    case 0x48: push(s.a); break;                                 // PHA
    case 0x68: s.a = setzn(pop()); break;                        // PLA
    // Flags / ALU
    case 0x18: s.c = 0; break;                                   // CLC
    case 0x38: s.c = 1; break;                                   // SEC
    case 0x69: adc(imm()); break;                                // ADC #
    case 0x65: adc(m[imm()] ?? 0); break;                        // ADC zp
    case 0x6d: adc(m[abs()] ?? 0); break;                        // ADC abs
    case 0xe9: adc(imm() ^ 0xff); break;                         // SBC #
    case 0xe5: adc((m[imm()] ?? 0) ^ 0xff); break;               // SBC zp
    case 0xc9: cmp(s.a, imm()); break;                           // CMP #
    case 0xc5: cmp(s.a, m[imm()] ?? 0); break;                   // CMP zp
    case 0xe0: cmp(s.x, imm()); break;                           // CPX #
    case 0xc0: cmp(s.y, imm()); break;                           // CPY #
    case 0xc4: cmp(s.y, m[imm()] ?? 0); break;                   // CPY zp
    // Shifts / rotates
    case 0x0a: s.c = (s.a >> 7) & 1; s.a = setzn(s.a << 1); break;                      // ASL A
    case 0x06: { const ad = imm(); s.c = ((m[ad] ?? 0) >> 7) & 1; rmw(ad, (x) => x << 1); break; } // ASL zp
    case 0x4a: s.c = s.a & 1; s.a = setzn(s.a >> 1); break;                             // LSR A
    case 0x46: { const ad = imm(); s.c = (m[ad] ?? 0) & 1; rmw(ad, (x) => x >> 1); break; }        // LSR zp
    case 0x2a: { const c = s.c; s.c = (s.a >> 7) & 1; s.a = setzn((s.a << 1) | c); break; }        // ROL A
    case 0x26: { const ad = imm(); const c = s.c; s.c = ((m[ad] ?? 0) >> 7) & 1; rmw(ad, (x) => (x << 1) | c); break; } // ROL zp
    case 0x6a: { const c = s.c; s.c = s.a & 1; s.a = setzn((s.a >> 1) | (c << 7)); break; }        // ROR A
    case 0x66: { const ad = imm(); const c = s.c; s.c = (m[ad] ?? 0) & 1; rmw(ad, (x) => (x >> 1) | (c << 7)); break; } // ROR zp
    // Inc / dec
    case 0xe6: rmw(imm(), (x) => x + 1); break;                  // INC zp
    case 0xc6: rmw(imm(), (x) => x - 1); break;                  // DEC zp
    case 0xca: s.x = setzn(s.x - 1); break;                      // DEX
    case 0xe8: s.x = setzn(s.x + 1); break;                      // INX
    case 0x88: s.y = setzn(s.y - 1); break;                      // DEY
    case 0xc8: s.y = setzn(s.y + 1); break;                      // INY
    // Branches / flow
    case 0x90: branch(s.c === 0); break;                         // BCC
    case 0xb0: branch(s.c === 1); break;                         // BCS
    case 0xd0: branch(s.z === 0); break;                         // BNE
    case 0xf0: branch(s.z === 1); break;                         // BEQ
    case 0x10: branch(s.n === 0); break;                         // BPL
    case 0x30: branch(s.n === 1); break;                         // BMI
    case 0x4c: s.pc = abs(); break;                              // JMP abs
    case 0x20: { const t = abs(); const r = s.pc - 1; push(r >> 8); push(r & 0xff); s.pc = t; break; } // JSR
    case 0x60: { const lo = pop(); const hi = pop(); s.pc = ((lo | (hi << 8)) + 1) & 0xffff; break; }  // RTS
    case 0xea: break;                                            // NOP
    default:
      throw new Error(
        `mos6502 test interpreter: unimplemented opcode $${op.toString(16)} at $${(s.pc - 1).toString(16)}`,
      );
  }
}

/**
 * Run one routine binary to completion (its final `RTS`) and return the state.
 *
 * The binary is loaded at {@link ROUTINE_ORG}; a sentinel return address is
 * pushed so the routine's `RTS` lands on $FFFF, which terminates the run.
 *
 * @param bin The assembled routine bytes (ACME `-f plain` output).
 * @param input Entry registers + zero-page argument bytes.
 * @returns The machine state at return (registers, flags, memory).
 * @throws {Error} On an unimplemented opcode or a runaway (> 200k steps).
 */
export function runRoutine(bin: Uint8Array, input: RoutineInput): CpuState {
  const mem = new Uint8Array(0x10000);
  mem.set(bin, ROUTINE_ORG);
  const s: CpuState = {
    mem,
    a: input.a ?? 0,
    x: input.x ?? 0,
    y: input.y ?? 0,
    sp: 0xfd,
    pc: ROUTINE_ORG,
    c: 0,
    z: 0,
    n: 0,
    v: 0,
  };
  for (const [addr, value] of Object.entries(input.zp ?? {})) {
    mem[Number(addr)] = value & 0xff;
  }
  // Sentinel return address $FFFE — the routine's RTS adds 1 → $FFFF.
  mem[0x100 + s.sp] = 0xff;
  s.sp = (s.sp - 1) & 0xff;
  mem[0x100 + s.sp] = 0xfe;
  s.sp = (s.sp - 1) & 0xff;

  let steps = 0;
  while (s.pc !== 0xffff) {
    step(s);
    if (++steps > MAX_STEPS) {
      throw new Error("mos6502 test interpreter: runaway routine (no RTS reached)");
    }
  }
  return s;
}
