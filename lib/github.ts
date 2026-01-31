import { GitHubRepo } from './types';

export async function parseGitHubUrl(url: string): Promise<GitHubRepo> {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\/$/, ''),
      };
    }
  }

  throw new Error(`Invalid GitHub URL: ${url}`);
}

export async function fetchRepoContent(owner: string, repo: string) {
  const githubToken = process.env.GITHUB_TOKEN || '';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (githubToken) {
    headers.Authorization = `token ${githubToken}`;
  }

  // Fetch repository metadata
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoResp = await fetch(repoUrl, { headers });

  if (!repoResp.ok) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }

  const repoData = await repoResp.json();

  // Fetch repository tree (file structure)
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`;
  const treeResp = await fetch(treeUrl, { headers });

  if (!treeResp.ok) {
    throw new Error(`Failed to fetch repository tree`);
  }

  const treeData = await treeResp.json();

  // Filter for important files (code files, readme, etc.)
  const importantExtensions = [
    '.py',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.java',
    '.go',
    '.rs',
    '.cpp',
    '.c',
    '.h',
    '.cs',
    '.rb',
    '.php',
    '.swift',
    '.kt',
    '.md',
  ];

  const files = treeData.tree.filter((item: any) => {
    if (item.type !== 'blob') return false;
    return importantExtensions.some((ext) => item.path.endsWith(ext));
  });

  return {
    repo_data: repoData,
    files,
    owner,
    repo,
    default_branch: repoData.default_branch,
  };
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
) {
  const githubToken = process.env.GITHUB_TOKEN || '';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  };

  if (githubToken) {
    headers.Authorization = `token ${githubToken}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    throw new Error(`Failed to fetch file: ${path}`);
  }

  return await resp.text();
}
