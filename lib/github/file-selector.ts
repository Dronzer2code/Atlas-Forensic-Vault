import 'server-only';
import type { FileNode } from './client';
import type { GitHubCommit } from './types';

/**
 * File selection configuration
 */
export const FILE_SELECTION_CONFIG = {
  MAX_FILES: 50,
  MAX_TOTAL_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILE_SIZE: 1024 * 1024, // 1MB per file
  RECENT_COMMITS_DAYS: 30,
};

/**
 * Priority file patterns
 */
const PRIORITY_FILES = {
  CRITICAL: [
    /^README\.(md|rst|txt)$/i,
    /^LICENSE$/i,
    /^package\.json$/,
    /^requirements\.txt$/,
    /^Cargo\.toml$/,
    /^go\.mod$/,
    /^composer\.json$/,
    /^Gemfile$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
  ],
  ENTRY_POINTS: [
    /^index\.(js|ts|jsx|tsx)$/,
    /^main\.(py|go|rs|java|cpp|c)$/,
    /^app\.(py|js|ts)$/,
    /^server\.(js|ts)$/,
    /^src\/index\./,
    /^src\/main\./,
    /^src\/app\./,
  ],
  CONFIG: [
    /^\.env\.example$/,
    /^config\.(js|ts|json|yaml|yml)$/,
    /^tsconfig\.json$/,
    /^webpack\.config\./,
    /^vite\.config\./,
    /^next\.config\./,
  ],
};

/**
 * Patterns to exclude
 */
const EXCLUDE_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /out\//,
  /\.next\//,
  /coverage\//,
  /vendor\//,
  /__pycache__\//,
  /\.pytest_cache\//,
  /target\//,
  /\.venv\//,
  /\.idea\//,
  /\.vscode\//,
  /\.test\./,
  /\.spec\./,
  /\.min\./,
  /\.bundle\./,
  /\.lock$/,
];

/**
 * File metadata for scoring
 */
export interface FileMetadata extends FileNode {
  score: number;
  category: FileCategory;
  linesOfCode?: number;
  hasInterestingComments?: boolean;
  lastModified?: Date;
  complexity?: number;
}

export type FileCategory = 
  | 'critical'
  | 'entry-point'
  | 'config'
  | 'high-complexity'
  | 'recently-modified'
  | 'standard';

/**
 * Selection result
 */
export interface SelectedFiles {
  files: FileMetadata[];
  summary: {
    totalFiles: number;
    selectedFiles: number;
    totalSize: number;
    languages: string[];
    entryPoints: string[];
    priorityFiles: string[];
    categoryBreakdown: Record<FileCategory, number>;
  };
}

/**
 * Repository statistics for context
 */
export interface RepoStats {
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  recentCommits?: GitHubCommit[];
  averageFileSize: number;
}

/**
 * File Selector Class
 */
export class FileSelector {
  /**
   * Select the most important files from a repository
   */
  async selectFiles(
    files: FileNode[],
    repoStats: RepoStats
  ): Promise<SelectedFiles> {
    // Filter out excluded files
    const validFiles = files.filter(file => 
      file.type === 'file' && 
      !this.shouldExclude(file.path) &&
      (file.size || 0) <= FILE_SELECTION_CONFIG.MAX_FILE_SIZE
    );

    // Score all files
    const scoredFiles = validFiles.map(file => 
      this.scoreFile(file, repoStats)
    );

    // Sort by score (highest first)
    scoredFiles.sort((a, b) => b.score - a.score);

    // Select top files within limits
    const selectedFiles: FileMetadata[] = [];
    let totalSize = 0;

    for (const file of scoredFiles) {
      const fileSize = file.size || 0;

      // Check limits
      if (selectedFiles.length >= FILE_SELECTION_CONFIG.MAX_FILES) {
        break;
      }

      if (totalSize + fileSize > FILE_SELECTION_CONFIG.MAX_TOTAL_SIZE) {
        break;
      }

      selectedFiles.push(file);
      totalSize += fileSize;
    }

    // Generate summary
    const summary = this.generateSummary(selectedFiles, validFiles.length);

    return {
      files: selectedFiles,
      summary,
    };
  }

