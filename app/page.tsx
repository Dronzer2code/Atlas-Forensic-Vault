import { getCollection } from '@/lib/mongodb';
import LandingPage from '@/components/home/LandingPage';

// Force dynamic rendering since we're fetching data directly
export const dynamic = 'force-dynamic';

async function getInitialData() {
  try {
    const podcastsCollection = await getCollection('podcasts');
    
    // Fetch recent podcasts
    const podcasts = await podcastsCollection
      .find({})
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    // Serialize for client component
    const serializedPodcasts = podcasts.map(podcast => ({
      ...podcast,
      _id: podcast._id.toString(),
      created_at: podcast.created_at?.toISOString() || new Date().toISOString(),
      updated_at: podcast.updated_at?.toISOString() || new Date().toISOString(),
    }));

    // Calculate stats
    const total = await podcastsCollection.countDocuments();
    const completed = await podcastsCollection.countDocuments({ status: 'completed' });
    const failed = await podcastsCollection.countDocuments({ status: 'failed' });
    const pending = total - completed - failed;

    return {
      podcasts: serializedPodcasts,
      stats: { total, completed, failed, pending }
    };
  } catch (error) {
    console.error('Error fetching initial data:', error);
    return {
      podcasts: [],
      stats: { total: 0, completed: 0, failed: 0, pending: 0 }
    };
  }
}

export default async function Page() {
  const { podcasts, stats } = await getInitialData();

  return (
    <LandingPage 
      initialPodcasts={podcasts} 
      initialStats={stats} 
    />
  );
}

/*
*/
