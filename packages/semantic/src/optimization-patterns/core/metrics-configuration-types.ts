/**
 * Metrics Configuration Types - Configuration and Setup Types
 * Task 1.11: Core Optimization Pattern Infrastructure
 *
 * This file defines all configuration-related types for the optimization metrics system.
 * It provides comprehensive configuration options for metrics collection, analysis,
 * and reporting with professional-grade flexibility and control.
 *
 * Educational Focus:
 * - Metrics system configuration and customization
 * - Performance tuning and optimization settings
 * - Flexible configuration architecture for diverse use cases
 * - Professional-grade metrics collection setup
 */

// ============================================================================
// CORE CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for metrics collector.
 * Provides comprehensive control over metrics collection behavior.
 */
export interface MetricsCollectorConfiguration {
  /** Enable detailed metrics collection */
  enableDetailedMetrics: boolean;

  /** Enable real-time analysis */
  enableRealTimeAnalysis: boolean;

  /** Enable trend analysis */
  enableTrendAnalysis: boolean;

  /** Enable performance predictions */
  enablePerformancePredictions: boolean;

  /** Metrics collection frequency */
  collectionFrequency: MetricsCollectionFrequency;

  /** Maximum memory usage for metrics (bytes) */
  maxMemoryUsage: number;

  /** Metrics retention period (days) */
  retentionPeriod: number;

  /** Enable metrics compression */
  enableCompression: boolean;

  /** Enable metrics export */
  enableExport: boolean;

  /** Export format preferences */
  exportFormats: MetricsExportFormat[];

  /** Performance thresholds */
  performanceThresholds: PerformanceThreshold[];

  /** Alert configurations */
  alertConfigurations: AlertConfiguration[];

  /** Sampling configurations */
  samplingConfigurations: SamplingConfiguration[];

  /** Storage configurations */
  storageConfigurations: StorageConfiguration;

  /** Analysis configurations */
  analysisConfigurations: AnalysisConfiguration;

  /** Custom metrics collection options */
  customOptions: Map<string, any>;
}

export type MetricsCollectionFrequency =
  | 'RealTime'
  | 'HighFrequency'
  | 'Standard'
  | 'LowFrequency'
  | 'OnDemand';
export type MetricsExportFormat = 'JSON' | 'CSV' | 'XML' | 'Parquet' | 'InfluxDB' | 'Prometheus';

/**
 * Performance threshold configuration.
 */
export interface PerformanceThreshold {
  /** Threshold name */
  thresholdName: string;

  /** Metric to monitor */
  metricName: string;

  /** Warning threshold */
  warningThreshold: number;

  /** Critical threshold */
  criticalThreshold: number;

  /** Threshold action */
  action: ThresholdAction;

  /** Threshold sensitivity */
  sensitivity: ThresholdSensitivity;
}

export type ThresholdAction = 'Log' | 'Alert' | 'Throttle' | 'Disable' | 'Escalate';
export type ThresholdSensitivity = 'Low' | 'Medium' | 'High' | 'Maximum';

/**
 * Alert configuration.
 */
export interface AlertConfiguration {
  /** Alert name */
  alertName: string;

  /** Alert conditions */
  conditions: AlertCondition[];

  /** Alert channels */
  channels: AlertChannel[];

  /** Alert frequency limits */
  frequencyLimits: AlertFrequencyLimit;

  /** Alert escalation */
  escalation: AlertEscalation;
}

/**
 * Alert condition specification.
 */
export interface AlertCondition {
  /** Condition expression */
  condition: string;

  /** Condition type */
  conditionType: AlertConditionType;

  /** Evaluation period */
  evaluationPeriod: number;

  /** Condition weight */
  weight: number;
}

export type AlertConditionType = 'Threshold' | 'Rate' | 'Pattern' | 'Anomaly' | 'Composite';

/**
 * Alert channel configuration.
 */
export interface AlertChannel {
  /** Channel type */
  channelType: AlertChannelType;

  /** Channel configuration */
  configuration: AlertChannelConfiguration;

  /** Channel priority */
  priority: AlertChannelPriority;

  /** Channel filters */
  filters: AlertChannelFilter[];
}

export type AlertChannelType = 'Email' | 'Slack' | 'SMS' | 'Webhook' | 'Console' | 'Log';
export type AlertChannelPriority = 'Low' | 'Medium' | 'High' | 'Critical' | 'Emergency';

/**
 * Alert channel configuration.
 */
export interface AlertChannelConfiguration {
  /** Channel endpoint */
  endpoint: string;

  /** Authentication configuration */
  authentication: AuthenticationConfiguration;

  /** Retry configuration */
  retryConfiguration: RetryConfiguration;

  /** Rate limiting */
  rateLimiting: RateLimitingConfiguration;
}

/**
 * Authentication configuration for alert channels.
 */
export interface AuthenticationConfiguration {
  /** Authentication type */
  authenticationType: AuthenticationType;

  /** Credentials */
  credentials: Map<string, string>;

  /** Token configuration */
  tokenConfiguration?: TokenConfiguration;
}

