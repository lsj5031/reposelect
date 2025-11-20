#!/usr/bin/env node

/**
 * Test runner for all reposelect tests
 */

const { spawnSync } = require('child_process');
const path = require('path');

const TESTS_DIR = __dirname;

function runTestFile(testFile) {
  console.log(`\n🚀 Running ${testFile}...\n`);
  console.log('='.repeat(60));
  
  const result = spawnSync('node', [path.join(TESTS_DIR, testFile)], {
    stdio: 'inherit',
    cwd: TESTS_DIR
  });
  
  return result.status === 0;
}

function main() {
  console.log('🧪 Reposelect Test Suite');
  console.log('========================\n');
  
  const testFiles = [
    'unit/test-scorer.js',
    'test-agent.js'
  ];
  
  let passed = 0;
  let total = testFiles.length;
  
  for (const testFile of testFiles) {
    if (runTestFile(testFile)) {
      passed++;
      console.log(`\n✅ ${testFile} PASSED\n`);
    } else {
      console.log(`\n❌ ${testFile} FAILED\n`);
    }
  }
  
  console.log('='.repeat(60));
  console.log(`\n📊 Final Results: ${passed}/${total} test suites passed`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! 🎉');
    console.log('\n✨ Reposelect is working correctly! ✨');
    process.exit(0);
  } else {
    console.log('💥 SOME TESTS FAILED! 💥');
    console.log('\n🔧 Please check the failing tests and fix the issues.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };