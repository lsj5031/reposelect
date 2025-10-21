/**
 * Base interface for LLM agents that can intelligently select files
 */
export interface AgentResult {
  files: string[];
  reasoning?: string;
  confidence?: number;
}

export interface AgentConfig {
  repoPath: string;
  question: string;
  tokenBudget: number;
  verbose: boolean;
}

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  abstract selectFiles(): Promise<AgentResult>;

  protected log(message: string): void {
    if (this.config.verbose) {
      console.log(`[${this.constructor.name}] ${message}`);
    }
  }

  protected safeExec(cmd: string, cwd?: string): { stdout: string; stderr: string; status: number | null } {
    const { spawnSync } = require('child_process');
    const result = spawnSync(cmd, { 
      shell: true, 
      cwd: cwd || this.config.repoPath,
      encoding: 'utf8'
    });
    
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status
    };
  }
}