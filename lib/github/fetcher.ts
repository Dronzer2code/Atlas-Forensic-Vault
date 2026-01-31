import 'server-only';
import { getGitHubClient } from './client';
import { getFileSelector, type SelectedFiles, type RepoStats } from './file-selector';
import type { GitHubRepo, RepoStructure, FileNode } from './client';
import { GitHubApiError } from './config';

/**
 * Complete repository analysis result
 */
export interface CompleteRepoAnalysis {
  repository: GitHubRepo;
  structure: RepoStructure;
  selectedFiles: SelectedFiles;
  filesWithContent: FileWithContent[];
  statistics: AnalysisStatistics;
}

export interface FileWithContent extends FileNode {
  content: string;
  category: 'critical' | 'entry-point' | 'config' | 'high-complexity' | 'recently-modified' | 'standard';
  analysis: {
    linesOfCode: number;
    hasInterestingComments: boolean;
    complexity: number;
    interestingComments?: string[];
  };
}

export interface AnalysisStatistics {
  totalFiles: number;
  analyzedFiles: number;
  totalSize: number;
  analyzedSize: number;
  languages: Record<string, number>;
  processingTime: number;
  errors: string[];
}

/**
 * Enhanced GitHub Fetcher
 */
export class GitHubFetcher {
  private client = getGitHubClient();
  private selector = getFileSelector();

  /**
   * Fetch and analyze a complete repository
   */
  async fetchCompleteRepository(
    owner: string,
    repo: string,
    options?: {
      branch?: string;
      maxFiles?: number;
      includeContent?: boolean;
    }
  ): Promise<CompleteRepoAnalysis> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Step 1: Fetch repository metadata
      console.log(`[Fetcher] Fetching repository: ${owner}/${repo}`);
      const repository = await this.client.getRepository(owner, repo);

      // Step 2: Get repository structure
      console.log(`[Fetcher] Fetching repository structure...`);
      const structure = await this.client.getRepoStructure(
        owner,
        repo,
        options?.branch || repository.defaultBranch
      );

      // Step 3: Get recent commits and languages for context
      console.log(`[Fetcher] Fetching additional context...`);
      const [commits, languages] = await Promise.all([
        this.client.getRecentCommits(owner, repo, 10, options?.branch).catch(err => {
          errors.push(`Failed to fetch commits: ${err.message}`);
          return [];
        }),
        this.client.getLanguages(owner, repo).catch(err => {
          errors.push(`Failed to fetch languages: ${err.message}`);
          return {};
        }),
      ]);

      // Step 4: Prepare repo stats for file selection
      const repoStats: RepoStats = {
        totalFiles: structure.totalFiles,
        totalSize: structure.totalSize,
        languages: structure.languages,
        recentCommits: commits,
        averageFileSize: structure.totalSize / structure.totalFiles,
      };

      // Step 5: Select important files
      console.log(`[Fetcher] Selecting important files from ${structure.files.length} total files...`);
      const selectedFiles = await this.selector.selectFiles(structure.files, repoStats);
      console.log(`[Fetcher] Selected ${selectedFiles.summary.selectedFiles} files`);

      // Step 6: Fetch content for selected files (if requested)
      let filesWithContent: FileWithContent[] = [];
      if (options?.includeContent !== false) {
        console.log(`[Fetcher] Fetching content for selected files...`);
        filesWithContent = await this.fetchFileContents(
          owner,
          repo,
          selectedFiles.files,
          options?.branch || repository.defaultBranch,
          errors
        );
      }

      // Step 7: Generate statistics
      const processingTime = Date.now() - startTime;
      const analyzedSize = filesWithContent.reduce((sum, f) => sum + (f.size || 0), 0);

      const statistics: AnalysisStatistics = {
        totalFiles: structure.totalFiles,
        analyzedFiles: filesWithContent.length,
        totalSize: structure.totalSize,
        analyzedSize,
        languages,
        processingTime,
        errors,
      };

      console.log(`[Fetcher] Analysis complete in ${processingTime}ms`);

