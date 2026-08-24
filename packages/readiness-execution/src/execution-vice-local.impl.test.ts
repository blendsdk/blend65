import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPublishedRuntimeEvaluationAuthorityV1,
  getPublishedRuntimeEvaluationProjectionV1,
  type ExecutionPolicyV1,
} from "@blend65/readiness";
import { hasAcme, hasVice } from "@blend65/test-harness";

import {
  acquireViceLeaseV1,
  executeEvaluatedViceRouteV1,
  prepareEvaluatedViceRouteV1,
} from "./execution-vice.js";
import type { PreparedViceBuildEvidenceV1 } from "./execution-vice-types.js";
import {
  createRuntimeAcceptanceFixture,
  type GenuineRuntimeAcceptanceCase,
  type RuntimeAcceptanceFixture,
} from "./test-fixtures/execution-runtime-acceptance-spec-fixture.js";

const LOCAL_RUNTIME_AVAILABLE = hasAcme() && hasVice("c64");
const LOCAL_TOOL_VERSIONS = LOCAL_RUNTIME_AVAILABLE
  ? {
      acme: execFileSync("acme", ["--version"], { encoding: "utf8" }).trim(),
      vice: execFileSync("x64sc", ["--version"], { encoding: "utf8" }).trim(),
    }
  : undefined;
const ACCEPTED_TOOL_VERSIONS = {
  acme: 'This is ACME, release 0.97 ("Zem"), 31 Jan 2021\n  Platform independent version.',
  vice: "x64sc (VICE 3.10)",
} as const;
const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: {
    operationMs: 60_000,
    launchAttemptMs: 15_000,
    routeMs: 120_000,
    cleanupGraceMs: 3_000,
    outputBytes: 1_048_576,
    evidenceBytes: 16_777_216,
    instructions: 65_535,
    cycles: 100_000_000,
    launchAttempts: 2,
  },
};

interface CompletionTimingProof {
  readonly visibleStoreInstructionAddresses: readonly number[];
  readonly visibleStoreTargetAddresses: readonly number[];
  readonly completionValueLoadInstructionAddress: number;
  readonly completionStoreInstructionAddress: number;
  readonly finalPostCallStoreInstructionAddress: number;
}

interface LocalAcceptanceEvidence {
  readonly case: GenuineRuntimeAcceptanceCase["fixed"]["name"];
  readonly sourceCaseDigest: string;
  readonly evaluationIdentity: string;
  readonly routeIdentity: string;
  readonly buildEvidenceDigest: string;
  readonly binaryDigest: string;
  readonly layoutDigest: string;
  readonly usage: {
    readonly outputBytes: number;
    readonly evidenceBytes: number;
    readonly instructions: number;
    readonly cycles: number;
    readonly launchAttempts: number;
  };
  readonly resultDigest: string;
  readonly completionTiming: CompletionTimingProof;
}

interface AcceptedLocalAcceptanceEvidence extends Omit<
  LocalAcceptanceEvidence,
  "resultDigest" | "usage"
> {
  readonly usage: Omit<LocalAcceptanceEvidence["usage"], "launchAttempts">;
  readonly resultDigestsByLaunchAttempt: readonly [string, string];
}

