'use server';

import { getGitHubClient } from '@/lib/github/client';

export async function fetchFileContent(owner: string, repo: string, path: string) {
  try {
    const client = getGitHubClient();
    const content = await client.getFileContent(owner, repo, path);
    return { success: true, content };
  } catch (error) {
    console.error('Error fetching file content:', error);
    return { success: false, error: 'Failed to fetch file content' };
  }
}
