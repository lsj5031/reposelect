/**
 * Configuration constants for reposelect
 */

export const IGNORE_PATTERNS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  'coverage/',
  '.next/',
  '.nuxt/',
  '.vscode/',
  '.idea/',
];

export const FILE_EXCLUDE_SUFFIXES = [
  '.min.js',
  '.min.css',
  '.map',
  '.d.ts'
];

export const MUST_INCLUDE_PATTERNS = [
  /^README\.md$/i,
  /^CHANGELOG/i,
  /^LICENSE$/i,
  /^docs\//i,
  /^package\.json$/i,
  /^pnpm-lock\.yaml$/i,
  /^yarn\.lock$/i,
  /^npm-lock\.json$/i,
  /^requirements\.txt$/i,
  /^pyproject\.toml$/i,
  /^tsconfig.*\.json$/i,
  /^\.eslintrc.*$/i,
  /^\.prettierrc.*$/i,
  /^Dockerfile/i,
  /^Makefile$/i,
  /.*\.env\.example$/i,
  /^\.gitignore$/i,
  /^\.env$/i
];

export const SOURCE_FILE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rb', '.java', '.cs', 
  '.md', '.json', '.toml', '.yaml', '.yml'
];

export const COMMON_STOPWORDS = [
  'the', 'and', 'for', 'are', 'with', 'not', 'you', 'all', 'can', 'has',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'had', 'his', 'how',
  'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
  'its', 'let', 'put', 'say', 'she', 'too', 'use'
];

export const DEFAULT_BUDGET = 12000;
export const MIN_SELECTED_FILES = 8;
export const TOKENS_PER_CHAR = 3.7;
export const SOURCE_FILE_EXTENSION_BONUS = 0.2;