export type AuthenticationType =
  | 'None'
  | 'ApiKey'
  | 'OAuth'
  | 'BasicAuth'
  | 'Token'
  | 'Certificate';

/**
 * Token configuration.
 */
export interface TokenConfiguration {
  /** Token endpoint */
  tokenEndpoint: string;

  /** Token refresh interval */
  refreshInterval: number;

  /** Token validation */
  validation: TokenValidation;
}

/**
 * Token validation configuration.
 */
export interface TokenValidation {
  /** Validation endpoint */
  validationEndpoint: string;

  /** Validation frequency */
  validationFrequency: number;

  /** Validation timeout */
  validationTimeout: number;
}

/**
 * Retry configuration for failed operations.
 */
export interface RetryConfiguration {
  /** Maximum retry attempts */
  maxRetries: number;

  /** Retry backoff strategy */
  backoffStrategy: BackoffStrategy;

  /** Base retry delay */
  baseDelay: number;

  /** Maximum retry delay */
  maxDelay: number;

  /** Retry jitter */
  jitter: boolean;
}

export type BackoffStrategy = 'Fixed' | 'Linear' | 'Exponential' | 'Custom';

/**
 * Rate limiting configuration.
 */
export interface RateLimitingConfiguration {
  /** Requests per second limit */
  requestsPerSecond: number;

  /** Burst capacity */
  burstCapacity: number;

  /** Rate limiting algorithm */
  algorithm: RateLimitingAlgorithm;

  /** Overflow behavior */
  overflowBehavior: OverflowBehavior;
}

export type RateLimitingAlgorithm = 'TokenBucket' | 'LeakyBucket' | 'FixedWindow' | 'SlidingWindow';
export type OverflowBehavior = 'Drop' | 'Queue' | 'Block' | 'Throttle';

/**
 * Alert channel filter.
 */
export interface AlertChannelFilter {
  /** Filter type */
  filterType: AlertFilterType;

  /** Filter expression */
  expression: string;

  /** Filter action */
  action: FilterAction;

  /** Filter priority */
  priority: number;
}

export type AlertFilterType = 'Severity' | 'Source' | 'Pattern' | 'Frequency' | 'Custom';
export type FilterAction = 'Allow' | 'Block' | 'Modify' | 'Aggregate';

/**
 * Alert frequency limit configuration.
 */
export interface AlertFrequencyLimit {
  /** Maximum alerts per minute */
  maxAlertsPerMinute: number;

  /** Maximum alerts per hour */
  maxAlertsPerHour: number;

  /** Maximum alerts per day */
  maxAlertsPerDay: number;

  /** Frequency limit action */
  limitAction: FrequencyLimitAction;

  /** Reset period */
  resetPeriod: number;
}

export type FrequencyLimitAction = 'Suppress' | 'Aggregate' | 'Delay' | 'Escalate';

/**
 * Alert escalation configuration.
 */
export interface AlertEscalation {
  /** Enable escalation */
  enabled: boolean;

  /** Escalation levels */
  escalationLevels: EscalationLevel[];

  /** Escalation criteria */
  escalationCriteria: EscalationCriteria;

  /** De-escalation criteria */
  deEscalationCriteria: DeEscalationCriteria;
}

/**
 * Escalation level definition.
 */
export interface EscalationLevel {
  /** Level number */
  level: number;

  /** Level name */
  name: string;

  /** Escalation delay */
  delay: number;

  /** Escalation targets */
  targets: EscalationTarget[];

  /** Level conditions */
  conditions: EscalationCondition[];
}

/**
 * Escalation target.
 */
export interface EscalationTarget {
  /** Target type */
  targetType: EscalationTargetType;

  /** Target identifier */
  targetId: string;

  /** Target configuration */
  configuration: EscalationTargetConfiguration;
}

export type EscalationTargetType = 'User' | 'Group' | 'Service' | 'External' | 'Automated';

/**
 * Configuration for escalation target.
 */
export interface EscalationTargetConfiguration {
  /** Contact method */
  contactMethod: ContactMethod;

  /** Priority level */
  priority: EscalationPriority;

  /** Response timeout */
  responseTimeout: number;

  /** Backup targets */
  backupTargets: string[];
}

export type ContactMethod = 'Email' | 'Phone' | 'SMS' | 'Slack' | 'Teams' | 'PagerDuty';
export type EscalationPriority = 'Low' | 'Medium' | 'High' | 'Critical' | 'Emergency';

/**
 * Escalation condition.
 */
export interface EscalationCondition {
  /** Condition type */
  conditionType: EscalationConditionType;

  /** Condition parameters */
  parameters: Map<string, any>;

  /** Condition weight */
  weight: number;

  /** Condition timeout */
  timeout: number;
}

export type EscalationConditionType =
  | 'TimeElapsed'
  | 'SeverityIncrease'
  | 'NoResponse'
  | 'PatternMatch'
  | 'Custom';

/**
 * Escalation criteria.
 */
export interface EscalationCriteria {
  /** Escalation triggers */
  triggers: EscalationTrigger[];

