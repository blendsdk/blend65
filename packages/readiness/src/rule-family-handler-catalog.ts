import type { HandlerDeclaration } from "./model.js";

/** Exact lexical handler population migrated into the first version-two parent. */
export const RULE_FAMILY_HANDLER_IDS_V2 = Object.freeze([
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.boundary-variants",
  "transform.semantic-relations",
] as const);

/** Stable identity of a handler represented in the version-two parent. */
export type RuleFamilyHandlerIdV2 = (typeof RULE_FAMILY_HANDLER_IDS_V2)[number];

/** Exact inventory declaration metadata owned by the first version-two parent. */
export const RULE_FAMILY_HANDLER_DECLARATIONS_V2 = Object.freeze([
  {
    id: "generator.compiler-cases",
    kind: "generator",
    owner: "readiness-rd02",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "generator.frontend-cases",
    kind: "generator",
    owner: "readiness-rd02",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "generator.runtime-cases",
    kind: "generator",
    owner: "readiness-rd02",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "oracle.compiler-result",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "oracle.emitted-program",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "oracle.frontend-result",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "oracle.runtime-state",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "transform.boundary-variants",
    kind: "transform",
    owner: "readiness-rd02",
    contractVersion: "1.0.0",
    binding: "bound",
  },
  {
    id: "transform.semantic-relations",
    kind: "transform",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "bound",
  },
] as const satisfies readonly HandlerDeclaration[]);
