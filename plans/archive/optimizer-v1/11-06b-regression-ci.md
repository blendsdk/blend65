# 11-06b: Regression Automation & CI

> **Document ID**: 11-06b-regression-ci
> **Phase**: 11 - Testing Framework
> **Task**: 11.6b - Regression automation & CI
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies CI/CD integration for automated regression testing, including GitHub Actions workflows, automated baseline updates, and notification systems.

### Goals

1. Automate regression testing in CI/CD
2. Run benchmarks on every PR
3. Automatically update baselines
4. Send notifications on regressions
5. Generate trend reports

---

## Type Definitions

```typescript
/**
 * CI runner configuration
 */
interface CIRunnerConfig {
  /** Run full benchmark suite */
  runFullBenchmarks: boolean;
  /** Run regression detection */
  runRegressionCheck: boolean;
  /** Update baseline on main branch */
  updateBaselineOnMain: boolean;
  /** Fail PR on regression */
  failOnRegression: boolean;
  /** Comment results on PR */
  commentOnPR: boolean;
  /** Send notifications */
  sendNotifications: boolean;
  /** Notification channels */
  notificationChannels: NotificationChannel[];
}

type NotificationChannel = 'github' | 'slack' | 'email' | 'webhook';

/**
 * CI run result
 */
interface CIRunResult {
  /** Run identifier */
  runId: string;
  /** Git commit */
  commit: string;
  /** Branch */
  branch: string;
  /** Pull request number (if applicable) */
  prNumber?: number;
  /** Test results summary */
  testSummary: TestSummary;
  /** Regression results */
  regressionResult: RegressionResult;
  /** Benchmark results */
  benchmarkResults?: BenchmarkSuiteResult;
  /** Overall status */
  status: CIStatus;
  /** Duration */
  duration: number;
  /** Artifacts */
  artifacts: CIArtifact[];
}

type CIStatus = 'success' | 'failure' | 'warning' | 'cancelled';

/**
 * CI artifact
 */
interface CIArtifact {
  name: string;
  path: string;
  type: 'report' | 'baseline' | 'log' | 'coverage';
}

/**
 * Test summary
 */
interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

/**
 * Trend data point
 */
interface TrendDataPoint {
  date: Date;
  commit: string;
  metrics: {
    avgCycleReduction: number;
    avgSizeReduction: number;
    compilationTime: number;
    testsPassing: number;
  };
}

/**
 * PR comment data
 */
interface PRCommentData {
  status: CIStatus;
  testSummary: TestSummary;
  regressions: Regression[];
  improvements: Improvement[];
  benchmarkSummary?: string;
}
```

---

## Implementation

### CI Runner

