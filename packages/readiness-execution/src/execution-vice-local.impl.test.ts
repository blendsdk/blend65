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
    evaluationIdentity: "sha256:f67282b054200b6459adc8b0a5e7b2ae2b7aeb991eb231379588ba3ee4da51ba",
    routeIdentity: "sha256:5535b0ed06507bc045eeabf2de7aaf87632e938889c55c6647681213eb57f545",
    buildEvidenceDigest: "sha256:2b007bc6b32b73828c8bd372ee2457d8aef2f9c6a4dd8cb59400c3672ed55804",
    binaryDigest: "7bb8098f1f9fab2e0feaf6fe3b5585fe0bb72dbd8521040a5b634fb23e5807ea",
    layoutDigest: "sha256:564e93ab224b4fa567150b551f3c8176562dd7b852f801a12a81c45d550316a6",
    usage: { outputBytes: 1254, evidenceBytes: 5795, instructions: 65_535, cycles: 34 },
    resultDigestsByLaunchAttempt: [
      "a2ac83358e4255648aa1a8a2f02e4ea33125e6088c45ec250f3482bccc6d524c",
      "96c19b21378df76f28c144078b5cc7aaee82ce034ba5f61f0180d2d6e8cdb007",
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
    evaluationIdentity: "sha256:f7149659c5a3ee3067832072da6e302efae89b1faf68c5e649357c30a306b5f6",
    routeIdentity: "sha256:65c04445d58b37510bf9b89aa771f662c5b8f3b072c881bbded2b4ce946d46e2",
    buildEvidenceDigest: "sha256:188221c47f62e338ce708381bca96ff244c71e5724099d035bdbe1783feb7415",
    binaryDigest: "bac26289506fc1183987d51d0193647e7de0dc8e8d1b92668a0ecbfe9c900fb5",
    layoutDigest: "sha256:061ac19e139164a5cc0c118afb7ae7732e53fff2fac6ce37d1abf95407536a64",
    usage: { outputBytes: 1551, evidenceBytes: 6685, instructions: 65_535, cycles: 50 },
    resultDigestsByLaunchAttempt: [
      "dde16126d03faccb35890289e1b11954e65b767061b5e2db922a3b35367be1a0",
      "f79ec73a4a4fa4c6f006d70b1d720d90a8ce765dfac6443546e0095821358f09",
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
    evaluationIdentity: "sha256:5522dd7c7845f064215f969956c7b0d3eff9e09149ff6b2eea77755aedc048be",
    routeIdentity: "sha256:5c22cfdfda3583acfac75e00e471ae755dd7516832c44450b3a36a6c193c7d4a",
    buildEvidenceDigest: "sha256:b3c96b28083b5bad8a909209e6ea230cced408ffa6a3bacac616688648fdef80",
    binaryDigest: "a38523dd41077a7a3f7042ba23903b179840b6fb3270fc479077fc0d21fbc2b4",
    layoutDigest: "sha256:ea4ecf308e89c1343b21e9521a23c58c2034580ee73b1eb5ea5bdce87ae381f3",
    usage: { outputBytes: 948, evidenceBytes: 4846, instructions: 65_535, cycles: 24 },
    resultDigestsByLaunchAttempt: [
      "daf488309596d5ab55260c8c5d7e6cabaaf9eb245f456f5af71b7753e4f42008",
      "521114d4b5d47ed43f1e799e79c810c6526d1102654991b763fec2176da13c14",
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
    evaluationIdentity: "sha256:c4dbe9aed56c5ed17d6aee4c62997cb71079ba48c476c692c07d48781bd8a0aa",
    routeIdentity: "sha256:996d797a8edf470704d15fd86b2775a3d537539a86f17cf32f9e4cde0a50ba70",
    buildEvidenceDigest: "sha256:cdc1e541ecbe3d7de800179e97cd7373ffb9bf04be909c662fed24fc8eea5b4c",
    binaryDigest: "b4e571989735bf6328a95b9122d561111991c3957ed886ccf1783d697df14ae2",
    layoutDigest: "sha256:871038834a9aff2cc49915fee18df71e34d4299a3790c2cbcc8cc40abc232868",
    usage: { outputBytes: 977, evidenceBytes: 4973, instructions: 65_535, cycles: 30 },
    resultDigestsByLaunchAttempt: [
      "f93a33d89191928627fdc1e20653900805e048263d54496dd01854785191b5d0",
      "353bd488b76a327573eeaa11def1cba240ab886cb255b98433ce44d8e66955b1",
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
