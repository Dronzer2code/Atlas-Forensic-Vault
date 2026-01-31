import { redirect } from 'next/navigation';
import { getCollection } from '@/lib/mongodb';
import { Podcast } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getLatestCase() {
  try {
    const collection = await getCollection('podcasts');
    const podcast = await collection.findOne<Podcast>(
      { status: { $in: ['completed', 'audio_ready'] } },
      { sort: { created_at: -1 } }
    );
    return podcast;
  } catch (error) {
    console.error('Error fetching latest case:', error);
    return null;
  }
}

export default async function CasePage() {
  const podcast = await getLatestCase();
  
  if (podcast) {
    redirect(`/case/${podcast.id}`);
  }
  
  redirect('/');
}
