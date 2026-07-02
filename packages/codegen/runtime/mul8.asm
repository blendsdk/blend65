; ============================================================================
; __rt_mul8 — unsigned 8-bit multiply, 16-bit product (RD-17 §4.6, AR-98)
;
; Params  : a -> A, b -> X                       (register-passed, AR-33)
; Returns : product lo -> A, hi -> X
; Clobbers: A, X, status                          (Y preserved)
; ZP      : __zp_arg_0/__zp_arg_1 as scratch — the runtime arg-block is
;           caller-volatile by definition (AR-34) and the validated profile
;           floor guarantees 4 bytes (R35), so 2 scratch bytes always exist.
; Cost    : ~130-180 cycles (data-dependent)
;
; Algorithm: canonical LSB-first shift-and-add. The multiplier sits in
; __zp_arg_0 and is consumed bit-by-bit from the bottom while product-low bits
; rotate in from the top, so one byte serves both roles; A accumulates the
; product high byte.
; ============================================================================
__rt_mul8:
	sta __zp_arg_0		; multiplier (becomes product lo)
	stx __zp_arg_1		; multiplicand
	lda #$00		; product hi accumulator
	ldx #$08		; 8 bits
	lsr __zp_arg_0		; multiplier bit 0 -> carry
__rt_mul8_loop:
	bcc __rt_mul8_skip	; bit clear -> no add
	clc
	adc __zp_arg_1		; add multiplicand into the hi byte
__rt_mul8_skip:
	ror			; hi >>= 1, bit 16 (ADC carry) in, bit -> carry
	ror __zp_arg_0		; product-lo bit in, next multiplier bit -> carry
	dex
	bne __rt_mul8_loop
	tax			; hi -> X
	lda __zp_arg_0		; lo -> A
	rts
