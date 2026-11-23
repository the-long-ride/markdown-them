import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import core from '../../out/core/index.js';
import xlsxLinks from '../../out/core/xlsx/hyperlinks.js';
import tables from '../../out/core/markdown/tables.js';

const asBytes = (zip) => zip.generateAsync({ type: 'uint8array' });

test('XLSX preserves rich strings, inferred positions, blank gaps, booleans and anchor-only rows', async () => {
  const zip = new JSZip();
  await assert.rejects(core.convertXlsxData(await asBytes(zip)), /missing workbook\.xml/);
  zip.file(
    'xl/workbook.xml',
    `<w:workbook xmlns:w="urn:test">
    <w:sheets>
      <w:sheet name="No relationship"/>
      <w:sheet name="Missing worksheet" id="missing"/>
      <w:sheet name="Empty worksheet" r:Id="empty"/>
      <w:sheet Id="data"/>
      <w:sheet name="Second sheet" r:id="second"/>
    </w:sheets>
  </w:workbook>`,
  );
  assert.equal(await core.convertXlsxData(await asBytes(zip)), '');
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships>
    <Relationship Id="missing" Target="worksheets/absent.xml"/>
    <Relationship id="empty" target="/xl/worksheets/empty.xml"/>
    <Relationship r:id="data" Target="./worksheets/../worksheets/data.xml"/>
    <Relationship Id="second" Target="worksheets/second.xml"/>
    <Relationship Id="incomplete" />
  </Relationships>`,
  );
  zip.file(
    'xl/sharedStrings.xml',
    `<sst>
    <si><r><t>North </t></r><r><t>West</t></r></si>
    <si><t xml:space="preserve">Inventory &amp; Sales</t></si>
    <si><unknown/></si>
  </sst>`,
  );
  zip.file(
    'xl/worksheets/empty.xml',
    '<worksheet><sheetData><row><c t="s"><v>99</v></c></row></sheetData></worksheet>',
  );
  zip.file(
    'xl/worksheets/data.xml',
    `<worksheet>
    <sheetData>
      <row R="1"><c R="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row><c r="A2" t="b"><v>1</v></c><c r="C2" t="b"><v>0</v></c></row>
      <row><c T="inlineStr"><is><r><t>Quarter </t></r><r><t>Four</t></r></is></c><c t="s"><v>-1</v></c><c t="s"><v/></c></row>
    </sheetData>
    <hyperlinks><hyperlink ref="B4" location="Sheet!A1" display="Details"/></hyperlinks>
  </worksheet>`,
  );
  zip.file(
    'xl/worksheets/second.xml',
    '<worksheet><sheetData><row><c><v>25</v></c></row></sheetData></worksheet>',
  );
  const markdown = await core.convertXlsxData(await asBytes(zip));
  for (const fragment of [
    '## Sheet',
    '| North West |  | Inventory & Sales |',
    '| TRUE |  | FALSE |',
    '| Quarter Four |  |  |',
    'Details (target: Sheet!A1)',
    '## Second sheet',
    '| 25 |',
  ]) {
    assert.ok(markdown.includes(fragment), fragment);
  }
  assert.doesNotMatch(markdown, /No relationship|Missing worksheet|Empty worksheet/);
});

test('workbooks reject references outside their own workbook directory', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook/>');
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<Relationships><Relationship Id="1" Target="/other.xml"/></Relationships>',
  );
  await assert.rejects(core.convertXlsxData(await asBytes(zip)), /outside xl\//);
});

test('table output normalizes nulls, column widths, and line breaks', () => {
  const markdown = [];
  core.appendMarkdownTable(markdown, [[null, '  '], [undefined]]);
  assert.deepEqual(markdown, []);
  assert.equal(core.escapeMarkdownTableCell(null), '');
  assert.equal(core.escapeMarkdownTableCell(5), '5');
  assert.deepEqual(tables.normalizeMarkdownTableRow([1, 'x\ny'], 3), ['1', 'x<br>y', '']);
  core.appendMarkdownTable(markdown, [['One | Two', 'Three'], ['Four']]);
  assert.deepEqual(markdown, ['| One \\| Two | Three |', '| --- | --- |', '| Four |  |']);
  assert.equal(xlsxLinks.columnIndexFromCellRef('123'), 1);
});
