/**
 * Metrics Reporting Types - Reporting, Export, and Visualization Types
 * Task 1.11: Core Optimization Pattern Infrastructure
 *
 * This file defines all types related to metrics reporting, data export,
 * and visualization. It provides comprehensive type definitions for
 * professional-grade reporting and data integration capabilities.
 *
 * Educational Focus:
 * - Performance reporting and visualization techniques
 * - Data export and integration with external tools
 * - Executive and technical reporting formats
 * - Benchmark comparison and competitive analysis
 */

// ============================================================================
// CORE REPORTING TYPES
// ============================================================================

export type PerformanceReportType = 'Summary' | 'Detailed' | 'Executive' | 'Technical' | 'Trend';

/**
 * Performance report configuration.
 */
export interface PerformanceReportConfiguration {
  /** Report type */
  reportType: PerformanceReportType;

  /** Report time window */
  timeWindow: MetricsTimeWindow;

  /** Included metrics */
  includedMetrics: string[];

  /** Report detail level */
  detailLevel: ReportDetailLevel;

  /** Report format */
  format: ReportFormat;

  /** Visualization preferences */
  visualizations: VisualizationPreference[];

  /** Report customizations */
  customizations: ReportCustomization[];
}

export type ReportDetailLevel = 'High' | 'Medium' | 'Low' | 'Summary';
export type ReportFormat = 'HTML' | 'PDF' | 'JSON' | 'CSV' | 'Excel' | 'PowerPoint';

/**
 * Time window for reporting.
 */
export interface MetricsTimeWindow {
  /** Window start time */
  startTime: Date;

  /** Window end time */
  endTime: Date;

  /** Window duration */
  duration: number;

  /** Time granularity */
  granularity: TimeGranularity;
}

export type TimeGranularity = 'Second' | 'Minute' | 'Hour' | 'Day' | 'Week' | 'Month';

/**
 * Visualization preference.
 */
export interface VisualizationPreference {
  /** Visualization type */
  visualizationType: VisualizationType;

  /** Data series */
  dataSeries: DataSeries[];

  /** Visualization style */
  style: VisualizationStyle;

  /** Interactive features */
  interactiveFeatures: InteractiveFeature[];
}

export type VisualizationType =
  | 'LineChart'
  | 'BarChart'
  | 'ScatterPlot'
  | 'Heatmap'
  | 'Dashboard'
  | 'Table';

/**
 * Data series for visualization.
 */
export interface DataSeries {
  /** Series name */
  seriesName: string;

  /** Series data source */
  dataSource: string;

  /** Series color */
  color: string;

  /** Series style */
  style: SeriesStyle;

  /** Series aggregation */
  aggregation: SeriesAggregation;
}

export type SeriesStyle = 'Line' | 'Bar' | 'Area' | 'Scatter' | 'Step';
export type SeriesAggregation = 'Sum' | 'Average' | 'Max' | 'Min' | 'Count' | 'None';

/**
 * Visualization style.
 */
export interface VisualizationStyle {
  /** Theme */
  theme: VisualizationTheme;

  /** Color palette */
  colorPalette: ColorPalette;

  /** Layout preferences */
  layout: LayoutPreferences;

  /** Typography settings */
  typography: TypographySettings;
}

export type VisualizationTheme = 'Light' | 'Dark' | 'Professional' | 'Modern' | 'Classic';
export type ColorPalette = 'Default' | 'Vibrant' | 'Muted' | 'Monochrome' | 'Custom';

/**
 * Layout preferences.
 */
export interface LayoutPreferences {
  /** Chart orientation */
  orientation: ChartOrientation;

  /** Legend position */
  legendPosition: LegendPosition;

  /** Title position */
  titlePosition: TitlePosition;

  /** Margins */
  margins: ChartMargins;
}

export type ChartOrientation = 'Horizontal' | 'Vertical' | 'Auto';
export type LegendPosition = 'Top' | 'Bottom' | 'Left' | 'Right' | 'None';
export type TitlePosition = 'Top' | 'Bottom' | 'Center' | 'None';

/**
 * Chart margins.
 */
export interface ChartMargins {
  /** Top margin */
  top: number;

  /** Bottom margin */
  bottom: number;

  /** Left margin */
  left: number;

  /** Right margin */
  right: number;
}

/**
 * Typography settings.
 */
export interface TypographySettings {
  /** Font family */
  fontFamily: string;

  /** Font sizes */
  fontSizes: FontSizes;

  /** Font weights */
  fontWeights: FontWeights;

  /** Text colors */
  textColors: TextColors;
}

