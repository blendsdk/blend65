; ============================================================================
; __rt_div16 — unsigned 16-bit divide (RD-17 §4.6, AR-98)
;
; Params  : a (dividend) -> A (lo) / X (hi),
;           b (divisor)  -> __zp_arg_0 (lo) / __zp_arg_1 (hi)   (AR-P7)
; Returns : quotient -> A (lo) / X (hi),
;           remainder -> __zp_arg_0 (lo) / __zp_arg_1 (hi)  (overwrites b —
;           safe: b is dead once the remainder exists, AR-P7)
; Clobbers: A, X, Y, status
; ZP      : __zp_arg_0..3 — arg passing/remainder (0/1) plus the shifting
;           dividend/quotient (2/3); the runtime arg-block is caller-volatile
;           (AR-34) and the validated profile floor guarantees 4 bytes (R35).
; Cost    : ~700-900 cycles (data-dependent)
; Note    : division by zero does not trap; the result is unspecified.
;
; Algorithm: canonical 16/16 restoring shift-subtract. The dividend shifts
; left out of __zp_arg_2/3 while quotient bits shift in from the bottom; the
; 16-bit running remainder lives in A (lo) / Y (hi). BCS after the remainder
; shift catches the 17th bit (divisor > $8000 cases). X is the bit counter.
; ============================================================================
__rt_div16:
	sta __zp_arg_2		; dividend lo (becomes quotient lo)
	stx __zp_arg_3		; dividend hi (becomes quotient hi)
	lda #$00
	tay			; remainder = 0 (A = lo, Y = hi)
	ldx #$10		; 16 bits
__rt_div16_loop:
	asl __zp_arg_2
	rol __zp_arg_3		; dividend top bit -> carry (quotient bit 0 = 0)
	rol			; remainder lo <<= 1 | bit
	pha			; (PHA/TYA/ROL/TAY/PLA: rotate the hi byte while
	tya			;  preserving A; none of these touch carry)
	rol			; remainder hi <<= 1 | carry; 17th bit -> carry
	tay
	pla
	bcs __rt_div16_sub	; 17-bit remainder always >= divisor
	cpy __zp_arg_1
	bcc __rt_div16_next	; rem hi < divisor hi -> no subtract
	bne __rt_div16_sub	; rem hi > divisor hi -> subtract
	cmp __zp_arg_0
	bcc __rt_div16_next	; equal hi: rem lo < divisor lo -> no subtract
__rt_div16_sub:
	sbc __zp_arg_0		; carry is set on every path -> exact subtract
	pha			; 16-bit subtract of the hi byte, same dance;
	tya			; SBC's borrow flows through untouched
	sbc __zp_arg_1
	tay
	pla
	inc __zp_arg_2		; set quotient bit 0
__rt_div16_next:
	dex
	bne __rt_div16_loop
	sta __zp_arg_0		; remainder lo (overwrites b — AR-P7)
	sty __zp_arg_1		; remainder hi
	lda __zp_arg_2		; quotient lo
	ldx __zp_arg_3		; quotient hi
	rts
