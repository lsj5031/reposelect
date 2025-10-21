#!/usr/bin/env node

/**
 * Edge case tests for reposelect
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = '/tmp/reposelect-edge-test';
const REPOSELECT_BIN = path.join(__dirname, '../bin/reposelect');

function runCommand(cmd, cwd = TEST_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' });
  } catch (error) {
    return { error: error.message, code: error.status };
  }
}

function setupEdgeCaseRepo() {
  // Clean up and create fresh test repo
  execSync(`rm -rf ${TEST_DIR}`);
  execSync(`mkdir -p ${TEST_DIR}`);
  
  // Initialize git repo
  execSync('git init', { cwd: TEST_DIR });
  execSync('git config user.email "test@example.com"', { cwd: TEST_DIR });
  execSync('git config user.name "Test User"', { cwd: TEST_DIR });
  
  // Create edge case files
  const files = {
    'README.md': '# Edge Case Test\n\nTesting various edge cases.',
    'package.json': JSON.stringify({
      name: 'edge-case-test',
      version: '1.0.0'
    }, null, 2),
    'src/empty.js': `
// Empty file with just comments
// No actual content here
`,
    'src/unicode.js': `
// File with unicode content: 🚀 🎉 ✨
export const emoji = '🦄';
export const chinese = '测试';
export const arabic = 'اختبار';
export const russian = 'тест';
`,
    'src/special-chars.js': `
// File with special characters in content
export const regex = /[^a-zA-Z0-9]/g;
export const template = \`Hello \${name}, welcome to \${place}!\`;
export const json = '{"key": "value with \\"quotes\\""}';
`,
    'src/very-deep/nested/path/file.js': `
// Very deeply nested file
export function deepFunction() {
  return 'I am very deep';
}
`,
    'file with spaces.js': `
// File with spaces in name
export function spacedFunction() {
  return 'spaces in filename';
}
`,
    'file-with-dashes.js': `
// File with dashes in name
export function dashedFunction() {
  return 'dashes-in-filename';
}
`,
    'src/keywords.js': `
// File with many potential keywords
export function authenticate() { return 'auth'; }
export function authorize() { return 'authz'; }
export function validate() { return 'valid'; }
export function process() { return 'processed'; }
export function handle() { return 'handled'; }
export function manage() { return 'managed'; }
export function create() { return 'created'; }
export function update() { return 'updated'; }
export function delete() { return 'deleted'; }
`,
    'docs/empty.md': `
# Empty Document

This document is intentionally sparse.
`,
    'config/.env.example': `
# Environment variables
DATABASE_URL=postgresql://localhost:5432/db
JWT_SECRET=your-secret-key
API_KEY=your-api-key
`,
    'scripts/build.sh': `#!/bin/bash
echo "Building..."
npm run build
echo "Build complete!"
`,
    'data/large-config.json': JSON.stringify({
      // Large JSON file
      ...Object.fromEntries(Array.from({length: 100}, (_, i) => [`key${i}`, `value${i}`]))
    }, null, 2)
  };
  
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(TEST_DIR, filePath);
    const dir = path.dirname(fullPath);
    execSync(`mkdir -p ${dir}`, { cwd: TEST_DIR });
    fs.writeFileSync(fullPath, content);
  }
  
  // Add and commit files
  execSync('git add .', { cwd: TEST_DIR });
  execSync('git commit -m "Add edge case files"', { cwd: TEST_DIR });
}

function testEmptyFiles() {
  console.log('🧪 Testing empty file handling...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "empty files and sparse content" --out empty-test.xml`);
  
  if (result.error) {
    console.log('❌ Empty file test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'empty-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle empty files gracefully
  const hasEmptyJs = content.includes('empty.js');
  const hasEmptyMd = content.includes('empty.md');
  
  if (!hasEmptyJs || !hasEmptyMd) {
    console.log('❌ Empty files not handled correctly');
    return false;
  }
  
  console.log('✅ Empty file handling works correctly');
  return true;
}

function testUnicodeContent() {
  console.log('🧪 Testing unicode content...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "unicode and emoji content" --out unicode-test.xml`);
  
  if (result.error) {
    console.log('❌ Unicode test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'unicode-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle unicode characters
  const hasEmoji = content.includes('🦄');
  const hasChinese = content.includes('测试');
  const hasArabic = content.includes('اختبار');
  const hasRussian = content.includes('тест');
  
  if (!hasEmoji || !hasChinese || !hasArabic || !hasRussian) {
    console.log('❌ Unicode content not handled correctly');
    return false;
  }
  
  console.log('✅ Unicode content handling works correctly');
  return true;
}

function testSpecialCharacters() {
  console.log('🧪 Testing special characters...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "regex patterns and templates" --out special-test.xml`);
  
  if (result.error) {
    console.log('❌ Special characters test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'special-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle special characters in content
  const hasRegex = content.includes('[^a-zA-Z0-9]');
  const hasTemplate = content.includes('Hello ${name}');
  const hasJson = content.includes('quotes');
  
  if (!hasRegex || !hasTemplate || !hasJson) {
    console.log('❌ Special characters not handled correctly');
    return false;
  }
  
  console.log('✅ Special character handling works correctly');
  return true;
}

function testFilenameWithSpaces() {
  console.log('🧪 Testing filenames with spaces...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "spaced filenames" --out spaces-test.xml`);
  
  if (result.error) {
    console.log('❌ Filename spaces test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'spaces-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle filenames with spaces
  const hasSpacedFile = content.includes('spacedFunction');
  
  if (!hasSpacedFile) {
    console.log('❌ Filenames with spaces not handled correctly');
    return false;
  }
  
  console.log('✅ Filename with spaces handling works correctly');
  return true;
}

function testDeeplyNestedFiles() {
  console.log('🧪 Testing deeply nested files...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "deeply nested functionality" --out nested-test.xml`);
  
  if (result.error) {
    console.log('❌ Deep nesting test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'nested-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle deeply nested files
  const hasDeepFile = content.includes('deepFunction');
  const hasDeepPath = content.includes('very-deep/nested/path/file.js');
  
  if (!hasDeepFile || !hasDeepPath) {
    console.log('❌ Deeply nested files not handled correctly');
    return false;
  }
  
  console.log('✅ Deeply nested file handling works correctly');
  return true;
}

function testKeywordOverload() {
  console.log('🧪 Testing keyword overload...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "authentication authorization validation processing handling management creation updates deletion" --budget 8000 --out keywords-test.xml`);
  
  if (result.error) {
    console.log('❌ Keyword overload test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'keywords-test.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should handle many keywords without breaking
  // Check for any of the keywords from the keywords.js file
  const hasAnyKeyword = content.includes('authenticate') || 
                      content.includes('authorize') || 
                      content.includes('validate') || 
                      content.includes('process') ||
                      content.includes('handle') ||
                      content.includes('manage') ||
                      content.includes('create') ||
                      content.includes('update') ||
                      content.includes('delete');
  
  console.log('Debug - Any keyword found:', hasAnyKeyword);
  
  if (!hasAnyKeyword) {
    console.log('❌ Keyword overload not handled correctly - no keywords found in output');
    return false;
  }
  
  console.log('✅ Keyword overload handling works correctly');
  return true;
}

function testZeroBudget() {
  console.log('🧪 Testing zero token budget...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "test question" --budget 0 --out zero-budget.xml`);
  
  if (result.error) {
    console.log('❌ Zero budget test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'zero-budget.xml');
  
  // Should still create output file, even with zero budget
  if (!fs.existsSync(outputFile)) {
    console.log('❌ Zero budget - no output file created');
    return false;
  }
  
  console.log('✅ Zero budget handling works correctly');
  return true;
}

function testVerySmallBudget() {
  console.log('🧪 Testing very small token budget...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "test question" --budget 100 --out small-budget.xml`);
  
  if (result.error) {
    console.log('❌ Small budget test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'small-budget.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should select minimal files with very small budget
  const fileMatches = content.match(/<file path="/g);
  const fileCount = fileMatches ? fileMatches.length : 0;
  
  // With very small budget, should prioritize must-include files (README, package.json)
  // and limit to essential files only
  if (fileCount > 5) {
    console.log('❌ Very small budget - too many files selected:', fileCount);
    return false;
  }
  
  console.log('✅ Very small budget handling works correctly - selected', fileCount, 'files');
  return true;
}

function runAllEdgeCaseTests() {
  console.log('🔬 Starting edge case tests...\n');
  
  setupEdgeCaseRepo();
  
  const tests = [
    testEmptyFiles,
    testUnicodeContent,
    testSpecialCharacters,
    testFilenameWithSpaces,
    testDeeplyNestedFiles,
    testKeywordOverload,
    testZeroBudget,
    testVerySmallBudget
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      if (test()) passed++;
    } catch (error) {
      console.log(`❌ Test failed with exception: ${error.message}`);
    }
    console.log(''); // Add spacing
  }
  
  console.log(`📊 Edge Case Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All edge case tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some edge case tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  runAllEdgeCaseTests();
}

module.exports = { runAllEdgeCaseTests, setupEdgeCaseRepo };