import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ReportInstruction } from "@blend65/compiler";

import { canonicalizeSealedAcmeReportEvidenceV1 } from "./execution-acme-artifacts.js";
import {
  deriveViceObservationStoresV1,
  mergeVicePreparationCleanupV1,
  selectUniqueViceBuildSymbolV1,
  selectViceEntryInstructionWindowV1,
} from "./execution-vice-build.js";

const LABELS = new Map([
  ["scope.___execution_result_low", 0x2000],
  ["scope.___execution_result_high", 0x2001],
  ["scope.___execution_completion", 0x2002],
]);

function instruction(
  address: number,
  opcode: ReportInstruction["opcode"],
  mode: ReportInstruction["mode"],
  operand: number | null,
): ReportInstruction {
  return { line: 1, address, bytes: Uint8Array.of(0xea), opcode, mode, operand };
}

function validWindow(): ReportInstruction[] {
  return [
    instruction(0x0800, "JSR", "Absolute", 0x0900),
    instruction(0x0803, "STA", "Absolute", 0x2000),
    instruction(0x0806, "STX", "Absolute", 0x2001),
    instruction(0x0809, "LDA", "Immediate", 0xa5),
    instruction(0x080b, "STA", "Absolute", 0x2002),
    instruction(0x080e, "RTS", "Implied", null),
  ];
}

function derive(
  instructions: readonly ReportInstruction[],
  labels: ReadonlyMap<string, number> = LABELS,
  semanticAddresses: readonly number[] = [],
) {
  return deriveViceObservationStoresV1(
    instructions,
    ["scope.___execution_result_low", "scope.___execution_result_high"],
    "scope.___execution_completion",
    labels,
    semanticAddresses,
  );
}