  /** Escalation thresholds */
  thresholds: EscalationThreshold[];

  /** Escalation logic */
  logic: EscalationLogic;
}

/**
 * Escalation trigger.
 */
export interface EscalationTrigger {
  /** Trigger name */
  triggerName: string;

  /** Trigger condition */
  condition: string;

  /** Trigger sensitivity */
  sensitivity: TriggerSensitivity;

  /** Trigger delay */
  delay: number;
}

export type TriggerSensitivity = 'Low' | 'Medium' | 'High' | 'Maximum';

/**
 * Escalation threshold.
 */
export interface EscalationThreshold {
  /** Threshold metric */
  metric: string;

  /** Threshold value */
  value: number;

  /** Threshold operator */
  operator: ThresholdOperator;

  /** Threshold duration */
  duration: number;
}

export type ThresholdOperator =
  | 'GreaterThan'
  | 'LessThan'
  | 'Equal'
  | 'NotEqual'
  | 'Between'
  | 'Outside';

/**
 * Escalation logic configuration.
 */
export interface EscalationLogic {
  /** Logic type */
  logicType: EscalationLogicType;

  /** Combination operator */
  operator: LogicOperator;

  /** Logic evaluation order */
  evaluationOrder: EvaluationOrder;

  /** Short circuit evaluation */
  shortCircuit: boolean;
}

export type EscalationLogicType = 'Simple' | 'Complex' | 'Conditional' | 'Temporal' | 'Statistical';
export type LogicOperator = 'AND' | 'OR' | 'XOR' | 'NOT' | 'NAND' | 'NOR';
export type EvaluationOrder = 'Sequential' | 'Parallel' | 'Priority' | 'Random';

/**
 * De-escalation criteria.
 */
export interface DeEscalationCriteria {
  /** De-escalation conditions */
  conditions: DeEscalationCondition[];

  /** Cool-down period */
  coolDownPeriod: number;

  /** Automatic de-escalation */
  automaticDeEscalation: boolean;

  /** De-escalation validation */
  validation: DeEscalationValidation;
}

/**
 * De-escalation condition.
 */
export interface DeEscalationCondition {
  /** Condition description */
  description: string;

  /** Condition type */
  conditionType: DeEscalationConditionType;

  /** Condition parameters */
  parameters: Map<string, any>;

  /** Condition weight */
  weight: number;
}

export type DeEscalationConditionType =
  | 'MetricImprovement'
  | 'TimeElapsed'
  | 'ManualResolution'
  | 'AutomaticResolution';

/**
 * De-escalation validation.
 */
export interface DeEscalationValidation {
  /** Validation required */
  required: boolean;

  /** Validation criteria */
  criteria: ValidationCriterion[];

  /** Validation timeout */
  timeout: number;

  /** Validation failure action */
  failureAction: ValidationFailureAction;
}

/**
 * Validation criterion for de-escalation.
 */
export interface ValidationCriterion {
  /** Criterion name */
  name: string;

  /** Criterion type */
  type: ValidationCriterionType;

  /** Expected value */
  expectedValue: any;

  /** Tolerance */
  tolerance: number;
}

export type ValidationCriterionType = 'Metric' | 'Status' | 'Duration' | 'Count' | 'Pattern';
export type ValidationFailureAction = 'Block' | 'Warning' | 'Override' | 'Escalate';

// ============================================================================
// SAMPLING CONFIGURATION
// ============================================================================

/**
 * Sampling configuration for metrics collection.
 */
export interface SamplingConfiguration {
  /** Sampling strategy */
  strategy: SamplingStrategy;

  /** Sample rate (0.0 to 1.0) */
  sampleRate: number;

  /** Sampling criteria */
  criteria: SamplingCriteria;

  /** Adaptive sampling */
  adaptiveSampling: AdaptiveSamplingConfiguration;

  /** Sampling validation */
  validation: SamplingValidation;
}

export type SamplingStrategy = 'Random' | 'Systematic' | 'Stratified' | 'Adaptive' | 'Targeted';

/**
 * Sampling criteria configuration.
 */
export interface SamplingCriteria {
  /** Priority-based sampling */
  priorityBasedSampling: PriorityBasedSampling;

  /** Performance-based sampling */
  performanceBasedSampling: PerformanceBasedSampling;

  /** Error-based sampling */
  errorBasedSampling: ErrorBasedSampling;

  /** Custom sampling rules */
  customRules: CustomSamplingRule[];
}

/**
 * Priority-based sampling configuration.
 */
export interface PriorityBasedSampling {
  /** Enable priority sampling */
  enabled: boolean;

  /** High priority sample rate */
  highPrioritySampleRate: number;

  /** Medium priority sample rate */
  mediumPrioritySampleRate: number;

  /** Low priority sample rate */
  lowPrioritySampleRate: number;

  /** Priority determination criteria */
  priorityCriteria: PriorityCriterion[];
}

/**
 * Priority criterion for sampling.
 */
export interface PriorityCriterion {
  /** Criterion name */
  name: string;

  /** Criterion weight */
  weight: number;

  /** Criterion evaluator */
  evaluator: PriorityEvaluator;
}

