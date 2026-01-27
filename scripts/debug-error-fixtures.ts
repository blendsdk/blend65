/**
 * @file Debug Error Fixtures
 * @description Identifies which error case fixtures are failing E2E tests
 */

import { join } from 'path';
import { loadAllFixtures } from '../packages/compiler/src/__tests__/e2e/fixture-validator.js';
import { FixtureExecutor } from '../packages/compiler/src/__tests__/e2e/fixture-executor.js';
import { FixtureCategory } from '../packages/compiler/src/__tests__/e2e/fixture-types.js';

const FIXTURES_DIR = join(import.meta.dirname, '../packages/compiler/fixtures');

async function main() {
  console.log('Loading error-case fixtures...');
  
  const executor = new FixtureExecutor({
    optimizationLevel: 0,
    target: 'c64',
    verbose: true,
  });

  const fixtures = loadAllFixtures(FIXTURES_DIR, FixtureCategory.ErrorCases);
  console.log(`Found ${fixtures.length} error-case fixtures\n`);

  let passed = 0;
  let failed = 0;

  for (const fixture of fixtures) {
    const result = executor.execute(fixture);

    if (!result.passed) {
      failed++;
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('FAILED FIXTURE:', fixture.metadata.fixture);
      console.log('FILE:', fixture.filePath);
      console.log('EXPECTED:', fixture.metadata.expect);
      console.log('───────────────────────────────────────────────────────────────────');
      console.log('FAILURE REASON:', result.failureReason);
      
      if (result.diagnostics && result.diagnostics.length > 0) {
        console.log('DIAGNOSTICS:');
        for (const diag of result.diagnostics.slice(0, 10)) {
          console.log('  ', diag);
        }
      }
      console.log('═══════════════════════════════════════════════════════════════════\n');
    } else {
      passed++;
    }
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total: ${fixtures.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('==============================');
}

main().catch(console.error);