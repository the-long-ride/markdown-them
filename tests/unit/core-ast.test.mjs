import assert from 'node:assert/strict';
import { test } from 'node:test';
import astRenderer from '../../out/core/markdown/office-ast.js';

const { officeAstToMarkdown } = astRenderer;
const text = (value, formatting) => ({ type: 'text', text: value, formatting });
const cell = (value) => ({ type: 'cell', text: value });

test('Office AST preserves style, inferred headings, lists, and table structure', () => {
  const result = officeAstToMarkdown({
    content: [
      null,
      { type: 'heading', children: [text('Projected &amp; actual')], metadata: { level: 9 } },
      { type: 'heading', text: 'Overview' },
      { type: 'heading', text: 'Non-finite', metadata: { level: Infinity } },
      { type: 'paragraph', children: [text('Large', { size: '36pt' })] },
      { type: 'paragraph', text: 'Medium', formatting: { size: 24 } },
      { type: 'paragraph', text: 'Small', formatting: { size: 18 } },
      { type: 'paragraph', text: 'Regular', formatting: { size: '12pt' } },
      { type: 'paragraph', text: 'Unknown size', formatting: { size: 'automatic' } },
      {
        type: 'paragraph',
        children: [
          text('Bold', { bold: true }),
          text(' '),
          text('Italic', { italic: true }),
          text(' '),
          text('Deleted', { strikethrough: true }),
          text(''),
        ],
      },
      {
        type: 'list',
        children: [
          { type: 'paragraph', text: 'Ordinary' },
          { type: 'paragraph', text: 'Numbered', metadata: { listType: 'ordered' } },
        ],
      },
      {
        type: 'list',
        metadata: { listType: 'ordered' },
        children: [{ type: 'unknown', text: 'Inherited', children: [] }],
      },
      { type: 'list' },
      {
        type: 'page',
        children: [
          {
            type: 'sheet',
            metadata: { sheetName: 'Income 2025' },
            children: [
              {
                type: 'table',
                children: [
                  { type: 'row', children: [cell('Name'), cell('Total')] },
                  {
                    type: 'row',
                    children: [{ type: 'cell', children: [text('North | West')] }, cell('12')],
                  },
                  { type: 'row' },
                ],
              },
            ],
          },
        ],
      },
      { type: 'sheet', text: 'From label' },
      { type: 'sheet' },
      { type: 'page' },
      { type: 'row' },
      { type: 'row', children: [cell('Standalone | cell'), cell('value')] },
      { type: 'table', children: [] },
      { type: 'table' },
      { type: 'slide' },
      {
        type: 'slide',
        children: [
          { type: 'image', text: 'Figure ' },
          { type: 'chart', text: 'Chart ' },
          { type: 'drawing', text: 'Drawing' },
        ],
      },
      { type: 'unknown', children: [text('Fallback')] },
      {
        type: 'text',
        text: {
          toString() {
            throw new Error('Unreadable node');
          },
        },
      },
    ],
  });
  for (const fragment of [
    '###### Projected & actual',
    '## Overview',
    '## Non-finite',
    '# Large',
    '## Medium',
    '### Small',
    'Regular',
    'Unknown size',
    '**Bold** *Italic* ~~Deleted~~',
    '- Ordinary',
    '2. Numbered',
    '1. Inherited',
    '## Income 2025',
    '| Name | Total |',
    '| North \\| West | 12 |',
    '## From label',
    '## Sheet',
    '| Standalone \\| cell | value |',
    '---\n\nFigure Chart Drawing',
    'Fallback',
  ]) {
    assert.ok(result.includes(fragment), `Expected Markdown to contain ${fragment}:\n${result}`);
  }
});

test('Office AST falls back to plain text, JSON, or a printable circular object', () => {
  assert.equal(officeAstToMarkdown({ toText: () => 'plain text' }), 'plain text');
  assert.equal(officeAstToMarkdown({ content: 'non-AST' }), '{\n  "content": "non-AST"\n}');
  assert.equal(officeAstToMarkdown(undefined), '');
  const circular = {};
  circular.content = circular;
  assert.equal(officeAstToMarkdown(circular), '[object Object]');
});