export type PriorityEvaluator =
  | 'PatternComplexity'
  | 'TransformationImpact'
  | 'ValidationResult'
  | 'ResourceUsage'
  | 'Custom';

/**
 * Performance-based sampling configuration.
 */
export interface PerformanceBasedSampling {
  /** Enable performance sampling */
  enabled: boolean;

  /** Slow operation sample rate */
  slowOperationSampleRate: number;

  /** Fast operation sample rate */
  fastOperationSampleRate: number;

  /** Performance thresholds */
  performanceThresholds: PerformanceSamplingThreshold[];
}

/**
 * Performance threshold for sampling.
 */
export interface PerformanceSamplingThreshold {
  /** Threshold name */
  name: string;

  /** Performance metric */
  metric: string;

  /** Threshold value */
  threshold: number;

  /** Sample rate for values above threshold */
  aboveThresholdRate: number;

  /** Sample rate for values below threshold */
  belowThresholdRate: number;
}

/**
 * Error-based sampling configuration.
 */
export interface ErrorBasedSampling {
  /** Enable error sampling */
  enabled: boolean;

  /** Error sample rate */
  errorSampleRate: number;

  /** Success sample rate */
  successSampleRate: number;

  /** Error type sampling */
  errorTypeSampling: ErrorTypeSamplingConfiguration[];
}

/**
 * Error type sampling configuration.
 */
export interface ErrorTypeSamplingConfiguration {
  /** Error type */
  errorType: string;

  /** Sample rate for this error type */
  sampleRate: number;

  /** Priority level */
  priority: ErrorSamplingPriority;

  /** Capture detailed context */
  captureDetailedContext: boolean;
}

export type ErrorSamplingPriority = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Custom sampling rule.
 */
export interface CustomSamplingRule {
  /** Rule name */
  ruleName: string;

  /** Rule condition */
  condition: string;

  /** Sample rate when condition is met */
  sampleRate: number;

  /** Rule priority */
  priority: number;

  /** Rule evaluation method */
  evaluationMethod: RuleEvaluationMethod;
}

export type RuleEvaluationMethod = 'Simple' | 'Complex' | 'Machine Learning' | 'Heuristic';

/**
 * Adaptive sampling configuration.
 */
export interface AdaptiveSamplingConfiguration {
  /** Enable adaptive sampling */
  enabled: boolean;

  /** Adaptation algorithm */
  algorithm: AdaptationAlgorithm;

  /** Adaptation frequency */
  adaptationFrequency: number;

  /** Adaptation targets */
  targets: AdaptationTarget[];

  /** Adaptation constraints */
  constraints: AdaptationConstraint[];
}

export type AdaptationAlgorithm = 'PID' | 'Fuzzy' | 'MachineLearning' | 'RuleBased' | 'Hybrid';

/**
 * Adaptation target for sampling.
 */
export interface AdaptationTarget {
  /** Target metric */
  metric: string;

  /** Target value */
  targetValue: number;

  /** Tolerance */
  tolerance: number;

  /** Weight in optimization */
  weight: number;
}

/**
 * Adaptation constraint.
 */
export interface AdaptationConstraint {
  /** Constraint type */
  constraintType: AdaptationConstraintType;

  /** Constraint value */
  value: number;

  /** Constraint enforcement */
  enforcement: ConstraintEnforcement;
}

export type AdaptationConstraintType =
  | 'MinSampleRate'
  | 'MaxSampleRate'
  | 'ResourceUsage'
  | 'Latency'
  | 'Accuracy';
export type ConstraintEnforcement = 'Soft' | 'Hard' | 'Advisory';

/**
 * Sampling validation configuration.
 */
export interface SamplingValidation {
  /** Validation enabled */
  enabled: boolean;

  /** Validation methods */
  methods: SamplingValidationMethod[];

  /** Validation frequency */
  frequency: ValidationFrequency;

  /** Validation thresholds */
  thresholds: SamplingValidationThreshold[];
}

export type SamplingValidationMethod = 'Statistical' | 'Comparative' | 'Predictive' | 'Manual';
export type ValidationFrequency = 'Continuous' | 'Periodic' | 'OnDemand' | 'Triggered';

/**
 * Sampling validation threshold.
 */
export interface SamplingValidationThreshold {
  /** Threshold name */
  name: string;

  /** Threshold metric */
  metric: string;

  /** Acceptable range */
  acceptableRange: ValueRange;

  /** Threshold action */
  action: SamplingThresholdAction;
}

/**
 * Value range specification.
 */
export interface ValueRange {
  /** Minimum value */
  min: number;

  /** Maximum value */
  max: number;

  /** Optimal value */
  optimal?: number;
}

export type SamplingThresholdAction = 'Adjust' | 'Alert' | 'Stop' | 'Switch';

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

/**
 * Storage configuration for metrics data.
 */
export interface StorageConfiguration {
  /** Primary storage */
  primaryStorage: StorageBackend;

  /** Backup storage */
  backupStorage?: StorageBackend;

  /** Archive storage */
  archiveStorage?: StorageBackend;