  /**
   * Score a file based on multiple factors
   */
  private scoreFile(file: FileNode, repoStats: RepoStats): FileMetadata {
    let score = 0;
    let category: FileCategory = 'standard';

    // Priority files get highest base score
    if (this.matchesPatterns(file.path, PRIORITY_FILES.CRITICAL)) {
      score += 100;
      category = 'critical';
    }

    // Entry points
    if (this.matchesPatterns(file.path, PRIORITY_FILES.ENTRY_POINTS)) {
      score += 80;
      category = 'entry-point';
    }

    // Config files
    if (this.matchesPatterns(file.path, PRIORITY_FILES.CONFIG)) {
      score += 70;
      if (category === 'standard') category = 'config';
    }

    // Root-level files (higher priority)
    const depth = (file.path.match(/\//g) || []).length;
    if (depth === 0) {
      score += 40;
    } else if (depth === 1) {
      score += 20;
    }

    // Files in src/ or lib/ (common important directories)
    if (file.path.startsWith('src/') || file.path.startsWith('lib/')) {
      score += 30;
    }

    // File size complexity (larger files often more important, but not too large)
    const fileSize = file.size || 0;
    if (fileSize > 1000 && fileSize < 100000) {
      // Files between 1KB and 100KB are interesting
      score += Math.min(fileSize / 2000, 25);
      if (fileSize > 50000 && category === 'standard') {
        category = 'high-complexity';
      }
    }

    // Language-specific bonuses
    const language = file.language;
    if (language) {
      // Primary languages get bonus
      const primaryLanguages = this.getPrimaryLanguages(repoStats.languages);
      if (primaryLanguages.includes(language)) {
        score += 15;
      }
    }

    // Common important file names
    const filename = file.path.split('/').pop() || '';
    if (this.isImportantFilename(filename)) {
      score += 25;
    }

    // Penalize test files (but don't exclude them entirely)
    if (this.isTestFile(file.path)) {
      score -= 30;
    }

    // Penalize generated files
    if (this.isGeneratedFile(file.path)) {
      score -= 40;
    }

    return {
      ...file,
      score: Math.max(score, 0),
      category,
    };
  }

  /**
   * Check if file should be excluded
   */
  private shouldExclude(path: string): boolean {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
  }

  /**
   * Check if path matches any of the patterns
   */
  private matchesPatterns(path: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(path));
  }

  /**
   * Get primary languages (top 3 by usage)
   */
  private getPrimaryLanguages(languages: Record<string, number>): string[] {
    return Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang]) => lang);
  }

  /**
   * Check if filename is commonly important
   */
  private isImportantFilename(filename: string): boolean {
    const important = [
      'index',
      'main',
      'app',
      'server',
      'api',
      'routes',
      'router',
      'controller',
      'service',
      'model',
      'schema',
      'database',
      'db',
      'config',
      'constants',
      'types',
      'utils',
      'helpers',
    ];

    const baseName = filename.split('.')[0].toLowerCase();
    return important.includes(baseName);
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(path: string): boolean {
    return /\.(test|spec)\.(js|ts|jsx|tsx|py)$/.test(path) ||
           /\/tests?\//.test(path) ||
           /__tests__\//.test(path);
  }

  /**
   * Check if file is likely generated
   */
  private isGeneratedFile(path: string): boolean {
    return /-generated\.(js|ts)$/.test(path) ||
           /\.generated\./.test(path) ||
           /generated\//.test(path) ||
           /dist\//.test(path) ||
           /\.min\.(js|css)$/.test(path);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(
    selectedFiles: FileMetadata[],
    totalFiles: number
  ): SelectedFiles['summary'] {
    const totalSize = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    
    const languages = Array.from(
      new Set(selectedFiles.map(f => f.language).filter(Boolean))
    ) as string[];

    const entryPoints = selectedFiles
      .filter(f => f.category === 'entry-point' || f.category === 'critical')
      .map(f => f.path);

    const priorityFiles = selectedFiles
      .filter(f => f.category === 'critical')
      .map(f => f.path);

    const categoryBreakdown = selectedFiles.reduce((acc, file) => {
      acc[file.category] = (acc[file.category] || 0) + 1;
      return acc;
    }, {} as Record<FileCategory, number>);

    return {
      totalFiles,
      selectedFiles: selectedFiles.length,
      totalSize,
      languages,
      entryPoints,
      priorityFiles,
      categoryBreakdown,
    };
  }

  /**
   * Analyze file content for interesting patterns
   */
  async analyzeFileContent(content: string): Promise<{
    linesOfCode: number;
    hasInterestingComments: boolean;
    complexity: number;
    interestingComments?: string[];
  }> {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('#') &&
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('*');
    }).length;

    // Find interesting comments
    const interestingComments: string[] = [];
    const commentRegex = /(\/\/|#)\s*(TODO|FIXME|BUG|HACK|XXX|OPTIMIZE).*$/gim;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      interestingComments.push(match[0].trim());
    }

    const hasInterestingComments = interestingComments.length > 0;

    // Simple complexity estimation
    const functionMatches = content.match(/function|def |class |interface |type /g) || [];
    const complexity = functionMatches.length;

    return {
      linesOfCode,
      hasInterestingComments,
      complexity,
      interestingComments: interestingComments.length > 0 ? interestingComments : undefined,
    };
  }

  /**
   * Filter files by commit recency
   */
  filterByRecentCommits(
    files: FileMetadata[],
    commits: GitHubCommit[],
    daysBack: number = FILE_SELECTION_CONFIG.RECENT_COMMITS_DAYS
  ): FileMetadata[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentlyModifiedPaths = new Set<string>();

    for (const commit of commits) {
      const commitDate = new Date(commit.commit.author.date);
      if (commitDate >= cutoffDate) {
        // In a real implementation, you'd parse commit data to get file paths
        // For now, we'll mark this as a placeholder
        // recentlyModifiedPaths.add(filepath);
      }
    }

    // Boost scores for recently modified files
    return files.map(file => {
      if (recentlyModifiedPaths.has(file.path)) {
        return {
          ...file,
          score: file.score + 30,
          category: 'recently-modified' as FileCategory,
          lastModified: new Date(),
        };
      }
      return file;
    });
  }

  /**
   * Get file selection explanation
   */
  explainSelection(selectedFiles: SelectedFiles): string {
    const { summary } = selectedFiles;
    
    let explanation = `Selected ${summary.selectedFiles} of ${summary.totalFiles} files `;
    explanation += `(${(summary.totalSize / 1024).toFixed(2)} KB)\n\n`;

    explanation += `Languages: ${summary.languages.join(', ')}\n\n`;

    explanation += `Priority Files (${summary.priorityFiles.length}):\n`;
    summary.priorityFiles.forEach(file => {
      explanation += `  - ${file}\n`;
    });

    explanation += `\nEntry Points (${summary.entryPoints.length}):\n`;
    summary.entryPoints.forEach(file => {
      explanation += `  - ${file}\n`;
    });

    explanation += `\nCategory Breakdown:\n`;
    Object.entries(summary.categoryBreakdown).forEach(([category, count]) => {
      explanation += `  ${category}: ${count}\n`;
    });

    return explanation;
  }
}

/**
 * Singleton instance
 */
let selectorInstance: FileSelector | null = null;

export function getFileSelector(): FileSelector {
  if (!selectorInstance) {
    selectorInstance = new FileSelector();
  }
  return selectorInstance;
}

/**
 * Convenience function for selecting files
 */
export async function selectImportantFiles(
  files: FileNode[],
  repoStats: RepoStats
): Promise<SelectedFiles> {
  const selector = getFileSelector();
  return selector.selectFiles(files, repoStats);
}