/**
 * Font sizes.
 */
export interface FontSizes {
  /** Title font size */
  title: number;

  /** Header font size */
  header: number;

  /** Body font size */
  body: number;

  /** Caption font size */
  caption: number;
}

/**
 * Font weights.
 */
export interface FontWeights {
  /** Normal weight */
  normal: number;

  /** Bold weight */
  bold: number;

  /** Light weight */
  light: number;
}

/**
 * Text colors.
 */
export interface TextColors {
  /** Primary text color */
  primary: string;

  /** Secondary text color */
  secondary: string;

  /** Accent text color */
  accent: string;

  /** Error text color */
  error: string;
}

/**
 * Interactive feature.
 */
export interface InteractiveFeature {
  /** Feature type */
  featureType: InteractiveFeatureType;

  /** Feature configuration */
  configuration: InteractiveFeatureConfiguration;

  /** Feature priority */
  priority: FeaturePriority;
}

export type InteractiveFeatureType =
  | 'Zoom'
  | 'Pan'
  | 'Tooltip'
  | 'Drill Down'
  | 'Filter'
  | 'Export';
export type FeaturePriority = 'Low' | 'Medium' | 'High' | 'Essential';

/**
 * Interactive feature configuration.
 */
export interface InteractiveFeatureConfiguration {
  /** Feature parameters */
  parameters: Map<string, any>;

  /** Feature behavior */
  behavior: FeatureBehavior;

  /** Feature styling */
  styling: FeatureStyling;
}

/**
 * Feature behavior.
 */
export interface FeatureBehavior {
  /** Trigger event */
  triggerEvent: TriggerEventType;

  /** Response action */
  responseAction: ResponseActionType;

  /** Animation enabled */
  animationEnabled: boolean;

  /** Persistence */
  persistence: FeaturePersistence;
}

export type TriggerEventType = 'Click' | 'Hover' | 'DoubleClick' | 'RightClick' | 'KeyPress';
export type ResponseActionType = 'Show' | 'Hide' | 'Navigate' | 'Filter' | 'Expand' | 'Collapse';
export type FeaturePersistence = 'None' | 'Session' | 'Local' | 'Remote';

/**
 * Feature styling.
 */
export interface FeatureStyling {
  /** Visual style */
  visualStyle: VisualStyle;

  /** Color scheme */
  colorScheme: ColorScheme;

  /** Animation settings */
  animation: AnimationSettings;
}

export type VisualStyle = 'Minimal' | 'Standard' | 'Rich' | 'Custom';
export type ColorScheme = 'Primary' | 'Secondary' | 'Accent' | 'Neutral';

/**
 * Animation settings.
 */
export interface AnimationSettings {
  /** Animation duration */
  duration: number;

  /** Animation easing */
  easing: AnimationEasing;

  /** Animation delay */
  delay: number;

  /** Animation repeat */
  repeat: AnimationRepeat;
}

export type AnimationEasing = 'Linear' | 'EaseIn' | 'EaseOut' | 'EaseInOut' | 'Bounce';
export type AnimationRepeat = 'None' | 'Once' | 'Loop' | 'Alternate';

/**
 * Report customization.
 */
export interface ReportCustomization {
  /** Customization type */
  customizationType: ReportCustomizationType;

  /** Customization parameters */
  parameters: Map<string, any>;

  /** Customization priority */
  priority: CustomizationPriority;

  /** Customization scope */
  scope: CustomizationScope;
}

export type ReportCustomizationType =
  | 'Branding'
  | 'Layout'
  | 'Content'
  | 'Styling'
  | 'Functionality';
export type CustomizationPriority = 'Low' | 'Medium' | 'High' | 'Required';
export type CustomizationScope = 'Global' | 'Report' | 'Section' | 'Component';

// ============================================================================
// PERFORMANCE REPORT TYPES
// ============================================================================

/**
 * Performance report.
 */
export interface PerformanceReport {
  /** Report identifier */
  reportId: string;

  /** Generation timestamp */
  generatedAt: Date;

  /** Report type */
  reportType: PerformanceReportType;

  /** Executive summary */
  executiveSummary: ExecutiveSummary;

  /** Detailed analysis */
  detailedAnalysis: DetailedAnalysis;

  /** Report recommendations */
  recommendations: ReportRecommendation[];

  /** Report appendices */
  appendices: ReportAppendix[];

  /** Report metadata */
  metadata: ReportMetadata;
}

/**
 * Executive summary.
 */
export interface ExecutiveSummary {
  /** Key findings */
  keyFindings: string[];

