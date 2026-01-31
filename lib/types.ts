export enum NarrativeStyle {
  TRUE_CRIME = 'true-crime',
  SPORTS = 'sports',
  DOCUMENTARY = 'documentary',
  COMEDY = 'comedy',
}

export enum AnalysisStatus {
  PENDING = 'pending',
  ANALYZING = 'analyzing',
  GENERATING_SCRIPT = 'generating_script',
  GENERATING_AUDIO = 'generating_audio',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ScriptSegment {
  speaker: string;
  text: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  sound_effect?: string;
  emotion?: string;
  code_reference?: Record<string, any>;
}

export interface PodcastScript {
  title: string;
  narrator_voice?: string;
  segments: ScriptSegment[];
  total_duration?: number;
  dramatic_arc?: string;
}

export interface Podcast {
  id: string;
  repo_url: string;
  repo_name: string;
  title: string;
  narrative_style: NarrativeStyle;
  status: AnalysisStatus;
  progress: number;
  progress_message: string;
  script?: PodcastScript;
  audio_url?: string;
  audio_filename?: string;
  duration: number;
  created_at: Date;
  completed_at?: Date;
  repo_metadata?: Record<string, any>;
  analysis_summary?: {
    total_files: number;
    analyzed_files: number;
    total_size: number;
    languages: Record<string, number>;
    processing_time_ms: number;
    autopsy_report?: string;
  };
  contributors?: string[];
  patterns_found: string[];
  error_message?: string;
}

export interface RepoAnalyzeRequest {
  repo_url: string;
  narrative_style?: NarrativeStyle;
}

export interface CodePattern {
  id: string;
  pattern_name: string;
  category: string;
  severity: string;
  detection_keywords: string[];
  dramatic_narrative: Record<string, string>;
  occurrences: number;
  solutions: string[];
  created_at: Date;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
}
