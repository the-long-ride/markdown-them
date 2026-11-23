import type JSZip from 'jszip';

export async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(filePath);
  return file ? file.async('text') : undefined;
}
