import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import pptx from '../../out/core/pptx.js';
import pptxImages from '../../out/core/pptx/image.js';
import pptxPackage from '../../out/core/pptx/package.js';
import pptxRenderer from '../../out/core/pptx/renderer.js';
import pptxTable from '../../out/core/pptx/table.js';
import pptxGeometry from '../../out/core/pptx/geometry.js';
import odf from '../../out/core/odf.js';
import odfGeometry from '../../out/core/odf/geometry.js';
import odfImages from '../../out/core/odf/images.js';

const size = { width: 100, height: 100 };
const pixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atMWVwAAAAASUVORK5CYII=';
const image = (props) => ({
  kind: 'image',
  x: 30,
  y: 30,
  width: 20,
  height: 20,
  order: 1,
  name: 'Picture 1',
  description: 'Quarterly chart',
  altText: 'Quarterly chart',
  mediaPath: 'ppt/media/chart.png',
  mimeType: 'image/png',
  ...props,
});

test('PPTX renderer embeds informative images and filters repeated ornaments and placeholders', async () => {
  const chart = image({});
  const large = image({
    width: 60,
    height: 60,
    description: '',
    mediaPath: 'ppt/media/low-info.png',
  });
  const backdrop = image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    mediaPath: 'ppt/media/backdrop.png',
  });
  const logo = image({
    x: 0,
    y: 0,
    width: 8,
    height: 8,
    name: 'Decorative logo',
    description: '',
    mediaPath: 'ppt/media/logo.png',
  });
  const zip = new JSZip();
  for (const item of [chart, large, backdrop, logo])
    zip.file(item.mediaPath, pixel, { base64: true });
  const slides = [
    {
      index: 1,
      size,
      items: [
        { kind: 'table', x: 5, y: 5, width: 50, height: 5, order: 0, markdown: 'Revenue' },
        chart,
        large,
        backdrop,
        logo,
        image({ mediaPath: 'ppt/media/missing.png' }),
      ],
    },
    { index: 2, size, items: [logo] },
    { index: 3, size, items: [chart] },
  ];
  assert.deepEqual(
    [...pptxImages.collectImageSlideCounts(slides)],
    [
      ['ppt/media/chart.png', 2],
      ['ppt/media/low-info.png', 1],
      ['ppt/media/backdrop.png', 1],
      ['ppt/media/logo.png', 2],
      ['ppt/media/missing.png', 1],
    ],
  );
  const embedded = `![Quarterly chart](data:image/png;base64,${pixel})`;
  assert.equal(
    await pptxRenderer.renderSlides(zip, slides),
    `Revenue\n\n${embedded}\n\n---\n\n${embedded}`,
  );
  assert.equal(pptxImages.shouldIncludeImage(image({ width: 0 }), size, 0, 1, false, 0), true);
  assert.equal(
    pptxImages.shouldIncludeImage(
      image({ width: 0, name: 'Logo', description: '' }),
      size,
      0,
      1,
      false,
      0,
    ),
    false,
  );
  assert.equal(
    pptxImages.shouldIncludeImage(image({ width: 3, description: '' }), size, 0, 1, false, 0),
    false,
  );
  assert.equal(
    pptxImages.shouldIncludeImage(
      image({ width: 8, height: 8, description: '' }),
      size,
      2,
      3,
      false,
      0,
    ),
    false,
  );
  assert.equal(
    pptxImages.shouldIncludeImage(
      image({ x: 0, width: 8, height: 8, description: '' }),
      size,
      1,
      2,
      false,
      0,
    ),
    false,
  );
  assert.equal(pptxImages.shouldIncludeImage(backdrop, size, 1, 2, false, 65536), true);
  assert.equal(pptxImages.preferredAltText('Revenue chart', 'image1.png'), 'Revenue chart');
  assert.equal(pptxImages.preferredAltText('Google Shape;13;p4 image1.png', ''), 'Slide image');
  assert.equal(
    pptxImages.preferredAltText('Picture 123', 'Descriptive label'),
    'Descriptive label',
  );
  assert.equal(
    pptxImages.hasContentAltText(image({ description: 'Weekly changes by region' })),
    true,
  );
  assert.equal(
    pptxImages.hasContentAltText(image({ description: 'Decorative background' })),
    false,
  );
});

