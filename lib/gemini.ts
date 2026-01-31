import { GoogleGenerativeAI } from '@google/generative-ai';
import { NarrativeStyle, PodcastScript, ScriptSegment } from './types';
import { FileWithContent } from './github/fetcher';
import { GitHubRepo } from './github/client';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Voice IDs for different styles
export const VOICE_IDS = {
  detective: '8iDUAV5slUpRv30f3cyz', // Main detective voice
  sports_commentator_1: 'gU0LNdkMOQCOrPrwtbee', // Sports voice 1
  sports_commentator_2: 'UPZIegnxY8z2Ya7jignw', // Sports voice 2
  documentary: '8iDUAV5slUpRv30f3cyz', // Documentary narrator
};

export async function generatePodcastScript(
  repoData: GitHubRepo,
  files: FileWithContent[],
  narrativeStyle: NarrativeStyle,
  context?: {
    selectedFilesSummary?: any;
    statistics?: any;
    patterns?: string[];
    fullRepoContext?: boolean;
  }
): Promise<PodcastScript> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Get style-specific prompt
  const stylePrompt = getStyleSpecificPrompt(narrativeStyle, repoData, files, context);

  console.log('[Gemini] Generating script with style:', narrativeStyle);
  console.log(`[Gemini] Prompt length: ${stylePrompt.length} characters`);

  // Truncate prompt if too large (Gemini has token limits)
  const MAX_PROMPT_LENGTH = 30000; // ~7500 tokens
  const truncatedPrompt = stylePrompt.length > MAX_PROMPT_LENGTH 
    ? stylePrompt.substring(0, MAX_PROMPT_LENGTH) + '\n\n[Content truncated for length. Generate script based on available information.]'
    : stylePrompt;
  
  if (truncatedPrompt.length < stylePrompt.length) {
    console.log(`[Gemini] Prompt truncated from ${stylePrompt.length} to ${truncatedPrompt.length} characters`);
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('[Gemini] ❌ GEMINI_API_KEY is missing!');
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  console.log('[Gemini] Calling Gemini API...');
  
  let result;
  try {
    // Add timeout for Gemini API call (90 seconds)
    result = await Promise.race([
      model.generateContent(truncatedPrompt),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout after 90 seconds')), 90000)
      )
    ]);
  } catch (apiError: any) {
    console.error('[Gemini] ❌ API call failed:', apiError?.message);
    throw new Error(`Gemini API error: ${apiError?.message || 'Unknown error'}`);
  }
  
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  // Parse the JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const previewText = text.length > 200 ? text.substring(0, 200) : text;
    console.error('[Gemini] Failed to find JSON in response:', previewText);
    console.log('[Gemini] Using fallback script for repository');
    // Use fallback script when JSON parsing completely fails
    return {
      title: `The Case of ${repoData.name}`,
      narrator_voice: 'detective',
      dramatic_arc: `Investigating ${repoData.fullName}`,
      segments: generateFallbackSegments(repoData, files, narrativeStyle),
      total_duration: 0,
    };
  }

  let scriptData;
  try {
    scriptData = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('[Gemini] JSON parse error:', parseError);
    console.error('[Gemini] Attempted to parse:', jsonMatch[0].substring(0, 500));
    console.log('[Gemini] Using fallback script due to parse error');
    // Use fallback script when JSON parsing fails
    return {
      title: `The Case of ${repoData.name}`,
      narrator_voice: 'detective',
      dramatic_arc: `Investigating ${repoData.fullName}`,
      segments: generateFallbackSegments(repoData, files, narrativeStyle),
      total_duration: 0,
    };
  }

  console.log(`[Gemini] ✅ Script generated: "${scriptData.title}" with ${scriptData.segments?.length || 0} segments`);

  // Validate and sanitize segments to prevent undefined text errors
  let validatedSegments = (scriptData.segments || [])
    .filter((seg: any) => seg && typeof seg === 'object')
    .map((seg: any) => ({
      speaker: seg.speaker || 'narrator',
      text: String(seg.text || '').trim(),
      emotion: seg.emotion || undefined,
      sound_effect: seg.sound_effect || undefined,
      code_reference: seg.code_reference || undefined,
    }))
    .filter((seg: any) => seg.text.length > 0); // Remove empty text segments

  if (validatedSegments.length === 0) {
    console.warn('[Gemini] No valid segments found, generating fallback script');
    // Generate a fallback script for large/complex repositories
    validatedSegments = generateFallbackSegments(repoData, files, narrativeStyle);
    scriptData.title = scriptData.title || `The Case of ${repoData.name}`;
  }

  console.log(`[Gemini] ✅ Validated ${validatedSegments.length} segments`);

  return {
    title: scriptData.title || 'Untitled Investigation',
    narrator_voice: scriptData.narrator_voice || 'detective',
    dramatic_arc: scriptData.dramatic_arc || '',
    segments: validatedSegments,
    total_duration: 0,
  };
}

