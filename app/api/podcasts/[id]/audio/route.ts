import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export const runtime = 'nodejs';

// Serve the generated audio file
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

    if (!podcast.audio_data) {
      return NextResponse.json(
        { error: 'Audio not available for this podcast' },
        { status: 404 }
      );
    }

    // Convert base64 back to buffer
    const audioBuffer = Buffer.from(podcast.audio_data, 'base64');

    // Return audio with proper headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Disposition': `inline; filename="${podcast.repo_name || 'podcast'}.mp3"`,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error serving audio:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
