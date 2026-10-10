# Ordinary saved-input source library

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P3, AR-P6, AR-P10 in [Decisions](00-ambiguity-register.md)

## Declarations

Extend only `packages/compiler/stdlib/c64/input.blend`. Preserve all six mask
constants. The nine new public names are exactly AR-P6's list; private helpers
are not exports or compiler intrinsics. All exported declarations/members/fields
and non-obvious private rules have durable source documentation.

```blend65
export enum InputState { OBSERVED_DOWN = 0, OBSERVED_UP = 1, UNCERTAIN = 2 }
export enum SnapshotQuality { COMPLETE = 0, INTERRUPTED = 1, UNAVAILABLE = 2 }
export enum JoystickPort { PORT_1 = 1, PORT_2 = 2 }
export enum JoystickControl { UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3, FIRE = 4 }
export struct InputSnapshot {
    rows: byte[8];
    joystick1: byte;
    joystick2: byte;
    quality: SnapshotQuality;
}
```

Packed field offsets are 0, 8, 9 and 10; `sizeof(InputSnapshot)` is 11. These are
ordinary enum/struct ABI facts, not the complete function/resource cost. Enum
representation follows frozen Chapter 09 EN-1/EN-10; unnamed byte values are legal.
Numeric assignments are the small plan-owned representation within AR-P3's
accepted member meanings, not a new public behavior or API.

`Key` has exactly the following 64 distinct values, encoded `column * 8 + row`.
The table is the source naming/coordinate owner; it follows the pinned matrix,
not host keyboard layout. There are no RESTORE/SHIFT_LOCK or direction aliases.
Cursor pairs name physical switches; SHIFT LOCK holds LEFT_SHIFT.

| PA column / base value | PB0     | PB1        | PB2               | PB3     | PB4         | PB5       | PB6      | PB7            |
| ---------------------- | ------- | ---------- | ----------------- | ------- | ----------- | --------- | -------- | -------------- |
| 0 / 0                  | DELETE  | RETURN     | CURSOR_LEFT_RIGHT | F7      | F1          | F3        | F5       | CURSOR_UP_DOWN |
| 1 / 8                  | DIGIT_3 | W          | A                 | DIGIT_4 | Z           | S         | E        | LEFT_SHIFT     |
| 2 / 16                 | DIGIT_5 | R          | D                 | DIGIT_6 | C           | F         | T        | X              |
| 3 / 24                 | DIGIT_7 | Y          | G                 | DIGIT_8 | B           | H         | U        | V              |
| 4 / 32                 | DIGIT_9 | I          | J                 | DIGIT_0 | M           | K         | O        | N              |
| 5 / 40                 | PLUS    | P          | L                 | MINUS   | PERIOD      | COLON     | AT       | COMMA          |
| 6 / 48                 | POUND   | ASTERISK   | SEMICOLON         | HOME    | RIGHT_SHIFT | EQUALS    | UP_ARROW | SLASH          |
| 7 / 56                 | DIGIT_1 | LEFT_ARROW | CONTROL           | DIGIT_2 | SPACE       | COMMODORE | Q        | RUN_STOP       |

Public function signatures are owned by
[AR-P3](00-ambiguity-register.md#ar-p3--accepted-saved-observation-api).
Both query functions take the same const borrowed snapshot, return InputState
in A and perform no fresh MMIO. They neither copy a whole snapshot nor modify
it. Const borrowing does not promise atomicity against another actual writer.

## Query implementation

Validate `quality == COMPLETE` and named enum arguments before any row indexing
or control shift. Invalid quality/key/port/control returns UNCERTAIN. Apply the
direct HIGH observation first; do not lose this release evidence merely because
remote rows are inconsistent. For other answers implement exactly the bounded
[full-matrix characterization](00-ambiguity-register.md#full-matrix-technical-closure-for-the-accepted-saved-data-policy).

Use ordinary byte complements, masks, bounded loops and small private functions:
one shared compatibility predicate, population count, and the public classifiers.
Count eligible PA/PB contacts separately. Read saved rows in place; do not create
an eight-row copy, graph, explanation set, cache or lookup table. A nested loop
can revisit rows for at most 28 unordered pairs; no general search is needed.
Early returns preserve the direct-release and whole-snapshot policy. Repeated
queries can repeat bounded work; no hidden acquisition or amortization mechanism.

Split source implementation tasks by declarations, compatibility, key classifier
and joystick classifier. Keep one installed module to preserve existing loading;
add no loader or private source-package resolver. If a source file grows beyond
the repository limit, select an existing legal module seam before splitting;
do not add a packaging mechanism solely for helper files.

## Cost and user guidance

Source is normal modern code. The compiler owns byte/carry selection, argument
address marshalling and A-result forwarding through
[03-01](03-01-output-corrections.md). Do not require source casts, copied query
objects or hand-unrolled callers to hide a codegen defect. Before activation,
derive an equivalent expert baseline for the complete public query paths and
charge shared helpers by declared whole-program/marginal attribution.

The existing platform-library guide gets a short example retaining one snapshot
and comparing `keyState(saved, Key.SPACE)` to `InputState.OBSERVED_DOWN`. Explain
COMPLETE versus electrical/contact certainty, unavailable raw placeholders and
application-owned retry policy. No gameplay helper or demo engine is added.
