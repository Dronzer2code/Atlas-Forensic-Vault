import 'server-only';
import { getOctokit, checkRateLimit, retryWithBackoff, FETCH_CONFIG } from './config';
import {
  GitHubApiError,
  RateLimitError,
  RepositoryNotFoundError,
  RepositoryAccessDeniedError,
} from './config';
import type {
  GitHubCommit,
  GitHubLanguages,
} from './types';

/**
 * Client-specific interfaces
 */
export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  language: string;
  size: number; // in KB
  lastUpdated: string;
  defaultBranch: string;
  owner: string;
  url: string;
  isPrivate: boolean;
  topics: string[];
}

export interface FileNode {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  content?: string;
  language?: string;
  sha?: string;
}

export interface RepoStructure {
  root: FileNode;
  files: FileNode[];
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>; // percentage
}

export interface BranchInfo {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * Simple in-memory cache
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new SimpleCache();

/**
 * GitHub API Client
 */
export class GitHubClient {
  private octokit = getOctokit();

  /**
   * Check rate limit and throw error if too low
   */
  private async ensureRateLimit(): Promise<void> {
    const rateLimit = await checkRateLimit();

    if (!rateLimit.canProceed || rateLimit.remaining < 10) {
      throw new RateLimitError(
        `Rate limit too low: ${rateLimit.remaining} requests remaining. Resets at ${rateLimit.reset.toISOString()}`,
        rateLimit.reset
      );
    }
  }