const ACCEPTED_EVIDENCE: readonly AcceptedLocalAcceptanceEvidence[] = [
  {
    case: "peek",
    sourceCaseDigest: "sha256:324abcffa2288995f6d553764ab5cb540fcd6a33c349e4e7614262101a168be8",
    evaluationIdentity: "sha256:fdd17030c3ac1cd12190da50eb14d11eb4c1c35e68b3e049f505ca356d04fa19",
    routeIdentity: "sha256:da7d8faa38412472ad25fd09af8b9b92dad2d57a2c44fad6a0567dcbed768649",
    buildEvidenceDigest: "sha256:c7354d7483993e6c5bbd9a4286eace6e993004790272258ad34a6a11a0b3c596",
    binaryDigest: "7bb8098f1f9fab2e0feaf6fe3b5585fe0bb72dbd8521040a5b634fb23e5807ea",
    layoutDigest: "sha256:564e93ab224b4fa567150b551f3c8176562dd7b852f801a12a81c45d550316a6",
    usage: { outputBytes: 1254, evidenceBytes: 5813, instructions: 65_535, cycles: 34 },
    resultDigestsByLaunchAttempt: [
      "cf6ac8d6133755bcb228d1fdfb3385f6666fa4732cc0a3bf063ff5e168975a3c",
      "aed2865fd7a1cf578f146904e45d91bad2940ff73cff329847c714b9b3a1b828",
    ],
    completionTiming: {
      visibleStoreInstructionAddresses: [0x0834, 0x0839],
      visibleStoreTargetAddresses: [0x2000, 0x2001],
      completionValueLoadInstructionAddress: 0x0837,
      completionStoreInstructionAddress: 0x0839,
      finalPostCallStoreInstructionAddress: 0x0839,
    },
  },
  {
    case: "peekw",
    sourceCaseDigest: "sha256:2a38428f820b2e8096f94f9ef1eb6cbe2e8f2db758971369c347e96df512b783",
    evaluationIdentity: "sha256:a61189a1a3df7bef16fb21ede2c6253be32e9f3ae7b2d30f721abd6849bad149",
    routeIdentity: "sha256:cd41a6c0939df30468a51829d5b8a923ec5e9d97934009d50f40db7ffdcd2e78",
    buildEvidenceDigest: "sha256:cce01d0dd41caea3ec30e6da2fe0728f415d5e94d35f813a74723814ce2e958b",
    binaryDigest: "bac26289506fc1183987d51d0193647e7de0dc8e8d1b92668a0ecbfe9c900fb5",
    layoutDigest: "sha256:061ac19e139164a5cc0c118afb7ae7732e53fff2fac6ce37d1abf95407536a64",
    usage: { outputBytes: 1551, evidenceBytes: 6703, instructions: 65_535, cycles: 50 },
    resultDigestsByLaunchAttempt: [
      "47dad6ea8db479dbfaeaf241933eefd86f63f828bd38a3ba9f6974a6b20fb61c",
      "888f30aded3c66b5599fdd399124b2f2feb3ee961b4a92e96220d39eba50f750",
    ],
    completionTiming: {
      visibleStoreInstructionAddresses: [0x083f, 0x0845, 0x084a],
      visibleStoreTargetAddresses: [0x2000, 0x2001, 0x2002],
      completionValueLoadInstructionAddress: 0x0848,
      completionStoreInstructionAddress: 0x084a,
      finalPostCallStoreInstructionAddress: 0x084a,
    },
  },
  {
    case: "poke",
    sourceCaseDigest: "sha256:68dfc69177f5869ed1353ff4a94e7ad8d93fc2225728fa4690644d4551fc3d10",
    evaluationIdentity: "sha256:e3ae2c7dda8ce949b2783583ccc17e573a2ffbb73b180755a05b52554507f50f",
    routeIdentity: "sha256:77af8e4391177750cddb8dd35f44be112561f660e0bfda70f243d87050326fd9",
    buildEvidenceDigest: "sha256:7bf76a8f7aa609ee4d368d64f131c85a70ab66413826bde9806cf172b66c39d4",
    binaryDigest: "a38523dd41077a7a3f7042ba23903b179840b6fb3270fc479077fc0d21fbc2b4",
    layoutDigest: "sha256:ea4ecf308e89c1343b21e9521a23c58c2034580ee73b1eb5ea5bdce87ae381f3",
    usage: { outputBytes: 948, evidenceBytes: 4864, instructions: 65_535, cycles: 24 },
    resultDigestsByLaunchAttempt: [
      "8f8e5bf06c062acb87ef885a06095fae5be6201c9d60d610ef4d8e961c48b340",
      "c314ff89080d7d141b71a06ddf136a3c69f4d9bcfb039d0a84950a092869359d",
    ],
    completionTiming: {
      visibleStoreInstructionAddresses: [0x082d],
      visibleStoreTargetAddresses: [0x2000],
      completionValueLoadInstructionAddress: 0x082b,
      completionStoreInstructionAddress: 0x082d,
      finalPostCallStoreInstructionAddress: 0x082d,
    },
  },
  {
    case: "pokew",
    sourceCaseDigest: "sha256:41aeef9e0da37bf308caf25b98181ba691ea0df680e5c81ccd0b88ffbf421853",
    evaluationIdentity: "sha256:1666c37e212640a13a82d5841338c18352ff9326b8e4f62a5ba9aae4980d5a61",
    routeIdentity: "sha256:9d53a1db693229d60589d1c52c63a0b548f43f407f9bf3c1560e994a61eb30b6",
    buildEvidenceDigest: "sha256:817364f456e8271347573a32ff3bd1a0bb7dec6317bbdace38c243e5607f79d0",
    binaryDigest: "b4e571989735bf6328a95b9122d561111991c3957ed886ccf1783d697df14ae2",
    layoutDigest: "sha256:871038834a9aff2cc49915fee18df71e34d4299a3790c2cbcc8cc40abc232868",
    usage: { outputBytes: 977, evidenceBytes: 4991, instructions: 65_535, cycles: 30 },
    resultDigestsByLaunchAttempt: [
      "5ead498e317022452044585bdcaed68e8389439cf50887329998539fdaeec0dc",
      "082306e4c12be2d873b3cc787c86c2f942b5484713af32c4e06f5a2a20b59f18",
    ],
    completionTiming: {
      visibleStoreInstructionAddresses: [0x0832],
      visibleStoreTargetAddresses: [0x2000],
      completionValueLoadInstructionAddress: 0x0830,
      completionStoreInstructionAddress: 0x0832,
      finalPostCallStoreInstructionAddress: 0x0832,
    },
  },
] as const;

