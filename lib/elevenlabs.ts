import 'server-only';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs for different speakers
export const VOICE_IDS = {
  // Default detective/narrator voice
  default: 'vVi6DAt8DSjWrQDUBGjg',
  narrator: '4u5cJuSmHP9d6YRolsOu',
  detective: 'vVi6DAt8DSjWrQDUBGjg',
  documentary: '9Ft9sm9dzvprPILZmLJl',
  // Sports commentary voices
  commentator_1: 'gU0LNdkMOQCOrPrwtbee',
  commentator_2: 'UPZIegnxY8z2Ya7jignw',
};

// Get voice ID based on speaker type
export function getVoiceIdForSpeaker(speaker: string): string {
  if (!speaker) return VOICE_IDS.default;
  const lowerSpeaker = speaker.toLowerCase();
  
  if (lowerSpeaker === 'commentator_1') return VOICE_IDS.commentator_1;
  if (lowerSpeaker === 'commentator_2') return VOICE_IDS.commentator_2;
  if (lowerSpeaker === 'detective') return VOICE_IDS.detective;
  if (lowerSpeaker === 'documentary') return VOICE_IDS.documentary;
  if (lowerSpeaker === 'narrator') return VOICE_IDS.narrator;
  
  // Default voice for any other speaker
  return VOICE_IDS.default;
}

interface TextToSpeechOptions {
  text: string;
  voiceId?: string;
  speaker?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/**
 * Generate speech from text using ElevenLabs API
 * Returns the audio as a Buffer
 */
export async function textToSpeech(options: TextToSpeechOptions): Promise<Buffer> {
  const {
    text,
    voiceId,
    speaker,
    modelId = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.5,
    useSpeakerBoost = true,
  } = options;

  // Determine voice ID: explicit voiceId > speaker-based > default
  const finalVoiceId = voiceId || (speaker ? getVoiceIdForSpeaker(speaker) : VOICE_IDS.default);

  // Log the text length and voice being used for debugging
  console.log(`[ElevenLabs] TTS request - Voice: ${finalVoiceId}, Speaker: ${speaker || 'default'}, Text length: ${text?.length || 0} chars`);

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  // Validate text is not empty
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate speech from empty text');
  }

  const voiceSettings: VoiceSettings = {
    stability,
    similarity_boost: similarityBoost,
    style,
    use_speaker_boost: useSpeakerBoost,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${finalVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: voiceSettings,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Log audio buffer size for debugging
    console.log(`[ElevenLabs] Audio generated: ${buffer.length} bytes (~${Math.round(buffer.length / 16000)}s at 128kbps)`);
    
    return buffer;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ElevenLabs API request timed out after 60 seconds');
    }
    throw error;
  }
}

/**
 * Generate speech for multiple segments and concatenate them
 * Returns an array of audio buffers for each segment
 */
export async function generatePodcastAudio(
  segments: Array<{ speaker: string; text: string; emotion?: string }>,
  onProgress?: (current: number, total: number, message: string) => Promise<void>
): Promise<Buffer[]> {
  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (onProgress) {
      await onProgress(i + 1, segments.length, `Recording: ${segment.speaker}`);
    }

    // Adjust voice settings based on emotion
    const emotionSettings = getEmotionSettings(segment.emotion);
    
    try {
      const audioBuffer = await textToSpeech({
        text: segment.text,
        ...emotionSettings,
      });
      
      audioBuffers.push(audioBuffer);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error generating audio for segment ${i + 1}:`, error);
      throw error;
    }
  }

  return audioBuffers;
}

/**
 * Get voice settings based on the emotion of the segment
 */
function getEmotionSettings(emotion?: string): Partial<TextToSpeechOptions> {
  const settings: Record<string, Partial<TextToSpeechOptions>> = {
    mysterious: {
      stability: 0.6,
      similarityBoost: 0.8,
      style: 0.3,
    },
    dramatic: {
      stability: 0.4,
      similarityBoost: 0.85,
      style: 0.7,
    },
    excited: {
      stability: 0.3,
      similarityBoost: 0.75,
      style: 0.8,
    },
    serious: {
      stability: 0.7,
      similarityBoost: 0.8,
      style: 0.4,
    },
    suspenseful: {
      stability: 0.5,
      similarityBoost: 0.85,
      style: 0.5,
    },
    shocked: {
      stability: 0.3,
      similarityBoost: 0.8,
      style: 0.9,
    },
  };

  return settings[emotion || ''] || {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.5,
  };
}

/**
 * Concatenate multiple audio buffers into a single audio file
 * Note: This is a simple concatenation - for production, you'd want
 * to use a proper audio library like ffmpeg for better results
 */
export function concatenateAudioBuffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

/**
 * Get available voices from ElevenLabs
 */
export async function getVoices(): Promise<unknown[]> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}

/**
 * Check remaining character quota
 */
export async function getSubscriptionInfo(): Promise<{
  character_count: number;
  character_limit: number;
  remaining: number;
}> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get subscription info: ${response.status}`);
  }

  const data = await response.json();
  return {
    character_count: data.character_count,
    character_limit: data.character_limit,
    remaining: data.character_limit - data.character_count,
  };
}
