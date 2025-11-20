#!/usr/bin/env node
/**
 * reposelect.ts – minimal "RepoPrompt-Lite"
 * Usage:
 *   reposelect "How is JWT validated?" --repo . --out context.xml
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import { FactoryAgent } from './agent/factory-agent';
import { OpenCodeAgent } from './agent/opencode-agent';

interface Args {
  _: string[];
  repo: string;
  out: string;
  budget: number;
  verbose: boolean;
  agent?: string;
}

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
  .option('agent', {
    type: 'string',
    choices: ['factory', 'opencode'],
    describe: 'Use LLM agent for intelligent file selection'
  })
  .help()
  .argv as Args;

const question = String(args._[0] ?? '');
if (!question) {
  console.error('Error: Provide a question about the codebase.');
  process.exit(1);
}

async function packWithRepomix(selected: string[], repo: string, out: string, question: string, verbose: boolean): Promise<void> {
  const usedTokens = selected.reduce((total, file) => {
    const size = getFileSize(file);
    return total + tokenEstimate(size);
  }, 0);

  if (verbose) {
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

  const result = spawnSync('repomix', repomixArgs, {
    cwd: repo,
    input: selected.join('\n') + '\n',
    stdio: ['pipe', 'inherit', 'inherit']
  });

  if ((result.status ?? 0) !== 0) {
    console.error('Error: Repomix failed. Make sure repomix is installed: npm install -g repomix');
    process.exit(result.status ?? 1);
  }

  console.log(`✓ Packed ${selected.length} files (~${usedTokens} tokens) → ${out}`);
}

const repo = path.resolve(args.repo);
const out = path.resolve(args.out);

// Extract keywords from question (3+ chars, alphanumeric + underscore)
const keywords = Array.from(new Set(
  (question.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [])
    .filter(w => !['the', 'and', 'for', 'are', 'with', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'had', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(w))
));

if (args.verbose) {
  console.log(`Keywords: ${keywords.join(', ')}`);
}

async function tryAgentSelection(): Promise<boolean> {
  if (!args.agent) return false;

  try {
    const agentConfig = {
      repoPath: repo,
      question: question,
      tokenBudget: args.budget,
      verbose: args.verbose
    };

    let agent;
    if (args.agent === 'factory') {
      agent = new FactoryAgent(agentConfig);
    } else if (args.agent === 'opencode') {
      agent = new OpenCodeAgent(agentConfig);
    } else {
      console.error(`Error: Agent '${args.agent}' not supported`);
      return false;
    }

    const result = await agent.selectFiles();
    
    if (args.verbose) {
      console.log(`Agent selected ${result.files.length} files`);
      console.log(`Reasoning: ${result.reasoning}`);
      console.log(`Confidence: ${result.confidence}`);
    }

    // Validate selected files exist
    const validFiles = result.files.filter(file => {
      const fullPath = path.join(repo, file);
      return fs.existsSync(fullPath);
    });

    if (validFiles.length === 0) {
      console.error('Error: Agent selected no valid files. Falling back to naive search.');
      return false;
    }

    // Use agent-selected files
    const selected = validFiles;
    const usedTokens = selected.reduce((total, file) => {
      const size = getFileSize(file);
      return total + tokenEstimate(size);
    }, 0);

    if (args.verbose) {
      console.log(`Selected ${selected.length} files (~${usedTokens} tokens) via agent`);
      console.log('Files:', selected.slice(0, 10).join(', '));
      if (selected.length > 10) {
        console.log(`... and ${selected.length - 10} more`);
      }
    }

    // Continue with Repomix packing using agent selection
    await packWithRepomix(selected, repo, out, question, args.verbose);
    return true;
  } catch (error) {
    console.error(`Agent failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Falling back to naive search...');
    return false;
  }
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { cwd: repo, encoding: 'utf8' });
  } catch {
    return '';
  }
}

function gitFiles(): string[] {
  const out = safeExec('git ls-files');
  return out.split('\n').filter(Boolean);
}

function grepCandidates(): Set<string> {
  if (!keywords.length) return new Set();
  const pattern = keywords.map(k => `-e ${JSON.stringify(k)}`).join(' ');
  const out = safeExec(`git grep -l -i ${pattern}`);
  return new Set(out.split('\n').filter(Boolean));
}

function byName(files: string[]): Set<string> {
  const selected = new Set<string>();
  const regexes = keywords.map(k => 
    new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  );
  
  for (const file of files) {
    if (regexes.some(regex => regex.test(file))) {
      selected.add(file);
    }
  }
  return selected;
}

function mustInclude(files: string[]): Set<string> {
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
  
  return new Set(files.filter(file => 
    patterns.some(pattern => pattern.test(file))
  ));
}

function getFileSize(file: string): number {
  try {
    return fs.statSync(path.join(repo, file)).size;
  } catch {
    return 0;
  }
}

function contentHits(file: string): number {
  try {
    const content = fs.readFileSync(path.join(repo, file), 'utf8').toLowerCase();
    return keywords.reduce((count, keyword) => 
      count + (content.includes(keyword) ? 1 : 0), 0
    );
  } catch {
    return 0;
  }
}

function lastCommitScore(file: string): number {
  const timestamp = safeExec(`git log -1 --format=%ct -- ${JSON.stringify(file)}`).trim();
  if (!timestamp) return 0;
  
  const ageDays = (Date.now() / 1000 - parseInt(timestamp, 10)) / 86400;
  return Math.max(0, Math.min(1, 1 - Math.log10(1 + ageDays) / 2));
}

function tokenEstimate(chars: number): number {
  return Math.ceil(chars / 3.7);
}

async function main() {
  // Try agent selection first if requested
  if (await tryAgentSelection()) {
    return; // Agent succeeded and packed the files
  }

  // Get all files, excluding common ignore patterns
  const allFiles = gitFiles().filter(file =>
    !file.includes('node_modules/') &&
    !file.includes('dist/') &&
    !file.includes('build/') &&
    !file.includes('.git/') &&
    !file.includes('coverage/') &&
    !file.includes('.next/') &&
    !file.includes('.nuxt/') &&
    !file.includes('.vscode/') &&
    !file.includes('.idea/') &&
    !file.endsWith('.min.js') &&
    !file.endsWith('.min.css') &&
    !file.endsWith('.map') &&
    !file.endsWith('.d.ts')
  );

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
    const nameHits = keywords.reduce((count, keyword) => 
      count + (file.toLowerCase().includes(keyword) ? 1 : 0), 0
    );
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
  const selected: string[] = [];
  let usedTokens = 0;

  for (const { file, tokens } of ranked) {
    if (usedTokens + tokens > args.budget && selected.length >= 8) break;
    selected.push(file);
    usedTokens += tokens;
  }

  if (selected.length === 0) {
    console.error('Error: No relevant files found.');
    process.exit(2);
  }

  await packWithRepomix(selected, repo, out, question, args.verbose);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});