  /** Performance highlights */
  performanceHighlights: PerformanceHighlight[];

  /** Executive recommendations */
  recommendations: ExecutiveRecommendation[];

  /** Risk assessment */
  riskAssessment: ExecutiveRiskAssessment;
}

/**
 * Performance highlight.
 */
export interface PerformanceHighlight {
  /** Highlight description */
  highlight: string;

  /** Highlight impact */
  impact: HighlightImpact;

  /** Supporting evidence */
  evidence: string[];
}

export type HighlightImpact = 'Positive' | 'Neutral' | 'Negative' | 'Mixed';

/**
 * Executive recommendation.
 */
export interface ExecutiveRecommendation {
  /** Recommendation summary */
  recommendation: string;

  /** Business priority */
  priority: ExecutivePriority;

  /** Expected return on investment */
  expectedROI: number;

  /** Implementation timeline */
  timeline: ExecutiveTimeline;
}

export type ExecutivePriority = 'Low' | 'Medium' | 'High' | 'Strategic';
export type ExecutiveTimeline = 'Immediate' | 'Quarter' | 'HalfYear' | 'Year';

/**
 * Executive risk assessment.
 */
export interface ExecutiveRiskAssessment {
  /** Overall risk level */
  overallRisk: RiskLevel;

  /** Key risks */
  keyRisks: ExecutiveRisk[];

  /** Mitigation status */
  mitigationStatus: MitigationStatus;
}

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Executive risk.
 */
export interface ExecutiveRisk {
  /** Risk description */
  riskDescription: string;

  /** Business impact */
  impact: RiskImpact;

  /** Risk probability */
  probability: number;

  /** Mitigation approach */
  mitigation: string;
}

export type RiskImpact = 'Low' | 'Medium' | 'High' | 'Critical';
export type MitigationStatus = 'None' | 'Planned' | 'InProgress' | 'Complete';

/**
 * Detailed analysis.
 */
export interface DetailedAnalysis {
  /** Performance analysis */
  performanceAnalysis: DetailedPerformanceAnalysis;

  /** Trend analysis */
  trendAnalysis: DetailedTrendAnalysis;

  /** Bottleneck analysis */
  bottleneckAnalysis: DetailedBottleneckAnalysis;

  /** Efficiency analysis */
  efficiencyAnalysis: DetailedEfficiencyAnalysis;
}

/**
 * Detailed performance analysis.
 */
export interface DetailedPerformanceAnalysis {
  /** Overall performance */
  overallPerformance: PerformanceMetricSummary[];

  /** Component performance */
  componentPerformance: ComponentPerformanceDetail[];

  /** Performance correlations */
  performanceCorrelations: PerformanceCorrelation[];
}

/**
 * Performance metric summary.
 */
export interface PerformanceMetricSummary {
  /** Metric name */
  metricName: string;

  /** Current value */
  currentValue: number;

  /** Target value */
  targetValue: number;

  /** Metric trend */
  trend: MetricTrend;

  /** Achievement level */
  achievement: AchievementLevel;
}

/**
 * Metric trend.
 */
export interface MetricTrend {
  /** Trend direction */
  direction: TrendDirection;

  /** Trend velocity */
  velocity: number;

  /** Trend stability */
  stability: TrendStability;

  /** Trend projection */
  projection: MetricProjection;
}

export type TrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Volatile';
export type TrendStability = 'Stable' | 'Variable' | 'Volatile' | 'Chaotic';

/**
 * Metric projection.
 */
export interface MetricProjection {
  /** Next week projection */
  nextWeek: number;

  /** Next month projection */
  nextMonth: number;

  /** Next quarter projection */
  nextQuarter: number;

  /** Projection confidence */
  confidence: number;
}

export type AchievementLevel = 'Exceeded' | 'Met' | 'Close' | 'Missed' | 'Failed';

/**
 * Component performance detail.
 */
export interface ComponentPerformanceDetail {
  /** Component name */
  componentName: string;

  /** Performance score */
  performanceScore: number;

  /** Key metrics */
  keyMetrics: ComponentMetric[];

  /** Component issues */
  issues: ComponentIssue[];
}

/**
 * Component metric.
 */
export interface ComponentMetric {
  /** Metric name */
  metricName: string;

  /** Metric value */
  value: number;

  /** Metric status */
  status: MetricStatus;

  /** Metric trend */
  trend: ComponentMetricTrend;
}

export type MetricStatus = 'Excellent' | 'Good' | 'Acceptable' | 'Poor' | 'Critical';

/**
 * Component metric trend.
 */
export interface ComponentMetricTrend {
  /** Trend direction */
  direction: TrendDirection;

