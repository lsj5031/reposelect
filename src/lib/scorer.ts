/**
 * Scoring algorithms for file ranking
 */
import * as path from 'path';
import {
  SOURCE_FILE_EXTENSIONS,
  SOURCE_FILE_EXTENSION_BONUS,
  TOKENS_PER_CHAR
} from './config';
import { FileScanner } from './scanner';

export interface ScoredFile {
  file: string;
  score: number;
  size: number;
  tokens: number;
}

export interface ScorerConfig {
  keywords: string[];
  scanner: FileScanner;
}

export class FileScorer {
  private keywords: string[];
  private scanner: FileScanner;

  constructor(config: ScorerConfig) {
    this.keywords = config.keywords;
    this.scanner = config.scanner;
  }

  /**
   * Count keyword matches in filename (case-insensitive)
   */
  filenameScore(file: string): number {
    const lowercase = file.toLowerCase();
    return this.keywords.reduce((count, keyword) =>
      count + (lowercase.includes(keyword) ? 1 : 0), 0
    );
  }

  /**
   * Count keyword matches in file content
   */
  contentScore(file: string): number {
    const content = this.scanner.getFileContent(file);
    return this.keywords.reduce((count, keyword) =>
      count + (content.includes(keyword) ? 1 : 0), 0
    );
  }

  /**
   * Calculate recency score based on last commit
   * Returns a value between 0 and 1, with recent files scoring higher
   */
  recencyScore(file: string): number {
    const timestamp = this.scanner.getLastCommitTimestamp(file);
    if (!timestamp) return 0;
    
    const ageDays = (Date.now() / 1000 - timestamp) / 86400;
    return Math.max(0, Math.min(1, 1 - Math.log10(1 + ageDays) / 2));
  }

  /**
   * Calculate size penalty (log scale)
   * Larger files are penalized to avoid bloat
   */
  sizePenalty(size: number): number {
    return Math.log10(1 + size) / 10;
  }

  /**
   * Check if file has a "source" extension (code, config, docs)
   */
  fileTypeBonus(file: string): number {
    const ext = path.extname(file).toLowerCase();
    return SOURCE_FILE_EXTENSIONS.includes(ext) ? SOURCE_FILE_EXTENSION_BONUS : 0;
  }

  /**
   * Convert bytes to approximate token count
   */
  tokenEstimate(bytes: number): number {
    return Math.ceil(bytes / TOKENS_PER_CHAR);
  }

  /**
   * Score a single file based on all criteria
   * Weights: nameHits (3x), contentHits (2x), recency (1x), size penalty (-0.5x), type bonus (+1x)
   */
  score(file: string): ScoredFile {
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

  /**
   * Score multiple files and return sorted by score descending
   */
  scoreMany(files: string[]): ScoredFile[] {
    return files
      .map(file => this.score(file))
      .sort((a, b) => b.score - a.score);
  }
}
