/**
 * E2E Fixture Generator
 * Generates synthetic, deterministic, zero-external-binary fixtures for:
 * .docx, .pdf, .xlsx, .pptx, .odt, .ods, .odp, .rtf, .html, .txt
 * along with boundary, corner-case, unicode, and malformed files.
 */

import JSZip from 'jszip';

/**
 * 1. DOCX Generator
 */
export async function generateDocx({
  title = 'Document Heading',
  paragraphs = ['This is a paragraph inside the DOCX document.'],
  boldText = '',
  italicText = '',
} = {}) {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  let paragraphsXml = '';
  if (title) {
    paragraphsXml += `
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>`;
  }

  for (const p of paragraphs) {
    paragraphsXml += `
    <w:p>
      <w:r><w:t>${escapeXml(p)}</w:t></w:r>
    </w:p>`;
  }

  if (boldText) {
    paragraphsXml += `
    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>${escapeXml(boldText)}</w:t>
      </w:r>
    </w:p>`;
  }

  if (italicText) {
    paragraphsXml += `
    <w:p>
      <w:r>
        <w:rPr><w:i/></w:rPr>
        <w:t>${escapeXml(italicText)}</w:t>
      </w:r>
    </w:p>`;
  }

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 2. PDF Generator (Valid PDF 1.4 with precise xref byte offsets)
 */
export function generatePdf({ text = 'Sample PDF Heading', lines = [] } = {}) {
  const allLines = [text, ...lines].filter(Boolean);

  let streamContent = 'BT\n/F1 16 Tf\n50 720 Td\n18 TL\n';
  for (let i = 0; i < allLines.length; i++) {
    const line = escapePdfText(allLines[i]);
    if (i === 0) {
      streamContent += `(${line}) Tj\n`;
    } else {
      streamContent += `T* (${line}) Tj\n`;
    }
  }
  streamContent += 'ET';

  const streamBuf = Buffer.from(streamContent, 'utf8');

  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  objs[4] = `<< /Length ${streamBuf.byteLength} >>\nstream\n${streamContent}\nendstream`;
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(out, 'utf8');
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(out, 'utf8');
  out += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(out, 'utf8');
}

/**
 * 3. XLSX Generator
 */
export async function generateXlsx({
  sheetName = 'Sheet1',
  headers = ['Column A', 'Column B'],
  rows = [['Data 1', 'Data 2']],
} = {}) {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  );

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  let rowsXml = '';

  if (headers && headers.length > 0) {
    let cells = '';
    headers.forEach((h, colIdx) => {
      const colLetter = colLetters[colIdx] || `C${colIdx}`;
      cells += `<c r="${colLetter}1" t="inlineStr"><is><t>${escapeXml(String(h))}</t></is></c>`;
    });
    rowsXml += `<row r="1">${cells}</row>`;
  }

  rows.forEach((row, rowIdx) => {
    const rowNum = (headers && headers.length > 0 ? 2 : 1) + rowIdx;
    let cells = '';
    row.forEach((val, colIdx) => {
      const colLetter = colLetters[colIdx] || `C${colIdx}`;
      if (typeof val === 'number') {
        cells += `<c r="${colLetter}${rowNum}"><v>${val}</v></c>`;
      } else {
        cells += `<c r="${colLetter}${rowNum}" t="inlineStr"><is><t>${escapeXml(String(val))}</t></is></c>`;
      }
    });
    rowsXml += `<row r="${rowNum}">${cells}</row>`;
  });

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 4. PPTX Generator
 */
export async function generatePptx({
  slides = [
    {
      title: 'Slide 1 Title',
      items: ['First bullet item', 'Second bullet item'],
    },
  ],
} = {}) {
  const zip = new JSZip();

  let slideContentTypeOverrides = '';
  let slideIdList = '';
  let presentationRels = '';

  slides.forEach((_, idx) => {
    const slideNum = idx + 1;
    slideContentTypeOverrides += `  <Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
    slideIdList += `    <p:sldId id="${255 + slideNum}" r:id="rIdSlide${slideNum}"/>\n`;
    presentationRels += `  <Relationship Id="rIdSlide${slideNum}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>\n`;
  });

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
${slideContentTypeOverrides}</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst>
${slideIdList}  </p:sldIdLst>
</p:presentation>`,
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presentationRels}</Relationships>`,
  );

  slides.forEach((slide, idx) => {
    const slideNum = idx + 1;
    let bodyItemsXml = '';
    (slide.items || []).forEach((item) => {
      bodyItemsXml += `
          <a:p>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t>${escapeXml(item)}</a:t>
            </a:r>
          </a:p>`;
    });

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="500000"/><a:ext cx="7000000" cy="1000000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr sz="3200" b="1"/>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="1600000"/><a:ext cx="7000000" cy="2500000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          ${bodyItemsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
  });

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 5. ODT Generator
 */
export async function generateOdt({
  heading = 'OpenDocument Heading',
  paragraphs = ['This is body text in an OpenDocument Text document.'],
} = {}) {
  const zip = new JSZip();

  zip.file('mimetype', 'application/vnd.oasis.opendocument.text');

  zip.file(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`,
  );

  let paragraphsXml = '';
  if (heading) {
    paragraphsXml += `<text:h text:outline-level="1">${escapeXml(heading)}</text:h>`;
  }
  for (const p of paragraphs) {
    paragraphsXml += `<text:p>${escapeXml(p)}</text:p>`;
  }

  zip.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">
  <office:body>
    <office:text>
      ${paragraphsXml}
    </office:text>
  </office:body>
</office:document-content>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 6. RTF Generator
 */
export function generateRtf({
  title = 'Rich Text Document',
  paragraphs = ['This is body text in RTF.'],
  boldText = '',
  italicText = '',
} = {}) {
  let content = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 ';

  if (title) {
    content += `{\\fs32\\b ${escapeRtf(title)}}\\par\\par `;
  }

  for (const p of paragraphs) {
    content += `${escapeRtf(p)}\\par `;
  }

  if (boldText) {
    content += `{\\b ${escapeRtf(boldText)}}\\par `;
  }

  if (italicText) {
    content += `{\\i ${escapeRtf(italicText)}}\\par `;
  }

  content += '}';
  return Buffer.from(content, 'utf8');
}

/**
 * 7. HTML Generator
 */
export function generateHtml({
  title = 'HTML Document',
  heading = 'HTML Header',
  paragraphs = ['This is a standard HTML paragraph.'],
  listItems = ['List Item 1', 'List Item 2'],
  table = { headers: ['Header 1', 'Header 2'], rows: [['Cell A', 'Cell B']] },
} = {}) {
  let listHtml = '';
  if (listItems && listItems.length > 0) {
    listHtml = `<ul>${listItems.map((item) => `<li>${escapeXml(item)}</li>`).join('')}</ul>`;
  }

  let tableHtml = '';
  if (table && table.headers) {
    tableHtml = `<table>
      <thead>
        <tr>${table.headers.map((h) => `<th>${escapeXml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${table.rows.map((row) => `<tr>${row.map((c) => `<td>${escapeXml(String(c))}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)}</title>
</head>
<body>
  <h1>${escapeXml(heading)}</h1>
  ${paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join('')}
  ${listHtml}
  ${tableHtml}
</body>
</html>`;

  return Buffer.from(html, 'utf8');
}

/**
 * 8. TXT Generator
 */
export function generateTxt({
  heading = 'Plain Text Heading',
  paragraphs = ['This is plain text content line 1.', 'This is line 2 of text.'],
} = {}) {
  const parts = [];
  if (heading) {
    parts.push(heading);
  }
  parts.push(...paragraphs);
  return Buffer.from(parts.join('\n\n'), 'utf8');
}

/**
 * Helpers & Escaping
 */
function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function escapePdfText(str) {
  return String(str).replace(/[\\()]/g, '\\$&');
}

function escapeRtf(str) {
  return String(str)
    .replace(/[\\{}]/g, '\\$&')
    .replace(/[^\x00-\x7F]/g, (char) => `\\u${char.charCodeAt(0)}?`);
}

/**
 * Corner case / boundary generators
 */
export function generateZeroByte() {
  return Buffer.alloc(0);
}

export function generateCorruptZip() {
  return Buffer.from('PK\x03\x04\x00\x00corrupted_payload_header_non_compliant_bytes_12345');
}

export function generateCorruptPdf() {
  return Buffer.from('%PDF-1.4\ncorrupt object without catalog or xref\n%%EOF');
}

export function generateCorruptRtf() {
  return Buffer.from('{\\rtf1\\ansi\\deff0 {unclosed bracket and broken syntax');
}
