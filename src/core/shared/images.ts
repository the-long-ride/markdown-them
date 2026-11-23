export const IMAGE_EXTENSIONS = 'avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf';

const IMAGE_PATH_PATTERN = new RegExp(`\\.(${IMAGE_EXTENSIONS})$`, 'i');

const MIME_TYPES = new Map<string, string>([
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['emf', 'image/x-emf'],
  ['gif', 'image/gif'],
  ['heic', 'image/heic'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['webp', 'image/webp'],
  ['wmf', 'image/wmf'],
]);

export function isImageFilePath(filePath: string): boolean {
  return IMAGE_PATH_PATTERN.test(filePath);
}

export function escapeImageAlt(value: string, fallback: string): string {
  return (
    value
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/]/g, '\\]')
      .trim() || fallback
  );
}

export function fallbackMimeType(extension: string): string {
  return MIME_TYPES.get(extension) ?? 'application/octet-stream';
}

export function base64ByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
