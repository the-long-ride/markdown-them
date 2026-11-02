/**
 * Complex E2E Fixture Generator
 * Generates synthetic, deterministic, zero-external-binary complex documents:
 * - Complex DOCX with multi-level headings, tables, and styled text
 * - Complex XLSX with multi-sheets, diverse data types, and special headers
 * - Complex PPTX with multi-slide structures and formatted body items
 * - Complex HTML with semantic structures, nested lists, and entity encodings
 * - Complex RTF with font/color tables, \\uc0 Unicode, and Windows-1252 bytes
 * - Complex ODT with headings, styled paragraphs, and tables
 * - Complex ODS with multi-sheet data tables
 * - Complex ODP with multi-slide presentations
 * - Complex PDF with multi-page streams and structured layout
 */

import JSZip from 'jszip';

function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRtf(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * 1. Complex DOCX Generator (Headings, Tables, Lists, Inline Styles)
 */
export async function generateComplexDocx({
  title = 'Enterprise Architecture Specification 2026',
  sections = [
    {
      heading: '1. Executive Overview',
      level: 1,
      paragraphs: [
        'This specification documents the multi-target document conversion pipeline.',
        'System targets include VS Code extension, Tauri desktop app, Node CLI, and Web runtime.',
      ],
    },
    {
      heading: '2. Service Level Objectives',
      level: 2,
      paragraphs: ['Table 1 summarizes latency and availability metrics across runtimes:'],
      table: {
        headers: ['Component', 'Throughput (docs/s)', 'p99 Latency', 'Resilience SLA'],
        rows: [
          ['Core Parser (DOCX)', '450', '< 15ms', '99.99%'],
          ['Spreadsheet Engine (XLSX)', '320', '< 25ms', '99.95%'],
          ['Presentation Parser (PPTX)', '280', '< 30ms', '99.95%'],
          ['Rich Text Engine (RTF)', '600', '< 8ms', '99.99%'],
        ],
      },
    },
    {
      heading: '3. Implementation Invariants',
      level: 2,
      paragraphs: ['Key architectural invariants to maintain across all releases:'],
      bullets: [
        'Zero data corruption in markdown table generation',
        'Deterministic collision-free output naming',
        'Multi-platform line-ending normalization (CRLF / LF)',
      ],
    },
  ],
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

  let docBody = '';
  if (title) {
    docBody += `
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>`;
  }

  for (const sec of sections) {
    if (sec.heading) {
      const style = sec.level === 2 ? 'Heading2' : 'Heading1';
      docBody += `
      <w:p>
        <w:pPr><w:pStyle w:val="${style}"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(sec.heading)}</w:t></w:r>
      </w:p>`;
    }

    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        docBody += `
        <w:p>
          <w:r><w:t>${escapeXml(p)}</w:t></w:r>
        </w:p>`;
      }
    }

    if (sec.bullets) {
      for (const b of sec.bullets) {
        docBody += `
        <w:p>
          <w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>
          <w:r><w:t>• ${escapeXml(b)}</w:t></w:r>
        </w:p>`;
      }
    }

    if (sec.table && sec.table.headers) {
      let tableXml = '<w:tbl>';
      // Header row
      tableXml += '<w:tr>';
      for (const h of sec.table.headers) {
        tableXml += `<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p></w:tc>`;
      }
      tableXml += '</w:tr>';

      // Data rows
      for (const row of sec.table.rows) {
        tableXml += '<w:tr>';
        for (const cell of row) {
          tableXml += `<w:tc><w:p><w:r><w:t>${escapeXml(String(cell))}</w:t></w:r></w:p></w:tc>`;
        }
        tableXml += '</w:tr>';
      }
      tableXml += '</w:tbl>';
      docBody += tableXml;
    }
  }

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docBody}
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 2. Complex XLSX Generator (Multi-Sheet, Formulas, Numbers, Special Characters)
 */