  /** Trend significance */
  significance: TrendSignificance;

  /** Trend predictability */
  predictability: TrendPredictability;
}

export type TrendSignificance = 'Low' | 'Medium' | 'High' | 'VeryHigh';
export type TrendPredictability = 'Predictable' | 'SomewhatPredictable' | 'Unpredictable';

/**
 * Component issue.
 */
export interface ComponentIssue {
  /** Issue type */
  issueType: string;

  /** Issue severity */
  severity: IssueSeverity;

  /** Issue description */
  description: string;

  /** Issue impact */
  impact: IssueImpact;
}

export type IssueSeverity = 'Minor' | 'Moderate' | 'Major' | 'Critical';
export type IssueImpact = 'Local' | 'Component' | 'System' | 'Global';

/**
 * Performance correlation.
 */
export interface PerformanceCorrelation {
  /** First metric */
  metric1: string;

  /** Second metric */
  metric2: string;

  /** Correlation coefficient */
  correlation: number;

  /** Correlation significance */
  significance: CorrelationSignificance;

  /** Causality assessment */
  causality: CausalityAssessment;
}

export type CorrelationSignificance = 'Weak' | 'Moderate' | 'Strong' | 'VeryStrong';

/**
 * Causality assessment.
 */
export interface CausalityAssessment {
  /** Causality likelihood */
  causalityLikelihood: CausalityLikelihood;

  /** Causal direction */
  causalDirection: CausalDirection;

  /** Evidence strength */
  evidenceStrength: EvidenceStrength;

  /** Confounding factors */
  confoundingFactors: string[];
}

export type CausalityLikelihood =
  | 'VeryLikely'
  | 'Likely'
  | 'Possible'
  | 'Unlikely'
  | 'VeryUnlikely';
export type CausalDirection = 'Forward' | 'Reverse' | 'Bidirectional' | 'None';
export type EvidenceStrength = 'Weak' | 'Moderate' | 'Strong' | 'VeryStrong';

/**
 * Detailed trend analysis.
 */
export interface DetailedTrendAnalysis {
  /** Trend overview */
  trendOverview: TrendOverview;

  /** Trend decomposition */
  trendDecomposition: TrendDecomposition;

  /** Seasonality analysis */
  seasonalityAnalysis: SeasonalityAnalysis;

  /** Forecast accuracy */
  forecastAccuracy: ForecastAccuracy;
}

/**
 * Trend overview.
 */
export interface TrendOverview {
  /** Primary trends */
  primaryTrends: PrimaryTrend[];

  /** Trend interactions */
  trendInteractions: TrendInteraction[];

  /** Trend drivers */
  trendDrivers: TrendDriver[];

  /** Trend risks */
  trendRisks: TrendRisk[];
}

/**
 * Primary trend.
 */
export interface PrimaryTrend {
  /** Trend name */
  trendName: string;

  /** Trend direction */
  direction: TrendDirection;

  /** Trend strength */
  strength: TrendStrength;

  /** Trend duration */
  duration: TrendDuration;

  /** Trend impact */
  impact: TrendImpact;
}

export type TrendStrength = 'Weak' | 'Moderate' | 'Strong' | 'VeryStrong';
export type TrendDuration = 'Short' | 'Medium' | 'Long' | 'Permanent';
export type TrendImpact = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Trend interaction.
 */
export interface TrendInteraction {
  /** First trend */
  trend1: string;

  /** Second trend */
  trend2: string;

  /** Interaction type */
  interactionType: InteractionType;

  /** Interaction strength */
  interactionStrength: number;
}

export type InteractionType = 'Reinforcing' | 'Opposing' | 'Independent' | 'Conditional';

/**
 * Trend driver.
 */
export interface TrendDriver {
  /** Driver name */
  driverName: string;

  /** Driver influence */
  influence: DriverInfluence;

  /** Driver controllability */
  controllability: DriverControllability;

  /** Driver predictability */
  predictability: DriverPredictability;
}

export type DriverInfluence = 'Minor' | 'Moderate' | 'Major' | 'Dominant';
export type DriverControllability = 'Uncontrollable' | 'Limited' | 'Moderate' | 'High';
export type DriverPredictability =
  | 'Unpredictable'
  | 'SomewhatPredictable'
  | 'Predictable'
  | 'HighlyPredictable';

/**
 * Trend risk.
 */
export interface TrendRisk {
  /** Risk description */
  riskDescription: string;

  /** Risk probability */
  probability: number;

  /** Risk impact */
  impact: TrendRiskImpact;