  /** Storage policies */
  policies: StoragePolicy[];

  /** Compression settings */
  compression: CompressionConfiguration;

  /** Encryption settings */
  encryption: EncryptionConfiguration;
}

/**
 * Storage backend configuration.
 */
export interface StorageBackend {
  /** Backend type */
  backendType: StorageBackendType;

  /** Connection configuration */
  connectionConfiguration: StorageConnectionConfiguration;

  /** Performance settings */
  performanceSettings: StoragePerformanceSettings;

  /** Reliability settings */
  reliabilitySettings: StorageReliabilitySettings;
}

export type StorageBackendType =
  | 'InMemory'
  | 'LocalFile'
  | 'Database'
  | 'TimeSeriesDB'
  | 'CloudStorage'
  | 'Custom';

/**
 * Storage connection configuration.
 */
export interface StorageConnectionConfiguration {
  /** Connection string */
  connectionString: string;

  /** Connection pool settings */
  poolSettings: ConnectionPoolSettings;

  /** Timeout settings */
  timeoutSettings: StorageTimeoutSettings;

  /** Authentication */
  authentication: StorageAuthentication;
}

/**
 * Connection pool settings.
 */
export interface ConnectionPoolSettings {
  /** Minimum connections */
  minConnections: number;

  /** Maximum connections */
  maxConnections: number;

  /** Connection timeout */
  connectionTimeout: number;

  /** Idle timeout */
  idleTimeout: number;

  /** Pool validation */
  validation: PoolValidation;
}

/**
 * Pool validation settings.
 */
export interface PoolValidation {
  /** Validate on borrow */
  validateOnBorrow: boolean;

  /** Validate on return */
  validateOnReturn: boolean;

  /** Validation query */
  validationQuery: string;

  /** Validation timeout */
  validationTimeout: number;
}

/**
 * Storage timeout settings.
 */
export interface StorageTimeoutSettings {
  /** Connection timeout */
  connectionTimeout: number;

  /** Read timeout */
  readTimeout: number;

  /** Write timeout */
  writeTimeout: number;

  /** Query timeout */
  queryTimeout: number;
}

/**
 * Storage authentication configuration.
 */
export interface StorageAuthentication {
  /** Authentication type */
  authenticationType: StorageAuthenticationType;

  /** Credentials */
  credentials: StorageCredentials;

  /** Security settings */
  securitySettings: StorageSecuritySettings;
}

export type StorageAuthenticationType =
  | 'None'
  | 'UserPassword'
  | 'ApiKey'
  | 'Certificate'
  | 'OAuth'
  | 'IAM';

/**
 * Storage credentials.
 */
export interface StorageCredentials {
  /** Username */
  username?: string;

  /** Password */
  password?: string;

  /** API key */
  apiKey?: string;

  /** Certificate path */
  certificatePath?: string;

  /** Additional properties */
  additionalProperties: Map<string, string>;
}

/**
 * Storage security settings.
 */
export interface StorageSecuritySettings {
  /** Enable SSL/TLS */
  enableSSL: boolean;

  /** SSL configuration */
  sslConfiguration?: SSLConfiguration;

  /** Access control */
  accessControl: AccessControlConfiguration;

  /** Audit logging */
  auditLogging: AuditLoggingConfiguration;
}

/**
 * SSL configuration.
 */
export interface SSLConfiguration {
  /** SSL version */
  sslVersion: SSLVersion;

  /** Certificate validation */
  certificateValidation: CertificateValidation;

  /** Cipher suites */
  cipherSuites: string[];

  /** Key store configuration */
  keyStoreConfiguration?: KeyStoreConfiguration;
}

export type SSLVersion = 'TLSv1.2' | 'TLSv1.3' | 'Auto';

/**
 * Certificate validation settings.
 */
export interface CertificateValidation {
  /** Validate certificate */
  validateCertificate: boolean;

  /** Validate hostname */
  validateHostname: boolean;

  /** Trusted certificates */
  trustedCertificates: string[];

  /** Certificate revocation checking */
  revocationChecking: RevocationChecking;
}

export type RevocationChecking = 'None' | 'CRL' | 'OCSP' | 'Both';

/**
 * Key store configuration.
 */
export interface KeyStoreConfiguration {
  /** Key store path */
  keyStorePath: string;

  /** Key store password */
  keyStorePassword: string;

  /** Key store type */
  keyStoreType: KeyStoreType;

  /** Key alias */
  keyAlias?: string;
}

export type KeyStoreType = 'JKS' | 'PKCS12' | 'PEM' | 'P7B';

/**
 * Access control configuration.
 */
export interface AccessControlConfiguration {
  /** Enable access control */
  enabled: boolean;

  /** Access policies */
  policies: AccessPolicy[];

  /** Role-based access */
  roleBasedAccess: RoleBasedAccessConfiguration;

  /** Permission model */
  permissionModel: PermissionModel;
}

/**
 * Access policy definition.
 */
export interface AccessPolicy {
  /** Policy name */
  policyName: string;

  /** Policy rules */
  rules: AccessRule[];