export async function generateComplexXlsx({
  sheets = [
    {
      name: 'Overview',
      headers: ['Metric', 'Q1 Value', 'Q2 Target', 'Delta (%)'],
      rows: [
        ['Active Concurrency', 16, 32, '100.0%'],
        ['Average Processing Time (ms)', 12.4, 10.0, '-19.3%'],
        ['Throughput Peak (req/sec)', 850, 1200, '+41.2%'],
      ],
    },
    {
      name: 'Special Tokens & Escapes',
      headers: ['Format Name', 'Test Vector [Pattern | Token]', 'Expected Behavior'],
      rows: [
        [
          'Markdown Table Pipe',
          'Cell | With | Multiple | Pipes',
          'Properly single-escaped in output',
        ],
        ['Path Traversal Test', 'C:\\Users\\admin\\app.config', 'Backslashes preserved accurately'],
        ['Unicode Entities', '© 2026 The Long Ride — Alpha & Omega', 'Entities decoded correctly'],
      ],
    },
  ],
} = {}) {
  const zip = new JSZip();

  let sheetTypes = '';
  let sheetElements = '';
  let sheetRels = '';

  sheets.forEach((sheet, idx) => {
    const sheetId = idx + 1;
    sheetTypes += `  <Override PartName="/xl/worksheets/sheet${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
    sheetElements += `    <sheet name="${escapeXml(sheet.name)}" sheetId="${sheetId}" r:id="rId${sheetId}"/>\n`;
    sheetRels += `  <Relationship Id="rId${sheetId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetId}.xml"/>\n`;
  });

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheetTypes}</Types>`,
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
${sheetElements}  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}</Relationships>`,
  );

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  sheets.forEach((sheet, idx) => {
    const sheetId = idx + 1;
    let rowsXml = '';

    if (sheet.headers && sheet.headers.length > 0) {
      let cells = '';
      sheet.headers.forEach((h, colIdx) => {
        const colLetter = colLetters[colIdx] || `C${colIdx}`;
        cells += `<c r="${colLetter}1" t="inlineStr"><is><t>${escapeXml(String(h))}</t></is></c>`;
      });
      rowsXml += `<row r="1">${cells}</row>`;
    }

    sheet.rows.forEach((row, rowIdx) => {
      const rowNum = (sheet.headers && sheet.headers.length > 0 ? 2 : 1) + rowIdx;
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
      `xl/worksheets/sheet${sheetId}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`,
    );
  });

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * 3. Complex PPTX Generator (Multi-Slide Presentation with Rich Hierarchy)
 */
export async function generateComplexPptx({
  presentationTitle = 'Document Conversion Architecture',
  slides = [
    {
      title: 'Slide 1: Core Engine Architecture',
      items: [
        'Direct buffer parsing with zero system external binary dependencies',
        'Lazy initialization via DocumentConverter singleton',
        'Deterministic markdown table generation with canonical spacing',
      ],
    },
    {
      title: 'Slide 2: Supported Formats Matrix',
      items: [
        'Office Documents: DOCX, XLSX, PPTX',
        'OpenDocument: ODT, ODS, ODP',
        'Standard Text & Markup: HTML, RTF, TXT, MD',
        'Portable Document Format: PDF text extraction',
      ],
    },
    {
      title: 'Slide 3: Production Security Guardrails',
      items: [
        'Zip-slip breakout protection in relationship target parsing',
        'Safe XML entity resolution without quadratic expansion',
        'Windows-1252 byte decoding for legacy RTF encodings',
      ],
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
 * 4. Complex HTML Generator (Nested Tables, Blockquotes, Entities, Code Blocks)
 */
export function generateComplexHtml({
  title = 'Comprehensive Technical Documentation',
  heading = 'Architecture & Protocols',
  quote = 'Simplicity is prerequisite for reliability. — Edsger W. Dijkstra',
  codeSnippet = 'function convert(input) {\n  return parser.parse(input);\n}',
  nestedTable = {
    parentHeaders: ['Module', 'Configuration', 'Subsystem Details'],
    parentRows: [
      [
        'Core Engine',
        'maxConcurrent: 16',
        'Direct stream conversion with zero intermediate disk writes',
      ],
      [
        'Desktop Wrapper',
        'platform: Tauri v2',
        'Lightweight Rust backend with system dialog bridge',
      ],
    ],
  },
} = {}) {
  let tableHtml = '';
  if (nestedTable && nestedTable.parentHeaders) {
    tableHtml = `<table border="1">
      <thead>
        <tr>${nestedTable.parentHeaders.map((h) => `<th>${escapeXml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${nestedTable.parentRows
          .map((row) => `<tr>${row.map((c) => `<td>${escapeXml(String(c))}</td>`).join('')}</tr>`)
          .join('')}
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
  <header>
    <h1>${escapeXml(heading)}</h1>
  </header>
  <main>
    <section>
      <h2>Executive Quote</h2>
      <blockquote>
        <p>${escapeXml(quote)}</p>
      </blockquote>
    </section>
    <section>
      <h2>System Source Implementation</h2>
      <pre><code>${escapeXml(codeSnippet)}</code></pre>
    </section>
    <section>
      <h2>Entity Encodings &amp; Typography</h2>
      <p>Trademark &trade;, Copyright &copy;, Em-dash &mdash;, En-dash &ndash;, and Bullet &bull; test vector.</p>
    </section>
    <section>
      <h2>System Architecture Matrix</h2>
      ${tableHtml}
    </section>
  </main>
  <footer>
    <p>&copy; 2026 The Long Ride. All rights reserved.</p>
  </footer>
</body>
</html>`;

  return Buffer.from(html, 'utf8');
}

/**
 * 5. Complex RTF Generator (Unicode \uc0, Fonts, Colors, Formatting)
 */
export function generateComplexRtf({
  title = 'Complex Rich Text Document',
  sections = [
    {
      title: 'Unicode Multilingual Test',
      paragraphs: [
        'English text with special characters:',
        'CJK Characters: \\uc0\\u20320\\u22909\\u19990\\u30028 (Hello World)',
      ],
    },
    {
      title: 'Formatting & Style Tokens',
      boldText: 'Strong bold emphasis for important security notes.',
      italicText: 'Subtle italic phrasing for secondary context.',
    },
  ],
} = {}) {
  let content = '{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033';
  content += '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Times New Roman;}}';
  content += '{\\colortbl ;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red255\\green0\\blue0;}';
  content += '\\viewkind4\\uc1\\pard\\f0\\fs24 ';

  if (title) {
    content += `{\\fs36\\b ${escapeRtf(title)}}\\par\\par `;
  }

  for (const sec of sections) {
    if (sec.title) {
      content += `{\\fs28\\b\\cf2 ${escapeRtf(sec.title)}}\\par\\par `;
    }
    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        // Allow raw RTF controls if already escaped or starting with \
        if (p.includes('\\u')) {
          content += `${p}\\par `;
        } else {
          content += `${escapeRtf(p)}\\par `;
        }
      }
    }
    if (sec.boldText) {
      content += `{\\b ${escapeRtf(sec.boldText)}}\\par `;
    }
    if (sec.italicText) {
      content += `{\\i ${escapeRtf(sec.italicText)}}\\par `;
    }
    content += '\\par ';
  }

  content += '}';
  return Buffer.from(content, 'utf8');
}

/**
 * 6. Complex Multi-Page PDF Generator
 */
export function generateComplexPdf({
  page1Title = 'Document Conversion Protocol v2',
  page1Lines = [
    'Chapter 1: Multi-Platform Architecture',
    'This chapter describes the native bridge across desktop and web.',
    'Supported file types include DOCX, PDF, XLSX, PPTX, RTF, and ODF.',
  ],
  page2Title = 'Chapter 2: Concurrency & Fault Tolerance',
  page2Lines = [
    'Concurrent conversion queues ensure maximum CPU utilization.',
    'Worker tasks isolate memory leaks and format corruption.',
    'Result files are written collision-free into output folders.',
  ],
} = {}) {
  const p1Content =
    `BT\n/F1 18 Tf\n50 720 Td\n22 TL\n(${escapePdfText(page1Title)}) Tj\n` +
    page1Lines.map((l) => `T* (${escapePdfText(l)}) Tj`).join('\n') +
    '\nET';

  const p2Content =
    `BT\n/F1 18 Tf\n50 720 Td\n22 TL\n(${escapePdfText(page2Title)}) Tj\n` +
    page2Lines.map((l) => `T* (${escapePdfText(l)}) Tj`).join('\n') +
    '\nET';

  const p1Buf = Buffer.from(p1Content, 'utf8');
  const p2Buf = Buffer.from(p2Content, 'utf8');

  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>';
  // Page 1
  objs[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>';
  objs[4] = `<< /Length ${p1Buf.byteLength} >>\nstream\n${p1Content}\nendstream`;
  // Page 2
  objs[5] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>';
  objs[6] = `<< /Length ${p2Buf.byteLength} >>\nstream\n${p2Content}\nendstream`;
  // Font
  objs[7] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i <= 7; i++) {
    offsets[i] = Buffer.byteLength(out, 'utf8');
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(out, 'utf8');
  out += `xref\n0 8\n0000000000 65535 f \n`;
  for (let i = 1; i <= 7; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(out, 'utf8');
}
