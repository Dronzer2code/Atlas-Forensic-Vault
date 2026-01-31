import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    message: 'Repo-to-Podcast API',
    version: '1.0.0',
    endpoints: {
      analyze: 'POST /api/analyze',
      podcasts: 'GET /api/podcasts',
      podcast: 'GET /api/podcasts/:id',
      patterns: 'GET /api/patterns',
      stats: 'GET /api/stats',
    },
  });
}