function generateFallbackSegments(
  repoData: GitHubRepo,
  files: FileWithContent[],
  style: NarrativeStyle
): ScriptSegment[] {
  const topLanguages = Object.entries(
    files.reduce((acc, f) => {
      const ext = f.path.split('.').pop() || 'unknown';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, 3).map(([lang]) => lang);

  const keyFiles = files.slice(0, 5).map(f => f.path.split('/').pop()).join(', ');
  
  if (style === NarrativeStyle.SPORTS) {
    return [
      { speaker: 'commentator_1', text: `And HERE WE GO! ${repoData.name} takes the pitch!`, sound_effect: 'crowd_cheering', emotion: 'excited' },
      { speaker: 'commentator_2', text: `${repoData.stars.toLocaleString()} fans in the stands tonight!`, emotion: 'impressed' },
      { speaker: 'commentator_1', text: `${files.length} players on the roster. ${repoData.language} leading the attack!`, emotion: 'building' },
      { speaker: 'commentator_2', text: `Look at that formation! ${topLanguages.join(', ')} in midfield!`, emotion: 'analytical' },
      { speaker: 'commentator_1', text: `Key players: ${keyFiles}. World class!`, emotion: 'explosive' },
      { speaker: 'commentator_2', text: `${repoData.description || 'Championship material, this one!'}` },
      { speaker: 'commentator_1', text: `FULL TIME! ${repoData.name} delivers a stunning performance!`, sound_effect: 'whistle', emotion: 'excited' },
    ];
  } else if (style === NarrativeStyle.DOCUMENTARY) {
    return [
      { speaker: 'narrator', text: `Here... in the depths of the digital wilderness... we discover something remarkable.`, sound_effect: 'nature_ambience', emotion: 'wonder' },
      { speaker: 'narrator', text: `${repoData.fullName}. A creature of extraordinary complexity.`, emotion: 'reverent' },
      { speaker: 'narrator', text: `${repoData.stars.toLocaleString()} observers... drawn to witness its ${files.length} interconnected components.`, emotion: 'curious' },
      { speaker: 'narrator', text: `The primary species... ${repoData.language}. Coexisting with ${topLanguages.join(' and ')}.`, emotion: 'wonder' },
      { speaker: 'narrator', text: `${repoData.description || 'A fascinating specimen... of collaborative evolution.'}` },
      { speaker: 'narrator', text: `And so... ${repoData.name}... continues its remarkable journey. Extraordinary.`, emotion: 'reverent' },
    ];
  } else {
    // TRUE_CRIME default - short, punchy noir style
    return [
      { speaker: 'narrator', text: `Rain on the glass. Another case file. ${repoData.fullName}.`, sound_effect: 'rain', emotion: 'world-weary' },
      { speaker: 'narrator', text: `${repoData.stars.toLocaleString()} stars. ${files.length} files. Too many alibis.`, emotion: 'suspicious' },
      { speaker: 'narrator', text: `Primary weapon? ${repoData.language}. Accomplices in ${topLanguages.join(', ')}.`, emotion: 'analytical' },
      { speaker: 'narrator', text: `${repoData.description || 'Motive unclear. But code always talks.'}` },
      { speaker: 'narrator', text: `Key suspects: ${keyFiles}. Each one hiding something.`, sound_effect: 'keyboard_typing' },
      { speaker: 'narrator', text: `The verdict? ${repoData.name} walks. For now. But I'll be watching.`, emotion: 'conclusive' },
    ];
  }
}

function getStyleSpecificPrompt(
  style: NarrativeStyle,
  repoData: GitHubRepo,
  files: FileWithContent[],
  context?: any
): string {
  const baseRepoInfo = `
📂 REPOSITORY INFORMATION:
- **Repository**: ${repoData.fullName}
- **Description**: ${repoData.description || 'No description provided'}
- **Primary Language**: ${repoData.language}
- **Stars**: ${repoData.stars}
- **Files Examined**: ${context?.statistics?.analyzedFiles || files.length} files
${repoData.topics && repoData.topics.length > 0 ? `- **Topics**: ${repoData.topics.join(', ')}` : ''}

🧬 LANGUAGES:
${context?.statistics?.languages 
  ? Object.entries(context.statistics.languages)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([lang, count]) => `  - ${lang}: ${count} files`)
      .join('\n')
  : `  - ${repoData.language || 'Multiple languages'}`}

🔎 KEY FILES:
${files.slice(0, 15).map((f, idx) => {
  const analysis = f.analysis;
  return `${idx + 1}. **${f.path}** - ${f.size} bytes${
     analysis?.interestingComments && analysis.interestingComments.length > 0
       ? ` | Note: ${analysis.interestingComments[0]}`
       : ''
   }`;
}).join('\n')}

🎯 DETECTED PATTERNS:
${context?.patterns && context.patterns.length > 0 
  ? context.patterns.map((p: string) => `  - ${p}`).join('\n')
  : '  - Standard codebase structure'}

📝 SAMPLE CODE (for reference):
${files.slice(0, 2).map(f => `
--- ${f.path} ---
\`\`\`
${f.content?.substring(0, 400)}${f.content && f.content.length > 400 ? '...' : ''}
\`\`\`
`).join('\n')}`;

  if (style === NarrativeStyle.SPORTS) {
    return getSportsCommentaryPrompt(repoData, baseRepoInfo);
  } else if (style === NarrativeStyle.DOCUMENTARY) {
    return getDocumentaryPrompt(repoData, baseRepoInfo);
  } else {
    // TRUE_CRIME is default
    return getTrueCrimePrompt(repoData, baseRepoInfo);
  }
}

function getTrueCrimePrompt(repoData: GitHubRepo, baseRepoInfo: string): string {
  return `You are Detective Mongo D. Bane, lead investigator for the Code Crime Unit. The rain hammers the window. Another case file lands on your desk.

${baseRepoInfo}

🎬 CREATE A HARD-BOILED TRUE CRIME PODCAST (STRICTLY 3-4 MINUTES - 400 to 500 words MAX)

🎙️ VOICE DIRECTION (CRITICAL - Write dialogue optimized for this delivery):
- **Age/Gender**: Male, 45-50 years old
- **Timbre**: Deep, gravelly, resonant. Heavy vocal fry with raspy, parched texture
- **Accent**: Subtle New York (Lower East Side/Brooklyn), non-rhotic 'r' sounds
- **Pace**: Low-tempo, rhythmic, deliberate. Let words hang in the air
- **Dynamics**: High intimacy, close-mic feel. NO shouting. Authority through gravel and breath control
- **Emotional Tone**: World-weary, cynical, analytical, stoic
- **Studio Feel**: High-fidelity, close-mic intimacy capturing every weathered breath

CRITICAL EXECUTION RULES:
1. **CREDIT CONSERVATION**: Maximum 500 words. ElevenLabs credits burn fast—make every syllable count.
2. **WRITE FOR THE VOICE**: Short, punchy sentences. Lots of periods. Let the gravel breathe.
3. **THE NOIR VIBE**: The repo is a "suspect." Functions are "alibis." Classes are "accomplices." Bugs are "bodies."
4. **INTERROGATE THE TARGET**: Grill the architecture. Find the "motive" behind design choices. Clean operation or messy hit?
5. **FORMAT**: 
   - "narrator" = The Detective. Cynical. Gravelly. Low and slow.
   - "sound_effect" = Sparse. High-impact only.

STRUCTURE:
1. **THE CRIME SCENE** (30s): Set the atmosphere. The discovery of ${repoData.name}.
2. **THE AUTOPSY** (1m): Tech stack as the victim's anatomy. Quick, clinical.
3. **THE GRILLING** (1m): Confront the key files. Point out the shady logic. What's hiding in there?
4. **THE VERDICT** (55s): Final judgment. Walking free or going to the chair?

📋 REQUIRED JSON FORMAT:
{
  "title": "CASE FILE #${repoData.name.toUpperCase()}: The [Gritty Noir Subtitle]",
  "narrator_voice": "detective",
  "dramatic_arc": "A high-stakes forensic analysis of ${repoData.fullName}",
  "segments": [
    {
      "speaker": "narrator",
      "text": "Short. Punchy. Let it breathe.",
      "emotion": "world-weary|suspicious|analytical|conclusive",
      "sound_effect": "optional - use sparingly"
    }
  ]
}

WRITING STYLE EXAMPLES (match this rhythm):
- "The rain don't stop. Neither do I."
- "Forty thousand lines of code. Forty thousand alibis."
- "I've seen cleaner crime scenes. But I've seen worse."
- "The architecture tells a story. Question is... who's lying?"

AVAILABLE SOUND EFFECTS: rain, suspenseful_music, dramatic_pause, thunder, keyboard_typing, door_slam, footsteps, static_noise, lighter_flick`;
}

function getSportsCommentaryPrompt(repoData: GitHubRepo, baseRepoInfo: string): string {
  return `You are TWO legendary football commentators calling the match of the century. This code is about to make history!

${baseRepoInfo}

🎬 CREATE A SPORTS "MATCH OF THE DAY" PODCAST (STRICTLY 3-4 MINUTES - 400 to 500 words MAX)

🎙️ VOICE DIRECTION (CRITICAL - Write dialogue optimized for these deliveries):

**COMMENTATOR 1 (Play-by-Play)**:
- **Age/Gender**: Male, 55-60 years old
- **Timbre**: Booming, authoritative, crystal clear
- **Accent**: British (received pronunciation with hints of Northern warmth)
- **Pace**: Variable - builds from measured to explosive on big moments
- **Dynamics**: Stadium-filling projection, dramatic pauses before key calls
- **Emotional Tone**: Excited, professional, building anticipation

**COMMENTATOR 2 (Color Commentary)**:
- **Age/Gender**: Male, 45-50 years old  
- **Timbre**: Warm, enthusiastic, slightly gravelly from years in the booth
- **Accent**: Subtle Scottish or Irish lilt
- **Pace**: Quick wit, reactive, punctuates the play-by-play
- **Dynamics**: Conversational but energetic, laughs easily
- **Emotional Tone**: Passionate, analytical, loves the beautiful game

CRITICAL EXECUTION RULES:
1. **CREDIT CONSERVATION**: Maximum 500 words. Keep it tight and exciting.
2. **RAPID-FIRE EXCHANGES**: Short bursts. Back and forth. Build momentum.
3. **FOOTBALL METAPHORS**: Code is the pitch. Functions are players. Bugs are own goals.
4. **FORMAT**: 
   - "commentator_1" = Play-by-play. The big calls.
   - "commentator_2" = Color. The analysis and reactions.
   - "sound_effect" = Crowd reactions. Use for emphasis.

STRUCTURE:
1. **KICKOFF** (30s): Stadium roar. Introduce ${repoData.name}. The crowd goes wild.
2. **FIRST HALF** (1m): Attack the architecture. What formation are they playing?
3. **SECOND HALF** (1m): The key patterns. Brilliant plays or defensive disasters?
4. **FINAL WHISTLE** (55s): The score. The verdict. A legendary closing call.

📋 REQUIRED JSON FORMAT:
{
  "title": "${repoData.name.toUpperCase()} vs THE COMPETITION: [Epic Match Title]",
  "narrator_voice": "sports",
  "dramatic_arc": "Championship coverage of ${repoData.fullName}",
  "segments": [
    {
      "speaker": "commentator_1",
      "text": "And here we GO!",
      "emotion": "excited|building|explosive",
      "sound_effect": "optional"
    },
    {
      "speaker": "commentator_2", 
      "text": "What a setup!",
      "emotion": "impressed|analytical|passionate"
    }
  ]
}

WRITING STYLE EXAMPLES (match this rhythm):
- C1: "And ${repoData.name} steps onto the pitch!" C2: "Look at that confidence!"
- C1: "OH! What a piece of architecture!" C2: "Absolutely world class!"
- C1: "They're building from the back here..." C2: "Solid foundation. I like it."

AVAILABLE SOUND EFFECTS: crowd_cheering, whistle, goal_horn, crowd_gasp, applause, stadium_ambience, vuvuzela`;
}

function getDocumentaryPrompt(repoData: GitHubRepo, baseRepoInfo: string): string {
  return `You are Sir David Attenborough, observing a rare and magnificent digital organism in its natural server habitat.

${baseRepoInfo}

🎬 CREATE A NATURE DOCUMENTARY PODCAST (STRICTLY 3-4 MINUTES - 400 to 500 words MAX)

🎙️ VOICE DIRECTION (CRITICAL - Write dialogue optimized for this delivery):
- **Age/Gender**: Male, 75-80 years old (but timeless)
- **Timbre**: Warm, rich, velvet-smooth with gentle gravitas
- **Accent**: Refined British RP, melodic and measured
- **Pace**: Slow, contemplative, savoring each observation. Pregnant pauses.
- **Dynamics**: Hushed intimacy, as if not to disturb the creature. Whispered wonder.
- **Emotional Tone**: Awe-struck, curious, gently humorous, profoundly respectful
- **Studio Feel**: ASMR-adjacent. Close-mic warmth. The rustle of nature.

CRITICAL EXECUTION RULES:
1. **CREDIT CONSERVATION**: Maximum 500 words. Let silence do the work.
2. **WRITE FOR THE VOICE**: Long, flowing sentences. Observations that breathe. Wonder in every phrase.
3. **NATURE METAPHORS**: Code is biology. Databases are "nesting grounds." Functions are "apex predators." APIs are "symbiotic relationships." Bugs are "parasites."
4. **GENTLE HUMOR**: Occasional dry wit. A raised eyebrow at peculiar code.
5. **FORMAT**: 
   - "narrator" = The Naturalist. Hushed. Reverent. Curious.
   - "sound_effect" = Nature ambience. Gentle. Immersive.

STRUCTURE:
1. **THE DISCOVERY** (30s): First contact with the ${repoData.name} ecosystem. Hushed wonder.
2. **ECOLOGICAL STUDY** (1m): The habitat. How the stack survives together. The food chain.
3. **BEHAVIORAL OBSERVATION** (1m): Watch the code in action. Mating rituals of functions. Territorial patterns.
4. **SURVIVAL PROGNOSIS** (55s): Will this species thrive... or face extinction?

📋 REQUIRED JSON FORMAT:
{
  "title": "${repoData.name}: A Digital Wilderness",
  "narrator_voice": "documentary",
  "dramatic_arc": "The remarkable survival story of ${repoData.fullName}",
  "segments": [
    {
      "speaker": "narrator",
      "text": "Here... in the depths of the repository... we find something remarkable.",
      "emotion": "wonder|curious|reverent|amused",
      "sound_effect": "optional - nature ambience"
    }
  ]
}

WRITING STYLE EXAMPLES (match this rhythm):
- "And here... we observe... a most remarkable creature."
- "The function... waits. Patient. Hungry for data."
- "One might wonder... why the developer chose this path. But nature... finds a way."
- "Extraordinary. Simply... extraordinary."

AVAILABLE SOUND EFFECTS: nature_ambience, birds_chirping, wind, water_flowing, dramatic_strings, gentle_music, rustling_leaves, distant_thunder`;
}
export async function generateAutopsyReport(
  repoData: GitHubRepo,
  files: FileWithContent[],
  patterns: string[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Analyze the following GitHub repository to understand its purpose, main features, and overall architecture.
    Generate a concise, professional, and insightful introduction for an "Autopsy Report".
    This text should summarize what the repository is, its target audience, and its key value proposition.
    Format: A single, well-written paragraph.

    Repository: ${repoData.fullName}
    Description: ${repoData.description}
    Languages: ${repoData.language}
    Topics: ${repoData.topics.join(', ')}
    Patterns Found: ${patterns.join(', ')}
    
    Files Sample:
    ${files.slice(0, 10).map(f => `- ${f.path}`).join('\n')}
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating autopsy report:', error);
    return repoData.description || "Analysis failed to generate report.";
  }
}

export async function analyzeCodePatterns(files: FileWithContent[]): Promise<string[]> {
  const patterns: string[] = [];

  // Enhanced pattern detection using file content and analysis
  const fileExtensions = files.map((f) => f.path.split('.').pop());
  const uniqueExtensions = [...new Set(fileExtensions)];
  const filePaths = files.map(f => f.path.toLowerCase());

  // Testing patterns
  if (filePaths.some(p => p.includes('test') || p.includes('spec') || p.includes('__tests__'))) {
    patterns.push('Test-Driven Development');
  }

  // Containerization
  if (filePaths.some((f) => f.includes('docker') || f.includes('dockerfile'))) {
    patterns.push('Containerization');
  }

  // CI/CD
  if (filePaths.some((f) => f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('jenkins'))) {
    patterns.push('CI/CD Pipeline');
  }

  // API patterns
  if (filePaths.some((f) => f.includes('api') || f.includes('routes') || f.includes('endpoints'))) {
    patterns.push('RESTful API Architecture');
  }

  // Frontend frameworks
  if (uniqueExtensions.includes('jsx') || uniqueExtensions.includes('tsx')) {
    patterns.push('React Architecture');
  }
  if (filePaths.some(f => f.includes('vue'))) {
    patterns.push('Vue.js Architecture');
  }
  if (filePaths.some(f => f.includes('angular'))) {
    patterns.push('Angular Architecture');
  }

  // Backend frameworks
  if (filePaths.some(f => f.includes('express') || f.includes('fastapi') || f.includes('flask') || f.includes('django'))) {
    patterns.push('Backend Framework');
  }

  // Database patterns
  if (filePaths.some(f => f.includes('model') || f.includes('schema') || f.includes('migration'))) {
    patterns.push('Database Layer');
  }

  // Configuration management
  if (filePaths.some(f => f.includes('.env') || f.includes('config'))) {
    patterns.push('Environment Configuration');
  }

  // TypeScript usage
  if (uniqueExtensions.includes('ts') || uniqueExtensions.includes('tsx')) {
    patterns.push('TypeScript Type Safety');
  }

  // Monorepo structure
  if (filePaths.some(f => f.includes('packages/') || f.includes('apps/'))) {
    patterns.push('Monorepo Structure');
  }

  // Analyze complexity
  const highComplexityFiles = files.filter(f => 
    f.analysis?.linesOfCode && f.analysis.linesOfCode > 200
  );
  if (highComplexityFiles.length > 3) {
    patterns.push('Complex Codebase');
  }

  // Check for interesting comments
  const filesWithTodos = files.filter(f => 
    f.analysis?.interestingComments?.some(c => c.toLowerCase().includes('todo'))
  );
  if (filesWithTodos.length > 5) {
    patterns.push('Work in Progress');
  }

  return [...new Set(patterns)]; // Remove duplicates
}