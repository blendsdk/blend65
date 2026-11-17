# Low-byte extraction write forwarding — evidence

> **Status**: Planning/preflight only; no implementation or new qualification claim
> **Baseline**: `ee9bb67d`, clean at task entry
> **Progress authority**: [execution plan](99-execution-plan.md), 0/6

## Fresh baseline and independent selection

The primary copied only the unchanged example manifest, source and `ball.bin` into an owned
temporary project and used the public compiler/real ACME in canonical `none`.
Generation `3b3986bc-6600-4ff4-810a-745944bf5b99` reproduces committed PRG SHA-256
`a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58`.
Cost/memory records report code 1,241, entry 326, SFA 45, platform state 49, resident RAM 7,261,
ZP/scratch 0 and payload 7,167. Code 1,241 + assets 1,024 + padding 4,890 + BASIC 12 = 7,167.
The equivalent twin's 442-byte code pin remains unchanged; the gap is 799.

The primary separately traversed the real closed semantic source before machine lowering:
52 original blocks of `src/main.blend:1485:5978`. Complete operation and branch/return counts
show eight one-use `lo` results with immediately adjacent fixed byte writes. Their operand
definitions are ordinary scalar-word loads; the unchanged whole-program certificate succeeds
with nine publications. Exact result/block/index and home identities are in the plan.
No home-specific observer exemption or new proof was used.

Actual assembled bytes within the CPU main range `$0953..$0CE6` (exclusive end):

| Result | PC | Original 12-byte core |
| --- | --- | --- |
| `v36` | `$09D4` | `AD 39 24 8D 4C 24 AD 4C 24 8D 00 D0` |
| `v39` | `$09E0` | `AD 3B 24 8D 4D 24 AD 4D 24 8D 02 D0` |
| `v42` | `$09EC` | `AD 39 24 8D 4E 24 AD 4E 24 8D 04 D0` |
| `v45` | `$09F8` | `AD 3B 24 8D 4F 24 AD 4F 24 8D 06 D0` |
| `v206` | `$0B47` | `AD 39 24 8D 46 24 AD 46 24 8D 00 D0` |
| `v209` | `$0B53` | `AD 3B 24 8D 47 24 AD 47 24 8D 02 D0` |
| `v212` | `$0B5F` | `AD 39 24 8D 48 24 AD 48 24 8D 04 D0` |
| `v215` | `$0B6B` | `AD 3B 24 8D 49 24 AD 49 24 8D 06 D0` |

Every exact core occurs once in that code range. The two removable absolute instructions
occupy six bytes/eight nominal CPU cycles per site. Eight homes are distinct one-byte CPU16
`retained-value` intervals, not duplicate VIC projections. These are baseline observations;
the predicted 48-byte/eight-demand improvement has not been implemented or measured.

Independent Astra challenge `ses_e1500ca1effecsLrbURhK2K698` converged on low-byte-to-fixed-write
forwarding. It considered high-byte branches, named arithmetic destinations, immediate reuse
and reload-only elimination. It required the original semantic-use trace/certificate, supplied
by the primary above. Its code-grounded recommendation was medium-confidence because the native
charter prevented direct inspection of hidden expert/generated paths; it clearly labeled the
parent's baseline measurements. No denial was retried or bypassed. No reviewer agreement is
treated as runtime, byte or physical proof.

| Owned temporary baseline artifact | SHA-256 before eventual cleanup |
| --- | --- |
| `extraction-trace.json` | `e36117bf9902186f50c069220d9851bbe4f49c088c43b6c04da6e200b5c77f4a` |
| `baseline-byte-cores.json` | `af41d86dfd9fa8cb5cb48fe521d2471060df090e99bc089ed9662040192a3a02` |

Only a fresh public build and focused inspection have run in this unit. The predecessor's actual
complete GREEN is not rerun or claimed as new evidence. No emulator is launched by these probes.
Whole-frame timing, loading time and physical behavior remain Unknown here. No push, issue
closure, production change or existing-oracle edit.

Expert lineage: `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
load/store and instruction-effect references and source keys are bound in the plan.
