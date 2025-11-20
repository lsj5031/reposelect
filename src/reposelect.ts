#!/usr/bin/env node
/**
 * reposelect.ts – minimal "RepoPrompt-Lite"
 * Usage:
 *   reposelect "How is JWT validated?" --repo . --out context.xml
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import { FactoryAgent } from './agent/factory-agent';
import { OpenCodeAgent } from './agent/opencode-agent';
import { FileScanner } from './lib/scanner';
import { FileScorer } from './lib/scorer';
import { Packer } from './lib/packer';
import { KeywordExtractor, FileSelector } from './lib/keywords';
import { DEFAULT_BUDGET, MIN_SELECTED_FILES } from './lib/config';

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
    default: DEFAULT_BUDGET,
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

const repo = path.resolve(args.repo);
const out = path.resolve(args.out);

// Extract keywords from question
const keywords = KeywordExtractor.extract(question);

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
    const packer = new Packer({
      repoPath: repo,
      outputPath: out,
      verbose: args.verbose
    });
    
    await packer.pack(validFiles, question);
    return true;
  } catch (error) {
    console.error(`Agent failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Falling back to naive search...');
    return false;
  }
}

// Initialize scanner and scorer
const scanner = new FileScanner({
  repoPath: repo,
  verbose: args.verbose
});

const scorer = new FileScorer({
  keywords,
  scanner
});

async function main() {
  // Try agent selection first if requested
  if (await tryAgentSelection()) {
    return; // Agent succeeded and packed the files
  }

  // Get all files (filtered by scanner)
  const allFiles = scanner.getAllFiles();

  // Find candidate files by various criteria
  const candidates = Array.from(new Set([
    ...FileSelector.byName(allFiles, keywords),
    ...scanner.grepFiles(keywords),
    ...FileSelector.mustInclude(allFiles)
  ]));

  if (args.verbose) {
    console.log(`Found ${candidates.length} candidate files`);
  }

  // Rank candidates by score
  const ranked = scorer.scoreMany(candidates);

  // Select files within token budget
  const selected: string[] = [];
  let usedTokens = 0;

  for (const { file, tokens } of ranked) {
    if (usedTokens + tokens > args.budget && selected.length >= MIN_SELECTED_FILES) break;
    selected.push(file);
    usedTokens += tokens;
  }

  if (selected.length === 0) {
    console.error('Error: No relevant files found.');
    process.exit(2);
  }

  // Pack files using Repomix
  const packer = new Packer({
    repoPath: repo,
    outputPath: out,
    verbose: args.verbose
  });
  
  await packer.pack(selected, question);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});