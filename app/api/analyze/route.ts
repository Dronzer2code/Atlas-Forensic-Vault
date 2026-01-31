import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getServerSession } from 'next-auth';
import { getCollection } from '@/lib/mongodb';
import { getGitHubFetcher } from '@/lib/github/fetcher';
import { getGitHubClient } from '@/lib/github/client';
import { generatePodcastScript, analyzeCodePatterns, generateAutopsyReport } from '@/lib/gemini';
import { NarrativeStyle, AnalysisStatus, Podcast } from '@/lib/types';
import { authOptions } from '@/lib/auth/config';
import { checkInvestigationLimit, recordInvestigation } from '@/lib/auth/investigations';

export const runtime = 'nodejs';

// Increase timeout for Vercel serverless functions
// Hobby: max 60s, Pro: max 300s (5 minutes)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // ========================================
    // AUTHENTICATION & AUTHORIZATION CHECK
    // ========================================
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          message: 'You must be logged in to start an investigation.'
        },
        { status: 401 }
      );
    }

    // Check investigation limit (SERVER-SIDE - cannot be bypassed)
    const limitStatus = await checkInvestigationLimit();
    
    if (!limitStatus.isAllowed) {
      return NextResponse.json(
        {
          error: 'Investigation limit reached',
          code: 'RED_NOTICE',
          message: 'Monthly investigation limit exceeded. Access suspended until next month.',
          status: limitStatus,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { repo_url, narrative_style = NarrativeStyle.TRUE_CRIME } = body;

    if (!repo_url) {
      return NextResponse.json(
        { error: 'repo_url is required' },
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const urlMatch = repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL' },
        { status: 400 }
      );
    }

    const [, owner, repo] = urlMatch;

    // Create initial podcast document
    const podcast: Podcast = {
      id: crypto.randomUUID(),
      repo_url,
      repo_name: `${owner}/${repo}`,
      title: `The Case of ${repo}`,
      narrative_style,
      status: AnalysisStatus.PENDING,
      progress: 0,
      progress_message: 'Starting analysis...',
      patterns_found: [],
      duration: 0,
      created_at: new Date(),
    };

    // Save to database
    const collection = await getCollection('podcasts');
    await collection.insertOne(podcast);

    // ========================================
    // RECORD THE INVESTIGATION (decrement remaining count)
    // ========================================
    const recordResult = await recordInvestigation(
      repo_url,
      `${owner}/${repo}`,
      podcast.id
    );

    if (!recordResult.success) {
      // Rollback: remove the podcast if we couldn't record the investigation
      await collection.deleteOne({ id: podcast.id });
      return NextResponse.json(
        {
          error: 'Failed to record investigation',
          code: 'RED_NOTICE',
          message: recordResult.error || 'Investigation limit reached',
          status: recordResult.status,
        },
        { status: 403 }
      );
    }

    // Log that we are starting processing
    console.log(`[Analyze] Starting analysis for ${owner}/${repo} (ID: ${podcast.id})`);
    console.log(`[Analyze] Remaining investigations for user: ${recordResult.status.remaining}/${recordResult.status.total}`);

    // Use waitUntil to keep the function alive after returning response
    // This is critical for Vercel - without it, the function terminates immediately
    waitUntil(
      processRepository(podcast.id, owner, repo, narrative_style)
        .then(() => console.log(`[Analyze] ✅ Completed analysis for ${podcast.id}`))
        .catch((err) => console.error(`[Analyze] ❌ Error in processRepository for ${podcast.id}:`, err))
    );

    return NextResponse.json({
      id: podcast.id,
      status: podcast.status,
      message: 'Analysis started',
      investigationStatus: recordResult.status,
    });
  } catch (error: any) {
    console.error('Error in analyze endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processRepository(
  podcastId: string,
  owner: string,
  repo: string,
  narrativeStyle: NarrativeStyle
) {
  console.log(`[Process] Processing repository ${owner}/${repo} for podcast ${podcastId}`);
  
  // Check for required environment variables
  if (!process.env.GITHUB_TOKEN) {
    console.warn('[Process] GITHUB_TOKEN is missing. Rate limits will be strict.');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('[Process] GEMINI_API_KEY is missing. Script generation will fail.');
  }

  const collection = await getCollection('podcasts');
  const fetcher = getGitHubFetcher();

  // Create a timeout promise that rejects after 4 minutes (leaving buffer for Vercel's 5m limit)
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Global analysis timeout - process took too long')), 240000)
  );

  try {
    await Promise.race([
      (async () => {
        // Step 1: Fetch repository metadata
        console.log('[Process] Step 1: Fetching metadata...');
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              status: AnalysisStatus.ANALYZING,
              progress: 5,
              progress_message: '🔍 Opening the case file...',
            },
          }
        );

        const repository = await Promise.race([
          fetcher.getRepoMetadata(owner, repo),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching repository metadata. Please check if the repository exists and is public.')), 30000)
          )
        ]);

        // Fetch contributors
        const client = getGitHubClient();
        const contributors = await client.getContributors(owner, repo);

        console.log('[Process] Metadata fetched successfully');

        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              progress: 15,
              progress_message: '📂 Searching crime scene for evidence...',
              repo_metadata: {
                name: repository.name,
                description: repository.description,
                language: repository.language,
                stars: repository.stars,
                size: repository.size,
                topics: repository.topics,
              },
              contributors: contributors,
            },
          }
        );

        // Step 2: Read ENTIRE repository structure
        console.log('[Process] Step 2: Fetching full repository...');
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              progress: 25,
              progress_message: '🗂️ Cataloging all evidence files...',
            },
          }
        );

        const fullRepo = await Promise.race([
          fetcher.fetchFullRepository(owner, repo),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching repository files. The repository might be too large.')), 60000)
          )
        ]);

        console.log(`[Process] Full repository fetched. ${fullRepo.allFiles.length} files found.`);

        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              progress: 40,
              progress_message: `📄 Reading ${fullRepo.allFiles.length} files from the scene...`,
            },
          }
        );

        // Step 3: Analyze code patterns
        console.log('[Process] Step 3: Analyzing patterns...');
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              progress: 55,
              progress_message: '🔬 Analyzing code patterns and forensic evidence...',
            },
          }
        );

        const patterns = await analyzeCodePatterns(fullRepo.filesWithContent);
        console.log(`[Process] Patterns found: ${patterns.join(', ')}`);

        // Generate Autopsy Report
        const autopsyReport = await generateAutopsyReport(repository, fullRepo.filesWithContent, patterns);

        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              patterns_found: patterns,
              progress: 65,
              progress_message: `🎯 Found ${patterns.length} suspicious patterns at the crime scene...`,
            },
          }
        );

        // Step 4: Generate crime investigation story
        console.log('[Process] Step 4: Generating script...');
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              status: AnalysisStatus.GENERATING_SCRIPT,
              progress: 75,
              progress_message: '🎙️ Detective crafting the investigation narrative...',
            },
          }
        );

        let script;
        try {
          // Add timeout for Gemini generation
          script = await Promise.race([
            generatePodcastScript(
              repository,
              fullRepo.filesWithContent,
              narrativeStyle,
              {
                statistics: fullRepo.statistics,
                patterns,
                fullRepoContext: true,
              }
            ),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout generating script with Gemini')), 60000)
            )
          ]);
          console.log('[Process] Script generated successfully');
        } catch (geminiError: any) {
          console.error('[Process] ❌ Gemini script generation failed:', geminiError?.message);
          throw new Error(`Script generation failed: ${geminiError?.message || 'Unknown Gemini error'}`);
        }

        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              script,
              progress: 90,
              progress_message: '📝 Crime story written, case file ready...',
            },
          }
        );

        // Mark as completed
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              status: AnalysisStatus.COMPLETED,
              progress: 100,
              progress_message: '✅ Case closed! Investigation complete.',
              completed_at: new Date(),
              analysis_summary: {
                total_files: fullRepo.statistics.totalFiles,
                analyzed_files: fullRepo.statistics.analyzedFiles,
                total_size: fullRepo.statistics.totalSize,
                languages: fullRepo.statistics.languages,
                processing_time_ms: fullRepo.statistics.processingTime,
                autopsy_report: autopsyReport,
              },
            },
          }
        );
        console.log('[Process] Analysis completed successfully');
      })(),
      timeoutPromise
    ]);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error occurred';
    console.error('[Process] ❌ Error processing repository:', errorMessage);
    console.error('[Process] Full error:', error);
    
    await collection.updateOne(
      { id: podcastId },
      {
        $set: {
          status: AnalysisStatus.FAILED,
          error_message: errorMessage,
          progress_message: `❌ Investigation failed: ${errorMessage.substring(0, 100)}`,
        },
      }
    );
  }
}