      return {
        repository,
        structure,
        selectedFiles,
        filesWithContent,
        statistics,
      };
    } catch (error) {
      console.error(`[Fetcher] Error analyzing repository:`, error);
      throw new GitHubApiError(
        error instanceof Error ? error.message : 'Failed to analyze repository',
        500,
        error
      );
    }
  }

  /**
   * Fetch content for multiple files
   */
  private async fetchFileContents(
    owner: string,
    repo: string,
    files: import('./file-selector').FileMetadata[],
    branch: string,
    errors: string[]
  ): Promise<FileWithContent[]> {
    const filesWithContent: FileWithContent[] = [];

    // Fetch files in batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          try {
            const content = await this.client.getFileContent(
              owner,
              repo,
              file.path,
              branch
            );

            const analysis = await this.selector.analyzeFileContent(content);

            return {
              ...file,
              content,
              category: file.category,
              analysis,
            } as FileWithContent;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to fetch ${file.path}: ${errorMsg}`);
            throw error;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          filesWithContent.push(result.value);
        }
      }

      // Log progress
      console.log(
        `[Fetcher] Fetched ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files`
      );
    }

    return filesWithContent;
  }

  /**
   * Fetch only specific files by path
   */
  async fetchSpecificFiles(
    owner: string,
    repo: string,
    filePaths: string[],
    branch?: string
  ): Promise<FileWithContent[]> {
    const errors: string[] = [];
    const repository = await this.client.getRepository(owner, repo);
    const targetBranch = branch || repository.defaultBranch;

    const filesWithContent: FileWithContent[] = [];

    for (const path of filePaths) {
      try {
        const content = await this.client.getFileContent(owner, repo, path, targetBranch);
        const analysis = await this.selector.analyzeFileContent(content);

        filesWithContent.push({
          path,
          type: 'file',
          content,
          category: 'standard', // Default category for manually specified files
          analysis,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to fetch ${path}: ${errorMsg}`);
        console.warn(`[Fetcher] ${errorMsg}`);
      }
    }

    if (errors.length > 0) {
      console.warn(`[Fetcher] Completed with ${errors.length} errors`);
    }

    return filesWithContent;
  }

  /**
   * Get a quick summary without fetching all content
   */
  async fetchQuickSummary(owner: string, repo: string): Promise<{
    repository: GitHubRepo;
    fileCount: number;
    languages: Record<string, number>;
    recentActivity: string;
  }> {
    const [repository, structure, commits, languages] = await Promise.all([
      this.client.getRepository(owner, repo),
      this.client.getRepoStructure(owner, repo),
      this.client.getRecentCommits(owner, repo, 1),
      this.client.getLanguages(owner, repo),
    ]);

    const recentActivity = commits[0]
      ? `${commits[0].commit.message.split('\n')[0]} by ${commits[0].commit.author.name}`
      : 'No recent commits';

    return {
      repository,
      fileCount: structure.totalFiles,
      languages,
      recentActivity,
    };
  }

  /**
   * Validate if repository is suitable for analysis
   */
  async validateRepository(owner: string, repo: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const repository = await this.client.getRepository(owner, repo);

      // Check if private (may need token)
      if (repository.isPrivate) {
        return {
          valid: false,
          reason: 'Repository is private. Add GITHUB_TOKEN to access.',
        };
      }

      // Check size (skip very large repos)
      if (repository.size > 500000) {
        // 500MB
        return {
          valid: false,
          reason: 'Repository too large (>500MB). This may take too long to analyze.',
        };
      }

      // Check if empty
      if (repository.size === 0) {
        return {
          valid: false,
          reason: 'Repository appears to be empty.',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Failed to validate repository',
      };
    }
  }

  /**
   * Fetch entire repository (simplified version - reads ALL files)
   */
  async fetchFullRepository(
    owner: string,
    repo: string,
    options?: {
      branch?: string;
      maxFiles?: number;
      maxFileSize?: number;
    }
  ): Promise<{
    repository: GitHubRepo;
    allFiles: FileNode[];
    filesWithContent: FileWithContent[];
    statistics: AnalysisStatistics;
  }> {
    const startTime = Date.now();
    const maxFiles = options?.maxFiles || 100;
    const maxFileSize = options?.maxFileSize || 100 * 1024; // 100KB per file
    const errors: string[] = [];

    console.log(`[Fetcher] Starting FULL repository scan: ${owner}/${repo}`);

    // Get repository metadata
    const repository = await this.client.getRepository(owner, repo);
    console.log(`[Fetcher] Repository: ${repository.fullName} (${repository.language})`);

    // Get complete file structure
    const structure = await this.client.getRepoStructure(
      owner,
      repo,
      options?.branch || repository.defaultBranch
    );

    console.log(`[Fetcher] Found ${structure.totalFiles} total files`);

    // Filter files: only code files, exclude build/node_modules/etc
    const codeFiles = structure.files.filter(file => {
      if (file.type !== 'file') return false;
      
      // Exclude patterns
      const excludePatterns = [
        /node_modules/,
        /dist\//,
        /build\//,
        /\.next\//,
        /\.git\//,
        /\.min\./,
        /\.bundle\./,
        /package-lock\.json/,
        /yarn\.lock/,
        /\.map$/,
      ];

      if (excludePatterns.some(pattern => pattern.test(file.path))) {
        return false;
      }

      // Include code file extensions
      const codeExtensions = [
        '.js', '.jsx', '.ts', '.tsx',
        '.py', '.java', '.go', '.rs',
        '.rb', '.php', '.c', '.cpp', '.h', '.hpp',
        '.cs', '.swift', '.kt', '.scala',
        '.vue', '.svelte', '.md',
        '.json', '.yml', '.yaml', '.toml',
        '.html', '.css', '.scss', '.sass',
        'Makefile', 'Kconfig', '.mk',
      ];

      return codeExtensions.some(ext => file.path.endsWith(ext));
    });

    console.log(`[Fetcher] Filtered to ${codeFiles.length} code files`);

    // Limit files if needed
    const filesToFetch = codeFiles.slice(0, maxFiles);
    console.log(`[Fetcher] Fetching content for ${filesToFetch.length} files...`);

    // Fetch file contents
    const filesWithContent: FileWithContent[] = [];
    let totalSize = 0;

    for (const file of filesToFetch) {
      if (!file.size || file.size > maxFileSize) {
        console.log(`[Fetcher] Skipping ${file.path} (size: ${file.size || 'unknown'})`);
        continue;
      }

      try {
        const content = await this.client.getFileContent(
          owner,
          repo,
          file.path,
          options?.branch || repository.defaultBranch
        );

        // Analyze file
        const lines = content.split('\n');
        const interestingComments: string[] = [];
        
        // Find TODO/FIXME/BUG/HACK comments
        lines.forEach((line, idx) => {
          const match = line.match(/(TODO|FIXME|BUG|HACK|XXX):\s*(.+)/i);
          if (match) {
            interestingComments.push(`Line ${idx + 1}: ${match[0].trim()}`);
          }
        });

        filesWithContent.push({
          ...file,
          content,
          category: 'standard',
          analysis: {
            linesOfCode: lines.length,
            hasInterestingComments: interestingComments.length > 0,
            complexity: Math.min(lines.length / 100, 10), // Simple complexity score
            interestingComments: interestingComments.slice(0, 3),
          },
        });

        totalSize += file.size;
        
        if (filesWithContent.length % 10 === 0) {
          console.log(`[Fetcher] Progress: ${filesWithContent.length}/${filesToFetch.length} files fetched`);
        }
      } catch (error) {
        errors.push(`Failed to fetch ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`[Fetcher] Error fetching ${file.path}:`, error);
      }
    }

    // Calculate language statistics
    const languages: Record<string, number> = {};
    filesWithContent.forEach(file => {
      const ext = file.path.split('.').pop() || 'unknown';
      languages[ext] = (languages[ext] || 0) + 1;
    });

    const processingTime = Date.now() - startTime;

    console.log(`[Fetcher] ✅ Complete! Fetched ${filesWithContent.length} files in ${processingTime}ms`);

    return {
      repository,
      allFiles: codeFiles,
      filesWithContent,
      statistics: {
        totalFiles: structure.totalFiles,
        analyzedFiles: filesWithContent.length,
        totalSize: structure.totalSize,
        analyzedSize: totalSize,
        languages,
        processingTime,
        errors,
      },
    };
  }

  /**
   * Get repository metadata only (no files)
   */
  async getRepoMetadata(owner: string, repo: string): Promise<GitHubRepo> {
    return this.client.getRepository(owner, repo);
  }
}

/**
 * Singleton instance
 */
let fetcherInstance: GitHubFetcher | null = null;

export function getGitHubFetcher(): GitHubFetcher {
  if (!fetcherInstance) {
    fetcherInstance = new GitHubFetcher();
  }
  return fetcherInstance;
}

/**
 * Convenience function
 */
export async function analyzeRepository(
  owner: string,
  repo: string,
  options?: {
    branch?: string;
    includeContent?: boolean;
  }
): Promise<CompleteRepoAnalysis> {
  const fetcher = getGitHubFetcher();
  return fetcher.fetchCompleteRepository(owner, repo, options);
}
