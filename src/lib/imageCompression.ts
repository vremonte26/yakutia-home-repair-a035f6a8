import Compressor from 'compressorjs';

export interface CompressOptions {
  quality?: number;
  maxWidth?: number;
  mimeType?: string;
}

/**
 * Compress an image file before uploading.
 * Returns a Blob (with `name` property when possible) on success.
 * Falls back to original file if compression fails (caller should notify the user).
 */
export function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File | Blob> {
  // Skip non-image files (e.g. svg, gif animations) — return original
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return Promise.resolve(file);
  }

  const { quality = 0.7, maxWidth = 1280, mimeType = 'image/jpeg' } = options;

  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      maxWidth,
      mimeType,
      convertSize: 0, // always convert to specified mimeType
      success(result) {
        // Wrap as File so it keeps a name + type for storage upload
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        const compressed = new File([result], name, {
          type: mimeType,
          lastModified: Date.now(),
        });
        resolve(compressed);
      },
      error(err) {
        reject(err);
      },
    });
  });
}

/**
 * Safe wrapper: tries to compress, on failure returns original file and calls onError.
 */
export async function compressImageSafe(
  file: File,
  options?: CompressOptions,
  onError?: (err: unknown) => void
): Promise<File | Blob> {
  try {
    return await compressImage(file, options);
  } catch (err) {
    onError?.(err);
    return file;
  }
}