  /** Policy scope */
  scope: PolicyScope;

  /** Policy enforcement */
  enforcement: PolicyEnforcement;
}

/**
 * Access rule definition.
 */
export interface AccessRule {
  /** Rule name */
  ruleName: string;

  /** Subject pattern */
  subjectPattern: string;

  /** Resource pattern */
  resourcePattern: string;

  /** Actions allowed */
  allowedActions: string[];

  /** Conditions */
  conditions: AccessCondition[];
}

/**
 * Access condition.
 */
export interface AccessCondition {
  /** Condition type */
  conditionType: AccessConditionType;

  /** Condition expression */
  expression: string;

  /** Condition weight */
  weight: number;
}

export type AccessConditionType = 'Time' | 'Location' | 'Role' | 'Attribute' | 'Context';
export type PolicyScope = 'Global' | 'Component' | 'Function' | 'Data';
export type PolicyEnforcement = 'Permissive' | 'Strict' | 'Advisory';

/**
 * Role-based access configuration.
 */
export interface RoleBasedAccessConfiguration {
  /** Enable RBAC */
  enabled: boolean;

  /** Role definitions */
  roles: RoleDefinition[];

  /** User role assignments */
  userRoleAssignments: UserRoleAssignment[];

  /** Role hierarchies */
  roleHierarchies: RoleHierarchy[];
}

/**
 * Role definition.
 */
export interface RoleDefinition {
  /** Role name */
  roleName: string;

  /** Role description */
  description: string;

  /** Permissions */
  permissions: Permission[];

  /** Role attributes */
  attributes: Map<string, any>;
}

/**
 * Permission definition.
 */
export interface Permission {
  /** Permission name */
  permissionName: string;

  /** Resource type */
  resourceType: string;

  /** Actions allowed */
  actions: string[];

  /** Permission scope */
  scope: PermissionScope;
}

export type PermissionScope = 'Read' | 'Write' | 'Execute' | 'Admin' | 'All';

/**
 * User role assignment.
 */
export interface UserRoleAssignment {
  /** User identifier */
  userId: string;

  /** Assigned roles */
  roles: string[];

  /** Assignment conditions */
  conditions: AssignmentCondition[];

  /** Assignment expiration */
  expiration?: Date;
}

/**
 * Assignment condition.
 */
export interface AssignmentCondition {
  /** Condition type */
  conditionType: AssignmentConditionType;

  /** Condition value */
  value: any;

  /** Condition operator */
  operator: string;
}

export type AssignmentConditionType = 'Time' | 'Location' | 'Project' | 'Temporary' | 'Conditional';

/**
 * Role hierarchy definition.
 */
export interface RoleHierarchy {
  /** Parent role */
  parentRole: string;

  /** Child roles */
  childRoles: string[];

  /** Inheritance type */
  inheritanceType: InheritanceType;

  /** Hierarchy constraints */
  constraints: HierarchyConstraint[];
}

export type InheritanceType = 'Full' | 'Partial' | 'Additive' | 'Restrictive';

/**
 * Hierarchy constraint.
 */
export interface HierarchyConstraint {
  /** Constraint type */
  constraintType: HierarchyConstraintType;

  /** Constraint description */
  description: string;

  /** Constraint enforcement */
  enforcement: ConstraintEnforcement;
}

export type HierarchyConstraintType = 'Circular' | 'Depth' | 'Breadth' | 'Conflict';

export type PermissionModel = 'Allow' | 'Deny' | 'Mixed';

/**
 * Audit logging configuration.
 */
export interface AuditLoggingConfiguration {
  /** Enable audit logging */
  enabled: boolean;

  /** Audit log level */
  logLevel: AuditLogLevel;

  /** Audit events */
  events: AuditEventConfiguration[];

  /** Log storage */
  storage: AuditLogStorage;

  /** Log retention */
  retention: AuditLogRetention;
}

export type AuditLogLevel = 'Basic' | 'Standard' | 'Detailed' | 'Comprehensive';

/**
 * Audit event configuration.
 */
export interface AuditEventConfiguration {
  /** Event type */
  eventType: string;

  /** Event priority */
  priority: AuditEventPriority;

  /** Capture details */
  captureDetails: boolean;

  /** Retention period */
  retentionPeriod: number;
}

export type AuditEventPriority = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Audit log storage configuration.
 */
export interface AuditLogStorage {
  /** Storage type */
  storageType: AuditStorageType;

  /** Storage path */
  storagePath: string;

  /** Encryption enabled */
  encryptionEnabled: boolean;

  /** Compression enabled */
  compressionEnabled: boolean;
}

export type AuditStorageType = 'Local' | 'Database' | 'Remote' | 'Cloud';

/**
 * Audit log retention configuration.
 */
export interface AuditLogRetention {
  /** Retention period (days) */
  retentionPeriod: number;

  /** Archive after (days) */
  archiveAfter: number;

  /** Cleanup policy */
  cleanupPolicy: CleanupPolicy;

  /** Archive compression */
  archiveCompression: boolean;
}