  /** Risk mitigation */
  mitigation: TrendRiskMitigation;
}

export type TrendRiskImpact = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Trend risk mitigation.
 */
export interface TrendRiskMitigation {
  /** Mitigation strategy */
  strategy: string;

  /** Mitigation effectiveness */
  effectiveness: number;

  /** Mitigation cost */
  cost: MitigationCost;

  /** Mitigation timeline */
  timeline: MitigationTimeline;
}

export type MitigationCost = 'Low' | 'Medium' | 'High' | 'VeryHigh';
export type MitigationTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long';

/**
 * Trend decomposition.
 */
export interface TrendDecomposition {
  /** Baseline component */
  baselineComponent: number;

  /** Trend component */
  trendComponent: number;

  /** Seasonal component */
  seasonalComponent: number;

  /** Noise component */
  noiseComponent: number;

  /** Decomposition quality */
  decompositionQuality: DecompositionQuality;
}

export type DecompositionQuality = 'Poor' | 'Fair' | 'Good' | 'Excellent';

/**
 * Seasonality analysis.
 */
export interface SeasonalityAnalysis {
  /** Seasonality detected */
  seasonalityDetected: boolean;

  /** Seasonal periods */
  seasonalPeriods: SeasonalPeriod[];

  /** Seasonal strength */
  seasonalStrength: SeasonalStrength;

  /** Seasonal patterns */
  seasonalPatterns: SeasonalPattern[];
}

/**
 * Seasonal period.
 */
export interface SeasonalPeriod {
  /** Period length */
  period: number;

  /** Period strength */
  strength: number;

  /** Period confidence */
  confidence: number;

  /** Period description */
  description: string;
}

export type SeasonalStrength = 'None' | 'Weak' | 'Moderate' | 'Strong' | 'VeryStrong';

/**
 * Seasonal pattern.
 */
export interface SeasonalPattern {
  /** Pattern name */
  patternName: string;

  /** Pattern type */
  patternType: SeasonalPatternType;

  /** Pattern characteristics */
  characteristics: PatternCharacteristics;

  /** Pattern reliability */
  reliability: PatternReliability;
}

export type SeasonalPatternType = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
export type PatternReliability = 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Pattern characteristics.
 */
export interface PatternCharacteristics {
  /** Pattern amplitude */
  amplitude: number;

  /** Pattern phase */
  phase: number;

  /** Pattern regularity */
  regularity: PatternRegularity;

  /** Pattern stability */
  stability: PatternStability;
}

export type PatternRegularity = 'Irregular' | 'SomewhatRegular' | 'Regular' | 'VeryRegular';
export type PatternStability = 'Unstable' | 'SomewhatStable' | 'Stable' | 'VeryStable';

/**
 * Forecast accuracy.
 */
export interface ForecastAccuracy {
  /** Overall accuracy */
  overallAccuracy: number;

  /** Accuracy by horizon */
  accuracyByHorizon: Map<string, number>;

  /** Accuracy trends */
  accuracyTrends: AccuracyTrend[];

  /** Accuracy factors */
  accuracyFactors: AccuracyFactor[];
}

/**
 * Accuracy trend.
 */
export interface AccuracyTrend {
  /** Trend metric */
  metric: string;

  /** Accuracy trend */
  trend: AccuracyTrendDirection;

  /** Trend confidence */
  confidence: number;
}

export type AccuracyTrendDirection = 'Improving' | 'Stable' | 'Degrading';

/**
 * Accuracy factor.
 */
export interface AccuracyFactor {
  /** Factor name */
  factorName: string;

  /** Factor impact */
  impact: AccuracyFactorImpact;

  /** Factor predictability */
  predictability: FactorPredictability;
}

export type AccuracyFactorImpact = 'Negligible' | 'Minor' | 'Moderate' | 'Major';
export type FactorPredictability = 'Predictable' | 'SomewhatPredictable' | 'Unpredictable';

/**
 * Detailed bottleneck analysis.
 */
export interface DetailedBottleneckAnalysis {
  /** Bottleneck identification */
  bottleneckIdentification: BottleneckIdentification;

  /** Bottleneck impact assessment */
  impactAssessment: BottleneckImpactAssessment;

  /** Bottleneck resolution strategies */
  resolutionStrategies: BottleneckResolutionStrategy[];

  /** Implementation priorities */
  implementationPriorities: BottleneckPriority[];
}

/**
 * Bottleneck identification.
 */
export interface BottleneckIdentification {
  /** Identified bottlenecks */
  identifiedBottlenecks: IdentifiedBottleneck[];

