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

  /**
   * Load the 16-bit address of a variable into A:X.
   *
   * Used by the address-of operator (`@variable`).
   * The result is a word (16-bit) with low byte in A, high byte in X.
   *
   * For @data/@sprite globals with ACME labels:
   *   6502: LDA #<label / LDX #>label
   *   (ACME resolves the label address at assembly time)
   *
   * For RAM/ZP globals with known numeric addresses:
   *   6502: LDA #lo(addr) / LDX #hi(addr)
   *
   * Operands: [SlotOperand]
   * Effect: A ← lo(slot.address), X ← hi(slot.address)
   */
  LOAD_ADDRESS = 'LOAD_ADDRESS',

  /**
   * Load an assembly-time expression derived from a variable's address.
   *
   * Used when the address-of operator is combined with division or
   * right-shift by a compile-time constant: `@variable / N` or `@variable >> N`.
   *
   * For variables with ACME data labels, the assembler computes the
   * expression at assembly time (zero runtime cost):
   *   6502: LDA #(label / N)   or   LDA #(label >> N)
   *
   * For variables with known numeric addresses, the compiler constant-folds:
   *   6502: LDA #(address / N)  →  LDA #result
   *
   * Result: byte in A register (NOT word A:X like LOAD_ADDRESS).
   *
   * Operands: [SlotOperand, ImmediateOperand]
   *   - SlotOperand: the variable whose address to use
   *   - ImmediateOperand: the constant divisor/shift amount
   *     The `isWord` field distinguishes the operator:
   *     - isWord=false: division (label / N)
   *     - isWord=true: right-shift (label >> N)
   */
  LOAD_ADDRESS_EXPR = 'LOAD_ADDRESS_EXPR',

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
   * Multiply by immediate (software implementation).
   * Operands: [ImmediateOperand]
   * Effect: A ← A * imm
   * 6502: JSR __mul8_imm
   */
  MUL_IMM = 'MUL_IMM',

  /**
   * Divide (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A / [slot.address]
   * 6502: JSR __div8
   */
  DIV_BYTE = 'DIV_BYTE',

  /**
   * Divide by immediate (software implementation).
   * Operands: [ImmediateOperand]
   * Effect: A ← A / imm
   * 6502: STA $FE / LDA #imm / STA $FF / LDA $FE / JSR __div8
   */
  DIV_IMM = 'DIV_IMM',

  /**
   * Modulo (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A % [slot.address]
   * 6502: JSR __mod8
   */
  MOD_BYTE = 'MOD_BYTE',

  /**
   * Modulo by immediate (software implementation).
   * Operands: [ImmediateOperand]
   * Effect: A ← A % imm
   * 6502: STA $FE / LDA #imm / STA $FF / LDA $FE / JSR __mod8
   */
  MOD_IMM = 'MOD_IMM',

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
  // WORD (16-BIT) ARITHMETIC OPERATIONS
  // All word operations use the A:X convention (low byte in A, high byte in X)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Add immediate word to A:X (full 16-bit add).
   * Operands: [ImmediateOperand] (isWord: true)
   * Effect: A:X ← A:X + imm16
   * 6502: CLC / ADC #lo / PHA / TXA / ADC #hi / TAX / PLA
   */
  ADD_WORD_IMM = 'ADD_WORD_IMM',

  /**
   * Add immediate byte to A:X with carry propagation.
   * Operands: [ImmediateOperand]
   * Effect: A:X ← A:X + imm8 (zero-extended)
   * 6502: CLC / ADC #byte / BCC +2 / INX
   */
  ADD_WORD_BYTE_IMM = 'ADD_WORD_BYTE_IMM',

  /**
   * Add word slot to A:X (full 16-bit add).
   * Operands: [SlotOperand]
   * Effect: A:X ← A:X + [slot16]
   * 6502: CLC / ADC slot / PHA / TXA / ADC slot+1 / TAX / PLA
   */
  ADD_WORD_SLOT = 'ADD_WORD_SLOT',

  /**
   * Add byte slot to A:X with carry propagation (zero-extended).
   * Operands: [SlotOperand]
   * Effect: A:X ← A:X + [slot8]
   * 6502: CLC / ADC slot / BCC +2 / INX
   */
  ADD_WORD_BYTE_SLOT = 'ADD_WORD_BYTE_SLOT',

  /**
   * Subtract immediate word from A:X (full 16-bit subtract).
   * Operands: [ImmediateOperand] (isWord: true)
   * Effect: A:X ← A:X - imm16
   * 6502: SEC / SBC #lo / PHA / TXA / SBC #hi / TAX / PLA
   */
  SUB_WORD_IMM = 'SUB_WORD_IMM',

  /**
   * Subtract immediate byte from A:X with borrow propagation.
   * Operands: [ImmediateOperand]
   * Effect: A:X ← A:X - imm8 (zero-extended)
   * 6502: SEC / SBC #byte / BCS +2 / DEX
   */
  SUB_WORD_BYTE_IMM = 'SUB_WORD_BYTE_IMM',

  /**
   * Subtract word slot from A:X (full 16-bit subtract).
   * Operands: [SlotOperand]
   * Effect: A:X ← A:X - [slot16]
   * 6502: SEC / SBC slot / PHA / TXA / SBC slot+1 / TAX / PLA
   */
  SUB_WORD_SLOT = 'SUB_WORD_SLOT',

  /**
   * Subtract byte slot from A:X with borrow propagation (zero-extended).
   * Operands: [SlotOperand]
   * Effect: A:X ← A:X - [slot8]
   * 6502: SEC / SBC slot / BCS +2 / DEX
   */
  SUB_WORD_BYTE_SLOT = 'SUB_WORD_BYTE_SLOT',

  /**
   * Promote byte in A to word in A:X (zero-extend).
   * Operands: none
   * Effect: X ← 0 (high byte = 0, unsigned extension)
   * 6502: LDX #0
   */
  PROMOTE_BYTE_WORD = 'PROMOTE_BYTE_WORD',

  /**
   * Increment word slot in place (16-bit).
   * Operands: [SlotOperand]
   * Effect: [slot16] ← [slot16] + 1
   * 6502: INC slot / BNE +2 / INC slot+1
   */
  INC_WORD = 'INC_WORD',

  /**
   * Decrement word slot in place (16-bit).
   * Operands: [SlotOperand]
   * Effect: [slot16] ← [slot16] - 1
   * 6502: LDA slot / BNE +2 / DEC slot+1 / DEC slot
   */
  DEC_WORD = 'DEC_WORD',

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

  /**
   * Logical shift right for word (16-bit) in A:X.
   *
   * Shifts the A:X register pair right by count positions.
   * Used for word division by power-of-2 constants (e.g., spriteAddr / 64).
   *
   * Operands: [ImmediateOperand] (count)
   * Effect: A:X ← A:X >> count (logical/unsigned shift)
   * 6502 per shift: PHA / TXA / LSR / TAX / PLA / ROR
   *   - LSR on high byte (X→A): shifts right, bit 0 → carry
   *   - ROR on low byte (A): shifts right, carry → bit 7
   */
  SHR_WORD = 'SHR_WORD',

  /**
   * Shift word right by N, take low byte only (fused SHR_WORD + LO).
   *
   * Produced by the IL peephole pass when it detects SHR_WORD N + LO
   * with N in range 3-7. Uses the shift-left technique:
   *   lo(word >> N) = hi(word << (8-N))
   *
   * This avoids the expensive full 16-bit shift-right loop (6N bytes)
   * and instead uses (8-N) ASL/ROL rounds through a temp byte.
   *
   * Operands: [ImmediateOperand] (shift count N, range 3-7)
   * Effect: A ← lo(A:X >> N) — result is a byte in A
   * 6502: STA tmp / TXA / [ASL tmp / ROL A] × (8-N)
   */
  SHR_WORD_LO = 'SHR_WORD_LO',

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

  /**
   * Compare A:X with immediate word (16-bit comparison).
   * Operands: [ImmediateOperand] (isWord: true)
   * Effect: flags ← A:X cmp imm16
   * 6502: CPX #>word / BNE .done / CMP #<word / .done:
   */
  CMP_WORD_IMM = 'CMP_WORD_IMM',

  /**
   * Compare A:X with word slot (16-bit comparison).
   * Operands: [SlotOperand]
   * Effect: flags ← A:X cmp [slot16]
   * 6502: CPX slot+1 / BNE .done / CMP slot / .done:
   */
  CMP_WORD_SLOT = 'CMP_WORD_SLOT',

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
   * Store A:X word to zero-page pointer ($FB/$FC).
   *
   * Used for indirect addressing: computes a 16-bit address in A:X,
   * then stores it to the ZP pointer location for subsequent
   * POKE_INDIRECT / PEEK_INDIRECT operations.
   *
   * Operands: none (operates on A:X)
   * Effect: $FB ← A (low byte), $FC ← X (high byte)
   * Cost: 6 cycles (STA zp + STX zp = 3+3)
   */
  STORE_ZP_PTR = 'STORE_ZP_PTR',

  /**
   * Indirect poke: store A through ZP pointer ($FB/$FC).
   *
   * Writes the accumulator value through the zero-page pointer
   * using 6502 indirect indexed addressing: STA ($FB),Y with Y=0.
   *
   * Operands: none (value in A, pointer in $FB/$FC)
   * Effect: ($FB),Y ← A where Y=0
   * Cost: 8 cycles (LDY #0 + STA ($FB),Y = 2+6)
   */
  POKE_INDIRECT = 'POKE_INDIRECT',

  /**
   * Indirect peek: load A through ZP pointer ($FB/$FC).
   *
   * Reads a byte through the zero-page pointer using 6502
   * indirect indexed addressing: LDA ($FB),Y with Y=0.
   *
   * Operands: none (pointer in $FB/$FC)
   * Effect: A ← ($FB),Y where Y=0
   * Cost: 7 cycles (LDY #0 + LDA ($FB),Y = 2+5)
   */
  PEEK_INDIRECT = 'PEEK_INDIRECT',

  /**
   * Indirect pokew: store A:X (word) through ZP pointer ($FB/$FC).
   *
   * Writes a 16-bit value through the zero-page pointer:
   * - Low byte (A) via STA ($FB),Y with Y=0
   * - High byte (X) via STX→A, STA ($FB),Y with Y=1
   *
   * Operands: none (value in A:X, pointer in $FB/$FC)
   * Effect: ($FB),0 ← A, ($FB),1 ← X
   * Cost: 14 cycles (LDY #0 + STA ($FB),Y + TXA + LDY #1 + STA ($FB),Y)
   */
  POKEW_INDIRECT = 'POKEW_INDIRECT',

  /**
   * Indirect peekw: load A:X (word) through ZP pointer ($FB/$FC).
   *
   * Reads a 16-bit value through the zero-page pointer:
   * - High byte first: LDY #1, LDA ($FB),Y → TAX
   * - Low byte second: LDY #0, LDA ($FB),Y
   * Result: low in A, high in X.
   *
   * Operands: none (pointer in $FB/$FC)
   * Effect: A ← ($FB),0, X ← ($FB),1
   * Cost: 14 cycles (LDY #1 + LDA ($FB),Y + TAX + LDY #0 + LDA ($FB),Y)
   */
  PEEKW_INDIRECT = 'PEEKW_INDIRECT',

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
   * Optimization barrier.
   *
   * Prevents the optimizer from reordering, merging, or eliminating
   * instructions across this point. Emits no code at runtime.
   * Used by the `barrier()` intrinsic to enforce instruction ordering
   * for volatile hardware register accesses.
   */
  BARRIER = 'BARRIER',

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

  // ══════════════════════════════════════════════════════════════════
  // RAW 6502 ASSEMBLY (asm_* functions)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Canonical delay loop using 6502 register-based countdown.
   *
   * Produced by the IL peephole optimizer when it detects a loop whose
   * body contains only BARRIER instructions (no side effects beyond timing).
   * Replaces the entire generic loop structure with a compact countdown.
   *
   * Operands: [ImmediateOperand] (iteration count, 1-255)
   * Effect: Delays for N iterations using DEX/BNE loop
   * 6502: LDX #N / .loop: DEX / BNE .loop
   * Cost: 5 bytes, N×5 cycles (DEX=2 + BNE=3 per iteration)
   */
  DELAY_LOOP = 'DELAY_LOOP',

  /**
   * Raw 6502 assembly instruction.
   * Operands: [AsmRawOperand] + optional [ImmediateOperand | AddressOperand]
   * Maps to exactly one 6502 instruction.
   * Used by asm_*() function calls (e.g., asm_lda_imm, asm_sei).
   */
  ASM_RAW = 'ASM_RAW',

  // ══════════════════════════════════════════════════════════════════
  // BLOCK MEMORY OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Block memory copy: memcpy(dest, src, count).
   *
   * Copies `count` bytes from source address to destination address
   * using an optimized page-based 6502 copy loop with ZP indirect
   * addressing ($FB/$FC for source, $FD/$FE for destination).
   *
   * The count must be a compile-time constant (known at IL generation time).
   * The dest and src addresses are evaluated at runtime via IL instructions
   * that precede the MEMCPY opcode.
   *
   * For large copies (256+ bytes): nested page/byte loop (~27 bytes code).
   * For small copies (< 256 bytes): single Y-indexed loop (~17 bytes code).
   *
   * Operands: [ImmediateOperand(count)]
   *   - count: number of bytes to copy (compile-time constant, 1-65535)
   *
   * Precondition: Source address stored in $FB/$FC, dest address in $FD/$FE
   *   (set up by preceding STORE_ZP_PTR-like instructions).
   *
   * Effect: Copies count bytes from ($FB/$FC) to ($FD/$FE).
   * Clobbers: A, X, Y registers and ZP pointers $FB-$FE.
   */
  MEMCPY = 'MEMCPY',
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