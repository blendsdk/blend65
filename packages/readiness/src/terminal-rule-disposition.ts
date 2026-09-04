import type {
  BoundaryFamilyId,
  ConstructionPrecondition,
  InvalidContract,
  RuleId,
  Sha256Digest,
  SpellingKind,
  TypedDomain,
} from "./model-registry-model.js";

/** How a reviewed rule contributes to semantic readiness. */
export type RuleClaimRole = "semantic-gate" | "secondary-quality";

/** Authenticated route that owns the evidence for a reviewed rule. */
export type RuleEvidenceRoute =
  | { readonly kind: "source"; readonly familyId: string }
  | { readonly kind: "non-source"; readonly handlerId: string };

/** Terminal evidence result retained for one reviewed rule. */
export type RuleEvidenceResult =
  | { readonly kind: "passing"; readonly evidenceDigest: Sha256Digest }
  | {
      readonly kind: "failing";
      readonly evidenceDigest: Sha256Digest;
      readonly owner: string;
    }
  | {
      readonly kind: "blocking";
      readonly reason:
        | "evidence-unavailable"
        | "evidence-incomplete"
        | "unreviewed-quality-obligation";
    };

/** Complete pending-or-reviewed disposition for one inventory rule. */
export type TerminalRuleDispositionV2 =
  | {
      readonly state: "pending-review";
      readonly ruleId: RuleId;
      readonly result: {
        readonly kind: "blocking";
        readonly reason: "family-review-pending";
      };
    }
  | {
      readonly state: "reviewed";
      readonly ruleId: RuleId;
      readonly claimRole: RuleClaimRole;
      readonly route: RuleEvidenceRoute;
      readonly result: RuleEvidenceResult;
    };

/** Reviewable construction and evidence family shared by equivalent rules. */
export interface RuleFamilyV2 {
  readonly familyId: string;
  readonly memberRuleIds: readonly RuleId[];
  readonly constructionPreconditions: readonly ConstructionPrecondition[];
  readonly typedDomains: readonly TypedDomain[];
  readonly invalidContracts: readonly InvalidContract[];
  readonly boundaryFamilyIds: readonly BoundaryFamilyId[];
  readonly spellings: readonly SpellingKind[];
  readonly oracleRouteIds: readonly string[];
}
