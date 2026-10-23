// GIF → short MP4 clip, on the device. A GIF from a screen recorder runs
// several megabytes for a few seconds; the same frames as an MP4 are a
// fraction of that. Each frame is decoded (omggif), laid over the ones before
// it the way a GIF player would, and encoded through WebCodecs (Mediabunny),
// keeping the GIF's own timing.
//
// A browser with no video encoder keeps the GIF as it is, and so does a GIF
// with one frame or one that somehow comes out smaller than its MP4.

import { GifReader } from 'omggif';
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, getFirstEncodableVideoCodec } from 'mediabunny';
import { fitSize } from './gif.ts';
import { CLIP_MAX_SIDE, type MadeClip } from './video.ts';

const BITRATE = 1_200_000;

/** Seconds a GIF frame shows. Browsers play delays under 0.02 s at 0.1 s, so the clip does too. */
export function frameSeconds(delay: number): number {
  return (delay < 2 ? 10 : delay) / 100;
}

export async function gifToClip(bytes: Uint8Array): Promise<MadeClip> {
  const gifBlob = new Blob([bytes], { type: 'image/gif' });
  const reader = new GifReader(bytes);
  const { width: w, height: h } = reader;
  const frames = reader.numFrames();
  const asGif: MadeClip = { blob: gifBlob, width: w, height: h };
  if (frames < 2 || typeof VideoEncoder === 'undefined') return asGif;

  const size = fitSize(w, h, CLIP_MAX_SIDE);
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { ...size, bitrate: BITRATE }).catch(() => null);
  if (!codec) return asGif;

  // The GIF at full size, built up frame by frame, and the clip-sized canvas it's drawn onto.
  const full = document.createElement('canvas');
  full.width = w;
  full.height = h;
  const fullCtx = full.getContext('2d');
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;
  const ctx = out.getContext('2d');
  if (!fullCtx || !ctx) return asGif;
  ctx.imageSmoothingQuality = 'high';

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(out, { codec, bitrate: BITRATE, keyFrameInterval: 2 });
  output.addVideoTrack(source);
  await output.start();

  const pixels = new Uint8ClampedArray(w * h * 4);
  const posterAt = Math.floor(frames / 3);
  let poster: Promise<Blob | null> | undefined;
  let time = 0;
  try {
    for (let i = 0; i < frames; i++) {
      const info = reader.frameInfo(i);
      // "Restore previous" frames are undone before the next one, so keep what was there.
      const before = info.disposal === 3 ? pixels.slice() : null;
      reader.decodeAndBlitFrameRGBA(i, pixels);
      fullCtx.putImageData(new ImageData(pixels, w, h), 0, 0);
      // Clear parts of a GIF play over white, as on a page.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(full, 0, 0, size.width, size.height);
      const seconds = frameSeconds(info.delay);
      await source.add(time, seconds);
      time += seconds;
      if (i === posterAt) poster = new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.82));
      if (info.disposal === 2) clearRect(pixels, w, info);
      else if (before) pixels.set(before);
      if (i % 8 === 7) await new Promise((r) => setTimeout(r)); // let the progress bar move
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  const mp4 = new Blob([target.buffer!], { type: 'video/mp4' });
  if (mp4.size >= gifBlob.size) return asGif;
  return { blob: mp4, ...size, poster: (await poster) ?? undefined };
}

/** "Restore to background": the frame's area goes clear. */
function clearRect(pixels: Uint8ClampedArray, w: number, f: { x: number; y: number; width: number; height: number }) {
  for (let y = f.y; y < Math.min(f.y + f.height, pixels.length / (w * 4)); y++) pixels.fill(0, (y * w + f.x) * 4, (y * w + f.x + f.width) * 4);
}
