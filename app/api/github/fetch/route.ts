import { NextRequest, NextResponse } from 'next/server';
import { getGitHubClient } from '@/lib/github/client';
import {
  RateLimitError,
  RepositoryNotFoundError,
  RepositoryAccessDeniedError,
  GitHubApiError,
} from '@/lib/github/config';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      );
    }

    const client = getGitHubClient();

    // Fetch repository metadata and structure
    const [repoInfo, structure] = await Promise.all([
      client.getRepository(owner, repo),
      client.getRepoStructure(owner, repo, branch),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        repository: repoInfo,
        structure,
      },
    });
  } catch (error) {
    console.error('Error fetching repo:', error);

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: 'GitHub API rate limit exceeded',
          resetTime: error.resetTime.toISOString(),
        },
        { status: 429 }
      );
    }

    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof RepositoryAccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repository';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch') || undefined;

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Owner and repo query parameters are required' },
      { status: 400 }
    );
  }

  try {
    const client = getGitHubClient();

    // Fetch repository metadata and structure
    const [repoInfo, structure] = await Promise.all([
      client.getRepository(owner, repo),
      client.getRepoStructure(owner, repo, branch),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        repository: repoInfo,
        structure,
      },
    });
  } catch (error) {
    console.error('Error fetching repo:', error);

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: 'GitHub API rate limit exceeded',
          resetTime: error.resetTime.toISOString(),
        },
        { status: 429 }
      );
    }

    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof RepositoryAccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repository';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
