// Getting a file out of the app. On a phone the share sheet is the natural
// way to save to Files, send by email or open in Word; on a computer it's a
// plain download.

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileSlug(title: string, fallback = 'class'): string {
  return (title || fallback).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback;
}
