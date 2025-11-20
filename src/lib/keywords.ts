/**
 * Keyword extraction from natural language questions
 */
import { COMMON_STOPWORDS, MUST_INCLUDE_PATTERNS } from './config';
import { FileScanner } from './scanner';

export class KeywordExtractor {
  /**
   * Extract keywords from a question
   * - Filters out stopwords
   * - Keeps only alphanumeric + underscore, 3+ chars
   * - Deduplicates
   */
  static extract(question: string): string[] {
    return Array.from(new Set(
      (question.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [])
        .filter(w => !COMMON_STOPWORDS.includes(w))
    ));
  }
}

/**
 * File selection helpers
 */
export class FileSelector {
  /**
   * Select files by name matching keywords
   */
  static byName(files: string[], keywords: string[]): Set<string> {
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

  /**
   * Select files that must be included (config, docs, package management)
   */
  static mustInclude(files: string[]): Set<string> {
    return new Set(files.filter(file =>
      MUST_INCLUDE_PATTERNS.some(pattern => pattern.test(file))
    ));
  }
}