test('PPTX relationship parsing resolves package paths without rewriting external links', async () => {
  const zip = new JSZip();
  assert.equal((await pptxPackage.readRelationships(zip, 'missing', 'ppt')).size, 0);
  assert.equal((await pptxPackage.readContentTypes(zip)).defaults.size, 0);
  await assert.rejects(
    pptx.convertPptxData(await zip.generateAsync({ type: 'uint8array' })),
    /missing ppt\/presentation\.xml/,
  );
  zip.file(
    'ppt/_rels/part.rels',
    `<Relationships>
    <Relationship Id="r1" Target=".././media/chart.PNG" />
    <Relationship Id="r2" Target="/ppt/media/diagram.svg" Type="image" />
    <Relationship Id="r3" Target="https://example.test" TargetMode="External" />
    <Relationship Target="ignored.png" />
    <Relationship Id="ignore" />
  </Relationships>`,
  );
  zip.file(
    '[Content_Types].xml',
    `<Types>
    <Default Extension="PNG" ContentType="image/png" />
    <Default Extension="unused" />
    <Override PartName="/ppt/media/diagram.svg" ContentType="image/svg+xml" />
    <Override ContentType="ignored" />
  </Types>`,
  );
  const rels = await pptxPackage.readRelationships(zip, 'ppt/_rels/part.rels', 'ppt/slides');
  assert.deepEqual(
    [...rels],
    [
      ['r1', { target: 'ppt/media/chart.PNG', type: '', external: false }],
      ['r2', { target: 'ppt/media/diagram.svg', type: 'image', external: false }],
      ['r3', { target: 'https://example.test', type: '', external: true }],
    ],
  );
  const types = await pptxPackage.readContentTypes(zip);
  assert.equal(pptxImages.mimeTypeForPart(types, 'ppt/media/diagram.svg'), 'image/svg+xml');
  assert.equal(pptxImages.mimeTypeForPart(types, 'chart.PNG'), 'image/png');
  assert.equal(pptxImages.mimeTypeForPart(types, 'chart.jpeg'), 'image/jpeg');
  assert.equal(pptxPackage.extensionName('no-extension'), '');
  assert.equal(pptxPackage.dirname('no-directory'), '');
});

test('PPTX table and nested group geometry honor cell text and coordinate scaling', () => {
  const frame = (rows) => ({ graphic: { graphicData: { tbl: { tr: rows } } } });
  const cell = (t) => ({ txBody: { p: { r: { t } } } });
  assert.equal(pptxTable.readTableMarkdown({}), undefined);
  assert.equal(pptxTable.readTableMarkdown(frame([{ tc: cell(' ') }])), undefined);
  assert.equal(
    pptxTable.readTableMarkdown(
      frame([{ tc: [cell('Name'), cell('Total')] }, { tc: [cell('West'), cell('10')] }]),
    ),
    '| Name | Total |\n| --- | --- |\n| West | 10 |',
  );
  assert.deepEqual(pptxGeometry.readSlideSize({ '@_cx': 800, '@_cy': 400 }), {
    width: 800,
    height: 400,
  });
  const transform = pptxGeometry.composeGroupTransform(
    { x: 20, y: 10, scaleX: 2, scaleY: 3 },
    {
      off: { '@_x': 30, '@_y': 10 },
      ext: { '@_cx': 100, '@_cy': 80 },
      chOff: { '@_x': 5, '@_y': 2 },
      chExt: { '@_cx': 50, '@_cy': 20 },
    },
  );
  assert.deepEqual(pptxGeometry.applyTransform(transform, { x: 5, y: 2, width: 2, height: 2 }), {
    x: 80,
    y: 40,
    width: 8,
    height: 24,
  });
});

test('OpenDocument rendering validates dimensions and filters only low-information images', async () => {
  for (const unit of ['2.54cm', '25.4mm', '72pt', '96px', '1in', '1']) {
    assert.equal(odfGeometry.readUnit(unit), 1, unit);
  }
  for (const invalid of [undefined, 'bad', `${'9'.repeat(310)}in`]) {
    assert.equal(odfGeometry.readUnit(invalid), 0);
  }
  const zip = new JSZip();
  await assert.rejects(
    odf.convertOdfData(await zip.generateAsync({ type: 'uint8array' })),
    /missing content\.xml/,
  );
  zip.file('Pictures/chart.png', pixel, { base64: true });
  zip.file('Pictures/invalid.txt', 'not an image');
  const context = {
    zip,
    manifest: new Map(),
    pageSize: size,
    imagePageCounts: new Map(),
    pageCount: 3,
    presentationMode: true,
  };
  const chart = { x: 30, y: 30, width: 20, height: 20, href: 'Pictures/chart.png' };
  assert.equal(odfImages.shouldIncludePresentationImage(chart, context), true);
  assert.equal(
    odfImages.shouldIncludePresentationImage({ ...chart, href: undefined }, context),
    false,
  );
  assert.equal(
    odfImages.shouldIncludePresentationImage(
      { ...chart, width: 1 },
      { ...context, presentationMode: false },
    ),
    false,
  );
  assert.equal(odfImages.shouldIncludePresentationImage({ ...chart, width: 1 }, context), false);
  assert.equal(
    odfImages.shouldIncludePresentationImage(
      { ...chart, x: 0, y: 0, width: 100, height: 100 },
      context,
    ),
    false,
  );
  assert.equal(
    odfImages.shouldIncludePresentationImage({ ...chart, width: 50, byteLength: 200 }, context),
    false,
  );
  context.imagePageCounts.set(chart.href, 2);
  assert.equal(
    odfImages.shouldIncludePresentationImage({ ...chart, width: 8, height: 8 }, context),
    false,
  );
  assert.equal(await odfImages.renderImageMarkdown('Pictures/invalid.txt', context), '');
  assert.equal(await odfImages.renderImageMarkdown('missing.png', context), '');
  const embedded = await odfImages.renderImageMarkdown('./Pictures/chart.png', context);
  assert.equal(embedded, `![chart.png](data:image/png;base64,${pixel})`);
  assert.equal(
    odfImages.imageByteLengthFromMarkdown(embedded),
    Buffer.from(pixel, 'base64').length,
  );
  assert.equal(odfImages.imageByteLengthFromMarkdown('plain text'), 0);
});
