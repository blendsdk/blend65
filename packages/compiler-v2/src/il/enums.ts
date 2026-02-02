/**
 * IL Opcode Enumeration
 *
 * Core opcodes for the Intermediate Language used by Blend65 compiler.
 * ~50 opcodes designed for accumulator-centric 6502 code generation.
 * Each opcode maps cleanly to 1-3 6502 instructions.
 *
 * @module il/enums
 */

/**
 * IL Opcode enumeration.
 *
 * Categorized into:
 * - Memory operations (load/store)
 * - Arithmetic operations (add/sub/mul/div)
 * - Bitwise operations (and/or/xor/shifts)
 * - Comparison operations (cmp)
 * - Control flow (jump/label)
 * - Function operations (call/return)
 * - Register transfers (TAX/TAY/TXA/TYA)
 * - Intrinsics (peek/poke/hi/lo)
 * - Special (nop/push/pop)
 */
export enum ILOpcode {
  // ══════════════════════════════════════════════════════════════════
  // MEMORY OPERATIONS - Load/Store
  // ══════════════════════════════════════════════════════════════════

  /**
   * Load byte from slot into accumulator.
   * Operands: [SlotOperand]
   * Effect: A ← [slot.address]
   * 6502: LDA addr (ZP or Absolute based on slot.location)
   */
  LOAD_BYTE = 'LOAD_BYTE',

  /**
   * Store accumulator to slot.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← A
   * 6502: STA addr (ZP or Absolute based on slot.location)
   */
  STORE_BYTE = 'STORE_BYTE',

  /**
   * Load word from slot (16-bit).
   * Operands: [SlotOperand]
   * Effect: A ← [slot.address], X ← [slot.address+1]
   * 6502: LDA addr / LDX addr+1
   */
  LOAD_WORD = 'LOAD_WORD',

  /**
   * Store word to slot (16-bit).
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← A, [slot.address+1] ← X
   * 6502: STA addr / STX addr+1
   */
  STORE_WORD = 'STORE_WORD',

  /**
   * Load immediate byte into accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← imm
   * 6502: LDA #imm
   */
  LOAD_IMM = 'LOAD_IMM',

  /**
   * Load immediate word (16-bit).
   * Operands: [ImmediateOperand]
   * Effect: A ← lo(imm), X ← hi(imm)
   * 6502: LDA #lo / LDX #hi
   */
  LOAD_IMM_WORD = 'LOAD_IMM_WORD',

  // ══════════════════════════════════════════════════════════════════
  // ARITHMETIC OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Add byte from slot to accumulator.
   * Operands: [SlotOperand]
   * Effect: A ← A + [slot.address]
   * 6502: CLC / ADC addr
   */
  ADD_BYTE = 'ADD_BYTE',

  /**
   * Subtract byte from slot.
   * Operands: [SlotOperand]
   * Effect: A ← A - [slot.address]
   * 6502: SEC / SBC addr
   */
  SUB_BYTE = 'SUB_BYTE',

  /**
   * Add immediate to accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← A + imm
   * 6502: CLC / ADC #imm
   */
  ADD_IMM = 'ADD_IMM',

  /**
   * Subtract immediate from accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← A - imm
   * 6502: SEC / SBC #imm
   */
  SUB_IMM = 'SUB_IMM',

  /**
   * Multiply (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A * [slot.address]
   * 6502: JSR __mul8
   */
  MUL_BYTE = 'MUL_BYTE',

  /**
   * Divide (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A / [slot.address]
   * 6502: JSR __div8
   */
  DIV_BYTE = 'DIV_BYTE',

  /**
   * Modulo (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A % [slot.address]
   * 6502: JSR __mod8
   */
  MOD_BYTE = 'MOD_BYTE',

  /**
   * Increment slot value.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← [slot.address] + 1
   * 6502: INC addr
   */
  INC_BYTE = 'INC_BYTE',

  /**
   * Decrement slot value.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← [slot.address] - 1
   * 6502: DEC addr
   */
  DEC_BYTE = 'DEC_BYTE',

  // ══════════════════════════════════════════════════════════════════
  // BITWISE OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Bitwise AND with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A & [slot.address]
   * 6502: AND addr
   */
  AND_BYTE = 'AND_BYTE',

  /**
   * Bitwise OR with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A | [slot.address]
   * 6502: ORA addr
   */
  OR_BYTE = 'OR_BYTE',

  /**
   * Bitwise XOR with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A ^ [slot.address]
   * 6502: EOR addr
   */
  XOR_BYTE = 'XOR_BYTE',

  /**
   * Bitwise AND with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A & imm
   * 6502: AND #imm
   */
  AND_IMM = 'AND_IMM',

  /**
   * Bitwise OR with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A | imm
   * 6502: ORA #imm
   */
  OR_IMM = 'OR_IMM',

  /**
   * Bitwise XOR with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A ^ imm
   * 6502: EOR #imm
   */
  XOR_IMM = 'XOR_IMM',

  /**
   * Bitwise NOT (complement).
   * Operands: none
   * Effect: A ← ~A
   * 6502: EOR #$FF
   */
  NOT_BYTE = 'NOT_BYTE',

  /**
   * Arithmetic shift left.
   * Operands: [ImmediateOperand] (count)
   * Effect: A ← A << count
   * 6502: ASL (repeated)
   */
  SHL_BYTE = 'SHL_BYTE',

  /**
   * Logical shift right.
   * Operands: [ImmediateOperand] (count)
   * Effect: A ← A >> count
   * 6502: LSR (repeated)
   */
  SHR_BYTE = 'SHR_BYTE',

