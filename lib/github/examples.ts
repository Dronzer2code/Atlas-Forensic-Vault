/**
 * GitHub Client Usage Examples and Tests
 * 
 * This file demonstrates how to use the GitHubClient in your application.
 */

import { getGitHubClient } from './client';
import type { GitHubRepo, RepoStructure, BranchInfo, FileNode } from './client';
import {
  RateLimitError,
  RepositoryNotFoundError,
  RepositoryAccessDeniedError,
  GitHubApiError,
} from './config';

/**
 * Example 1: Fetch Repository Metadata
 */
export async function exampleGetRepository() {
  const client = getGitHubClient();

  try {
    const repo = await client.getRepository('facebook', 'react');
    
    console.log('Repository:', {
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      stars: repo.stars,
      language: repo.language,
      size: `${repo.size} KB`,
      lastUpdated: repo.lastUpdated,
      topics: repo.topics,
    });

    return repo;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 2: Get Repository Structure
 */
export async function exampleGetStructure() {
  const client = getGitHubClient();

  try {
    const structure = await client.getRepoStructure('vercel', 'next.js');
    
    console.log('Repository Structure:', {
      totalFiles: structure.totalFiles,
      totalSize: `${(structure.totalSize / 1024).toFixed(2)} MB`,
      languages: structure.languages,
      fileCount: structure.files.length,
    });

    // List top-level files
    const topLevelFiles = structure.files
      .filter(f => !f.path.includes('/'))
      .slice(0, 10);

    console.log('Top-level files:', topLevelFiles);

    return structure;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 3: Get File Content
 */
export async function exampleGetFileContent() {
  const client = getGitHubClient();

  try {
    const content = await client.getFileContent(
      'facebook',
      'react',
      'package.json'
    );
    
    const packageJson = JSON.parse(content);
    console.log('Package.json:', {
      name: packageJson.name,
      version: packageJson.version,
      dependencies: Object.keys(packageJson.dependencies || {}),
    });

    return content;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 4: Get Branch Info
 */
export async function exampleGetBranchInfo() {
  const client = getGitHubClient();

  try {
    const branchInfo = await client.getBranchInfo(
      'facebook',
      'react',
      'main'
    );
    
    console.log('Branch Info:', {
      name: branchInfo.name,
      commitSha: branchInfo.commit.sha,
      protected: branchInfo.protected,
    });

    return branchInfo;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 5: Get Recent Commits
 */
export async function exampleGetCommits() {
  const client = getGitHubClient();

  try {
    const commits = await client.getRecentCommits('facebook', 'react', 5);
    
    console.log(`Last ${commits.length} commits:`);
    commits.forEach((commit, i) => {
      console.log(`${i + 1}. ${commit.commit.message.split('\n')[0]}`);
      console.log(`   by ${commit.commit.author.name} at ${commit.commit.author.date}`);
    });

    return commits;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 6: Comprehensive Repository Analysis
 */
export async function analyzeRepository(owner: string, repo: string) {
  const client = getGitHubClient();

  try {
    console.log(`Analyzing ${owner}/${repo}...`);

    // Fetch all data in parallel
    const [repoInfo, structure, commits, languages] = await Promise.all([
      client.getRepository(owner, repo),
      client.getRepoStructure(owner, repo),
      client.getRecentCommits(owner, repo, 10),
      client.getLanguages(owner, repo),
    ]);

    // Calculate statistics
    const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    const languagePercentages = Object.entries(languages).map(([lang, bytes]) => ({
      language: lang,
      percentage: ((bytes / totalBytes) * 100).toFixed(2),
      bytes,
    }));

    // Find largest files
    const largestFiles = structure.files
      .filter(f => f.type === 'file' && f.size)
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10);

    const analysis = {
      repository: {
        name: repoInfo.fullName,
        description: repoInfo.description,
        stars: repoInfo.stars,
        size: `${repoInfo.size} KB`,
        isPrivate: repoInfo.isPrivate,
        topics: repoInfo.topics,
      },
      structure: {
        totalFiles: structure.totalFiles,
        totalSize: `${(structure.totalSize / 1024).toFixed(2)} MB`,
        directories: structure.files.filter(f => f.type === 'dir').length,
      },
      languages: languagePercentages,
      recentActivity: {
        lastCommit: commits[0]?.commit.message.split('\n')[0],
        lastCommitDate: commits[0]?.commit.author.date,
        lastCommitAuthor: commits[0]?.commit.author.name,
        totalCommitsAnalyzed: commits.length,
      },
      largestFiles: largestFiles.map(f => ({
        path: f.path,
        size: `${((f.size || 0) / 1024).toFixed(2)} KB`,
        language: f.language,
      })),
    };

    console.log('Analysis complete:', JSON.stringify(analysis, null, 2));
    return analysis;
  } catch (error) {
    handleGitHubError(error);
    throw error;
  }
}

/**
 * Example 7: Fetch Multiple Files
 */
export async function fetchImportantFiles(owner: string, repo: string) {
  const client = getGitHubClient();

  const importantFiles = [
    'package.json',
    'README.md',
    'tsconfig.json',
    '.gitignore',
    'LICENSE',
  ];

  const results: Record<string, string | null> = {};

  for (const filePath of importantFiles) {
    try {
      const content = await client.getFileContent(owner, repo, filePath);
      results[filePath] = content;
      console.log(`✓ Fetched ${filePath} (${content.length} bytes)`);
    } catch (error) {
      console.log(`✗ Failed to fetch ${filePath}`);
      results[filePath] = null;
    }
  }

  return results;
}

/**
 * Example 8: Search for Specific File Types
 */
export async function findFilesByExtension(
  owner: string,
  repo: string,
  extension: string
) {
  const client = getGitHubClient();

  try {
    const structure = await client.getRepoStructure(owner, repo);
    
    const matchingFiles = structure.files.filter(
      f => f.type === 'file' && f.path.endsWith(extension)
    );

    console.log(`Found ${matchingFiles.length} ${extension} files:`);
    matchingFiles.slice(0, 20).forEach(f => {
      console.log(`- ${f.path} (${((f.size || 0) / 1024).toFixed(2)} KB)`);
    });

    return matchingFiles;
  } catch (error) {
    handleGitHubError(error);
  }
}

/**
 * Example 9: Cache Management
 */
export async function demonstrateCaching(owner: string, repo: string) {
  const client = getGitHubClient();

  console.log('First fetch (from API)...');
  const start1 = Date.now();
  await client.getRepository(owner, repo);
  const time1 = Date.now() - start1;

  console.log('Second fetch (from cache)...');
  const start2 = Date.now();
  await client.getRepository(owner, repo);
  const time2 = Date.now() - start2;

  console.log(`API call: ${time1}ms`);
  console.log(`Cached call: ${time2}ms`);
  console.log(`Speed improvement: ${(time1 / time2).toFixed(2)}x`);

  // Clear cache
  client.clearCache();
  console.log('Cache cleared');

  // Fetch again (should be slow)
  const start3 = Date.now();
  await client.getRepository(owner, repo);
  const time3 = Date.now() - start3;
  console.log(`After cache clear: ${time3}ms`);
}

/**
 * Error Handler
 */
function handleGitHubError(error: unknown): void {
  if (error instanceof RateLimitError) {
    console.error('❌ Rate limit exceeded');
    console.error(`   Reset time: ${error.resetTime.toISOString()}`);
    console.error(`   Wait: ${Math.ceil((error.resetTime.getTime() - Date.now()) / 1000 / 60)} minutes`);
  } else if (error instanceof RepositoryNotFoundError) {
    console.error('❌ Repository not found');
    console.error(`   ${error.message}`);
  } else if (error instanceof RepositoryAccessDeniedError) {
    console.error('❌ Access denied');
    console.error(`   ${error.message}`);
    console.error('   Tip: Set GITHUB_TOKEN environment variable for private repos');
  } else if (error instanceof GitHubApiError) {
    console.error('❌ GitHub API Error');
    console.error(`   Status: ${error.status}`);
    console.error(`   Message: ${error.message}`);
  } else if (error instanceof Error) {
    console.error('❌ Unexpected error');
    console.error(`   ${error.message}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('=== GitHub Client Examples ===\n');

  try {
    await exampleGetRepository();
    console.log('\n---\n');

    await exampleGetStructure();
    console.log('\n---\n');

    await exampleGetFileContent();
    console.log('\n---\n');

    await exampleGetBranchInfo();
    console.log('\n---\n');

    await exampleGetCommits();
    console.log('\n---\n');

    await analyzeRepository('facebook', 'react');
    console.log('\n---\n');

    await findFilesByExtension('vercel', 'next.js', '.ts');
    console.log('\n---\n');

    await demonstrateCaching('facebook', 'react');
  } catch (error) {
    console.error('Example failed:', error);
  }
}
