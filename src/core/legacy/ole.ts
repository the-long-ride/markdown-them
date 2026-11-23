import * as XLSX from 'xlsx';

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function isOleCompoundFile(data: Uint8Array): boolean {
  return data.length >= OLE_SIGNATURE.length && OLE_SIGNATURE.every((byte, i) => data[i] === byte);
}

export function isZipFile(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
}

export interface OleStreams {
  get(name: string): Uint8Array | undefined;
}

export function readOleStreams(data: Uint8Array): OleStreams {
  const container = XLSX.CFB.read(data, { type: 'array' });
  const fullPaths = container.FullPaths.map((fullPath: string) => fullPath.toUpperCase());
  const root = fullPaths[0] ?? '';
  return {
    get(name: string) {
      const index = fullPaths.indexOf(`${root}${name.toUpperCase()}`);
      const entry = index >= 0 ? container.FileIndex[index] : undefined;
      if (!entry || !entry.content) {
        return undefined;
      }
      const content = entry.content as ArrayLike<number>;
      return content instanceof Uint8Array ? content : Uint8Array.from(content);
    },
  };
}
