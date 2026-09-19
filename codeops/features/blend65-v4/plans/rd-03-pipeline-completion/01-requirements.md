# Requirements: RD-03 Pipeline Completion

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-playable-m1-complete-pipeline.md) — the OWNING requirements document

## Scope of This Plan (Delta View)

### In This Plan

- R3.1–R3.4: one public M1 journey, truthful `check`/`build`/`run`, and diagnostics-only editor slice.
- Remaining R3.8/R3.10 profile/asset completion after the finished frontend-first plan.
- R3.11–R3.16: semantic/machine representations, explicit CFG, whole-program closure and SFA.
- R3.17–R3.24: selected C64/6510 profile, named operations, raw memory, raw asset, final placement,
  startup and BASIC return.
- R3.25–R3.29: terminal ACME, verified PRG/evidence publication, exact run generation and real
  joystick-port-2 VICE input.
- R3.30–R3.37: transition proofs, independent behavior/expert baselines, final qualification,
  source readability and observational host measurements.

The completed [frontend-first plan](../rd-03-frontend-first/00-index.md) remains the owner of
R3.5–R3.10's target-independent implementation and its portion of R3.11. This plan consumes it and
does not repeat or reopen its oracle (AR-C1, AR-C3).

### Deferred / Out of This Plan

- SpritePad and every native-format asset handler remain in RD-06 (AR-C1).
- Complete Specification 4 coverage remains in RD-04; broader C64 systems in RD-05–RD-07;
  optional optimization in RD-08; production tooling in RD-09; production/host qualification in
  RD-10.
- Native Windows execution of publication, pin/cleanup, tool/process and editor smoke is the named
  RD-10 deferral. Portable implementation, pure platform cases and Linux qualification remain here
  (AR-C16).
- No game engine/runtime, IRQ application handler, loader, D64, audio, multiplexer, debugger,
  production editor commands or another target.

## Plan-Local Decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Package boundaries | Backend stages remain internal compiler modules; editor products are workspaces | AR-C2 |
| Representation count | Semantic CFG and structured machine CFG only | AR-C3 |
| Asset mechanism | Direct raw literal embed resolver and one fixed fixture | AR-C6 |
| Public APIs | Direct check/build/run root services; frontend-only subpath for editor | AR-C9 |
| Editor implementation | Standard LSP client/server libraries and Vite bundle only | AR-C10 |
| Automated input | VICE binary monitor + I/O simulation + emitted frame checkpoint | AR-C11 |

## Plan-Local Acceptance Criteria

1. The existing frontend accepts the M1 project only after its exact profile and raw-asset
   obligations are resolved; poison or errors never reach backend stages.
2. Every live pipeline transition has an immutable specification test before implementation and a
   separate implementation tier after green.
3. All function-execution storage appears in the SFA closure certificate; final layout/emission
   cannot allocate another byte.
4. The one selected profile emits documented NMOS instructions only and places one 512-byte sprite
   payload at its final VIC-visible address without runtime copying.
5. ACME 0.97 output, report, symbols, bytes, PRG header and all eight published artifacts agree on
   one immutable generation.
6. `blendc check`, `build` and `run` never claim or consume stale success; failures map to the
   required stable categories.
7. The language server and VS Code extension publish the existing compiler diagnostics without a
   backend dependency or extra feature surface.
8. One fixed PAL input trace reaches win and returns to BASIC through real emulated joystick port
   2. A pure oracle separately reaches loss.
9. The expert twin comparison records complete bytes/cycles/resources as the RD-08 baseline. Worse
   output fails; a meet-only result requires the project-mandated issue and concrete path to beat.
   No optional optimizer is introduced.
10. Linux closeout passes AR-C15. Native Windows evidence is handed to RD-10 exactly as AR-C16
    specifies; no Linux simulation is reported as Windows proof.
