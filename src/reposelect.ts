#!/usr/bin/env node
import * as path from 'path';
import * as yargs from 'yargs';
import { FactoryAgent } from './agent/factory-agent';
import { OpenCodeAgent } from './agent/opencode-agent';
import { Packer } from './lib/packer';
import { DEFAULT_BUDGET } from './lib/config';

interface Args {
  _: string[];
  repo: string;
  out: string;
  budget: number;
  verbose: boolean;
  agent?: 'factory' | 'opencode';
  smart: boolean;
  'dry-run': boolean;
  top?: number;
  format: 'xml' | 'markdown' | 'json';
}

const args = yargs
  .usage('Usage: reposelect <question> [options]')
  .demandCommand(1)
  .option('repo', { alias: 'r', type: 'string', default: process.cwd() })
  .option('out', { alias: 'o', type: 'string', default: 'context.xml' })
  .option('budget', { alias: 'b', type: 'number', default: DEFAULT_BUDGET })
  .option('verbose', { alias: 'v', type: 'boolean', default: false })
  .option('agent', { choices: ['factory', 'opencode'] })
  .option('smart', { type: 'boolean', describe: 'Auto-pick best available agent' })
  .option('dry-run', { type: 'boolean', describe: 'Show what agent selected' })
  .option('top', { type: 'number', describe: 'Limit dry-run preview' })
  .option('format', { alias: 'f', choices: ['xml', 'markdown', 'json'], default: 'xml' })
  .help()
  .argv as Args;

const question = String(args._[0]);
const repo = path.resolve(args.repo);
const out = path.resolve(args.out);

async function run() {
  const agentConfig = {
    repoPath: repo,
    question,
    tokenBudget: args.budget,
    verbose: args.verbose
  };

  const agentsToTry = args.smart || !args.agent
    ? ['factory', 'opencode']
    : [args.agent!];

  let selectedFiles: string[] | null = null;
  let reasoning = '';
  let source = '';

  for (const agentName of agentsToTry) {
    let agent;
    if (agentName === 'factory') {
      agent = new FactoryAgent(agentConfig);
    } else {
      agent = new OpenCodeAgent(agentConfig);
    }

    try {
      if (args.verbose) {
        console.log(`Trying ${agentName} agent...`);
      }
      const result = await agent.selectFiles();

      selectedFiles = result.files;
      reasoning = result.reasoning || '';
      source = agentName;

      console.log(`${agentName} succeeded → ${selectedFiles.length} files (confidence: ${result.confidence?.toFixed(2) || 'N/A'})`);
      break;
    } catch (err) {
      if (args.verbose) {
        console.log(`${agentName} unavailable or failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  if (!selectedFiles || selectedFiles.length === 0) {
    console.error('\nNo agent could select files.');
    console.error('Available agents: factory, opencode');
    console.error('\nInstall agents with:');
    console.error('   Factory → curl -fsSL https://app.factory.ai/cli | sh');
    console.error('   OpenCode → https://opencode.ai');
    process.exit(1);
  }

  if (args['dry-run']) {
    console.log(`\nTop ${args.top || 20} files selected by ${source}:\n`);
    selectedFiles.slice(0, args.top || 20).forEach((f, i) => {
      console.log(`${(i+1).toString().padStart(2)}. ${f}`);
    });
    if (selectedFiles.length > (args.top || 20)) {
      console.log(`... and ${selectedFiles.length - (args.top || 20)} more`);
    }
    console.log(`\nReasoning: ${reasoning}`);
    process.exit(0);
  }

  const packer = new Packer({ repoPath: repo, outputPath: out, verbose: args.verbose });
  await packer.pack(selectedFiles, question, args.format);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
