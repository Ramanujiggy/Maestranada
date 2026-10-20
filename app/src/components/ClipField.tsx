// A move's technique clip: add one from a video (or a ready-made GIF),
// see it loop, replace or remove it. And the large version Teach mode shows.

import { useEffect, useRef, useState } from 'react';
import { Film, Maximize2, RefreshCw, X } from 'lucide-react';
import { uid, type Clip } from '../lib/plan.ts';
import { putClip, useClip, useClipUrl } from '../lib/clips.ts';
import { ConfirmDialog } from './feedback.tsx';
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
  const { url, missing } = useClip(clip);
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const saving = useRef(false);

  const save = async (gif: MadeGif) => {
    // A double tap on "Use" must not store the clip twice.
    if (saving.current) return;
    saving.current = true;
    const id = uid();
    try {
      await putClip(id, gif.blob);
      onChange({ id, width: gif.width, height: gif.height });
      setVideo(null);
    } catch {
      notify('There is no room left on this device for that clip');
    } finally {
      saving.current = false;
    }
  };

  const onFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (file.type === 'image/gif' || (!file.type && name.endsWith('.gif'))) {
      try {
        await save({ blob: file, ...(await imageSize(file)) });
      } catch {
        notify('That GIF could not be read');
      }
      return;
    }
    // Some pickers leave the type blank, so the extension counts too.
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|3gp)$/.test(name)) {
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
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmRemove(true)}>
              <X size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="clip-add" onClick={() => fileRef.current?.click()}>
          <Film size={16} />
          <span>
            <strong>{missing ? 'Clip not on this device' : 'Add a technique clip'}</strong>
            <span className="muted">
              {missing ? 'Import a backup that has it, or pick the video again' : 'Pick a video and it becomes a looping GIF'}
            </span>
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
      {confirmRemove && (
        <ConfirmDialog
          title="Remove this clip?"
          body="The GIF is deleted from this device. A backup you exported earlier still has it."
          confirmLabel="Remove clip"
          onConfirm={() => {
            setConfirmRemove(false);
            onChange(undefined);
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
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
      {big && <Lightbox url={url} label={label} onClose={() => setBig(false)} />}
    </>
  );
}

function Lightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop clip-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <img src={url} alt={label} />
      <button type="button" className="icon-btn clip-lightbox-close" aria-label="Close" onClick={onClose} autoFocus>
        <X size={20} />
      </button>
    </div>
  );
}