  /**
   * Get repository metadata
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    const cacheKey = `repo:${owner}/${repo}`;
    const cached = cache.get<GitHubRepo>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        const { data } = await this.octokit.repos.get({
          owner,
          repo,
        });

        const repoData: GitHubRepo = {
          name: data.name,
          fullName: data.full_name,
          description: data.description || '',
          stars: data.stargazers_count,
          language: data.language || 'Unknown',
          size: data.size,
          lastUpdated: data.updated_at,
          defaultBranch: data.default_branch,
          owner: data.owner.login,
          url: data.html_url,
          isPrivate: data.private,
          topics: data.topics || [],
        };

        cache.set(cacheKey, repoData);
        return repoData;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          
          if (status === 404) {
            throw new RepositoryNotFoundError(`${owner}/${repo}`);
          }
          
          if (status === 403) {
            throw new RepositoryAccessDeniedError(`${owner}/${repo}`);
          }
          
          if (status === 401) {
            throw new GitHubApiError('Invalid GitHub token', 401);
          }
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch repository',
          500,
          error
        );
      }
    });
  }

  /**
   * Get complete repository file tree
   */
  async getRepoStructure(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<RepoStructure> {
    const cacheKey = `structure:${owner}/${repo}:${branch || 'default'}`;
    const cached = cache.get<RepoStructure>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        // Get repository info to determine default branch if not provided
        const repoInfo = await this.getRepository(owner, repo);
        const targetBranch = branch || repoInfo.defaultBranch;

        // Get the tree recursively
        const { data: treeData } = await this.octokit.git.getTree({
          owner,
          repo,
          tree_sha: targetBranch,
          recursive: 'true',
        });

        // Filter and process files
        const files: FileNode[] = treeData.tree
          .filter((node) => node.path && this.shouldIncludeFile(node.path))
          .map((node) => ({
            path: node.path!,
            type: node.type === 'blob' ? 'file' as const : 'dir' as const,
            size: node.size,
            sha: node.sha,
            language: node.path ? this.detectLanguage(node.path) : undefined,
          }));

        // Calculate statistics
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const languages = this.calculateLanguageDistribution(files);

        // Build root structure
        const root: FileNode = {
          path: '/',
          type: 'dir',
          size: totalSize,
        };

        const structure: RepoStructure = {
          root,
          files,
          totalFiles: files.filter(f => f.type === 'file').length,
          totalSize,
          languages,
        };

        cache.set(cacheKey, structure);
        return structure;
      } catch (error: unknown) {
        if (error instanceof GitHubApiError) {
          throw error;
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch repository structure',
          500,
          error
        );
      }
    });
  }

  /**
   * Get file content
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<string> {
    const cacheKey = `file:${owner}/${repo}:${path}:${branch || 'default'}`;
    const cached = cache.get<string>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        const params: { owner: string; repo: string; path: string; ref?: string } = {
          owner,
          repo,
          path,
        };

        if (branch) {
          params.ref = branch;
        }

        const { data } = await this.octokit.repos.getContent(params);

        if (Array.isArray(data) || data.type !== 'file') {
          throw new GitHubApiError('Path is not a file', 400);
        }

        if (!data.content) {
          throw new GitHubApiError('File has no content', 400);
        }

        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Check file size limit
        if (data.size > FETCH_CONFIG.MAX_FILE_SIZE) {
          throw new GitHubApiError(
            `File too large: ${data.size} bytes (max: ${FETCH_CONFIG.MAX_FILE_SIZE})`,
            413
          );
        }

        cache.set(cacheKey, content);
        return content;
      } catch (error: unknown) {
        if (error instanceof GitHubApiError) {
          throw error;
        }

        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          
          if (status === 404) {
            throw new GitHubApiError(`File not found: ${path}`, 404);
          }
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch file content',
          500,
          error
        );
      }
    });
  }

  /**
   * Get branch information
   */
  async getBranchInfo(
    owner: string,
    repo: string,
    branch: string
  ): Promise<BranchInfo> {
    const cacheKey = `branch:${owner}/${repo}:${branch}`;
    const cached = cache.get<BranchInfo>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        const { data } = await this.octokit.repos.getBranch({
          owner,
          repo,
          branch,
        });

        const branchInfo: BranchInfo = {
          name: data.name,
          commit: {
            sha: data.commit.sha,
            url: data.commit.url,
          },
          protected: data.protected,
        };

        cache.set(cacheKey, branchInfo);
        return branchInfo;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          
          if (status === 404) {
            throw new GitHubApiError(`Branch not found: ${branch}`, 404);
          }
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch branch info',
          500,
          error
        );
      }
    });
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(
    owner: string,
    repo: string,
    limit: number = 10,
    branch?: string
  ): Promise<GitHubCommit[]> {
    const cacheKey = `commits:${owner}/${repo}:${limit}:${branch || 'default'}`;
    const cached = cache.get<GitHubCommit[]>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        const params: {
          owner: string;
          repo: string;
          per_page: number;
          sha?: string;
        } = {
          owner,
          repo,
          per_page: Math.min(limit, 100), // GitHub max is 100
        };

        if (branch) {
          params.sha = branch;
        }

        const { data } = await this.octokit.repos.listCommits(params);

        const commits: GitHubCommit[] = data.map(commit => ({
          sha: commit.sha,
          commit: {
            author: {
              name: commit.commit.author?.name || 'Unknown',
              email: commit.commit.author?.email || '',
              date: commit.commit.author?.date || '',
            },
            message: commit.commit.message,
          },
          author: commit.author
            ? {
                login: commit.author.login,
                id: commit.author.id,
                avatar_url: commit.author.avatar_url,
                type: commit.author.type as 'User' | 'Organization',
                html_url: commit.author.html_url,
              }
            : null,
          html_url: commit.html_url,
        }));

        cache.set(cacheKey, commits);
        return commits;
      } catch (error: unknown) {
        if (error instanceof GitHubApiError) {
          throw error;
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch commits',
          500,
          error
        );
      }
    });
  }

  /**
   * Get repository languages
   */
  async getLanguages(owner: string, repo: string): Promise<GitHubLanguages> {
    const cacheKey = `languages:${owner}/${repo}`;
    const cached = cache.get<GitHubLanguages>(cacheKey);

    if (cached) {
      return cached;
    }

    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      try {
        const { data } = await this.octokit.repos.listLanguages({
          owner,
          repo,
        });

        cache.set(cacheKey, data);
        return data;
      } catch (error: unknown) {
        if (error instanceof GitHubApiError) {
          throw error;
        }

        throw new GitHubApiError(
          error instanceof Error ? error.message : 'Failed to fetch languages',
          500,
          error
        );
      }
    });
  }

  /**
   * Get repository contributors
   */
  async getContributors(owner: string, repo: string): Promise<string[]> {
    const cacheKey = `contributors:${owner}/${repo}`;
    const cached = cache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 10,
      });

      const contributors = data.map(c => c.login || 'Anonymous');
      cache.set(cacheKey, contributors);
      return contributors;
    } catch (error) {
      console.error('Error fetching contributors:', error);
      return [];
    }
  }

  /**
   * Helper: Check if file should be included
   */
  private shouldIncludeFile(path: string): boolean {
    // Check exclude patterns
    for (const pattern of FETCH_CONFIG.EXCLUDE_PATTERNS) {
      const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
      if (regex.test(path)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of FETCH_CONFIG.INCLUDE_PATTERNS) {
      const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
      if (regex.test(path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: Detect language from file extension
   */
  private detectLanguage(path: string): string | undefined {
    const ext = path.substring(path.lastIndexOf('.'));
    
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++',
      '.cs': 'C#',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.vue': 'Vue',
      '.md': 'Markdown',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
    };

    return languageMap[ext];
  }

  /**
   * Helper: Calculate language distribution
   */
  private calculateLanguageDistribution(files: FileNode[]): Record<string, number> {
    const languageSizes: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      if (file.type === 'file' && file.language && file.size) {
        languageSizes[file.language] = (languageSizes[file.language] || 0) + file.size;
        totalSize += file.size;
      }
    }

    // Convert to percentages
    const distribution: Record<string, number> = {};
    for (const [lang, size] of Object.entries(languageSizes)) {
      distribution[lang] = totalSize > 0 ? (size / totalSize) * 100 : 0;
    }

    return distribution;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    cache.clear();
  }
}

/**
 * Singleton instance
 */
let clientInstance: GitHubClient | null = null;

export function getGitHubClient(): GitHubClient {
  if (!clientInstance) {
    clientInstance = new GitHubClient();
  }
  return clientInstance;
}
