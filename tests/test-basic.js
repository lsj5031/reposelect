#!/usr/bin/env node

/**
 * Basic functionality tests for reposelect
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = '/tmp/reposelect-test';
const REPOSELECT_BIN = path.join(__dirname, '../bin/reposelect');

function runCommand(cmd, cwd = TEST_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' });
  } catch (error) {
    return { error: error.message, code: error.status };
  }
}

function setupTestRepo() {
  // Clean up and create fresh test repo
  execSync(`rm -rf ${TEST_DIR}`);
  execSync(`mkdir -p ${TEST_DIR}`);
  
  // Initialize git repo
  execSync('git init', { cwd: TEST_DIR });
  execSync('git config user.email "test@example.com"', { cwd: TEST_DIR });
  execSync('git config user.name "Test User"', { cwd: TEST_DIR });
  
  // Create test files
  const files = {
    'README.md': '# Test Project\n\nThis is a test project for reposelect.',
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { test: 'jest' }
    }, null, 2),
    'src/auth.js': `
// Authentication module
export function authenticateUser(username, password) {
  // JWT token validation logic
  if (!username || !password) {
    throw new Error('Missing credentials');
  }
  return { token: 'jwt-token-here', user: username };
}

export function validateToken(token) {
  // Token validation
  return token && token.startsWith('jwt-');
}
`,
    'src/database.js': `
// Database connection
export function connectToDatabase() {
  // Database connection logic
  return { connected: true, host: 'localhost' };
}

export function queryUsers() {
  // User queries
  return ['user1', 'user2'];
}
`,
    'src/utils.js': `
// Utility functions
export function formatDate(date) {
  return date.toISOString();
}

export function validateEmail(email) {
  return email.includes('@');
}
`,
    'docs/api.md': '# API Documentation\n\n## Authentication\nPOST /auth/login\n\n## Users\nGET /users',
    'config.json': JSON.stringify({
      database: { host: 'localhost', port: 5432 },
      auth: { jwtSecret: 'secret' }
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
  execSync('git commit -m "Initial commit"', { cwd: TEST_DIR });
}

function testBasicSelection() {
  console.log('🧪 Testing basic file selection...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "How does authentication work?" --out auth-context.xml`);
  
  if (result.error) {
    console.log('❌ Basic selection failed:', result.error);
    return false;
  }
  
  // Check if output file was created
  const outputFile = path.join(TEST_DIR, 'auth-context.xml');
  if (!fs.existsSync(outputFile)) {
    console.log('❌ Output file not created');
    return false;
  }
  
  // Check if auth-related files are in the output
  const content = fs.readFileSync(outputFile, 'utf8');
  const hasAuthJs = content.includes('authenticateUser');
  const hasTokenValidation = content.includes('validateToken');
  
  if (!hasAuthJs || !hasTokenValidation) {
    console.log('❌ Auth files not properly selected');
    return false;
  }
  
  console.log('✅ Basic selection works correctly');
  return true;
}

function testKeywordExtraction() {
  console.log('🧪 Testing keyword extraction...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "Database connection and user queries" --verbose --out db-context.xml`);
  
  if (result.error) {
    console.log('❌ Keyword extraction failed:', result.error);
    return false;
  }
  
  // Should contain database-related files
  const outputFile = path.join(TEST_DIR, 'db-context.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  const hasDatabaseJs = content.includes('connectToDatabase');
  const hasQueryUsers = content.includes('queryUsers');
  const hasConfig = content.includes('database');
  
  if (!hasDatabaseJs || !hasQueryUsers || !hasConfig) {
    console.log('❌ Database files not properly selected');
    return false;
  }
  
  console.log('✅ Keyword extraction works correctly');
  return true;
}

function testTokenBudget() {
  console.log('🧪 Testing token budget...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "All functionality" --budget 1000 --out small-context.xml`);
  
  if (result.error) {
    console.log('❌ Token budget test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'small-context.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should have fewer files due to small budget
  const fileMatches = content.match(/<file path="/g);
  const fileCount = fileMatches ? fileMatches.length : 0;
  
  if (fileCount > 5) {
    console.log('❌ Too many files selected for small budget:', fileCount);
    return false;
  }
  
  console.log('✅ Token budget works correctly');
  return true;
}

function testMustIncludeFiles() {
  console.log('🧪 Testing must-include files...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} "Random question" --out all-context.xml`);
  
  if (result.error) {
    console.log('❌ Must-include test failed:', result.error);
    return false;
  }
  
  const outputFile = path.join(TEST_DIR, 'all-context.xml');
  const content = fs.readFileSync(outputFile, 'utf8');
  
  // Should always include README and package.json
  const hasReadme = content.includes('Test Project');
  const hasPackageJson = content.includes('test-project');
  
  if (!hasReadme || !hasPackageJson) {
    console.log('❌ Must-include files not selected');
    return false;
  }
  
  console.log('✅ Must-include files work correctly');
  return true;
}

function testErrorHandling() {
  console.log('🧪 Testing error handling...');
  
  // Test with no question
  const result1 = runCommand(`node ${REPOSELECT_BIN}`);
  if (!result1.error) {
    console.log('❌ Should fail with no question');
    return false;
  }
  
  // Test with non-existent repo
  const result2 = runCommand(`node ${REPOSELECT_BIN} "test" --repo /nonexistent`, '/');
  if (!result2.error) {
    console.log('❌ Should fail with non-existent repo');
    return false;
  }
  
  console.log('✅ Error handling works correctly');
  return true;
}

function runAllTests() {
  console.log('🚀 Starting reposelect tests...\n');
  
  setupTestRepo();
  
  const tests = [
    testBasicSelection,
    testKeywordExtraction,
    testTokenBudget,
    testMustIncludeFiles,
    testErrorHandling
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
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests, setupTestRepo };