describe("sealed VICE build evidence", () => {
  it("canonicalizes only the exact retained proc-descriptor report header", () => {
    const firstPath = "/proc/9/fd/7";
    const secondPath = "/proc/123456/fd/789";
    const first = canonicalizeSealedAcmeReportEvidenceV1(
      new TextEncoder().encode(`\n; ******** Source: ${firstPath}\n  1 LDA #$01\n`),
      firstPath,
    );
    const second = canonicalizeSealedAcmeReportEvidenceV1(
      new TextEncoder().encode(`\n; ******** Source: ${secondPath}\n  1 LDA #$01\n`),
      secondPath,
    );

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(createHash("sha256").update(first!).digest("hex")).toBe(
      createHash("sha256").update(second!).digest("hex"),
    );
  });

  it.each([
    ["invalid retained path", "; ******** Source: /proc/9/fd/7\n", "/proc/self/fd/7"],
    ["near-match", "; ******* Source: /proc/9/fd/7\n", "/proc/9/fd/7"],
    ["unexpected path", "; ******** Source: /tmp/main.asm\n", "/proc/9/fd/7"],
    ["cross-paired path", "; ******** Source: /proc/9/fd/8\n", "/proc/9/fd/7"],
    [
      "multiple headers",
      "; ******** Source: /proc/9/fd/7\n; ******** Source: /proc/9/fd/7\n",
      "/proc/9/fd/7",
    ],
  ])("rejects a %s report source header", (_name, report, retainedPath) => {
    expect(
      canonicalizeSealedAcmeReportEvidenceV1(new TextEncoder().encode(report), retainedPath),
    ).toBeUndefined();
  });

  it("rejects non-UTF-8 report evidence", () => {
    expect(
      canonicalizeSealedAcmeReportEvidenceV1(Uint8Array.of(0xff), "/proc/9/fd/7"),
    ).toBeUndefined();
  });

  it("preserves an operational issue before a bounded cleanup blocker", () => {
    const operation = {
      ok: false as const,
      issues: [
        {
          code: "assembler-failure" as const,
          path: "/acme",
          message: "Assembly failed.",
        },
      ] as const,
    };
    const cleanup = {
      ok: true as const,
      value: {
        ok: false as const,
        blocker: {
          code: "emulator-lease-recovery-blocked" as const,
          evidenceDigest: `sha256:${"c".repeat(64)}`,
        },
      },
    };

    expect(mergeVicePreparationCleanupV1(operation, cleanup)).toEqual({
      ok: false,
      issues: [
        operation.issues[0],
        {
          code: "emulator-lease-recovery-blocked",
          path: "/cleanup",
          message: `Cleanup blocker evidence: sha256:${"c".repeat(64)}`,
        },
      ],
    });
    expect(mergeVicePreparationCleanupV1({ ok: true, value: "prepared" }, cleanup)).toMatchObject({
      ok: false,
      issues: [{ code: "emulator-lease-recovery-blocked", path: "/cleanup" }],
    });
    const successfulCleanup = { ok: true as const, value: { ok: true as const } };
    expect(mergeVicePreparationCleanupV1(operation, successfulCleanup)).toBe(operation);
    expect(
      mergeVicePreparationCleanupV1(operation, {
        ok: true,
        value: { ok: false },
      }),
    ).toMatchObject({
      ok: false,
      issues: [operation.issues[0], { code: "emulator-lease-recovery-blocked", path: "/cleanup" }],
    });
    expect(
      mergeVicePreparationCleanupV1(operation, {
        ok: false,
        issues: [{ code: "execution.io", path: "/cleanup", message: "cleanup threw" }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [operation.issues[0], { code: "emulator-lease-recovery-blocked", path: "/cleanup" }],
    });
  });

  it("selects only unique labels and a complete entry-through-return window", () => {
    expect(selectUniqueViceBuildSymbolV1(LABELS, "___execution_result_low")).toBe(
      "scope.___execution_result_low",
    );
    expect(selectUniqueViceBuildSymbolV1(LABELS, "missing")).toBeUndefined();
    expect(
      selectUniqueViceBuildSymbolV1(
        new Map([...LABELS, ["other.___execution_result_low", 0x3000]]),
        "___execution_result_low",
      ),
    ).toBeUndefined();

    expect(selectViceEntryInstructionWindowV1(validWindow(), 0x0800)).toHaveLength(6);
    expect(selectViceEntryInstructionWindowV1(validWindow(), 0x0801)).toBeUndefined();
    expect(selectViceEntryInstructionWindowV1(validWindow().slice(0, -1), 0x0800)).toBeUndefined();
  });

  it("derives the exact visible stores and completion timing", () => {
    expect(derive(validWindow())).toEqual({
      stores: [
        {
          instructionAddress: 0x0803,
          targetAddress: 0x2000,
          kind: "observation-byte",
          byteIndex: 0,
        },
        {
          instructionAddress: 0x0806,
          targetAddress: 0x2001,
          kind: "observation-byte",
          byteIndex: 1,
        },
        {
          instructionAddress: 0x080b,
          targetAddress: 0x2002,
          kind: "completion",
          value: 0xa5,
        },
      ],
      completionValueLoadInstructionAddress: 0x0809,
      finalPostCallStoreInstructionAddress: 0x080b,
    });
  });

  it.each([
    ["missing label", validWindow(), new Map([...LABELS].slice(0, 2)), []],
    ["missing store", validWindow().filter(({ address }) => address !== 0x0803), LABELS, []],
    [
      "duplicate store",
      [
        ...validWindow().slice(0, 2),
        instruction(0x0804, "STA", "Absolute", 0x2000),
        ...validWindow().slice(2),
      ],
      LABELS,
      [],
    ],
    ["missing call", validWindow().slice(1), LABELS, []],
    [
      "wrong completion register",
      validWindow().map((value) =>
        value.address === 0x0809 ? instruction(0x0809, "LDX", "Immediate", 0xa5) : value,
      ),
      LABELS,
      [],
    ],
    [
      "wrong completion mode",
      validWindow().map((value) =>
        value.address === 0x0809 ? instruction(0x0809, "LDA", "ZeroPage", 0xa5) : value,
      ),
      LABELS,
      [],
    ],
    [
      "wrong completion value",
      validWindow().map((value) =>
        value.address === 0x0809 ? instruction(0x0809, "LDA", "Immediate", 0xa4) : value,
      ),
      LABELS,
      [],
    ],
    [
      "store address order",
      validWindow().map((value) =>
        value.address === 0x0803
          ? instruction(0x0803, "STA", "Absolute", 0x2001)
          : value.address === 0x0806
            ? instruction(0x0806, "STX", "Absolute", 0x2000)
            : value,
      ),
      LABELS,
      [],
    ],
    [
      "pre-call visible store",
      [validWindow()[1]!, validWindow()[0]!, ...validWindow().slice(2)],
      LABELS,
      [],
    ],
    [
      "report-visible order",
      [validWindow()[0]!, validWindow()[2]!, validWindow()[1]!, ...validWindow().slice(3)],
      LABELS,
      [],
    ],
    [
      "semantic write",
      [
        ...validWindow().slice(0, 3),
        instruction(0x0808, "STA", "Absolute", 0xd020),
        ...validWindow().slice(3),
      ],
      LABELS,
      [0xd020],
    ],
    [
      "post-completion write",
      [
        ...validWindow().slice(0, -1),
        instruction(0x080d, "STA", "Absolute", 0x3000),
        validWindow().at(-1)!,
      ],
      LABELS,
      [],
    ],
  ])("rejects %s evidence", (_name, instructions, labels, semanticAddresses) => {
    expect(derive(instructions, labels, semanticAddresses)).toBeUndefined();
  });
});
