/**
 * Unit tests for scoring algorithms
 * Fast, isolated tests that don't require git or file system access
 */

const assert = require('assert');

// Mock FileScanner for testing
class MockFileScanner {
  constructor(fileData = {}) {
    this.fileData = fileData; // { 'file.ts': { size: 1000, content: '...', timestamp: 1234567890 } }
  }

  getFileContent(file) {
    return (this.fileData[file]?.content ?? '').toLowerCase();
  }

  getFileSize(file) {
    return this.fileData[file]?.size ?? 0;
  }

  getLastCommitTimestamp(file) {
    return this.fileData[file]?.timestamp ?? 0;
  }
}

// FileScorer with scoring logic (copied from scorer.ts for testing)
class FileScorer {
  constructor(config) {
    this.keywords = config.keywords;
    this.scanner = config.scanner;
  }

  filenameScore(file) {
    const lowercase = file.toLowerCase();
    return this.keywords.reduce((count, keyword) =>
      count + (lowercase.includes(keyword) ? 1 : 0), 0
    );
  }

  contentScore(file) {
    const content = this.scanner.getFileContent(file);
    return this.keywords.reduce((count, keyword) =>
      count + (content.includes(keyword) ? 1 : 0), 0
    );
  }

  recencyScore(file) {
    const timestamp = this.scanner.getLastCommitTimestamp(file);
    if (!timestamp) return 0;
    
    const ageDays = (Date.now() / 1000 - timestamp) / 86400;
    return Math.max(0, Math.min(1, 1 - Math.log10(1 + ageDays) / 2));
  }

  sizePenalty(size) {
    return Math.log10(1 + size) / 10;
  }

  fileTypeBonus(file) {
    const ext = require('path').extname(file).toLowerCase();
    const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rb', '.java', '.cs', 
                        '.md', '.json', '.toml', '.yaml', '.yml'];
    return sourceExts.includes(ext) ? 0.2 : 0;
  }

  tokenEstimate(bytes) {
    return Math.ceil(bytes / 3.7);
  }

  score(file) {
    const nameHits = this.filenameScore(file);
    const contentHitCount = this.contentScore(file);
    const recency = this.recencyScore(file);
    const size = this.scanner.getFileSize(file);
    const penalty = this.sizePenalty(size);
    const bonus = this.fileTypeBonus(file);
    
    const totalScore = 3 * nameHits + 2 * contentHitCount + recency - 0.5 * penalty + bonus;
    const tokens = this.tokenEstimate(size);
    
    return {
      file,
      score: totalScore,
      size,
      tokens
    };
  }

  scoreMany(files) {
    return files
      .map(file => this.score(file))
      .sort((a, b) => b.score - a.score);
  }
}

