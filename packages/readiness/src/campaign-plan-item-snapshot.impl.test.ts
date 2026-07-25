import { expect, it, vi } from "vitest";

import type { CampaignPlanItem } from "./campaign-model.js";
import {
  readCampaignPlanItemOrdinal,
  snapshotCampaignPlanItem,
} from "./campaign-plan-item-snapshot.js";

const generationPath: CampaignPlanItem["generationPath"] = Object.freeze([0, 0]);

const expected: CampaignPlanItem = Object.freeze({
  ordinal: 0,
  generationPath,
  lane: "coverage-valid",
  request: Object.freeze({
    handlerId: "generator.frontend-cases",
    modulePath: Object.freeze(["CampaignCase0"]),
    choice: Object.freeze({
      kind: "scalar",
      ruleId: "rule.fixture",
      spelling: "literal",
      value: 0n,
    }),
    validity: Object.freeze({ kind: "valid" }),
    budget: Object.freeze({
      maxModules: 1,
      maxDeclarations: 8,
      maxIrNodes: 32,
      maxStatements: 16,
      maxExpressionDepth: 8,
      maxLoopWork: 1n,
      maxSourceBytes: 4096,
      maxAttempts: 1,
    }),
  }),
  renderOptions: Object.freeze({
    maxSourceBytes: 4096,
    literalSpellings: Object.freeze([]),
  }),
});

it("snapshots only exact own-data plan items without invoking caller behavior", () => {
  const copy = {
    ordinal: 0,
    generationPath: [0, 0],
    lane: "coverage-valid",
    request: {
      handlerId: "generator.frontend-cases",
      modulePath: ["CampaignCase0"],
      choice: {
        kind: "scalar",
        ruleId: "rule.fixture",
        spelling: "literal",
        value: 0n,
      },
      validity: { kind: "valid" },
      budget: {
        maxModules: 1,
        maxDeclarations: 8,
        maxIrNodes: 32,
        maxStatements: 16,
        maxExpressionDepth: 8,
        maxLoopWork: 1n,
        maxSourceBytes: 4096,
        maxAttempts: 1,
      },
    },
    renderOptions: {
      maxSourceBytes: 4096,
      literalSpellings: [],
    },
  };
  expect(readCampaignPlanItemOrdinal(copy)).toBe(0);
  expect(snapshotCampaignPlanItem(copy, expected)).toBe(expected);
  expect(readCampaignPlanItemOrdinal(null)).toBeUndefined();
  expect(snapshotCampaignPlanItem(null, expected)).toBeUndefined();

  const getter = vi.fn(() => expected.request);
  const accessor = { ...copy };
  Object.defineProperty(accessor, "request", { enumerable: true, get: getter });
  expect(readCampaignPlanItemOrdinal(accessor)).toBeUndefined();
  expect(snapshotCampaignPlanItem(accessor, expected)).toBeUndefined();
  expect(getter).not.toHaveBeenCalled();

  const nestedGetter = vi.fn(() => "generator.frontend-cases");
  const nestedAccessor = {
    ...copy,
    request: { ...copy.request },
  };
  Object.defineProperty(nestedAccessor.request, "handlerId", {
    enumerable: true,
    get: nestedGetter,
  });
  expect(snapshotCampaignPlanItem(nestedAccessor, expected)).toBeUndefined();
  expect(nestedGetter).not.toHaveBeenCalled();

  const { proxy, revoke } = Proxy.revocable(copy, {});
  revoke();
  expect(readCampaignPlanItemOrdinal(proxy)).toBeUndefined();
  expect(snapshotCampaignPlanItem(proxy, expected)).toBeUndefined();
});
