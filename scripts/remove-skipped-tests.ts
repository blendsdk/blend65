/**
 * Script to remove .skip from all test files in compiler-v2
 * This enables previously skipped tests that should now pass after the block-scope fix
 * 
 * Run with: npx tsx scripts/remove-skipped-tests.ts
 */

import * as fs from 'fs';
import * as path from 'path';

function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function processFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace it.skip( with it(
  // Replace describe.skip( with describe(
  const newContent = content
    .replace(/it\.skip\(/g, 'it(')
    .replace(/describe\.skip\(/g, 'describe(');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

// Main execution
const testDir = path.join(process.cwd(), 'packages/compiler-v2/src/__tests__');
console.log('Searching for test files in:', testDir);

const testFiles = findTestFiles(testDir);
console.log(`Found ${testFiles.length} test files`);

let updatedCount = 0;
for (const file of testFiles) {
  if (processFile(file)) {
    updatedCount++;
  }
}

console.log('');
console.log(`Done! Updated ${updatedCount} files.`);
console.log('');
console.log('Verifying no .skip remains...');

// Verify no .skip remains
let foundSkip = false;
for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.includes('it.skip(') || content.includes('describe.skip(')) {
    console.log(`❌ Still has .skip: ${file}`);
    foundSkip = true;
  }
}

if (!foundSkip) {
  console.log('✅ All .skip modifiers have been removed successfully!');
}