// Test suite
const tests = [
  {
    name: 'filenameScore: single keyword match',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: ['auth', 'jwt'], scanner });
      assert.strictEqual(scorer.filenameScore('auth-handler.ts'), 1);
    }
  },
  {
    name: 'filenameScore: multiple keyword matches',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: ['auth', 'jwt'], scanner });
      assert.strictEqual(scorer.filenameScore('jwt-auth-service.ts'), 2);
    }
  },
  {
    name: 'filenameScore: no matches',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: ['auth', 'jwt'], scanner });
      assert.strictEqual(scorer.filenameScore('middleware.ts'), 0);
    }
  },
  {
    name: 'filenameScore: case-insensitive',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: ['auth'], scanner });
      assert.strictEqual(scorer.filenameScore('AUTH.ts'), 1);
      assert.strictEqual(scorer.filenameScore('Auth-Handler.ts'), 1);
    }
  },
  {
    name: 'contentScore: keyword match in content',
    fn: () => {
      const scanner = new MockFileScanner({
        'auth.ts': { content: 'authenticate user with jwt token', size: 100, timestamp: 1 }
      });
      const scorer = new FileScorer({ keywords: ['jwt', 'token'], scanner });
      assert.strictEqual(scorer.contentScore('auth.ts'), 2);
    }
  },
  {
    name: 'contentScore: missing file',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: ['jwt'], scanner });
      assert.strictEqual(scorer.contentScore('nonexistent.ts'), 0);
    }
  },
  {
    name: 'recencyScore: non-existent file',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: [], scanner });
      assert.strictEqual(scorer.recencyScore('nonexistent.ts'), 0);
    }
  },
  {
    name: 'recencyScore: recent file scores high',
    fn: () => {
      const now = Date.now() / 1000;
      const scanner = new MockFileScanner({
        'recent.ts': { size: 100, content: '', timestamp: now }
      });
      const scorer = new FileScorer({ keywords: [], scanner });
      const score = scorer.recencyScore('recent.ts');
      assert(score > 0.99, `Expected score > 0.99, got ${score}`);
    }
  },
  {
    name: 'recencyScore: older files score lower',
    fn: () => {
      const now = Date.now() / 1000;
      const scanner = new MockFileScanner({
        'recent.ts': { size: 100, content: '', timestamp: now },
        'old.ts': { size: 100, content: '', timestamp: now - (30 * 86400) }
      });
      const scorer = new FileScorer({ keywords: [], scanner });
      const recentScore = scorer.recencyScore('recent.ts');
      const oldScore = scorer.recencyScore('old.ts');
      assert(recentScore > oldScore, 'Recent file should score higher');
    }
  },
  {
    name: 'tokenEstimate: correct calculation',
    fn: () => {
      const scanner = new MockFileScanner({});
      const scorer = new FileScorer({ keywords: [], scanner });
      assert.strictEqual(scorer.tokenEstimate(3700), 1000);
      assert.strictEqual(scorer.tokenEstimate(7400), 2000);
      assert.strictEqual(scorer.tokenEstimate(100), 28); // ceil(100 / 3.7) = 28
    }
  },
  {
    name: 'score: combines all factors',
    fn: () => {
      const now = Date.now() / 1000;
      const scanner = new MockFileScanner({
        'auth-validator.ts': { size: 3700, content: 'jwt validation', timestamp: now }
      });
      const scorer = new FileScorer({ keywords: ['jwt', 'validator'], scanner });
      const result = scorer.score('auth-validator.ts');
      
      assert.strictEqual(result.file, 'auth-validator.ts');
      assert(typeof result.score === 'number');
      assert.strictEqual(result.size, 3700);
      assert.strictEqual(result.tokens, 1000);
      assert(result.score > 5);
    }
  },
  {
    name: 'score: penalizes large files',
    fn: () => {
      const now = Date.now() / 1000;
      const scanner = new MockFileScanner({
        'small.ts': { size: 100, content: 'jwt', timestamp: now },
        'large.ts': { size: 100000, content: 'jwt', timestamp: now }
      });
      const scorer = new FileScorer({ keywords: ['jwt'], scanner });
      const smallScore = scorer.score('small.ts').score;
      const largeScore = scorer.score('large.ts').score;
      assert(smallScore > largeScore, 'Smaller file should score higher');
    }
  },
  {
    name: 'scoreMany: sorts by score descending',
    fn: () => {
      const now = Date.now() / 1000;
      const scanner = new MockFileScanner({
        'jwt-auth.ts': { size: 100, content: 'jwt', timestamp: now },
        'middleware.ts': { size: 100, content: '', timestamp: now },
        'validator.ts': { size: 100, content: 'jwt validator', timestamp: now }
      });
      const scorer = new FileScorer({ keywords: ['jwt', 'validator'], scanner });
      const results = scorer.scoreMany(['middleware.ts', 'jwt-auth.ts', 'validator.ts']);
      
      assert.strictEqual(results[0].file, 'validator.ts');
      assert.strictEqual(results[1].file, 'jwt-auth.ts');
      assert.strictEqual(results[2].file, 'middleware.ts');
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${test.name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
