/**
 * Repomix integration for packing selected files
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PackerConfig {
  repoPath: string;
  outputPath: string;
  verbose?: boolean;
}

export class Packer {
  private repoPath: string;
  private outputPath: string;
  private verbose: boolean;

  constructor(config: PackerConfig) {
    this.repoPath = config.repoPath;
    this.outputPath = config.outputPath;
    this.verbose = config.verbose ?? false;
  }

  /**
   * Estimate tokens from file size (chars / 3.7)
   */
  private tokenEstimate(bytes: number): number {
    return Math.ceil(bytes / 3.7);
  }

  /**
   * Calculate total tokens used by selected files
   */
  private calculateTotalTokens(files: string[]): number {
    return files.reduce((total, file) => {
      try {
        const size = fs.statSync(path.join(this.repoPath, file)).size;
        return total + this.tokenEstimate(size);
      } catch {
        return total;
      }
    }, 0);
  }

  /**
   * Ensure repomix instruction file exists
   */
  private ensureInstructionFile(question: string): void {
    const instructionFile = path.join(this.repoPath, 'repomix-instruction.md');
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
  }

  /**
   * Pack files using Repomix
   */
  async pack(files: string[], question: string): Promise<void> {
    const usedTokens = this.calculateTotalTokens(files);

    if (this.verbose) {
      console.log(`Selected ${files.length} files (~${usedTokens} tokens)`);
      console.log('Files:', files.slice(0, 10).join(', '));
      if (files.length > 10) {
        console.log(`... and ${files.length - 10} more`);
      }
    }

    // Ensure instruction file exists
    this.ensureInstructionFile(question);

    // Pack with Repomix
    const relativeOut = path.relative(this.repoPath, this.outputPath);
    const repomixArgs = [
      '--stdin',
      '--style', 'xml',
      '--remove-comments',
      '--output', relativeOut,
      '--instruction-file-path', 'repomix-instruction.md'
    ];

    const result = spawnSync('repomix', repomixArgs, {
      cwd: this.repoPath,
      input: files.join('\n') + '\n',
      stdio: ['pipe', 'inherit', 'inherit']
    });

    if ((result.status ?? 0) !== 0) {
      console.error('Error: Repomix failed. Make sure repomix is installed: npm install -g repomix');
      process.exit(result.status ?? 1);
    }

    console.log(`✓ Packed ${files.length} files (~${usedTokens} tokens) → ${this.outputPath}`);
  }
}
