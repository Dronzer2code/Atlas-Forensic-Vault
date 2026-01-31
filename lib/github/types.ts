/**
 * GitHub API Types and Interfaces
 */

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubOwner;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  topics: string[];
  license: GitHubLicense | null;
}

export interface GitHubOwner {
  login: string;
  id: number;
  avatar_url: string;
  type: 'User' | 'Organization';
  html_url: string;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
}

export interface GitHubFile {
  path: string;
  name: string;
  sha: string;
  size: number;
  url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeNode[];
  truncated: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: GitHubOwner | null;
  html_url: string;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

export interface GitHubLanguages {
  [language: string]: number;
}

export interface RepoAnalysisData {
  repository: GitHubRepository;
  files: AnalyzedFile[];
  structure: FileStructure;
  languages: GitHubLanguages;
  contributors: GitHubContributor[];
  recentCommits: GitHubCommit[];
  statistics: RepoStatistics;
}

export interface AnalyzedFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  content: string;
  language: string;
  lines: number;
  complexity?: number;
  imports?: string[];
}

export interface FileStructure {
  root: FileNode;
  totalFiles: number;
  totalDirectories: number;
  maxDepth: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface RepoStatistics {
  totalSize: number;
  totalFiles: number;
  totalLines: number;
  languageDistribution: LanguageDistribution[];
  fileTypeDistribution: FileTypeDistribution[];
  averageFileSize: number;
  largestFiles: FileSizeInfo[];
}

export interface LanguageDistribution {
  language: string;
  bytes: number;
  percentage: number;
  files: number;
}

export interface FileTypeDistribution {
  extension: string;
  count: number;
  percentage: number;
  totalSize: number;
}

export interface FileSizeInfo {
  path: string;
  size: number;
  lines: number;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface GitHubApiResponse<T> {
  data: T;
  rateLimit: GitHubRateLimit;
}

export interface GitHubError {
  message: string;
  documentation_url?: string;
  status?: number;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface FetchOptions {
  maxFiles?: number;
  maxFileSize?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  fetchContent?: boolean;
  branch?: string;
}

export interface CodePattern {
  pattern: string;
  type: 'function' | 'class' | 'import' | 'variable' | 'comment';
  file: string;
  line: number;
  context: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  description?: string;
}

export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  license?: string;
  repository?: {
    type: string;
    url: string;
  };
}
