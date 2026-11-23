import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import core from '../../out/core/index.js';
import odfXml from '../../out/core/odf/xml.js';
import pptxText from '../../out/core/pptx/text.js';
import rtfParser from '../../out/core/rtf/parser.js';
import rtfFormatter from '../../out/core/rtf/formatter.js';
import rtfTypes from '../../out/core/rtf/types.js';

test('OpenDocument preserves section flow, entity decoding, explicit spaces, and list continuations', async () => {
  const zip = new JSZip();
  zip.file(
    'content.xml',
    `<office:document>
    <office:styles>
      <style:style />
      <style:style style:name="Emphasis">
        <style:text-properties fo:font-weight="900" style:font-style-asian="italic" style:text-line-through-style="solid"/>
      </style:style>
    </office:styles>
    <office:body>
      <text:section>
        <text:h text:outline-level="unknown">Overview &quot;A&quot; &apos;B&apos; &lt;x&gt; &amp; y</text:h>
        <text:h text:outline-level="1" />
        <text:p>one<text:s text:c="3"/>two<text:tab/>three<text:line-break/>four</text:p>
        <text:p><text:span text:style-name="Emphasis">Styled</text:span><text:a> link</text:a></text:p>
        <text:p>Inline frame:<draw:frame><draw:text-box><text:p>Embedded note</text:p></draw:text-box></draw:frame></text:p>
        <text:p><draw:frame /></text:p>
        <text:list>
          <text:list-level-style-number />
          <text:list-header><text:p>Steps</text:p></text:list-header>
          <text:list-item />
          <text:list-item><text:p>First step</text:p><text:p>More detail</text:p></text:list-item>
          <text:list-item><text:p>Second step</text:p></text:list-item>
        </text:list>
      </text:section>
    </office:body>
  </office:document>`,
  );
  const output = await core.convertOdfData(await zip.generateAsync({ type: 'uint8array' }));
  for (const fragment of [
    '## Overview "A" \'B\' <x> & y',
    'one   two\tthree\nfour',
    'Styled',
    'link',
    'Embedded note',
    'Steps\n1. First step\n  More detail\n2. Second step',
  ]) {
    assert.ok(output.includes(fragment), `Expected ${fragment}:\n${output}`);
  }
  assert.equal(odfXml.readRepeat({ ':@': { c: '-3' } }, 'c'), 1);
  assert.equal(odfXml.readRepeat({ ':@': { c: '3.9' } }, 'c'), 3);
  assert.deepEqual(odfXml.childrenOf(undefined), []);
  assert.equal(odfXml.findFirst({ section: [] }, 'section').section.length, 0);
  assert.throws(
    () => odfXml.parseOdfXml('<!DOCTYPE document><document/>', 'content.xml'),
    /Unsupported XML doctype/,
  );
});

test('RTF handles Windows-1252 bytes, optional typography controls, and malformed input', () => {
  const bytes = new TextEncoder().encode(
    String.raw`{\rtf1 Line\emdash one\par \b Bold\b0 \plain  Plain}`,
  );
  const markdown = core.convertRtfToMarkdown(bytes.buffer);
  assert.match(markdown, /Line-one/);
  assert.match(markdown, /\*\*Bold\*\* Plain/);
  assert.throws(() => core.convertRtfToMarkdown('plain text'), /signature/);
  assert.throws(
    () => core.convertRtfToMarkdown(String.raw`{\rtf1\bin3 abc}`),
    /Binary RTF payloads/,
  );
  assert.throws(
    () => core.convertRtfToMarkdown(String.raw`{\rtf1 never closed`),
    /unclosed bracket/,
  );
  assert.equal(rtfParser.decodeRtfBytes(Uint8Array.of(0x80).buffer), '€');
  assert.equal(rtfParser.symbolForControl(':') + rtfParser.symbolForControl('|'), '');
  assert.equal(rtfParser.symbolForControl(undefined), '');
  assert.equal(rtfParser.symbolForControl('?'), '?');
  const state = { ...rtfTypes.INITIAL_STATE };
  const text = [];
  const control = (name, param) =>
    rtfParser.applyControlWord(
      name,
      param,
      state,
      (value) => text.push(value),
      () => {},
    );
  control('fs', undefined);
  assert.equal(state.fontSize, 0);
  control('uc', undefined);
  assert.equal(state.unicodeFallbackChars, 1);
  assert.equal(control('u', undefined), 0);
  assert.equal(control('u', 100000), 1);
  assert.deepEqual(text, []);
  assert.equal(control('u', -1), 1);
  assert.deepEqual(text, ['\uFFFF']);
  assert.equal(rtfFormatter.formatParagraph([]), '');
});

test('PowerPoint text preserves field order, numbering, and placeholder heading intent', () => {
  const body = pptxText.readTextBody({
    p: [
      { pPr: { buAutoNum: { type: 'arabicPeriod' }, '@_lvl': '1' }, r: { t: 'First' } },
      { pPr: { buAutoNum: { type: 'arabicPeriod' }, '@_lvl': '1' }, r: { t: 'Second' } },
      {
        pPr: { arbitrary: true },
        paragraphChildren: [
          ['r', { t: 'Report', rPr: { '@_b': '1' } }],
          ['br', {}],
          ['fld', { t: 'Page 2', rPr: { '@_i': '1' } }],
        ],
      },
      null,
    ],
  });
  assert.equal(
    pptxText.formatTextBody([{ markdown: '', level: 0 }, ...body.paragraphs]),
    '  1. First\n  2. Second\n**Report** *Page 2*',
  );
  assert.equal(pptxText.readBulletKind({ buNone: true, buAutoNum: true }), undefined);
  const subtitle = { nvSpPr: { nvPr: { ph: { '@_type': 'subTitle' } } } };
  const centerTitle = { nvSpPr: { nvPr: { ph: { '@_type': 'ctrTitle' } } } };
  assert.equal(pptxText.inferHeadingLevel(subtitle, body), 2);
  assert.equal(pptxText.inferHeadingLevel(centerTitle, body), 1);
  assert.equal(
    pptxText.inferHeadingLevel({}, pptxText.readTextBody({ p: { r: { t: '1234' } } })),
    undefined,
  );
});
