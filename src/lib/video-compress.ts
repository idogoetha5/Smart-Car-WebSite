'use client';

/**
 * Shrinks a phone video in the browser so it fits Supabase's per-file
 * upload limit (50MB on the current plan) before the inspection upload.
 *
 * Path 1 (fast, most phones): WebCodecs transcode via mediabunny — H.264
 * MP4, long side capped at 1280px (960 for long videos), bitrate chosen
 * from the video's duration so the result lands under the target size.
 * Path 2 (fallback): replay the video into a canvas and re-record it with
 * MediaRecorder at a capped bitrate. Real-time, but works where WebCodecs
 * encoding isn't available.
 *
 * Files already under the target are returned untouched.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const TARGET_BYTES = 42 * 1024 * 1024;
const AUDIO_BPS = 64_000;
const MAX_VIDEO_BPS = 2_500_000;
const MIN_VIDEO_BPS = 300_000;

export class VideoTooLongError extends Error {}

function videoBitrateFor(durationSec: number, targetBytes: number): number {
  const total = (targetBytes * 8) / Math.max(durationSec, 1);
  return Math.floor(Math.min(MAX_VIDEO_BPS, total - AUDIO_BPS));
}

function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || 'inspection';
}

async function transcodeWithWebCodecs(
  file: File,
  targetBytes: number,
  onProgress: (fraction: number) => void
): Promise<File | null> {
  const {
    Input,
    Output,
    Conversion,
    BlobSource,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    ALL_FORMATS,
    canEncodeVideo,
    canEncodeAudio,
  } = await import('mediabunny');

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const duration = await input.computeDuration();
    const videoBps = videoBitrateFor(duration, targetBytes);
    if (videoBps < MIN_VIDEO_BPS) throw new VideoTooLongError('Video too long to compress');

    const longSide = videoBps >= 1_000_000 ? 1280 : 960;
    const landscape = track.displayWidth >= track.displayHeight;
    const currentLong = Math.max(track.displayWidth, track.displayHeight);
    const size =
      currentLong > longSide ? (landscape ? { width: longSide } : { height: longSide }) : {};

    // H.264/AAC MP4 plays everywhere (incl. iPhone); fall back to VP9/Opus
    // WebM on browsers that can't encode H.264.
    const useMp4 = await canEncodeVideo('avc', { width: 1280, height: 720, bitrate: videoBps });
    const videoCodec = useMp4 ? 'avc' : (await canEncodeVideo('vp9')) ? 'vp9' : 'vp8';
    const audioCodec = useMp4 ? 'aac' : 'opus';
    const keepAudio = await canEncodeAudio(audioCodec);

    const output = new Output({
      format: useMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: { ...size, codec: videoCodec, bitrate: videoBps, forceTranscode: true },
      audio: keepAudio ? { codec: audioCodec, bitrate: AUDIO_BPS } : { discard: true },
      showWarnings: false,
    });

    // Needs a video track to survive; losing audio (unsupported encoder) is acceptable.
    const videoDiscarded = conversion.discardedTracks.some((d) => d.track.type === 'video');
    if (!conversion.isValid || videoDiscarded) return null;

    conversion.onProgress = (p: number) => onProgress(p);
    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer) return null;
    const ext = useMp4 ? 'mp4' : 'webm';
    return new File([buffer], `${baseName(file)}-compressed.${ext}`, { type: `video/${ext}` });
  } finally {
    input.dispose();
  }
}

function pickRecorderMime(): string | null {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return null;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

async function reRecordRealtime(
  file: File,
  targetBytes: number,
  onProgress: (fraction: number) => void
): Promise<File | null> {
  const mime = pickRecorderMime();
  if (!mime) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video'));
    });

    const duration = video.duration;
    const videoBps = videoBitrateFor(duration, targetBytes);
    if (videoBps < MIN_VIDEO_BPS) throw new VideoTooLongError('Video too long to compress');

    const longSide = videoBps >= 1_000_000 ? 1280 : 960;
    const scale = Math.min(1, longSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((video.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((video.videoHeight * scale) / 2) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof canvas.captureStream !== 'function') return null;

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBps });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(0.99, video.currentTime / duration));
      if (!video.ended) raf = requestAnimationFrame(draw);
    };

    recorder.start(1000);
    video.onended = () => {
      cancelAnimationFrame(raf);
      recorder.stop();
    };
    await video.play();
    draw();
    await done;

    const type = mime.split(';')[0];
    const ext = type === 'video/mp4' ? 'mp4' : 'webm';
    return new File(chunks, `${baseName(file)}-compressed.${ext}`, { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a file that fits the upload limit, compressing if necessary.
 * Throws VideoTooLongError if the video is too long to fit even at low
 * quality, or a generic Error if the browser can't compress it at all.
 */
export async function compressVideoIfNeeded(
  file: File,
  onProgress: (fraction: number) => void
): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;

  let target = TARGET_BYTES;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: File | null = null;
    try {
      result = await transcodeWithWebCodecs(file, target, onProgress);
    } catch (err) {
      if (err instanceof VideoTooLongError) throw err;
      console.warn('[video-compress] WebCodecs transcode failed, falling back:', err);
    }
    if (!result) {
      onProgress(0);
      result = await reRecordRealtime(file, target, onProgress);
    }
    if (!result) throw new Error('This browser cannot compress video');
    if (result.size <= MAX_UPLOAD_BYTES - 1024 * 1024) return result;
    // Overshot (encoders don't hit bitrate exactly) — retry smaller.
    target = Math.floor(target * 0.7);
    onProgress(0);
  }
  throw new Error('Could not compress video enough');
}
