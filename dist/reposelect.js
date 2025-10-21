#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * reposelect.ts – minimal "RepoPrompt-Lite"
 * Usage:
 *   reposelect "How is JWT validated?" --repo . --out context.xml
 */
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yargs = __importStar(require("yargs"));
const args = yargs
    .usage('Usage: reposelect <question> [options]')
    .positional('question', {
    describe: 'Question about the codebase',
    type: 'string'
})
    .option('repo', {
    alias: 'r',
    type: 'string',
    default: process.cwd(),
    describe: 'Repository path'
})
    .option('out', {
    alias: 'o',
    type: 'string',
    default: 'context.xml',
    describe: 'Output file'
})
    .option('budget', {
    alias: 'b',
    type: 'number',
    default: 12000,
    describe: 'Token budget limit'
})
    .option('verbose', {
    alias: 'v',
    type: 'boolean',
    default: false,
    describe: 'Verbose output'
})
    .help()
    .argv;
const question = String(args._[0] ?? '');
if (!question) {
    console.error('Error: Provide a question about the codebase.');
    process.exit(1);
}
const repo = path.resolve(args.repo);
const out = path.resolve(args.out);
// Extract keywords from question (3+ chars, alphanumeric + underscore)
const keywords = Array.from(new Set((question.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [])
    .filter(w => !['the', 'and', 'for', 'are', 'with', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'had', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(w))));
if (args.verbose) {
    console.log(`Keywords: ${keywords.join(', ')}`);
}
function safeExec(cmd) {
    try {
        return (0, child_process_1.execSync)(cmd, { cwd: repo, encoding: 'utf8' });
    }
    catch (error) {
        return '';
    }
}
function gitFiles() {
    const out = safeExec('git ls-files');
    return out.split('\n').filter(Boolean);
}
function grepCandidates() {
    if (!keywords.length)
        return new Set();
    const pattern = keywords.map(k => `-e ${JSON.stringify(k)}`).join(' ');
    const out = safeExec(`git grep -l -i ${pattern}`);
    return new Set(out.split('\n').filter(Boolean));
}
function byName(files) {
    const selected = new Set();
    const regexes = keywords.map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    for (const file of files) {
        if (regexes.some(regex => regex.test(file))) {
            selected.add(file);
        }
    }
    return selected;
}
function mustInclude(files) {
    const patterns = [
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
    return new Set(files.filter(file => patterns.some(pattern => pattern.test(file))));
}
function getFileSize(file) {
    try {
        return fs.statSync(path.join(repo, file)).size;
    }
    catch {
        return 0;
    }
}
function contentHits(file) {
    try {
        const content = fs.readFileSync(path.join(repo, file), 'utf8').toLowerCase();
        return keywords.reduce((count, keyword) => count + (content.includes(keyword) ? 1 : 0), 0);
    }
    catch {
        return 0;
    }
}
function lastCommitScore(file) {
    const timestamp = safeExec(`git log -1 --format=%ct -- ${JSON.stringify(file)}`).trim();
    if (!timestamp)
        return 0;
    const ageDays = (Date.now() / 1000 - parseInt(timestamp, 10)) / 86400;
    return Math.max(0, Math.min(1, 1 - Math.log10(1 + ageDays) / 2));
}
function tokenEstimate(chars) {
    return Math.ceil(chars / 3.7);
}
// Get all files, excluding common ignore patterns
const allFiles = gitFiles().filter(file => !file.startsWith('node_modules/') &&
    !file.startsWith('dist/') &&
    !file.startsWith('build/') &&
    !file.startsWith('.git/') &&
    !file.startsWith('coverage/') &&
    !file.startsWith('.next/') &&
    !file.startsWith('.nuxt/') &&
    !file.endsWith('.min.js') &&
    !file.endsWith('.min.css'));
// Find candidate files
const candidates = Array.from(new Set([
    ...byName(allFiles),
    ...grepCandidates(),
    ...mustInclude(allFiles)
]));
if (args.verbose) {
    console.log(`Found ${candidates.length} candidate files`);
}
const ranked = candidates.map(file => {
    const nameHits = keywords.reduce((count, keyword) => count + (file.toLowerCase().includes(keyword) ? 1 : 0), 0);
    const contentHitCount = contentHits(file);
    const recency = lastCommitScore(file);
    const size = getFileSize(file);
    const sizePenalty = Math.log10(1 + size) / 10;
    const extBonus = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rb', '.java', '.cs', '.md', '.json', '.toml', '.yaml', '.yml']
        .includes(path.extname(file).toLowerCase()) ? 0.2 : 0;
    const score = 3 * nameHits + 2 * contentHitCount + recency - 0.5 * sizePenalty + extBonus;
    const tokens = tokenEstimate(size);
    return { file, score, size, tokens };
}).sort((a, b) => b.score - a.score);
// Select files within token budget
const selected = [];
let usedTokens = 0;
for (const { file, tokens } of ranked) {
    if (usedTokens + tokens > args.budget && selected.length >= 8)
        break;
    selected.push(file);
    usedTokens += tokens;
}
if (selected.length === 0) {
    console.error('Error: No relevant files found.');
    process.exit(2);
}
if (args.verbose) {
    console.log(`Selected ${selected.length} files (~${usedTokens} tokens)`);
    console.log('Files:', selected.slice(0, 10).join(', '));
    if (selected.length > 10) {
        console.log(`... and ${selected.length - 10} more`);
    }
}
// Ensure instruction file exists
const instructionFile = path.join(repo, 'repomix-instruction.md');
if (!fs.existsSync(instructionFile)) {
    fs.writeFileSync(instructionFile, `# Context & Rules

## Repository Context
This is a packed repository context for AI assistance. The files below represent the most relevant code for answering your question.

## Guidelines
- Only modify files listed in the <files> section
- Follow existing code style and conventions
- Make minimal, focused changes
- Add tests where feasible
- Respect existing linting and formatting rules
- Consider the broader codebase impact

## Question Context
The original question was: "${question}"

Focus your answer on addressing this specific question using the provided context.
`);
}
// Pack with Repomix
const relativeOut = path.relative(repo, out);
const repomixArgs = [
    '--stdin',
    '--style', 'xml',
    '--remove-comments',
    '--output', relativeOut,
    '--instruction-file-path', 'repomix-instruction.md'
];
const result = (0, child_process_1.spawnSync)('repomix', repomixArgs, {
    cwd: repo,
    input: selected.join('\n') + '\n',
    stdio: ['pipe', 'inherit', 'inherit']
});
if ((result.status ?? 0) !== 0) {
    console.error('Error: Repomix failed. Make sure repomix is installed: npm install -g repomix');
    process.exit(result.status ?? 1);
}
console.log(`✓ Packed ${selected.length} files (~${usedTokens} tokens) → ${out}`);
//# sourceMappingURL=reposelect.js.map