```typescript
/**
 * CI/CD integration runner
 */
export class CIRunner {
  protected config: CIRunnerConfig;
  protected regressionDetector: RegressionDetector;
  protected benchmarkRunner: MacroBenchmarkRunner;
  protected baselineManager: BaselineManager;
  
  constructor(config: CIRunnerConfig) {
    this.config = config;
    this.regressionDetector = new RegressionDetector({
      performanceThreshold: 10,
      sizeThreshold: 5,
      cycleThreshold: 5,
      failOnRegression: config.failOnRegression,
      minSampleSize: 3,
      confidenceLevel: 0.95
    });
    this.benchmarkRunner = new MacroBenchmarkRunner({
      iterations: 3,
      timeout: 60000,
      optimizationLevels: ['none', 'standard', 'aggressive'],
      collectDetailedMetrics: true,
      compareBaseline: true
    });
    this.baselineManager = new BaselineManager('./baselines');
  }
  
  /**
   * Run CI pipeline
   */
  async run(): Promise<CIRunResult> {
    const runId = this.generateRunId();
    const startTime = Date.now();
    const artifacts: CIArtifact[] = [];
    
    // Get git info
    const gitInfo = await this.getGitInfo();
    
    // Load baseline
    const baseline = await this.baselineManager.loadBaseline();
    if (baseline) {
      this.regressionDetector.loadBaseline(baseline);
    }
    
    // Run tests
    const testSummary = await this.runTests();
    
    // Run regression detection
    const testResults = await this.collectTestResults();
    const regressionResult = this.regressionDetector.detect(testResults, 'cycles');
    
    // Run benchmarks if configured
    let benchmarkResults: BenchmarkSuiteResult | undefined;
    if (this.config.runFullBenchmarks) {
      benchmarkResults = await this.benchmarkRunner.runSuite(BENCHMARK_PROGRAMS);
    }
    
    // Generate reports
    const reportPath = await this.generateReport(regressionResult, benchmarkResults);
    artifacts.push({ name: 'regression-report', path: reportPath, type: 'report' });
    
    // Update baseline if on main
    if (this.config.updateBaselineOnMain && gitInfo.branch === 'main') {
      await this.updateBaseline(testResults);
      artifacts.push({ name: 'baseline', path: './baselines/baseline-latest.json', type: 'baseline' });
    }
    
    // Determine status
    const status = this.determineStatus(testSummary, regressionResult);
    
    // Send notifications
    if (this.config.sendNotifications && status === 'failure') {
      await this.sendNotifications(regressionResult);
    }
    
    // Comment on PR
    if (this.config.commentOnPR && gitInfo.prNumber) {
      await this.commentOnPR(gitInfo.prNumber, {
        status,
        testSummary,
        regressions: regressionResult.regressions,
        improvements: regressionResult.improvements
      });
    }
    
    return {
      runId,
      commit: gitInfo.commit,
      branch: gitInfo.branch,
      prNumber: gitInfo.prNumber,
      testSummary,
      regressionResult,
      benchmarkResults,
      status,
      duration: Date.now() - startTime,
      artifacts
    };
  }
  
  /**
   * Run test suite
   */
  protected async runTests(): Promise<TestSummary> {
    const { execSync } = await import('child_process');
    const startTime = Date.now();
    
    try {
      execSync('yarn test --reporter json --outputFile test-results.json', {
        stdio: 'pipe'
      });
      
      const results = JSON.parse(
        (await import('fs/promises')).readFileSync('test-results.json', 'utf-8')
      );
      
      return {
        total: results.numTotalTests,
        passed: results.numPassedTests,
        failed: results.numFailedTests,
        skipped: results.numPendingTests,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Tests failed
      return {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Collect test results for regression detection
   */
  protected async collectTestResults(): Promise<Map<string, TestResult>> {
    // This would collect actual test metrics
    // Simplified for documentation
    const results = new Map<string, TestResult>();
    
    // Example: would read from benchmark output files
    const benchmarkOutput = await this.readBenchmarkOutput();
    for (const [id, value] of benchmarkOutput) {
      results.set(id, { value, samples: 3 });
    }
    
    return results;
  }
  
  /**
   * Read benchmark output
   */
  protected async readBenchmarkOutput(): Promise<Map<string, number>> {
    // Would read actual benchmark results
    return new Map();
  }
  
  /**
   * Generate report
   */
  protected async generateReport(
    regression: RegressionResult,
    benchmark?: BenchmarkSuiteResult
  ): Promise<string> {
    const report = new ReportGenerator();
    const html = report.generateHTML(regression, benchmark);
    
    const fs = await import('fs/promises');
    const path = './reports/regression-report.html';
    await fs.mkdir('./reports', { recursive: true });
    await fs.writeFile(path, html);
    
    return path;
  }
  
  /**
   * Update baseline
   */
  protected async updateBaseline(results: Map<string, TestResult>): Promise<void> {
    const resultsWithSamples = new Map<string, TestResult[]>();
    for (const [id, result] of results) {
      resultsWithSamples.set(id, [result]);
    }
    
    const gitInfo = await this.getGitInfo();
    const baseline = this.baselineManager.createBaseline(resultsWithSamples, {
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch,
      nodeVersion: process.version,
      platform: process.platform,
      optimizer: {
        version: '1.0.0',
        patterns: 100,
        passes: 10
      }
    });
    
    await this.baselineManager.saveBaseline(baseline);
  }
  
  /**
   * Determine CI status
   */
  protected determineStatus(
    tests: TestSummary,
    regression: RegressionResult
  ): CIStatus {
    if (tests.failed > 0) {
      return 'failure';
    }
    
    if (regression.status === 'fail') {
      return this.config.failOnRegression ? 'failure' : 'warning';
    }
    
    if (regression.status === 'warning') {
      return 'warning';
    }
    
    return 'success';
  }
  
  /**
   * Send notifications
   */
  protected async sendNotifications(regression: RegressionResult): Promise<void> {
    for (const channel of this.config.notificationChannels) {
      switch (channel) {
        case 'slack':
          await this.sendSlackNotification(regression);
          break;
        case 'email':
          await this.sendEmailNotification(regression);
          break;
        case 'webhook':
          await this.sendWebhookNotification(regression);
          break;
      }
    }
  }
  
  /**
   * Send Slack notification
   */
  protected async sendSlackNotification(regression: RegressionResult): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const message = {
      text: `🚨 Performance Regression Detected`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 Performance Regression Detected' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${regression.regressions.length} regressions* found in optimizer`
          }
        },
        {
          type: 'section',
          fields: regression.regressions.slice(0, 5).map(r => ({
            type: 'mrkdwn',
            text: `*${r.id}*\n${r.description}`
          }))
        }
      ]
    };
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
  
  /**
   * Send email notification
   */
  protected async sendEmailNotification(regression: RegressionResult): Promise<void> {
    // Would integrate with email service
    console.log('Email notification:', regression.summary);
  }
  
  /**
   * Send webhook notification
   */
  protected async sendWebhookNotification(regression: RegressionResult): Promise<void> {
    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'regression_detected',
        data: regression
      })
    });
  }
  
  /**
   * Comment on PR
   */
  protected async commentOnPR(prNumber: number, data: PRCommentData): Promise<void> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return;
    
    const body = this.formatPRComment(data);
    
    await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      }
    );
  }
  
  /**
   * Format PR comment
   */
  protected formatPRComment(data: PRCommentData): string {
    const statusEmoji = {
      success: '✅',
      failure: '❌',
      warning: '⚠️',
      cancelled: '🚫'
    };
    
    let comment = `## ${statusEmoji[data.status]} Optimizer Regression Check\n\n`;
    comment += `**Tests:** ${data.testSummary.passed}/${data.testSummary.total} passed\n\n`;
    
    if (data.regressions.length > 0) {
      comment += `### ❌ Regressions (${data.regressions.length})\n\n`;
      comment += '| Test | Change | Severity |\n';
      comment += '|------|--------|----------|\n';
      for (const r of data.regressions.slice(0, 10)) {
        comment += `| ${r.id} | ${r.changePercent.toFixed(1)}% | ${r.severity} |\n`;
      }
      comment += '\n';
    }
    
    if (data.improvements.length > 0) {
      comment += `### ✅ Improvements (${data.improvements.length})\n\n`;
      comment += '| Test | Improvement |\n';
      comment += '|------|-------------|\n';
      for (const i of data.improvements.slice(0, 5)) {
        comment += `| ${i.id} | ${i.improvementPercent.toFixed(1)}% |\n`;
      }
    }
    
    return comment;
  }
  
  /**
   * Get git info
   */
  protected async getGitInfo(): Promise<{
    commit: string;
    branch: string;
    prNumber?: number;
  }> {
    const { execSync } = await import('child_process');
    
    const commit = execSync('git rev-parse HEAD').toString().trim();
    const branch = process.env.GITHUB_REF_NAME || 
      execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const prNumber = process.env.GITHUB_PR_NUMBER 
      ? parseInt(process.env.GITHUB_PR_NUMBER) 
      : undefined;
    
    return { commit, branch, prNumber };
  }
  
  /**
   * Generate run ID
   */
  protected generateRunId(): string {
    return `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

### Report Generator

```typescript
/**
 * Generates HTML regression reports
 */
export class ReportGenerator {
  /**
   * Generate HTML report
   */
  generateHTML(
    regression: RegressionResult,
    benchmark?: BenchmarkSuiteResult
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Optimizer Regression Report</title>
  <style>
    body { font-family: system-ui; margin: 40px; }
    .status-pass { color: green; }
    .status-fail { color: red; }
    .status-warning { color: orange; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    .severity-critical { background: #fee; }
    .severity-major { background: #fff3e0; }
    .severity-minor { background: #fff8e1; }
  </style>
</head>
<body>
  <h1>Optimizer Regression Report</h1>
  <p class="status-${regression.status}">Status: ${regression.status.toUpperCase()}</p>
  
  <h2>Summary</h2>
  <ul>
    <li>Total Tests: ${regression.summary.totalTests}</li>
    <li>Regressions: ${regression.summary.regressions}</li>
    <li>Improvements: ${regression.summary.improvements}</li>
    <li>Unchanged: ${regression.summary.unchanged}</li>
  </ul>
  
  ${regression.regressions.length > 0 ? `
  <h2>Regressions</h2>
  <table>
    <tr><th>Test</th><th>Change</th><th>Severity</th><th>Description</th></tr>
    ${regression.regressions.map(r => `
    <tr class="severity-${r.severity}">
      <td>${r.id}</td>
      <td>${r.changePercent.toFixed(1)}%</td>
      <td>${r.severity}</td>
      <td>${r.description}</td>
    </tr>
    `).join('')}
  </table>
  ` : ''}
  
  ${regression.improvements.length > 0 ? `
  <h2>Improvements</h2>
  <table>
    <tr><th>Test</th><th>Improvement</th></tr>
    ${regression.improvements.map(i => `
    <tr>
      <td>${i.id}</td>
      <td>${i.improvementPercent.toFixed(1)}%</td>
    </tr>
    `).join('')}
  </table>
  ` : ''}
  
  <footer>Generated at ${new Date().toISOString()}</footer>
</body>
</html>
    `.trim();
  }
}
```

---

## GitHub Actions Workflow

```yaml
# .github/workflows/optimizer-regression.yml
name: Optimizer Regression Check

on:
  pull_request:
    paths:
      - 'packages/compiler/src/optimizer/**'
      - 'packages/compiler/src/__tests__/optimizer/**'
  push:
    branches: [main]

jobs:
  regression-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Build
        run: yarn build
      
      - name: Run regression check
        run: yarn workspace @blend65/compiler run regression-check
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      
      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: regression-report
          path: reports/regression-report.html
      
      - name: Update baseline
        if: github.ref == 'refs/heads/main'
        run: yarn workspace @blend65/compiler run update-baseline
      
      - name: Commit baseline
        if: github.ref == 'refs/heads/main'
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update optimizer baseline'
          file_pattern: 'baselines/*.json'
```

---

## Usage Examples

```typescript
// Run in CI
const runner = new CIRunner({
  runFullBenchmarks: process.env.CI_FULL_BENCHMARKS === 'true',
  runRegressionCheck: true,
  updateBaselineOnMain: true,
  failOnRegression: true,
  commentOnPR: true,
  sendNotifications: true,
  notificationChannels: ['github', 'slack']
});

const result = await runner.run();

// Exit with appropriate code
process.exit(result.status === 'success' ? 0 : 1);
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| ci-run-tests | CI runs tests | ⏳ |
| ci-detect-regression | Regressions detected in CI | ⏳ |
| ci-pr-comment | PR comments posted | ⏳ |
| ci-notification | Notifications sent | ⏳ |
| ci-baseline-update | Baseline updates on main | ⏳ |

---

## Task Checklist

- [ ] 11.6b.1: Implement `CIRunner`
- [ ] 11.6b.2: Implement `ReportGenerator`
- [ ] 11.6b.3: Create GitHub Actions workflow
- [ ] 11.6b.4: Add notification integrations
- [ ] 11.6b.5: Write unit tests

---

## References

- `11-06a-regression-detect.md`, `11-05b-bench-macro.md`, `01-architecture.md`