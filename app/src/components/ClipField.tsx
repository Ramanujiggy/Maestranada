// A move's technique clip: add one from a video (or a ready-made GIF),
// see it loop, replace or remove it. And the large version Teach mode shows.

import { useRef, useState } from 'react';
import { Film, Maximize2, RefreshCw, X } from 'lucide-react';
import { uid, type Clip } from '../lib/plan.ts';
import { putClip, useClipUrl } from '../lib/clips.ts';
import { imageSize, type MadeGif } from '../lib/gif.ts';
import { ClipMaker } from './ClipMaker.tsx';

export function ClipField({
  clip,
  onChange,
  notify,
}: {
  clip: Clip | undefined;
  onChange: (clip: Clip | undefined) => void;
  notify: (m: string) => void;
}) {
  const url = useClipUrl(clip);
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);

  const save = async (gif: MadeGif) => {
    const id = uid();
    try {
      await putClip(id, gif.blob);
      onChange({ id, width: gif.width, height: gif.height });
      setVideo(null);
    } catch {
      notify('There is no room left on this device for that clip');
    }
  };

  const onFile = async (file: File) => {
    if (file.type === 'image/gif') {
      try {
        await save({ blob: file, ...(await imageSize(file)) });
      } catch {
        notify('That GIF could not be read');
      }
      return;
    }
    if (!file.type.startsWith('video/')) {
      notify('Pick a video or a GIF');
      return;
    }
    setVideo(file);
  };

  return (
    <>
      {clip && url ? (
        <div className="clip-field">
          <img src={url} alt="Technique clip" width={clip.width} height={clip.height} />
          <div className="clip-field-actions">
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <RefreshCw size={14} /> Replace
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onChange(undefined)}>
              <X size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="clip-add" onClick={() => fileRef.current?.click()}>
          <Film size={16} />
          <span>
            <strong>Add a technique clip</strong>
            <span className="muted">Pick a video and it becomes a looping GIF</span>
          </span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
      {video && <ClipMaker file={video} onUse={save} onClose={() => setVideo(null)} />}
    </>
  );
}

/** Teach mode: the clip as large as the screen allows; tap to fill the screen. */
export function ClipView({ clip, label }: { clip: Clip; label: string }) {
  const url = useClipUrl(clip);
  const [big, setBig] = useState(false);
  if (!url) return null;
  return (
    <>
      <button type="button" className="clip-view" onClick={() => setBig(true)} aria-label={`Enlarge clip: ${label}`}>
        <img src={url} alt={label} width={clip.width} height={clip.height} />
        <span className="clip-view-hint">
          <Maximize2 size={14} />
        </span>
      </button>
      {big && (
        <div className="backdrop clip-lightbox" onClick={() => setBig(false)} role="dialog" aria-label={label}>
          <img src={url} alt={label} />
        </div>
      )}
    </>
  );
}
