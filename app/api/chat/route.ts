import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCollection } from '@/lib/mongodb';
import { Podcast } from '@/lib/types';

export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { podcastId, message } = await request.json();

    if (!podcastId || !message) {
      return NextResponse.json({ error: 'Missing podcastId or message' }, { status: 400 });
    }

    const collection = await getCollection('podcasts');
    const podcast = await collection.findOne<Podcast>({ id: podcastId });

    if (!podcast) {
      return NextResponse.json({ error: 'Podcast not found' }, { status: 404 });
    }

    // Construct context from podcast data
    const context = `
      Repository: ${podcast.repo_name}
      Description: ${podcast.repo_metadata?.description || 'N/A'}
      Languages: ${Object.keys(podcast.analysis_summary?.languages || {}).join(', ')}
      Patterns Found: ${podcast.patterns_found?.join(', ') || 'None'}
      
      Autopsy Summary: ${podcast.analysis_summary?.autopsy_report || 'Not available'}
      
      The user is asking a question about this codebase. You are a technical expert (Detective Mongo D. Bane) analyzing this code.
      Answer the user's question based on the provided context. If you don't know, say so, but try to infer from the patterns and metadata.
      Keep the tone professional but slightly noir/detective-like. keep responses concise and to the point. and make sure to response in short under 50 to 60 words.
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      context,
      `User Question: ${message}`
    ]);

    const response = result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