  /** Detection methodology */
  detectionMethodology: DetectionMethodology;

  /** Detection confidence */
  detectionConfidence: number;

  /** Detection validation */
  detectionValidation: DetectionValidation;
}

/**
 * Identified bottleneck.
 */
export interface IdentifiedBottleneck {
  /** Bottleneck name */
  bottleneckName: string;

  /** Bottleneck location */
  location: BottleneckLocation;

  /** Bottleneck severity */
  severity: BottleneckSeverity;

  /** Bottleneck characteristics */
  characteristics: BottleneckCharacteristics;
}

/**
 * Bottleneck location.
 */
export interface BottleneckLocation {
  /** Component name */
  componentName: string;

  /** Function name */
  functionName?: string;

  /** Code location */
  codeLocation?: string;

  /** System layer */
  systemLayer: SystemLayer;
}

export type SystemLayer = 'Application' | 'Framework' | 'Runtime' | 'OS' | 'Hardware';
export type BottleneckSeverity = 'Minor' | 'Moderate' | 'Major' | 'Critical' | 'Blocking';

/**
 * Bottleneck characteristics.
 */
export interface BottleneckCharacteristics {
  /** Resource type */
  resourceType: BottleneckResourceType;

  /** Utilization pattern */
  utilizationPattern: UtilizationPattern;

  /** Scalability impact */
  scalabilityImpact: ScalabilityImpact;

  /** Optimization potential */
  optimizationPotential: OptimizationPotential;
}

export type BottleneckResourceType = 'CPU' | 'Memory' | 'IO' | 'Network' | 'Algorithm';
export type UtilizationPattern = 'Constant' | 'Bursty' | 'Cyclic' | 'Random';
export type ScalabilityImpact = 'None' | 'Linear' | 'Quadratic' | 'Exponential';
export type OptimizationPotential = 'None' | 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Detection methodology.
 */
export interface DetectionMethodology {
  /** Detection approach */
  approach: DetectionApproach;

  /** Analysis techniques */
  techniques: AnalysisTechnique[];

  /** Validation methods */
  validationMethods: ValidationMethodology[];
}

export type DetectionApproach = 'Statistical' | 'MachineLearning' | 'Heuristic' | 'Hybrid';
export type AnalysisTechnique = 'Profiling' | 'Sampling' | 'Tracing' | 'Monitoring';
export type ValidationMethodology = 'CrossValidation' | 'Benchmarking' | 'Simulation' | 'RealWorld';

/**
 * Detection validation.
 */
export interface DetectionValidation {
  /** Validation result */
  validationResult: ValidationResult;

  /** Validation confidence */
  confidence: number;

  /** Validation issues */
  issues: ValidationIssue[];
}

export type ValidationResult = 'Passed' | 'PassedWithWarnings' | 'Failed' | 'Inconclusive';

/**
 * Validation issue.
 */
export interface ValidationIssue {
  /** Issue description */
  description: string;

  /** Issue severity */
  severity: ValidationIssueSeverity;

  /** Issue impact */
  impact: ValidationIssueImpact;
}

export type ValidationIssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ValidationIssueImpact = 'Accuracy' | 'Reliability' | 'Completeness' | 'Validity';

/**
 * Bottleneck impact assessment.
 */
export interface BottleneckImpactAssessment {
  /** Performance impact */
  performanceImpact: PerformanceImpactMeasurement;

  /** User experience impact */
  userExperienceImpact: UserExperienceImpact;

  /** Business impact */
  businessImpact: BusinessImpact;

  /** Technical debt impact */
  technicalDebtImpact: TechnicalDebtImpact;
}

/**
 * Performance impact measurement.
 */
export interface PerformanceImpactMeasurement {
  /** Throughput impact */
  throughputImpact: number;

  /** Latency impact */
  latencyImpact: number;

  /** Resource utilization impact */
  resourceUtilizationImpact: number;

  /** Scalability impact */
  scalabilityImpact: number;
}

/**
 * User experience impact.
 */
export interface UserExperienceImpact {
  /** Responsiveness impact */
  responsivenessImpact: ResponsivenessImpact;

  /** Reliability impact */
  reliabilityImpact: ReliabilityImpact;

  /** Usability impact */
  usabilityImpact: UsabilityImpact;
}

export type ResponsivenessImpact = 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';

/**
 * Reliability impact.
 */
export type ReliabilityImpact = 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';

/**
 * Usability impact.
 */
export type UsabilityImpact = 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';

/**
 * Business impact.
 */
export interface BusinessImpact {
  /** Revenue impact */
  revenueImpact: number;