function requireValue<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issues?: readonly unknown[] },
): T {
  if (!result.ok) {
    throw new TypeError(
      `Expected a successful local acceptance operation: ${JSON.stringify(result.issues ?? [])}`,
    );
  }
  return result.value;
}

function completionTiming(evidence: PreparedViceBuildEvidenceV1): CompletionTimingProof {
  const completion = evidence.postEntryStores.at(-1);
  if (completion?.kind !== "completion") {
    throw new TypeError("The sealed build has no terminal completion store.");
  }
  return Object.freeze({
    visibleStoreInstructionAddresses: Object.freeze(
      evidence.postEntryStores.map(({ instructionAddress }) => instructionAddress),
    ),
    visibleStoreTargetAddresses: Object.freeze(
      evidence.postEntryStores.map(({ targetAddress }) => targetAddress),
    ),
    completionValueLoadInstructionAddress: evidence.completionValueLoadInstructionAddress,
    completionStoreInstructionAddress: completion.instructionAddress,
    finalPostCallStoreInstructionAddress: evidence.finalPostCallStoreInstructionAddress,
  });
}

describe.skipIf(!LOCAL_RUNTIME_AVAILABLE)("real evaluated VICE runtime acceptance", () => {
  let fixture: RuntimeAcceptanceFixture;

  beforeAll(async () => {
    fixture = await createRuntimeAcceptanceFixture();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("executes the fixed memory rules through real ACME and VICE", async () => {
    expect(LOCAL_TOOL_VERSIONS).toEqual(ACCEPTED_TOOL_VERSIONS);
    const coveredAddresses = new Set<number>();
    const wordStarts = new Set<number>();
    const evidence: LocalAcceptanceEvidence[] = [];

    for (const entry of fixture.cases) {
      const authority = requireValue(
        createPublishedRuntimeEvaluationAuthorityV1(fixture.context, entry.executionCase),
      );
      const evaluation = requireValue(getPublishedRuntimeEvaluationProjectionV1(authority));
      const prepared = requireValue(
        await prepareEvaluatedViceRouteV1(
          entry.executionCase,
          authority,
          POLICY,
          AbortSignal.timeout(POLICY.budget.routeMs),
        ),
      );
      const lease = requireValue(
        await acquireViceLeaseV1("c64", AbortSignal.timeout(POLICY.budget.routeMs)),
      );
      const result = await executeEvaluatedViceRouteV1(
        prepared.request,
        lease,
        AbortSignal.timeout(POLICY.budget.routeMs),
      );
      expect(result, entry.fixed.name).toMatchObject({
        status: "pass",
        stage: "compare",
        code: "pass",
      });
      for (const { address } of entry.projection.fixture.cells) coveredAddresses.add(address);
      if (entry.projection.observation.byteLength === 2) {
        const start =
          entry.projection.observation.kind === "direct-mmio"
            ? entry.projection.observation.address
            : entry.projection.fixture.cells[0]?.address;
        if (start !== undefined) wordStarts.add(start);
      }
      evidence.push({
        case: entry.fixed.name,
        sourceCaseDigest: entry.projection.sourceCaseDigest,
        evaluationIdentity: evaluation.evaluationIdentity,
        routeIdentity: prepared.evidence.routeIdentity,
        buildEvidenceDigest: prepared.evidence.buildEvidenceDigest,
        binaryDigest: prepared.evidence.binaryDigest.replace(/^sha256:/u, ""),
        layoutDigest: prepared.evidence.layoutDigest,
        usage: {
          outputBytes: result.usage.outputBytes,
          evidenceBytes: result.usage.evidenceBytes,
          instructions: result.usage.instructions,
          cycles: result.usage.cycles,
          launchAttempts: result.usage.launchAttempts,
        },
        resultDigest: result.evidence.digest,
        completionTiming: completionTiming(prepared.evidence),
      });
    }

    expect([...coveredAddresses].sort((left, right) => left - right)).toEqual([
      0xd020, 0xd021, 0xd022,
    ]);
    expect([...wordStarts].sort((left, right) => left - right)).toEqual([0xd020, 0xd021]);
    expect(fixture.cases.map(({ fixed }) => fixed.name)).toEqual([
      "peek",
      "peekw",
      "poke",
      "pokew",
    ]);
    for (const [index, observed] of evidence.entries()) {
      const accepted = ACCEPTED_EVIDENCE[index];
      expect(accepted).toBeDefined();
      if (accepted === undefined) continue;
      const { resultDigestsByLaunchAttempt, ...expected } = accepted;
      expect(observed).toMatchObject(expected);
      expect(observed.usage.launchAttempts).toBeGreaterThanOrEqual(1);
      expect(observed.usage.launchAttempts).toBeLessThanOrEqual(
        resultDigestsByLaunchAttempt.length,
      );
      expect(observed.resultDigest).toBe(
        resultDigestsByLaunchAttempt[observed.usage.launchAttempts - 1],
      );
    }
  }, 240_000);
});
