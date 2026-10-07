import { cia2Source } from "./cia2-fixture.js";

/** A source-owned one-shot timer stimulus and its independent captured-bit expectation. */
export interface Cia2TimerScenario {
  /** Human-readable source event being qualified. */
  readonly name: string;
  /** Timer-source mask selected by the source program. */
  readonly mask: number;
  /** Complete interrupt data expected after the real enabled underflow. */
  readonly pending: number;
  /** Whether both stopped timers first accumulate pending data with masks clear. */
  readonly accumulate: boolean;
}

/** Each source event has a distinct ordinary-bit-branch result, including the combined event. */
export const CIA2_TIMER_SCENARIOS: readonly Cia2TimerScenario[] = [
  { name: "timer A underflow", mask: 1, pending: 0x81, accumulate: false },
  { name: "timer B underflow", mask: 2, pending: 0x82, accumulate: false },
  { name: "simultaneous latched timer underflows", mask: 3, pending: 0x83, accumulate: true },
];

/** Program timers and masks in source; the monitor never manufactures pending data. */
export function cia2TimerSource(scenario: Cia2TimerScenario): string {
  const start = [
    ...(scenario.mask & 1 ? ["configureTimerA($19);"] : []),
    ...(scenario.mask & 2 ? ["configureTimerB($19);"] : []),
  ].join("\n");
  const enable = `enableInterruptSources(${scenario.mask});`;
  const stimulus = scenario.accumulate
    ? `${start}
let delay: word = 0;
while (delay < $0400) { asm_nop(); delay = delay + 1; }
${enable}`
    : `${enable}\n${start}`;
  return cia2Source(
    `poke($0410, 0); poke($0411, 0); poke($0412, 0); poke($0413, 0); poke($0414, 0);
asm_sei();
setNMIExclusive(&handler);
disableInterruptSources($1F);
readAndClearPendingSources();
configureTimerA($08); configureTimerB($08);
writeTimerALatch($00FF); writeTimerBLatch($00FF);
${stimulus}
while (peek($0410) == 0) { asm_nop(); }
let pending: byte = peek($0410);
if ((pending & 1) != 0) { poke($0411, $11); }
if ((pending & 2) != 0) { poke($0412, $22); }
poke($0413, 1);
restoreNMI();
poke($0414, 1);`,
    "poke($0410, readAndClearPendingSources());",
  );
}