  /** Cost impact */
  costImpact: number;

  /** Customer satisfaction impact */
  customerSatisfactionImpact: number;

  /** Market position impact */
  marketPositionImpact: MarketPositionImpact;
}

export type MarketPositionImpact = 'Positive' | 'Neutral' | 'Negative' | 'Significant';

/**
 * Technical debt impact.
 */
export interface TechnicalDebtImpact {
  /** Debt increase */
  debtIncrease: number;

  /** Maintenance cost impact */
  maintenanceCostImpact: number;

  /** Development velocity impact */
  developmentVelocityImpact: number;

  /** Code quality impact */
  codeQualityImpact: CodeQualityImpactLevel;
}

export type CodeQualityImpactLevel =
  | 'Improved'
  | 'Unchanged'
  | 'Degraded'
  | 'Significantly_Degraded';

/**
 * Bottleneck resolution strategy.
 */
export interface BottleneckResolutionStrategy {
  /** Strategy name */
  strategyName: string;

  /** Strategy approach */
  approach: ResolutionApproach;

  /** Strategy effectiveness */
  effectiveness: number;

  /** Implementation complexity */
  complexity: ResolutionComplexity;

  /** Strategy timeline */
  timeline: StrategyTimeline;
}

export type ResolutionApproach =
  | 'Optimization'
  | 'Replacement'
  | 'Workaround'
  | 'Scaling'
  | 'Redesign';
export type ResolutionComplexity = 'Simple' | 'Moderate' | 'Complex' | 'VeryComplex';
export type StrategyTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long';

/**
 * Bottleneck priority.
 */
export interface BottleneckPriority {
  /** Priority level */
  priorityLevel: BottleneckPriorityLevel;

  /** Priority justification */
  justification: string;

  /** Priority factors */
  factors: PriorityFactor[];

  /** Priority timeline */
  timeline: PriorityTimeline;
}

export type BottleneckPriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'Emergency';
export type PriorityTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long' | 'Future';

/**
 * Priority factor.
 */
export interface PriorityFactor {
  /** Factor name */
  factorName: string;

  /** Factor weight */
  weight: number;

  /** Factor impact */
  impact: FactorImpact;
}

export type FactorImpact = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Detailed efficiency analysis.
 */
export interface DetailedEfficiencyAnalysis {
  /** Efficiency overview */
  efficiencyOverview: EfficiencyOverview;

  /** Resource efficiency */
  resourceEfficiency: ResourceEfficiencyAnalysis;

  /** Process efficiency */
  processEfficiency: ProcessEfficiencyAnalysis;

  /** Optimization opportunities */
  optimizationOpportunities: EfficiencyOptimizationOpportunity[];
}

/**
 * Efficiency overview.
 */
export interface EfficiencyOverview {
  /** Overall efficiency score */
  overallScore: number;

  /** Efficiency by component */
  componentEfficiency: Map<string, number>;

  /** Efficiency trends */
  trends: EfficiencyTrend[];

  /** Efficiency benchmarks */
  benchmarks: EfficiencyBenchmark[];
}

/**
 * Efficiency trend.
 */
export interface EfficiencyTrend {
  /** Trend component */
  component: string;

  /** Efficiency change */
  efficiencyChange: number;

  /** Trend direction */
  direction: EfficiencyTrendDirection;

  /** Trend confidence */
  confidence: number;
}

export type EfficiencyTrendDirection = 'Improving' | 'Stable' | 'Declining';

/**
 * Efficiency benchmark.
 */
export interface EfficiencyBenchmark {
  /** Benchmark name */
  benchmarkName: string;

  /** Benchmark value */
  benchmarkValue: number;

  /** Current performance */
  currentPerformance: number;

  /** Performance gap */
  performanceGap: number;
}

/**
 * Resource efficiency analysis.
 */
export interface ResourceEfficiencyAnalysis {
  /** Memory efficiency */
  memoryEfficiency: ResourceEfficiencyDetail;

  /** CPU efficiency */
  cpuEfficiency: ResourceEfficiencyDetail;

  /** I/O efficiency */
  ioEfficiency: ResourceEfficiencyDetail;

  /** Cache efficiency */
  cacheEfficiency: ResourceEfficiencyDetail;
}

/**
 * Resource efficiency detail.
 */
export interface ResourceEfficiencyDetail {
  /** Efficiency score */
  score: number;

  /** Utilization rate */
  utilizationRate: number;

  /** Waste percentage */
  wastePercentage: number;

  /** Improvement potential */
  improvementPotential: number;
}

/**
 * Process efficiency analysis.
 */