export type CleanupPolicy = 'Delete' | 'Archive' | 'Compress' | 'Move';

/**
 * Storage policy configuration.
 */
export interface StoragePolicy {
  /** Policy name */
  policyName: string;

  /** Policy type */
  policyType: StoragePolicyType;

  /** Policy rules */
  rules: StoragePolicyRule[];

  /** Policy enforcement */
  enforcement: PolicyEnforcement;
}

export type StoragePolicyType = 'Retention' | 'Compression' | 'Encryption' | 'Access' | 'Backup';

/**
 * Storage policy rule.
 */
export interface StoragePolicyRule {
  /** Rule condition */
  condition: string;

  /** Rule action */
  action: StoragePolicyAction;

  /** Rule parameters */
  parameters: Map<string, any>;
}

export type StoragePolicyAction = 'Retain' | 'Delete' | 'Archive' | 'Compress' | 'Encrypt';

/**
 * Compression configuration.
 */
export interface CompressionConfiguration {
  /** Compression algorithm */
  algorithm: CompressionAlgorithm;

  /** Compression level */
  level: CompressionLevel;

  /** Compression threshold */
  threshold: number;

  /** Compression validation */
  validation: boolean;
}

export type CompressionAlgorithm = 'gzip' | 'brotli' | 'lz4' | 'zstd' | 'snappy';
export type CompressionLevel = 'Fastest' | 'Fast' | 'Default' | 'Best' | 'Maximum';

/**
 * Encryption configuration.
 */
export interface EncryptionConfiguration {
  /** Encryption algorithm */
  algorithm: EncryptionAlgorithm;

  /** Key management */
  keyManagement: KeyManagementConfiguration;

  /** Encryption scope */
  scope: EncryptionScope;

  /** Performance optimization */
  performanceOptimization: boolean;
}

export type EncryptionAlgorithm = 'AES256' | 'ChaCha20' | 'AES128' | 'Blowfish';
export type EncryptionScope = 'Full' | 'Sensitive' | 'Metadata' | 'None';

/**
 * Key management configuration.
 */
export interface KeyManagementConfiguration {
  /** Key provider */
  keyProvider: KeyProvider;

  /** Key rotation */
  keyRotation: KeyRotationConfiguration;

  /** Key storage */
  keyStorage: KeyStorageConfiguration;
}

export type KeyProvider = 'Internal' | 'External' | 'HSM' | 'KMS' | 'Manual';

/**
 * Key rotation configuration.
 */
export interface KeyRotationConfiguration {
  /** Enable automatic rotation */
  automaticRotation: boolean;

  /** Rotation interval (days) */
  rotationInterval: number;

  /** Rotation trigger */
  rotationTrigger: RotationTrigger[];
}

/**
 * Key rotation trigger.
 */
export interface RotationTrigger {
  /** Trigger type */
  triggerType: RotationTriggerType;

  /** Trigger condition */
  condition: string;

  /** Trigger priority */
  priority: TriggerPriority;
}

export type RotationTriggerType = 'Time' | 'Usage' | 'Security' | 'Manual';
export type TriggerPriority = 'Low' | 'Medium' | 'High' | 'Emergency';

/**
 * Key storage configuration.
 */
export interface KeyStorageConfiguration {
  /** Storage type */
  storageType: KeyStorageType;

  /** Storage location */
  storageLocation: string;

  /** Access control */
  accessControl: KeyAccessControl;
}

export type KeyStorageType = 'File' | 'HSM' | 'KMS' | 'Database' | 'Memory';

/**
 * Key access control.
 */
export interface KeyAccessControl {
  /** Access restrictions */
  restrictions: KeyAccessRestriction[];

  /** Audit key access */
  auditAccess: boolean;

  /** Key usage tracking */
  usageTracking: boolean;
}

/**
 * Key access restriction.
 */
export interface KeyAccessRestriction {
  /** Restriction type */
  restrictionType: KeyRestrictionType;

  /** Restriction value */
  value: string;

  /** Enforcement level */
  enforcement: RestrictionEnforcement;
}

export type KeyRestrictionType = 'User' | 'Role' | 'Time' | 'Location' | 'Usage';
export type RestrictionEnforcement = 'Advisory' | 'Warning' | 'Block';

/**
 * Storage performance settings.
 */
export interface StoragePerformanceSettings {
  /** Batch size for writes */
  batchSize: number;

  /** Flush interval */
  flushInterval: number;

  /** Buffer size */
  bufferSize: number;

  /** Parallel operations */
  parallelOperations: number;

  /** Performance monitoring */
  performanceMonitoring: boolean;
}

/**
 * Storage reliability settings.
 */
export interface StorageReliabilitySettings {
  /** Replication factor */
  replicationFactor: number;

  /** Consistency level */
  consistencyLevel: ConsistencyLevel;

  /** Failure handling */
  failureHandling: FailureHandlingStrategy;

  /** Health checking */
  healthChecking: HealthCheckConfiguration;
}

export type ConsistencyLevel = 'Eventual' | 'Strong' | 'Weak' | 'Session';
export type FailureHandlingStrategy = 'FailFast' | 'Retry' | 'Fallback' | 'Ignore';

