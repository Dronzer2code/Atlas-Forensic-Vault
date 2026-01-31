import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getCollection } from '@/lib/mongodb';
import { textToSpeech, concatenateAudioBuffers } from '@/lib/elevenlabs';

export const runtime = 'nodejs';

// Increase timeout for Vercel serverless functions
// Hobby: max 60s, Pro: max 300s (5 minutes)
export const maxDuration = 300;

// This endpoint starts the audio generation process
export async function POST(
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

    if (!podcast.script || !podcast.script.segments) {
      return NextResponse.json(
        { error: 'No script available for this podcast' },
        { status: 400 }
      );
    }

    // Log script details for debugging
    const scriptSegments = podcast.script.segments || [];
    console.log(`[Audio] Podcast ${id} has ${scriptSegments.length} segments in script`);
    if (scriptSegments.length > 0) {
      console.log(`[Audio] First segment: speaker="${scriptSegments[0]?.speaker}", text length=${scriptSegments[0]?.text?.length || 0}`);
    }

    // Update status to generating audio
    await collection.updateOne(
      { id },
      {
        $set: {
          audio_status: 'recording',
          audio_progress: 0,
          audio_message: 'Starting audio generation with ElevenLabs...',
          audio_started_at: new Date().toISOString(),
        },
      }
    );

    // Use waitUntil to keep the function alive after returning response
    // This is critical for Vercel - without it, the function terminates immediately
    console.log(`[Audio] Starting background audio generation for ${id}`);
    
    waitUntil(
      generateAudioInBackground(id, podcast.script)
        .then(() => console.log(`[Audio] ✅ Completed audio generation for ${id}`))
        .catch((err) => console.error(`[Audio Error] ❌ Audio generation failed for ${id}:`, err))
    );

    return NextResponse.json({
      success: true,
      message: 'Audio generation started',
      id,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error starting audio generation:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

interface ScriptSegment {
  speaker: string;
  text: string;
  emotion?: string;
}

interface PodcastScript {
  segments: ScriptSegment[];
}

// Real audio generation using ElevenLabs API
async function generateAudioInBackground(podcastId: string, script: PodcastScript) {
  console.log(`[Audio] Background process started for ${podcastId}`);
  console.log(`[Audio] Script received with ${script.segments?.length || 0} total segments`);
  
  // Debug: Log first few segments to diagnose issues
  if (script.segments && script.segments.length > 0) {
    console.log(`[Audio] First segment preview:`, JSON.stringify(script.segments[0]).substring(0, 200));
  }
  
  try {
    const collection = await getCollection('podcasts');
    
    // Filter out sound_effect segments - only voice segments
    // Keep segments with missing speaker (default to Narrator) or where speaker is NOT sound_effect
    const voiceSegments = script.segments.filter(
      (s) => !s.speaker || s.speaker.toLowerCase() !== 'sound_effect'
    );
    const totalSegments = voiceSegments.length;
    const audioBuffers: Buffer[] = [];

    console.log(`[Audio] Starting generation for ${totalSegments} voice segments (skipping ${script.segments.length - totalSegments} sound effects)`);

    let lastError: Error | null = null;

    for (let i = 0; i < totalSegments; i++) {
      const segment = voiceSegments[i];
      const progress = Math.round(((i + 1) / totalSegments) * 90); // Reserve 10% for processing

      // Update progress
      await collection.updateOne(
        { id: podcastId },
        {
          $set: {
            audio_status: 'recording',
            audio_progress: progress,
            audio_message: `🎙️ Recording segment ${i + 1} of ${totalSegments}: ${segment.speaker}`,
            audio_current_segment: i + 1,
            audio_total_segments: totalSegments,
          },
        }
      );

      try {
        const speakerName = segment.speaker || 'Narrator';
        const segmentText = segment.text || '';
        
        // Skip empty segments with enhanced logging
        if (!segmentText || !segmentText.trim()) {
          console.error(`⚠️ CRIME SCENE DATA MISSING: Segment ${i + 1} text is empty or undefined`);
          continue;
        }
        
        // Safe substring for logging - prevent undefined errors
        const textPreview = segmentText.length > 50 
          ? segmentText.substring(0, 50) + '...' 
          : segmentText;
        
        // Call ElevenLabs API to generate audio
        console.log(`Generating audio for segment ${i + 1} (${speakerName}): "${textPreview}"`);
        
        const audioBuffer = await textToSpeech({
          text: segmentText,
          speaker: speakerName, // Pass speaker to determine voice ID
          // Adjust voice settings based on emotion if present
          stability: getStabilityForEmotion(segment.emotion),
          similarityBoost: 0.75,
          style: getStyleForEmotion(segment.emotion),
        });

        audioBuffers.push(audioBuffer);
        console.log(`✅ Segment ${i + 1} audio generated (${audioBuffer.length} bytes)`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (segmentError: unknown) {
        console.error(`Error generating segment ${i + 1}:`, segmentError);
        lastError = segmentError instanceof Error ? segmentError : new Error(String(segmentError));
        const errorMsg = lastError.message || 'Unknown error';
        // Safe substring to prevent undefined errors
        const safeErrorMsg = errorMsg && errorMsg.length > 50 
          ? errorMsg.substring(0, 50) + '...' 
          : errorMsg || 'Unknown';
        // Continue with other segments, but log the error
        await collection.updateOne(
          { id: podcastId },
          {
            $set: {
              audio_message: `⚠️ Warning: Segment ${i + 1} failed: ${safeErrorMsg}`,
            },
          }
        );
      }
    }

    // Processing phase - concatenate audio
    await collection.updateOne(
      { id: podcastId },
      {
        $set: {
          audio_status: 'processing',
          audio_progress: 95,
          audio_message: '🔧 Concatenating audio segments...',
        },
      }
    );

    if (audioBuffers.length === 0) {
      if (totalSegments === 0) {
         throw new Error('No voice segments found in script to generate audio for.');
      }
      throw new Error(`No audio segments were generated successfully. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    // Concatenate all audio buffers
    const finalAudio = concatenateAudioBuffers(audioBuffers);
    console.log(`📦 Final audio size: ${finalAudio.length} bytes`);

    // Store the audio as base64 in MongoDB (for simplicity)
    // In production, you'd upload to S3/Cloudflare R2/etc.
    const audioBase64 = finalAudio.toString('base64');
    const audioDuration = estimateDuration(audioBuffers.length);

    // Mark as completed
    await collection.updateOne(
      { id: podcastId },
      {
        $set: {
          audio_status: 'completed',
          audio_progress: 100,
          audio_message: '✅ Audio generation complete!',
          audio_data: audioBase64, // Store audio data
          audio_url: `/api/podcasts/${podcastId}/audio`, // API endpoint to serve audio
          audio_duration: audioDuration,
          audio_completed_at: new Date().toISOString(),
          status: 'audio_ready',
        },
      }
    );

    console.log(`🎉 Podcast ${podcastId} audio generation complete!`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Audio generation failed';
    console.error('Error generating audio:', error);
    
    try {
      const collection = await getCollection('podcasts');
      await collection.updateOne(
        { id: podcastId },
        {
          $set: {
            audio_status: 'error',
            audio_message: `❌ ${errorMessage}`,
          },
        }
      );
    } catch (dbError) {
      console.error('Failed to update error status in DB:', dbError);
    }
  }
}

// Get stability setting based on emotion
function getStabilityForEmotion(emotion?: string): number {
  const settings: Record<string, number> = {
    mysterious: 0.6,
    dramatic: 0.4,
    excited: 0.3,
    serious: 0.7,
    suspenseful: 0.5,
    shocked: 0.3,
  };
  return settings[emotion || ''] || 0.5;
}

// Get style setting based on emotion
function getStyleForEmotion(emotion?: string): number {
  const settings: Record<string, number> = {
    mysterious: 0.3,
    dramatic: 0.7,
    excited: 0.8,
    serious: 0.4,
    suspenseful: 0.5,
    shocked: 0.9,
  };
  return settings[emotion || ''] || 0.5;
}

// Estimate duration based on segments
function estimateDuration(generatedSegments: number): number {
  // Rough estimate: ~10 seconds per segment on average
  return generatedSegments * 10;
}