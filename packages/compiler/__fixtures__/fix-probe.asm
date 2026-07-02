; ============================================================================
; fix_probe — TEST FIXTURE ONLY (RD-17 AR-P2): the compiler-local copy for the
; ST-32 pipeline test (packages own their test fixtures — D10 boundary rule).
;
; Params  : none
; Returns : nothing
; Clobbers: A, status
; ============================================================================
fix_probe:
	lda #$01
	rts
