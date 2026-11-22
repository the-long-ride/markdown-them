import { brotliDecompressSync } from 'node:zlib';

export function woff2Characters(font) {
  if (font.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Expected a WOFF2 font');
  let cursor = 48;
  function base128() {
    let value = 0;
    for (let count = 0; count < 5; count++) {
      const byte = font.readUInt8(cursor++);
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid WOFF2 table length');
  }
  let offset = 0;
  let cmap;
  for (let index = 0; index < font.readUInt16BE(12); index++) {
    const flags = font.readUInt8(cursor++);
    const tagIndex = flags & 63;
    const tag = tagIndex === 63 ? font.toString('ascii', cursor, (cursor += 4)) : '';
    const originalLength = base128();
    const glyfOrLoca = tagIndex === 10 || tagIndex === 11 || tag === 'glyf' || tag === 'loca';
    const transformed = glyfOrLoca ? flags >> 6 !== 3 : flags >> 6 !== 0;
    const length = transformed ? base128() : originalLength;
    if (tagIndex === 0 || tag === 'cmap') {
      if (transformed) throw new Error('Transformed cmap is unsupported');
      cmap = { offset, length };
    }
    offset += length;
  }
  if (!cmap) throw new Error('WOFF2 font has no cmap');
  const tables = brotliDecompressSync(font.subarray(cursor, cursor + font.readUInt32BE(20)));
  if (tables.length !== offset) throw new Error('Invalid WOFF2 table data');
  const table = tables.subarray(cmap.offset, cmap.offset + cmap.length);
  const characters = new Set();
  for (let index = 0; index < table.readUInt16BE(2); index++) {
    const record = 4 + index * 8;
    const platform = table.readUInt16BE(record);
    if (platform !== 0 && platform !== 3) continue;
    const start = table.readUInt32BE(record + 4);
    const format = table.readUInt16BE(start);
    if (format === 12) {
      for (let group = 0; group < table.readUInt32BE(start + 12); group++) {
        const position = start + 16 + group * 12;
        const first = table.readUInt32BE(position);
        const last = table.readUInt32BE(position + 4);
        const glyph = table.readUInt32BE(position + 8);
        for (let point = first; point <= last; point++) {
          if (glyph + point - first !== 0) characters.add(point);
        }
      }
    } else if (format === 4) {
      const count = table.readUInt16BE(start + 6) / 2;
      const ends = start + 14;
      const starts = ends + count * 2 + 2;
      const deltas = starts + count * 2;
      const ranges = deltas + count * 2;
      for (let segment = 0; segment < count; segment++) {
        const first = table.readUInt16BE(starts + segment * 2);
        const last = table.readUInt16BE(ends + segment * 2);
        const delta = table.readInt16BE(deltas + segment * 2);
        const address = ranges + segment * 2;
        const range = table.readUInt16BE(address);
        for (let point = first; point <= last && point !== 0xffff; point++) {
          let glyph = range ? table.readUInt16BE(address + range + (point - first) * 2) : point;
          if (!range || glyph) glyph = (glyph + delta) & 0xffff;
          if (glyph) characters.add(point);
        }
      }
    }
  }
  return characters;
}
