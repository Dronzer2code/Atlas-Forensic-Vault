import 'server-only';
import { Octokit } from '@octokit/rest';

/**
 * GitHub API Configuration
 */

// GitHub API client singleton
let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'detective-mongo-nextjs/1.0.0',
      timeZone: 'UTC',
      baseUrl: 'https://api.github.com',
      request: {
        timeout: 30000, // 30 seconds
      },
    });
  }
  return octokitInstance;
}

/**
 * Rate Limit Configuration
 */
export const RATE_LIMIT_CONFIG = {
  // GitHub API rate limits (per hour)
  AUTHENTICATED: 5000,
  UNAUTHENTICATED: 60,
  
  // Buffer before hitting limit
  BUFFER_PERCENTAGE: 0.1, // Stop at 90% of limit
  
  // Cache duration for rate limit info (seconds)
  CACHE_DURATION: 60,
};

/**
 * File Fetch Configuration
 */
export const FETCH_CONFIG = {
  // Maximum number of files to analyze
  MAX_FILES: 100,
  
  // Maximum file size to download (bytes) - 1MB
  MAX_FILE_SIZE: 1024 * 1024,
  
  // Maximum total size to download (bytes) - 50MB
  MAX_TOTAL_SIZE: 50 * 1024 * 1024,
  
  // File patterns to include
  INCLUDE_PATTERNS: [
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.py',
    '**/*.java',
    '**/*.go',
    '**/*.rs',
    '**/*.rb',
    '**/*.php',
    '**/*.cpp',
    '**/*.c',
    '**/*.h',
    '**/*.cs',
    '**/*.swift',
    '**/*.kt',
    '**/*.scala',
    '**/*.vue',
    '**/*.md',
    '**/package.json',
    '**/requirements.txt',
    '**/Cargo.toml',
    '**/go.mod',
    '**/pom.xml',
    '**/build.gradle',
  ],
  
  // Directories to exclude
  EXCLUDE_PATTERNS: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'out/**',
    '.next/**',
    'coverage/**',
    'target/**',
    'vendor/**',
    '__pycache__/**',
    '.git/**',
    '.github/**',
    '*.min.js',
    '*.bundle.js',
    '*.test.js',
    '*.test.ts',
    '*.spec.js',
    '*.spec.ts',
  ],
};

/**
 * Language Configuration
 */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
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
};

/**
 * Error Types
 */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class RateLimitError extends GitHubApiError {
  constructor(
    message: string,
    public resetTime: Date
  ) {
    super(message, 403);
    this.name = 'RateLimitError';
  }
}

export class RepositoryNotFoundError extends GitHubApiError {
  constructor(repo: string) {
    super(`Repository not found: ${repo}`, 404);
    this.name = 'RepositoryNotFoundError';
  }
}

export class RepositoryAccessDeniedError extends GitHubApiError {
  constructor(repo: string) {
    super(`Access denied to repository: ${repo}`, 403);
    this.name = 'RepositoryAccessDeniedError';
  }
}

/**
 * Rate Limit Utilities
 */
export async function checkRateLimit(): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
  canProceed: boolean;
}> {
  const octokit = getOctokit();
  
  try {
    const { data } = await octokit.rateLimit.get();
    const core = data.resources.core;
    
    const resetDate = new Date(core.reset * 1000);
    const buffer = Math.floor(core.limit * RATE_LIMIT_CONFIG.BUFFER_PERCENTAGE);
    const canProceed = core.remaining > buffer;
    
    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: resetDate,
      canProceed,
    };
  } catch (error) {
    // If rate limit check fails, assume we can proceed
    console.error('Failed to check rate limit:', error);
    return {
      limit: 0,
      remaining: 0,
      reset: new Date(),
      canProceed: true,
    };
  }
}

export async function waitForRateLimit(): Promise<void> {
  const rateLimit = await checkRateLimit();
  
  if (!rateLimit.canProceed) {
    const waitTime = rateLimit.reset.getTime() - Date.now();
    
    if (waitTime > 0) {
      throw new RateLimitError(
        `Rate limit exceeded. Reset at ${rateLimit.reset.toISOString()}`,
        rateLimit.reset
      );
    }
  }
}

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 2,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = RETRY_CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (
        error instanceof RepositoryNotFoundError ||
        error instanceof RepositoryAccessDeniedError
      ) {
        throw error;
      }
      
      // If it's a rate limit error, wait for reset time
      if (error instanceof RateLimitError) {
        const waitTime = error.resetTime.getTime() - Date.now();
        if (waitTime > 0 && waitTime < 60000) {
          // Only wait if it's less than 1 minute
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
      
      // Calculate backoff delay
      const delay = Math.min(
        RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, i),
        RETRY_CONFIG.MAX_DELAY
      );
      
      // Wait before retrying
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Validation
 */
export function isValidGitHubUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/,
    /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/tree\/[\w.-]+/,
    /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/blob\/[\w.-]+/,
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

export function normalizeRepoPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}
