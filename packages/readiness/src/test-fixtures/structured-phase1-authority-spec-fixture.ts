/** Stable identifier of the combined structured program used for execution evidence. */
export const COMBINED_STRUCTURED_CASE_ID = "case.structured.vertical-combined-v1" as const;

/** Exact lexical rule population of the first structured publication candidate. */
export const EXPECTED_FIRST_VERTICAL_RULE_IDS = [
  "rule.ch05.4-2-rules.both-body-else-body-blocks-cf",
  "rule.ch05.4-2-rules.e10100-condition-boolean-cf-2-divide",
  "rule.ch05.4-2-rules.e10102-all-code-paths-return-non",
  "rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false",
  "rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated",
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
  "rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end",
  "rule.ch06.fn-10.calling-function-multiple-arguments-argument-expressions",
  "rule.ch06.fn-2.callee-receives-copy-modifying-parameter-inside",
  "rule.ch06.fn-2.parameters-scalar-types-byte-sbyte-word",
  "rule.ch06.fn-4.functions-return-scalar-types-only",
  "rule.ch08.2-2-element-types.byte.size-per-element.1-byte",
  "rule.ch08.ar-8.compile-time-index-compile-time-constant",
  "rule.ch08.ar-8.out-bounds-constant-index-compile-error",
  "rule.ch08.ar-8.runtime-no-bounds-checking-default-too",
  "rule.ch08.ar-8.without-bounds-check-out-bounds-runtime",
] as const;

/** Exact stable case population used by the first structured candidate. */
export const EXPECTED_FIRST_VERTICAL_CASE_IDS = [
  "case.structured.branch-arms-v1",
  "case.structured.invalid-condition-v1",
  "case.structured.missing-return-v1",
  "case.structured.while-zero-v1",
  "case.structured.do-while-one-v1",
  "case.structured.for-inclusive-extremes-v1",
  "case.structured.for-until-v1",
  "case.structured.call-argument-order-v1",
  "case.structured.scalar-copy-v1",
  "case.structured.scalar-signatures-v1",
  "case.structured.scalar-returns-v1",
  "case.structured.byte-array-index-v1",
  "case.structured.constant-index-v1",
  "case.structured.constant-oob-v1",
  "case.structured.runtime-oob-public-v1",
  "case.structured.runtime-wrap-oracle-v1",
] as const;

/** Exact rule-to-case mapping; case digests come only from authenticated case authority. */
export const EXPECTED_FIRST_VERTICAL_BINDINGS = [
  {
    ruleId: "rule.ch05.4-2-rules.both-body-else-body-blocks-cf",
    caseIds: ["case.structured.branch-arms-v1"],
  },
  {
    ruleId: "rule.ch05.4-2-rules.e10100-condition-boolean-cf-2-divide",
    caseIds: ["case.structured.invalid-condition-v1"],
  },
  {
    ruleId: "rule.ch05.4-2-rules.e10102-all-code-paths-return-non",
    caseIds: ["case.structured.missing-return-v1"],
  },
  {
    ruleId: "rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false",
    caseIds: ["case.structured.while-zero-v1"],
  },
  {
    ruleId: "rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated",
    caseIds: ["case.structured.do-while-one-v1"],
  },
  {
    ruleId: "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
    caseIds: ["case.structured.for-inclusive-extremes-v1"],
  },
  {
    ruleId: "rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end",
    caseIds: ["case.structured.for-until-v1"],
  },
  {
    ruleId: "rule.ch06.fn-10.calling-function-multiple-arguments-argument-expressions",
    caseIds: ["case.structured.call-argument-order-v1"],
  },
  {
    ruleId: "rule.ch06.fn-2.callee-receives-copy-modifying-parameter-inside",
    caseIds: ["case.structured.scalar-copy-v1"],
  },
  {
    ruleId: "rule.ch06.fn-2.parameters-scalar-types-byte-sbyte-word",
    caseIds: ["case.structured.scalar-signatures-v1"],
  },
  {
    ruleId: "rule.ch06.fn-4.functions-return-scalar-types-only",
    caseIds: ["case.structured.scalar-returns-v1"],
  },
  {
    ruleId: "rule.ch08.2-2-element-types.byte.size-per-element.1-byte",
    caseIds: ["case.structured.byte-array-index-v1"],
  },
  {
    ruleId: "rule.ch08.ar-8.compile-time-index-compile-time-constant",
    caseIds: ["case.structured.constant-index-v1"],
  },
  {
    ruleId: "rule.ch08.ar-8.out-bounds-constant-index-compile-error",
    caseIds: ["case.structured.constant-oob-v1"],
  },
  {
    ruleId: "rule.ch08.ar-8.runtime-no-bounds-checking-default-too",
    caseIds: ["case.structured.runtime-oob-public-v1"],
  },
  {
    ruleId: "rule.ch08.ar-8.without-bounds-check-out-bounds-runtime",
    caseIds: ["case.structured.runtime-oob-public-v1", "case.structured.runtime-wrap-oracle-v1"],
  },
] as const;