  // ══════════════════════════════════════════════════════════════════
  // COMPARISON OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Compare accumulator with slot.
   * Operands: [SlotOperand]
   * Effect: flags ← A cmp [slot.address]
   * 6502: CMP addr
   */
  CMP_BYTE = 'CMP_BYTE',

  /**
   * Compare accumulator with immediate.
   * Operands: [ImmediateOperand]
   * Effect: flags ← A cmp imm
   * 6502: CMP #imm
   */
  CMP_IMM = 'CMP_IMM',

  // ══════════════════════════════════════════════════════════════════
  // CONTROL FLOW
  // ══════════════════════════════════════════════════════════════════

  /**
   * Label definition (pseudo-instruction).
   * Operands: [LabelOperand]
   * Not a real instruction - marks a jump target.
   */
  LABEL = 'LABEL',

  /**
   * Unconditional jump.
   * Operands: [LabelOperand]
   * 6502: JMP label
   */
  JUMP = 'JUMP',

  /**
   * Jump if equal (zero flag set).
   * Operands: [LabelOperand]
   * 6502: BEQ label
   */
  JUMP_EQ = 'JUMP_EQ',

  /**
   * Jump if not equal (zero flag clear).
   * Operands: [LabelOperand]
   * 6502: BNE label
   */
  JUMP_NE = 'JUMP_NE',

  /**
   * Jump if less than (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCC label
   */
  JUMP_LT = 'JUMP_LT',

  /**
   * Jump if less than or equal (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCC label / BEQ label
   */
  JUMP_LE = 'JUMP_LE',

  /**
   * Jump if greater than or equal (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCS label
   */
  JUMP_GE = 'JUMP_GE',

  /**
   * Jump if greater than (unsigned).
   * Operands: [LabelOperand]
   * 6502: BEQ skip / BCS label / skip:
   */
  JUMP_GT = 'JUMP_GT',

  // ══════════════════════════════════════════════════════════════════
  // FUNCTION OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Call function.
   * Operands: [FunctionOperand]
   * 6502: JSR funcname
   */
  CALL = 'CALL',

  /**
   * Return from function.
   * Operands: none
   * 6502: RTS
   */
  RETURN = 'RETURN',

  // ══════════════════════════════════════════════════════════════════
  // REGISTER OPERATIONS (for register-passed parameters)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Transfer A to X.
   * Operands: none
   * 6502: TAX
   */
  TRANSFER_AX = 'TRANSFER_AX',

  /**
   * Transfer A to Y.
   * Operands: none
   * 6502: TAY
   */
  TRANSFER_AY = 'TRANSFER_AY',

  /**
   * Transfer X to A.
   * Operands: none
   * 6502: TXA
   */
  TRANSFER_XA = 'TRANSFER_XA',

  /**
   * Transfer Y to A.
   * Operands: none
   * 6502: TYA
   */
  TRANSFER_YA = 'TRANSFER_YA',

  // ══════════════════════════════════════════════════════════════════
  // INTRINSICS
  // ══════════════════════════════════════════════════════════════════

  /**
   * peek(addr) - Read byte from address.
   * Operands: [AddressOperand]
   * Effect: A ← [addr]
   * 6502: LDA addr (or indirect if dynamic)
   */
  PEEK = 'PEEK',

  /**
   * poke(addr, val) - Write byte to address.
   * Operands: [AddressOperand, ImmediateOrSlotOperand]
   * Effect: [addr] ← val
   * 6502: STA addr
   */
  POKE = 'POKE',

  /**
   * peekw(addr) - Read word from address.
   * Operands: [AddressOperand]
   * Effect: AX ← [addr]
   */
  PEEKW = 'PEEKW',

  /**
   * pokew(addr, val) - Write word to address.
   * Operands: [AddressOperand, ImmediateOrSlotOperand]
   * Effect: [addr] ← val
   */
  POKEW = 'POKEW',

  /**
   * hi(word) - Get high byte.
   * Operands: none (operates on AX)
   * Effect: A ← X (high byte)
   */
  HI = 'HI',

  /**
   * lo(word) - Get low byte.
   * Operands: none (operates on AX)
   * Effect: A ← A (low byte, already there)
   */
  LO = 'LO',

  // ══════════════════════════════════════════════════════════════════
  // SPECIAL
  // ══════════════════════════════════════════════════════════════════

  /**
   * No operation (for alignment/debugging).
   * 6502: NOP
   */
  NOP = 'NOP',

  /**
   * Push accumulator to stack.
   * Used for complex expressions.
   * 6502: PHA
   */
  PUSH_A = 'PUSH_A',

  /**
   * Pop accumulator from stack.
   * 6502: PLA
   */
  POP_A = 'POP_A',
}

/**
 * Addressing mode hints for code generation.
 * Computed during IL generation based on slot analysis.
 *
 * These hints guide the code generator to use optimal
 * 6502 addressing modes based on slot location and access pattern.
 */
export enum AddressingModeHint {
  /** Zero page direct: LDA $nn */
  ZeroPage = 'ZeroPage',

  /** Zero page indexed X: LDA $nn,X */
  ZeroPageX = 'ZeroPageX',

  /** Zero page indexed Y: LDA $nn,Y */
  ZeroPageY = 'ZeroPageY',

  /** Absolute: LDA $nnnn */
  Absolute = 'Absolute',

  /** Absolute indexed X: LDA $nnnn,X */
  AbsoluteX = 'AbsoluteX',

  /** Absolute indexed Y: LDA $nnnn,Y */
  AbsoluteY = 'AbsoluteY',

  /** Indirect: JMP ($nnnn) */
  Indirect = 'Indirect',

  /** Indexed indirect: LDA ($nn,X) */
  IndirectX = 'IndirectX',

  /** Indirect indexed: LDA ($nn),Y */
  IndirectY = 'IndirectY',
}