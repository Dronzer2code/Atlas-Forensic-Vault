import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export const runtime = 'nodejs';

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

    return NextResponse.json(podcast);
  } catch (error: any) {
    console.error('Error fetching podcast:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const collection = await getCollection('podcasts');

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Allow updating script
    if (body.script) {
      updateData.script = body.script;
    }

    // Allow updating title
    if (body.title) {
      updateData.title = body.title;
    }

    const result = await collection.updateOne(
      { id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Podcast not found' }, { status: 404 });
    }

    const updatedPodcast = await collection.findOne({ id });
    return NextResponse.json(updatedPodcast);
  } catch (error: any) {
    console.error('Error updating podcast:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
