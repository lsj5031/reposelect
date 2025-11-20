/**
 * File system and Git operations
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { IGNORE_PATTERNS, FILE_EXCLUDE_SUFFIXES } from './config';

export interface ScannerConfig {
  repoPath: string;
  verbose?: boolean;
}

export class FileScanner {
  private repoPath: string;
  private verbose: boolean;

  constructor(config: ScannerConfig) {
    this.repoPath = config.repoPath;
    this.verbose = config.verbose ?? false;
  }

  private safeExec(cmd: string): string {
    try {
      return execSync(cmd, { cwd: this.repoPath, encoding: 'utf8' });
    } catch {
      return '';
    }
  }

  /**
   * Get all files tracked by git
   */
  gitFiles(): string[] {
    const out = this.safeExec('git ls-files');
    return out.split('\n').filter(Boolean);
  }

  /**
   * Filter out files that match ignore patterns
   */
  filterIgnored(files: string[]): string[] {
    return files.filter(file => {
      // Check for directory patterns
      for (const pattern of IGNORE_PATTERNS) {
        if (file.includes(pattern)) {
          return false;
        }
      }
      // Check for file suffixes
      for (const suffix of FILE_EXCLUDE_SUFFIXES) {
        if (file.endsWith(suffix)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get all candidate files from git
   */
  getAllFiles(): string[] {
    const files = this.gitFiles();
    return this.filterIgnored(files);
  }

  /**
   * Search for files matching keywords using git grep
   */
  grepFiles(keywords: string[]): Set<string> {
    if (!keywords.length) return new Set();
    
    const pattern = keywords.map(k => `-e ${JSON.stringify(k)}`).join(' ');
    const out = this.safeExec(`git grep -l -i ${pattern}`);
    return new Set(out.split('\n').filter(Boolean));
  }

  /**
   * Get file size in bytes
   */
  getFileSize(file: string): number {
    try {
      return fs.statSync(path.join(this.repoPath, file)).size;
    } catch {
      return 0;
    }
  }

  /**
   * Get file content (lowercase for search)
   */
  getFileContent(file: string): string {
    try {
      return fs.readFileSync(path.join(this.repoPath, file), 'utf8').toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Get timestamp of last commit for a file (in seconds since epoch)
   */
  getLastCommitTimestamp(file: string): number {
    const timestamp = this.safeExec(`git log -1 --format=%ct -- ${JSON.stringify(file)}`).trim();
    if (!timestamp) return 0;
    return parseInt(timestamp, 10);
  }
}
