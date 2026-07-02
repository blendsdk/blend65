; ============================================================================
; __rt_div8 — unsigned 8-bit divide (RD-17 §4.6, AR-98)
;
; Params  : a (dividend) -> A, b (divisor) -> X   (register-passed, AR-33)
; Returns : quotient -> A, remainder -> X
; Clobbers: A, X, status                           (Y preserved)
; ZP      : __zp_arg_0/__zp_arg_1 as scratch — the runtime arg-block is
;           caller-volatile by definition (AR-34) and the validated profile
;           floor guarantees 4 bytes (R35), so 2 scratch bytes always exist.
; Cost    : ~160-210 cycles (data-dependent)
; Note    : division by zero does not trap; the result is unspecified.
;
; Algorithm: canonical restoring shift-subtract. The dividend shifts left out
; of __zp_arg_1 while quotient bits shift in from the bottom, so one byte
; serves both roles; A holds the running remainder. BCS catches the 9th
; remainder bit (divisor > $80 cases) where CMP alone would miss.
; ============================================================================
__rt_div8:
	stx __zp_arg_0		; divisor
	sta __zp_arg_1		; dividend (becomes quotient)
	lda #$00		; remainder
	ldx #$08		; 8 bits
__rt_div8_loop:
	asl __zp_arg_1		; dividend top bit -> carry (quotient bit 0 = 0)
	rol			; remainder = remainder<<1 | bit; 9th bit -> carry
	bcs __rt_div8_sub	; 9-bit remainder always >= divisor
	cmp __zp_arg_0
	bcc __rt_div8_next	; remainder < divisor -> quotient bit stays 0
__rt_div8_sub:
	sbc __zp_arg_0		; carry is set on both paths -> exact subtract
	inc __zp_arg_1		; set quotient bit 0
__rt_div8_next:
	dex
	bne __rt_div8_loop
	tax			; remainder -> X
	lda __zp_arg_1		; quotient -> A
	rts
