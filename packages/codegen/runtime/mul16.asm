; ============================================================================
; __rt_mul16 — unsigned 16-bit multiply, low 16 bits of the product
;              (RD-17 §4.6, AR-98; result width per RD-17 §4.3)
;
; Params  : a -> A (lo) / X (hi), b -> __zp_arg_0 (lo) / __zp_arg_1 (hi)
;           (word second operand travels through the ZP arg-block — AR-P7)
; Returns : product lo -> A, hi -> X
; Clobbers: A, X, Y, status
; ZP      : __zp_arg_0..3 — arg passing (0/1) plus scratch (2/3); the runtime
;           arg-block is caller-volatile (AR-34) and the validated profile
;           floor guarantees 4 bytes (R35).
; Cost    : ~450-550 cycles (data-dependent)
;
; Algorithm: three 8x8 partial products (self-contained — §4.6 forbids
; cross-module calls, so the 8x8 core is an internal subroutine, AR-100):
;   (a*b) mod 2^16 = a_lo*b_lo + ((a_lo*b_hi + a_hi*b_lo) << 8)
; The high bytes of a_lo*b_hi and a_hi*b_lo contribute only >= 2^16 and are
; discarded.
; ============================================================================
__rt_mul16:
	tay			; Y = a_lo (persists across the core calls)
	; ---- P2 = a_hi * b_lo (low byte only) ----
	stx __zp_arg_2		; core multiplier = a_hi
	lda __zp_arg_0
	sta __zp_arg_3		; core multiplicand = b_lo
	jsr __rt_mul16_core	; __zp_arg_2 = P2 lo
	lda __zp_arg_2
	pha			; save P2 lo
	; ---- P1 = a_lo * b_hi (low byte only) ----
	sty __zp_arg_2		; core multiplier = a_lo
	lda __zp_arg_1
	sta __zp_arg_3		; core multiplicand = b_hi
	jsr __rt_mul16_core	; __zp_arg_2 = P1 lo
	pla			; P2 lo
	clc
	adc __zp_arg_2		; hi contribution = P1 lo + P2 lo (mod 256)
	pha			; save the hi contribution
	; ---- P0 = a_lo * b_lo (full 16 bits) ----
	sty __zp_arg_2		; core multiplier = a_lo
	lda __zp_arg_0
	sta __zp_arg_3		; core multiplicand = b_lo
	jsr __rt_mul16_core	; A = P0 hi, __zp_arg_2 = P0 lo
	sta __zp_arg_3		; reuse arg3: P0 hi (multiplicand is dead)
	pla			; hi contribution
	clc
	adc __zp_arg_3		; product hi = P0 hi + contribution
	tax			; hi -> X
	lda __zp_arg_2		; lo -> A
	rts

; ---- internal 8x8 core: __zp_arg_2 * __zp_arg_3 -> A (hi) / __zp_arg_2 (lo).
;      Destroys X; preserves Y. Same rotate-down scheme as __rt_mul8.
__rt_mul16_core:
	lda #$00		; product hi accumulator
	ldx #$08		; 8 bits
	lsr __zp_arg_2		; multiplier bit 0 -> carry
__rt_mul16_core_loop:
	bcc __rt_mul16_core_skip
	clc
	adc __zp_arg_3		; add multiplicand into the hi byte
__rt_mul16_core_skip:
	ror			; hi >>= 1, bit 16 in, bit -> carry
	ror __zp_arg_2		; product-lo bit in, next multiplier bit -> carry
	dex
	bne __rt_mul16_core_loop
	rts
