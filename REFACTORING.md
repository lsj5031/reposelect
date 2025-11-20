# Refactoring Summary

## What Was Done

The monolithic `src/reposelect.ts` (370+ lines) has been refactored into specialized, modular components for improved maintainability, testability, and separation of concerns.

## New Module Structure

### 1. **src/lib/config.ts** – Configuration Constants
Centralizes all hardcoded patterns and constants:
- **IGNORE_PATTERNS**: Directories to exclude (node_modules/, dist/, etc.)
- **FILE_EXCLUDE_SUFFIXES**: File types to skip (.min.js, .d.ts, etc.)
- **MUST_INCLUDE_PATTERNS**: Files to always include (README.md, package.json, tsconfig.json, etc.)
- **SOURCE_FILE_EXTENSIONS**: Code/config file extensions eligible for bonus scoring
- **COMMON_STOPWORDS**: Words filtered from keyword extraction
- **Scoring constants**: DEFAULT_BUDGET, MIN_SELECTED_FILES, TOKENS_PER_CHAR, SOURCE_FILE_EXTENSION_BONUS

**Benefits:**
- Easy to update patterns (e.g., add new file types to include)
- Single source of truth for configuration
- Can be extended to load from a config file if needed

### 2. **src/lib/scanner.ts** – File System & Git Operations
Encapsulates all file discovery and metadata retrieval:
- `gitFiles()`: Get all files tracked by git
- `filterIgnored()`: Apply ignore patterns
- `getAllFiles()`: Combined git files + filtering
- `grepFiles()`: Search for keywords using `git grep`
- `getFileSize()`: Read file size in bytes
- `getFileContent()`: Read file content for analysis
- `getLastCommitTimestamp()`: Get git commit timestamp

**Benefits:**
- Isolates system calls (git, fs)
- Easy to mock for testing
- Can swap implementations (e.g., use a different VCS)
- Handles errors gracefully with fallbacks

### 3. **src/lib/scorer.ts** – Scoring Algorithms
Pure functions that rank files by relevance:
- `filenameScore()`: Keyword matches in file path
- `contentScore()`: Keyword matches in file content
- `recencyScore()`: Bonus for recently modified files (log scale)
- `sizePenalty()`: Penalize large files to reduce bloat
- `fileTypeBonus()`: Bonus for recognized code/config files
- `tokenEstimate()`: Convert bytes to token count
- `score()`: Combined scoring formula
- `scoreMany()`: Batch score and sort files

**Formula:** `score = 3 * nameHits + 2 * contentHits + recency - 0.5 * sizePenalty + typeBonus`

**Benefits:**
- Testable in isolation (no I/O)
- Scoring logic is explicit and reviewable
- Easy to adjust weights or add new factors
- Fast unit tests (13 tests, all passing)

### 4. **src/lib/packer.ts** – Repomix Integration
Handles packing selected files with Repomix:
- `ensureInstructionFile()`: Create/update repomix-instruction.md
- `calculateTotalTokens()`: Sum tokens for selected files
- `pack()`: Execute repomix with selected files

**Benefits:**
- Separates I/O from selection logic
- Can be tested with mocks
- Easier to swap packing backend (e.g., repomix v2)

### 5. **src/lib/keywords.ts** – Keyword & File Selection Helpers
Utilities for question analysis and file filtering:
- `KeywordExtractor.extract()`: Extract keywords from questions (removes stopwords, filters to 3+ chars, alphanumeric + underscore)
- `FileSelector.byName()`: Select files matching keyword patterns
- `FileSelector.mustInclude()`: Select required config/docs files

**Benefits:**
- Reusable logic
- Clear naming for intent

## Refactored Main Entry Point: **src/reposelect.ts**

The main file is now cleaner and orchestrates the modules:
1. Parse CLI arguments
2. Extract keywords from question
3. Initialize scanner and scorer with configuration
4. Try agent selection if requested (with fallback)
5. Scan files and find candidates
6. Score and rank candidates
7. Select files within token budget
8. Pack with Repomix

**Before:** 371 lines of mixed concerns  
**After:** ~200 lines of orchestration (modules handle the rest)

## Unit Tests: **tests/unit/test-scorer.js**

Fast, isolated tests for scoring logic (no git/filesystem needed):
- 13 test cases covering all scoring factors
- All passing ✓
- Run in <100ms
- Can run independently: `node tests/unit/test-scorer.js`

**Test Coverage:**
- Filename scoring (single/multiple matches, case-insensitive)
- Content scoring (keyword hits, missing files)
- Recency scoring (recent files score higher, age penalty)
- Token estimation (chars to tokens)
- Combined scoring (all factors work together)
- Large file penalty (size penalty reduces score)
- Sorting (files ranked correctly by score)

## Benefits of This Refactoring

1. **Testability**: Core logic can be unit tested without spawning child processes or accessing git
2. **Maintainability**: Each module has a single responsibility
3. **Reusability**: Modules can be imported in other projects
4. **Extensibility**: Easy to add features (new scoring factors, different file patterns)
5. **Performance**: Can optimize individual components without affecting others
6. **Documentation**: Clear interfaces and type hints make code self-documenting

## Migration Guide for Future Developers

To understand how a feature works:
1. **File selection?** → Look at `scanner.ts` and `keywords.ts`
2. **Scoring/ranking?** → Look at `scorer.ts` and write unit tests
3. **Config/patterns?** → Edit `config.ts`
4. **Repomix integration?** → Look at `packer.ts`
5. **CLI/orchestration?** → Look at `reposelect.ts`

## Running Tests

```bash
# All tests
npm test

# Just unit tests (fast)
node tests/unit/test-scorer.js

# Build TypeScript
npm run build
```

## Next Steps (Optional)

1. Add unit tests for `scanner.ts` (with mocked git/fs)
2. Add unit tests for `keywords.ts`
3. Create integration tests that verify the full pipeline
4. Consider moving some scoring weights to config.ts for tuning
5. Add metric for token efficiency (score per token spent)