/**
 * Health check configuration.
 */
export interface HealthCheckConfiguration {
  /** Health check interval */
  interval: number;

  /** Health check timeout */
  timeout: number;

  /** Health check retries */
  retries: number;

  /** Health check query */
  query: string;
}

/**
 * Analysis configuration.
 */
export interface AnalysisConfiguration {
  /** Real-time analysis */
  realTimeAnalysis: RealTimeAnalysisConfiguration;

  /** Batch analysis */
  batchAnalysis: BatchAnalysisConfiguration;

  /** Trend analysis */
  trendAnalysis: TrendAnalysisConfiguration;

  /** Prediction models */
  predictionModels: PredictionModelConfiguration[];
}

/**
 * Real-time analysis configuration.
 */
export interface RealTimeAnalysisConfiguration {
  /** Enable real-time analysis */
  enabled: boolean;

  /** Analysis window size */
  windowSize: number;

  /** Analysis frequency */
  frequency: number;

  /** Alert thresholds */
  alertThresholds: RealTimeThreshold[];
}

/**
 * Real-time analysis threshold.
 */
export interface RealTimeThreshold {
  /** Threshold name */
  name: string;

  /** Threshold value */
  value: number;

  /** Threshold action */
  action: string;
}

/**
 * Batch analysis configuration.
 */
export interface BatchAnalysisConfiguration {
  /** Batch size */
  batchSize: number;

  /** Batch frequency */
  frequency: number;

  /** Parallel processing */
  parallelProcessing: boolean;

  /** Resource limits */
  resourceLimits: BatchResourceLimits;
}

/**
 * Batch resource limits.
 */
export interface BatchResourceLimits {
  /** Memory limit */
  memoryLimit: number;

  /** CPU limit */
  cpuLimit: number;

  /** Time limit */
  timeLimit: number;
}

/**
 * Trend analysis configuration.
 */
export interface TrendAnalysisConfiguration {
  /** Analysis algorithms */
  algorithms: TrendAnalysisAlgorithm[];

  /** Analysis window */
  analysisWindow: number;

  /** Prediction horizon */
  predictionHorizon: number;

  /** Confidence threshold */
  confidenceThreshold: number;
}

export type TrendAnalysisAlgorithm =
  | 'Linear'
  | 'Polynomial'
  | 'Exponential'
  | 'ARIMA'
  | 'MachineLearning';

/**
 * Prediction model configuration.
 */
export interface PredictionModelConfiguration {
  /** Model name */
  modelName: string;

  /** Model type */
  modelType: PredictionModelType;

  /** Model parameters */
  parameters: Map<string, any>;

  /** Training configuration */
  training: ModelTrainingConfiguration;
}

export type PredictionModelType = 'Linear' | 'Neural' | 'RandomForest' | 'SVM' | 'Ensemble';

/**
 * Model training configuration.
 */
export interface ModelTrainingConfiguration {
  /** Training data size */
  trainingDataSize: number;

  /** Training frequency */
  trainingFrequency: number;

  /** Validation split */
  validationSplit: number;

  /** Early stopping */
  earlyStopping: boolean;
}

// ============================================================================
// MANAGEMENT TYPES
// ============================================================================

export type MetricsResetScope = 'All' | 'Pattern' | 'Category' | 'Platform' | 'Session';

export interface MetricsResetResult {
  success: boolean;
  resetScope: MetricsResetScope;
  itemsReset: number;
  resetTime: number;
  warnings: string[];
}

export interface MetricsCollectorStatus {
  status: CollectorStatus;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  lastActivity: Date;
}

export type CollectorStatus = 'Running' | 'Stopped' | 'Error' | 'Degraded' | 'Maintenance';

export interface MetricsIntegrityValidation {
  validationPassed: boolean;
  issuesFound: IntegrityIssue[];
  validationTime: number;
  confidence: number;
}

export interface IntegrityIssue {
  issueType: IntegrityIssueType;
  description: string;
  severity: IntegrityIssueSeverity;
  autoFixAvailable: boolean;
}

export type IntegrityIssueType =
  | 'MissingData'
  | 'CorruptedData'
  | 'InconsistentData'
  | 'DuplicateData';
export type IntegrityIssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

// ============================================================================
// EXPORTS AND SUMMARY
// ============================================================================

/**
 * Summary of Metrics Configuration Types:
 *
 * This comprehensive configuration system provides professional-grade
 * control over all aspects of metrics collection, storage, and analysis.
 *
 * Key Configuration Areas:
 * 1. Collection: Frequency, sampling, and data capture settings
 * 2. Storage: Backend, security, and reliability configurations
 * 3. Analysis: Real-time, batch, and predictive analysis settings
 * 4. Alerting: Comprehensive alerting and escalation systems
 * 5. Security: Authentication, encryption, and access control
 * 6. Performance: Optimization and resource management settings
 *
 * This modular configuration system enables the optimization metrics
 * system to be adapted for diverse deployment scenarios while
 * maintaining professional-grade capabilities and performance.
 */
