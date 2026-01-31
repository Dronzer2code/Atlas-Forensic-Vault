import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export const runtime = 'nodejs';

// Increase timeout for Vercel serverless functions
export const maxDuration = 30;

// This endpoint returns the current audio generation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await getCollection('podcasts');
    const podcast = await collection.findOne({ id });

    if (!podcast) {
      return NextResponse.json({ error: 'Podcast not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: podcast.audio_status || 'pending',
      progress: podcast.audio_progress || 0,
      message: podcast.audio_message || 'Waiting to start...',
      currentSegment: podcast.audio_current_segment,
      totalSegments: podcast.audio_total_segments,
      audioUrl: podcast.audio_url,
    });
  } catch (error: any) {
    console.error('Error fetching audio status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
