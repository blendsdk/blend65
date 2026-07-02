; ============================================================================
; fix_probe — TEST FIXTURE ONLY (RD-17 AR-P2): proves the T4 platform
; contribution mechanism (registry merge, import boundary, embedding).
; Never part of a production platform library.
;
; Params  : none
; Returns : nothing
; Clobbers: A, status
; ============================================================================
fix_probe:
	lda #$01
	rts
