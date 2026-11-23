import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { assert, assertEqual, assertMatches, assertRejects } from '../framework/assertions.mjs';
import { generateMarkdown } from '../framework/conversion-adapter.mjs';
import {
  generateComplexDocx,
  generateComplexPdf,
  generateComplexXlsx,
} from '../fixtures/complex-fixtures.mjs';
import {
  generateCorruptPdf,
  generateCorruptRtf,
  generateCorruptZip,
  generateDocx,
  generatePdf,
  generatePptx,
  generateRtf,
  generateXlsx,
} from '../fixtures/fixture-generator.mjs';

const multilingual = '日本語 · العربية · 📚';

async function odf(kind, body) {
  const zip = new JSZip();
  zip.file('mimetype', `application/vnd.oasis.opendocument.${kind}`);
  zip.file(
    'content.xml',
    `<office:document-content
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
    xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
    office:version="1.2"><office:body><office:${kind}>${body}</office:${kind}></office:body>
    </office:document-content>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

function odfRow(cells, repeats = 1) {
  return `<table:table-row table:number-rows-repeated="${repeats}">${cells.map((cell) => `<table:table-cell>${cell}</table:table-cell>`).join('')}</table:table-row>`;
}

function odfFrame(content, y) {
  return `<draw:frame svg:x="2cm" svg:y="${y}cm" svg:width="20cm" svg:height="2cm"><draw:text-box>${content}</draw:text-box></draw:frame>`;
}

function success(name, makeInput, expected) {
  return {
    name,
    async run(convert) {
      const markdown = await convert(await makeInput());
      if (typeof expected === 'string') {
        assertEqual(markdown, expected);
        return;
      }

      let position = 0;
      for (const fragment of expected) {
        const found = markdown.indexOf(fragment, position);
        assert(
          found >= 0,
          `Expected ${JSON.stringify(fragment)} after offset ${position} in ${JSON.stringify(markdown.slice(0, 350))}`,
        );
        position = found + fragment.length;
      }
    },
  };
}

function boundary(name, makeMalformed, expectedError) {
  return {
    name,
    async run(convert) {
      const empty = await assertRejects(() => convert(Buffer.alloc(0)));
      assertMatches(empty.message, /zero bytes/);
      const error = await assertRejects(() => convert(makeMalformed()));
      assertMatches(error.message, expectedError);
    },
  };
}

function zipBoundary() {
  return boundary(
    'rejects an empty file and a truncated package',
    generateCorruptZip,
    /invalid|corrupt|zip|format|unsupported|supports .* only/i,
  );
}

const formats = [
  {
    extensions: ['txt', 'text', 'md', 'markdown', 'mdx'],
    cases: [
      success('preserves a plain line', () => '  Plain text\r\n', 'Plain text'),
      success(
        'preserves a heading, ordered list, and hard break',
        () => '# Tasks\r\n\r\n1. Setup  \r\n   Continue\r\n2. Done',
        '# Tasks\n\n1. Setup  \n   Continue\n2. Done',
      ),
      success(
        'preserves a multilingual table with inline HTML',
        () => `| Status | Note |\r\n| --- | --- |\r\n| <b>Ready</b> | ${multilingual} |`,
        `| Status | Note |\n| --- | --- |\n| <b>Ready</b> | ${multilingual} |`,
      ),
      {
        name: 'accepts empty documents and preserves an unclosed quoted fence',
        async run(convert) {
          assertEqual(await convert(''), '');
          assertEqual(await convert('\uFEFF\r\n\t '), '');
          const input = '> ```\r\n>\tcode   \r\n>\r\n>\r\n>\r\nProse\t';
          assertEqual(await convert(input), '> ```\n>\tcode   \n>\n>\n>\nProse');
        },
      },
    ],
  },
  {
    extensions: ['html', 'htm'],
    cases: [
      success('extracts a paragraph', () => '<p>Notice &amp; consent</p>', 'Notice & consent'),
      success(
        'converts a heading, link, and ordered list',
        () =>
          '<h2>Guide</h2><ol><li><a href="https://example.com/">Open</a></li><li>Finish</li></ol>',
        '## Guide\n\n1.  [Open](https://example.com/)\n2.  Finish',
      ),
      success(
        'converts nested lists beside a multilingual table',
        () =>
          `<ul><li>Parent<ul><li><b>Child</b></li></ul></li></ul><table><tr><th>Text</th></tr><tr><td><span dir="rtl">${multilingual}</span></td></tr></table>`,
        ['*   Parent\n    *   **Child**', '| Text |\n| --- |', `| ${multilingual} |`],
      ),
      {
        name: 'recovers an unclosed fragment and accepts empty HTML',
        async run(convert) {
          assertEqual(await convert(''), '');
          assertEqual(await convert(' \r\n\t'), '');
          assertEqual(
            await convert('<main><p>Draft <strong>still readable'),
            'Draft **still readable**',
          );
        },
      },
    ],
  },
  {
    extensions: ['docx', 'doc'],
    cases: [
      success(
        'converts a one-paragraph Word package',
        () => generateDocx({ title: '', paragraphs: ['A short memo.'] }),
        'A short memo.',
      ),
      success(
        'preserves heading and emphasis',
        () => generateDocx({ title: 'Memo', paragraphs: ['Read this'], boldText: 'Important' }),
        '# Memo\n\nRead this\n\n**Important**',
      ),
      success(
        'converts a multilingual Word table and list in order',
        () =>
          generateComplexDocx({
            title: 'Inventory',
            sections: [
              {
                heading: 'Stock',
                level: 2,
                table: { headers: ['Label', 'Status'], rows: [[multilingual, 'A | B']] },
                bullets: ['Check stock'],
              },
            ],
          }),
        [
          '**Inventory**',
          '## **Stock**',
          '• Check stock',
          '| **Label** | **Status** |',
          `| ${multilingual} | A \\| B |`,
        ],
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['xlsx', 'xls', 'xlm'],
    cases: [
      success(
        'converts a worksheet with one cell',
        () => generateXlsx({ sheetName: 'Only', headers: ['Value'], rows: [] }),
        '## Only\n\n| Value |\n| --- |',
      ),
      success(
        'preserves zero, negatives, and decimals in a table',
        () =>
          generateXlsx({
            sheetName: 'Prices',
            headers: ['Item', 'Value'],
            rows: [
              ['Free', 0],
              ['Credit', -1.25],
            ],
          }),
        '## Prices\n\n| Item | Value |\n| --- | --- |\n| Free | 0 |\n| Credit | -1.25 |',
      ),
      success(
        'keeps sheet order and escapes multiline multilingual cells',
        () =>
          generateComplexXlsx({
            sheets: [
              { name: 'Names', headers: ['Text'], rows: [[`${multilingual} | west\r\neast`]] },
              { name: 'Totals', headers: ['Count'], rows: [[2]] },
            ],
          }),
        ['## Names', `| ${multilingual} \\| west<br>east |`, '## Totals', '| 2 |'],
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['pptx'],
    cases: [
      success(
        'converts a title-only slide',
        () => generatePptx({ slides: [{ title: 'Briefing', items: [] }] }),
        '## **Briefing**',
      ),
      success(
        'keeps a slide title before its bullets',
        () =>
          generatePptx({
            slides: [{ title: 'Agenda', items: ['Plan', 'Decide'], bulleted: true }],
          }),
        ['## **Agenda**', '- Plan', '- Decide'],
      ),
      success(
        'preserves multilingual content across slide boundaries',
        () =>
          generatePptx({
            slides: [
              { title: 'Start', items: [multilingual] },
              { title: 'Finish', items: ['Done & checked'] },
            ],
          }),
        ['## **Start**', multilingual, '---', '## **Finish**', 'Done & checked'],
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['odt'],
    cases: [
      success(
        'extracts a plain paragraph',
        () => odf('text', '<text:p>A short note.</text:p>'),
        'A short note.',
      ),
      success(
        'converts a heading, paragraph, and list',
        () =>
          odf(
            'text',
            '<text:h text:outline-level="2">Tour</text:h><text:p>Follow the steps.</text:p><text:list><text:list-item><text:p>Start</text:p></text:list-item><text:list-item><text:p>Stop</text:p></text:list-item></text:list>',
          ),
        '## Tour\n\nFollow the steps.\n\n- Start\n- Stop',
      ),
      success(
        'converts nested list content and a multilingual table',
        () =>
          odf(
            'text',
            `<text:list><text:list-item><text:p>Parent</text:p><text:list><text:list-item><text:p>Child</text:p></text:list-item></text:list></text:list-item></text:list><table:table>${odfRow(['<text:p>Label</text:p>'])}${odfRow([`<text:p>${multilingual} | &amp;</text:p>`])}</table:table>`,
          ),
        ['- Parent', '- Child', '| Label |', `| ${multilingual} \\| & |`],
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['ods'],
    cases: [
      success(
        'converts a single populated cell',
        () =>
          odf(
            'spreadsheet',
            `<table:table table:name="Only">${odfRow(['<text:p>Value</text:p>'])}</table:table>`,
          ),
        '## Only\n\n| Value |\n| --- |',
      ),
      success(
        'expands repeat rows into individual table rows',
        () =>
          odf(
            'spreadsheet',
            `<table:table table:name="Stock">${odfRow(['<text:p>Label</text:p>', '<text:p>Qty</text:p>'])}${odfRow(['<text:p>Pen</text:p>', '<text:p>2</text:p>'], 2)}</table:table>`,
          ),
        '## Stock\n\n| Label | Qty |\n| --- | --- |\n| Pen | 2 |\n| Pen | 2 |',
      ),
      success(
        'pads ragged rows and keeps multiline multilingual cells',
        () =>
          odf(
            'spreadsheet',
            `<table:table table:name="Stock">${odfRow(['<text:p>Label</text:p>', '<text:p>Qty</text:p>'])}${odfRow([`<text:p>${multilingual} | &amp;</text:p><text:p>next</text:p>`])}</table:table>`,
          ),
        `## Stock\n\n| Label | Qty |\n| --- | --- |\n| ${multilingual} \\| &<br>next |  |`,
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['odp'],
    cases: [
      success(
        'extracts one frame from one page',
        () =>
          odf(
            'presentation',
            `<draw:page>${odfFrame('<text:p>Slide text</text:p>', 4)}</draw:page>`,
          ),
        '## Slide text',
      ),
      success(
        'orders frames by position rather than XML order',
        () =>
          odf(
            'presentation',
            `<draw:page>${odfFrame('<text:p>Lower frame</text:p>', 10)}${odfFrame('<text:p>Upper frame</text:p>', 4)}</draw:page>`,
          ),
        ['Upper frame', 'Lower frame'],
      ),
      success(
        'keeps multilingual text in grouped frames and separates pages',
        () =>
          odf(
            'presentation',
            `<draw:page><draw:g>${odfFrame(`<text:p>${multilingual}</text:p>`, 4)}</draw:g></draw:page><draw:page>${odfFrame('<text:p>Final page</text:p>', 4)}</draw:page>`,
          ),
        [multilingual, '---', 'Final page'],
      ),
      zipBoundary(),
    ],
  },
  {
    extensions: ['pdf'],
    cases: [
      success('extracts one plain text line', () => generatePdf({ text: 'A short PDF note' }), [
        'A short PDF note',
      ]),
      success(
        'extracts ordered lines and PDF literal escapes',
        () => generatePdf({ text: 'Invoice (draft)', lines: ['Location: A\\B', 'Total: 42'] }),
        ['Invoice (draft)', 'Location: A\\B', 'Total: 42'],
      ),
      success(
        'retains page order and repeated text at a page boundary',
        () =>
          generateComplexPdf({
            page1Title: 'Opening',
            page1Lines: ['Repeated footer'],
            page2Title: 'Second page',
            page2Lines: ['Repeated footer', 'Closing (total: 42)'],
          }),
        ['Opening', 'Repeated footer', 'Second page', 'Repeated footer', 'Closing (total: 42)'],
      ),
      boundary(
        'rejects zero bytes and a broken PDF catalog',
        generateCorruptPdf,
        /invalid|pdf|document|format/i,
      ),
    ],
  },
  {
    extensions: ['rtf'],
    cases: [
      success(
        'extracts a plain paragraph',
        () => generateRtf({ title: '', paragraphs: ['Quick note'] }),
        'Quick note',
      ),
      success(
        'converts grouped emphasis without leaking formatting',
        () => '{\\rtf1\\ansi plain {\\b bold} plain\\par {\\i italic} end}',
        'plain **bold** plain\n\n*italic* end',
      ),
      success(
        'decodes CJK, RTL, and surrogate-pair Unicode escapes',
        () => generateRtf({ title: '', paragraphs: [multilingual], boldText: 'Done' }),
        `${multilingual}\n\n**Done**`,
      ),
      boundary(
        'rejects zero bytes and an unclosed RTF group',
        generateCorruptRtf,
        /unclosed|corrupt/i,
      ),
    ],
  },
];

export function registerGradedFormatTests(harness) {
  harness.suite('Tier 8: Graded File Formats', () => {
    let dir;
    harness.beforeAll(async () => {
      dir = await mkdtemp(path.join(tmpdir(), 'markdown-them-formats-'));
    });
    harness.afterAll(async () => rm(dir, { recursive: true, force: true }));

    for (const [level, difficulty] of ['Easy', 'Intermediate', 'Hard', 'Hardest'].entries()) {
      harness.suite(difficulty, () => {
        for (const { extensions, cases } of formats) {
          const { name, run } = cases[level];
          for (const extension of extensions) {
            harness.test(`${extension.toUpperCase()}: ${name}`, async () => {
              const file = path.join(dir, `${difficulty}.${extension}`);
              await run(async (input) => {
                await writeFile(file, input);
                return generateMarkdown(file);
              });
            });
          }
        }
      });
    }
  });
}
