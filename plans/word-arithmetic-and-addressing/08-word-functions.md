# Word Function Parameters & Returns

> **Document**: 08-word-functions.md
> **Parent**: [Index](00-index.md)

## Overview

Enable functions to accept and return word (16-bit) values using the A:X convention.

## Word Parameters

When a function parameter is word-typed, pass via A:X pair:
- First word param: A (low) + X (high)
- Additional word params: pushed to stack as 2 bytes

### Codegen for Word Argument Passing

```asm
; Call func(wordArg) where wordArg is word variable
LDA wordArg        ; low byte
LDX wordArg+1      ; high byte
JSR func
```

### Codegen for Word Parameter Receiving

Inside the function, word parameters are stored to their frame slot:
```asm
; Function prologue stores A:X to param slot
STA param_addr     ; low byte
STX param_addr+1   ; high byte
```

## Word Return Values

Functions returning word use A:X convention:
```asm
; return $0400 + offset
LDA offset_low
LDX offset_high
RTS
```

Callers store the A:X result into a word slot:
```asm
JSR getAddress
STA result_addr
STX result_addr+1
```

## Files to Modify

| File | Changes |
|------|---------|
| `il/generator/expressions.ts` | Word argument generation in `generateCall()` |
| `il/generator/generator.ts` | Word parameter frame slot handling |
| `codegen/generator/functions.ts` | Word arg passing + return codegen |
| `frame/` | Ensure word params get 2-byte slots |
