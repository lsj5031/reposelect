#!/usr/bin/env node

/**
 * Agent functionality tests for reposelect
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = '/tmp/reposelect-agent-test';
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
    'README.md': '# Test Project\n\nThis is a test project for reposelect agent testing.',
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
    'docs/api.md': '# API Documentation\n\n## Authentication\nPOST /auth/login\n\n## Users\nGET /users'
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

function testAgentFlag() {
  console.log('🧪 Testing --agent flag...');
  
  // Test with unsupported agent
  const result1 = runCommand(`node ${REPOSELECT_BIN} "How does authentication work?" --agent unsupported`);
  if (!result1.error || (!result1.error.includes('not supported') && !result1.error.includes('Invalid values'))) {
    console.log('❌ Should fail with unsupported agent');
    console.log('Error message:', result1.error);
    return false;
  }
  
  // Test with factory agent (should fallback gracefully if not installed)
  const result2 = runCommand(`node ${REPOSELECT_BIN} "How does authentication work?" --agent factory`);
  if (result2.error && !result2.error.includes('Falling back to naive search')) {
    console.log('❌ Should fallback gracefully when Factory CLI not installed');
    console.log('Error:', result2.error);
    return false;
  }
  
  // Test with opencode agent (should fallback gracefully if not installed)
  const result3 = runCommand(`node ${REPOSELECT_BIN} "How does authentication work?" --agent opencode`);
  if (result3.error && !result3.error.includes('Falling back to naive search')) {
    console.log('❌ Should fallback gracefully when OpenCode CLI not installed');
    console.log('Error:', result3.error);
    return false;
  }
  
  console.log('✅ Agent flag validation works correctly');
  return true;
}

function testFallbackToNaive() {
  console.log('🧪 Testing fallback to naive search...');
  
  // Test that fallback works when agent fails
  const result = runCommand(`node ${REPOSELECT_BIN} "How does authentication work?" --agent factory --out fallback-test.xml`);
  
  if (result.error) {
    console.log('❌ Fallback to naive search failed:', result.error);
    return false;
  }
  
  // Check if output file was created
  const outputFile = path.join(TEST_DIR, 'fallback-test.xml');
  if (!fs.existsSync(outputFile)) {
    console.log('❌ Output file not created during fallback');
    return false;
  }
  
  // Check if content is reasonable (should contain auth-related files)
  const content = fs.readFileSync(outputFile, 'utf8');
  if (!content.includes('authenticateUser')) {
    console.log('❌ Auth files not properly selected during fallback');
    return false;
  }
  
  console.log('✅ Fallback to naive search works correctly');
  return true;
}

function testAgentHelp() {
  console.log('🧪 Testing agent help documentation...');
  
  const result = runCommand(`node ${REPOSELECT_BIN} --help`);
  
  if (result.error) {
    console.log('❌ Help command failed');
    return false;
  }
  
  // Check if agent option is documented
  if (!result.includes('--agent') || !result.includes('factory') || !result.includes('opencode')) {
    console.log('❌ Agent option not properly documented in help');
    return false;
  }
  
  console.log('✅ Agent help documentation is correct');
  return true;
}

function runAllTests() {
  console.log('🚀 Starting reposelect agent tests...\n');
  
  setupTestRepo();
  
  const tests = [
    testAgentFlag,
    testFallbackToNaive,
    testAgentHelp
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
  
  console.log(`📊 Agent Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All agent tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some agent tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests, setupTestRepo };