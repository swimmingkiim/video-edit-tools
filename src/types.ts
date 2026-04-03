export type Result<T> =
  | { ok: true; data: T; warnings?: string[] }
  | { ok: false; error: string; code: ErrorCode };

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FETCH_FAILED = 'FETCH_FAILED',
}

/**
 * Video input. Buffer, local file path, or URL.
 * Internally, it is always normalized to a temporary file path.
 */
export type VideoInput = Buffer | string;

/** Time representation: number of seconds or 'HH:MM:SS.mmm' string */
export type TimeCode = number | string;

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec: string | null;
  bitrate: number; // kbps
  size: number; // bytes
  format: string; // 'mp4' | 'webm' | 'avi' | ...
}

export interface TrimOptions {
  start: TimeCode;
  end?: TimeCode;
  duration?: number;
}

export interface ConcatOptions {
  transition?: { type: 'fade' | 'none'; duration?: number };
  format?: 'mp4' | 'webm';
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CropOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | string;
}

export interface ChangeSpeedOptions {
  speed: number;
}

export interface ConvertOptions {
  format: 'mp4' | 'webm' | 'avi' | 'mov' | 'gif';
  quality?: number;
  fps?: number;
  width?: number;
}

export interface ExtractFramesOptions {
  mode: 'fps' | 'timestamps' | 'count';
  fps?: number;
  timestamps?: TimeCode[];
  count?: number;
}

export interface TextSpan {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

export interface VideoTextLayer {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color?: string;
  fontFamily?: string;
  fontUrl?: string;
  anchor?: string;
  background?: { color: string; padding?: number; borderRadius?: number };
  stroke?: { color: string; width: number };
  startTime?: TimeCode;
  endTime?: TimeCode;
  animation?: 'fade-in' | 'fade-out' | 'fade-in-out' | 'none';
  spans?: TextSpan[];
}

export interface SubtitleEntry {
  startTime: TimeCode;
  endTime: TimeCode;
  text: string;
}

export interface AddSubtitlesOptions {
  subtitles: string | SubtitleEntry[];
  style?: {
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    outline?: boolean;
    position?: 'bottom' | 'top' | 'center';
  };
}

export interface CompositeOptions {
  layers: Array<{
    image: Buffer | string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    opacity?: number;
    startTime?: TimeCode;
    endTime?: TimeCode;
  }>;
}

export interface GradientOverlayOptions {
  direction: 'bottom' | 'top' | 'left' | 'right';
  color?: string;
  opacity?: number;
  coverage?: number;
}

export interface BlurRegionOptions {
  regions: Array<{ x: number; y: number; width: number; height: number }>;
  blur?: number;
}

export interface AddTransitionOptions {
  type: 'fade' | 'slide-left' | 'slide-right' | 'wipe' | 'dissolve';
  duration?: number;
}

export interface ExtractAudioOptions {
  format?: 'mp3' | 'aac' | 'wav' | 'flac';
  quality?: number;
}

export interface ReplaceAudioOptions {
  audio: Buffer | string;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
}

export interface AdjustVolumeOptions {
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  normalize?: boolean;
}

export interface MuteSectionOptions {
  sections: Array<{ start: TimeCode; end: TimeCode }>;
}

export interface TranscribeOptions {
  model?: 'tiny' | 'base' | 'small';
  language?: string;
  format?: 'json' | 'srt' | 'vtt';
  /** Optional path to save the transcript file (.srt, .vtt, or .json). */
  output?: string;
}

export interface TranscribeResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  srt?: string;
  vtt?: string;
  /** Path where the transcript was saved, if output was specified. */
  savedTo?: string;
}

export interface AdjustOptions {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  gamma?: number;
}

export interface ApplyFilterOptions {
  filter: 'grayscale' | 'sepia' | 'vintage' | 'blur' | 'sharpen' | 'vignette';
  intensity?: number;
}

export interface DetectScenesOptions {
  threshold?: number;
  minSceneDuration?: number;
}

export interface SceneDetectResult {
  scenes: Array<{ start: number; end: number; thumbnail?: Buffer }>;
  count: number;
}

export interface GenerateThumbnailOptions {
  time?: TimeCode;
  width?: number;
  height?: number;
  count?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export type PipelineStep =
  | ({ op: 'trim' } & TrimOptions)
  | ({ op: 'concat'; inputs: VideoInput[] } & ConcatOptions)
  | ({ op: 'resize' } & ResizeOptions)
  | ({ op: 'crop' } & CropOptions)
  | ({ op: 'changeSpeed' } & ChangeSpeedOptions)
  | { op: 'addText'; layers: VideoTextLayer[] }
  | ({ op: 'addSubtitles' } & AddSubtitlesOptions)
  | ({ op: 'composite' } & CompositeOptions)
  | ({ op: 'gradientOverlay' } & GradientOverlayOptions)
  | ({ op: 'adjust' } & AdjustOptions)
  | ({ op: 'applyFilter' } & ApplyFilterOptions)
  | ({ op: 'replaceAudio' } & ReplaceAudioOptions)
  | ({ op: 'adjustVolume' } & AdjustVolumeOptions)
  | ({ op: 'convert' } & ConvertOptions)
  | ({ op: 'generateThumbnail' } & GenerateThumbnailOptions);
