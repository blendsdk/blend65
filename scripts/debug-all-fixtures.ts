/**
 * @file Debug All Fixtures
 * @description Identifies all failing E2E fixtures by category
 */

import { join } from 'path';
import { loadAllFixtures } from '../packages/compiler/src/__tests__/e2e/fixture-validator.js';
import { FixtureExecutor } from '../packages/compiler/src/__tests__/e2e/fixture-executor.js';
import { FixtureCategory } from '../packages/compiler/src/__tests__/e2e/fixture-types.js';

const FIXTURES_DIR = join(import.meta.dirname, '../packages/compiler/fixtures');

async function main() {
  console.log('='.repeat(70));
  console.log('DEBUG ALL FIXTURES');
  console.log('='.repeat(70));
  
  const executor = new FixtureExecutor({
    optimizationLevel: 0,
    target: 'c64',
    verbose: false,
  });

  const categories = Object.values(FixtureCategory);
  let totalFailed = 0;

  for (const category of categories) {
    const fixtures = loadAllFixtures(FIXTURES_DIR, category);
    if (fixtures.length === 0) continue;

    let categoryFailed = 0;
    const failures: Array<{name: string, reason: string}> = [];

    for (const fixture of fixtures) {
      const result = executor.execute(fixture);

      if (!result.passed && !result.failureReason?.startsWith('Skipped:')) {
        categoryFailed++;
        totalFailed++;
        failures.push({
          name: fixture.metadata.fixture,
          reason: result.failureReason || 'Unknown'
        });
      }
    }

    if (categoryFailed > 0) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`CATEGORY: ${category} (${categoryFailed}/${fixtures.length} failed)`);
      console.log('─'.repeat(70));
      
      for (const f of failures) {
        console.log(`\n❌ ${f.name}`);
        console.log(`   Reason: ${f.reason}`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL FAILURES: ${totalFailed}`);
  console.log('='.repeat(70));
}

main().catch(console.error);