export interface ProcessEfficiencyAnalysis {
  /** Process steps efficiency */
  stepEfficiency: ProcessStepEfficiency[];

  /** Workflow efficiency */
  workflowEfficiency: WorkflowEfficiency;

  /** Automation level */
  automationLevel: AutomationLevel;

  /** Process bottlenecks */
  processBottlenecks: ProcessBottleneck[];
}

/**
 * Process step efficiency.
 */
export interface ProcessStepEfficiency {
  /** Step name */
  stepName: string;

  /** Step efficiency */
  efficiency: number;

  /** Step duration */
  duration: number;

  /** Step automation */
  automation: StepAutomation;
}

export type StepAutomation = 'Manual' | 'SemiAutomated' | 'Automated' | 'FullyAutomated';

/**
 * Workflow efficiency.
 */
export interface WorkflowEfficiency {
  /** End-to-end efficiency */
  endToEndEfficiency: number;

  /** Parallel execution rate */
  parallelExecutionRate: number;

  /** Idle time percentage */
  idleTimePercentage: number;

  /** Workflow optimization score */
  optimizationScore: number;
}

/**
 * Automation level.
 */
export interface AutomationLevel {
  /** Current automation percentage */
  currentAutomation: number;

  /** Target automation percentage */
  targetAutomation: number;

  /** Automation gap */
  automationGap: number;

  /** Automation readiness */
  automationReadiness: AutomationReadiness;
}

export type AutomationReadiness = 'NotReady' | 'Partially' | 'Ready' | 'FullyReady';

/**
 * Process bottleneck.
 */
export interface ProcessBottleneck {
  /** Bottleneck name */
  bottleneckName: string;

  /** Bottleneck type */
  bottleneckType: ProcessBottleneckType;

  /** Impact severity */
  severity: ProcessBottleneckSeverity;

  /** Resolution difficulty */
  resolutionDifficulty: ResolutionDifficulty;
}

export type ProcessBottleneckType = 'Capacity' | 'Quality' | 'Coordination' | 'Knowledge';
export type ProcessBottleneckSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ResolutionDifficulty = 'Easy' | 'Moderate' | 'Difficult' | 'VeryDifficult';

/**
 * Efficiency optimization opportunity.
 */
export interface EfficiencyOptimizationOpportunity {
  /** Opportunity name */
  opportunityName: string;

  /** Opportunity type */
  opportunityType: EfficiencyOpportunityType;

  /** Expected benefit */
  expectedBenefit: number;

  /** Implementation effort */
  implementationEffort: ImplementationEffort;

  /** Priority score */
  priorityScore: number;
}

export type EfficiencyOpportunityType = 'Automation' | 'Process' | 'Technology' | 'Training';
export type ImplementationEffort = 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Report recommendation.
 */
export interface ReportRecommendation {
  /** Recommendation ID */
  recommendationId: string;

  /** Recommendation title */
  title: string;

  /** Recommendation description */
  description: string;

  /** Priority level */
  priority: RecommendationPriority;

  /** Expected impact */
  expectedImpact: ExpectedImpact;

  /** Implementation timeline */
  timeline: RecommendationTimeline;
}

export type RecommendationPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type RecommendationTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long';

/**
 * Expected impact.
 */
export interface ExpectedImpact {
  /** Performance improvement */
  performanceImprovement: number;

  /** Cost reduction */
  costReduction: number;

  /** Quality improvement */
  qualityImprovement: number;

  /** Risk reduction */
  riskReduction: number;
}

/**
 * Report appendix.
 */
export interface ReportAppendix {
  /** Appendix ID */
  appendixId: string;

  /** Appendix title */
  title: string;

  /** Content type */
  contentType: AppendixContentType;

  /** Content */
  content: any;
}

export type AppendixContentType = 'Data' | 'Chart' | 'Table' | 'Text' | 'Code';

/**
 * Report metadata.
 */
export interface ReportMetadata {
  /** Report version */
  version: string;

  /** Generated by */
  generatedBy: string;

  /** Data sources */
  dataSources: string[];

  /** Report parameters */
  parameters: Map<string, any>;

  /** Quality indicators */
  qualityIndicators: QualityIndicator[];
}

/**
 * Quality indicator.
 */
export interface QualityIndicator {
  /** Indicator name */
  indicatorName: string;

  /** Indicator value */
  value: number;

  /** Quality threshold */
  threshold: number;

  /** Quality status */
  status: QualityStatus;
}

export type QualityStatus = 'Excellent' | 'Good' | 'Acceptable' | 'Poor' | 'Critical';
