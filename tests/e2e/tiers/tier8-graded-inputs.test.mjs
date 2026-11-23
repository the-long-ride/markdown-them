import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertEqual } from '../framework/assertions.mjs';
import {
  convertTextToMarkdown,
  generateMarkdown,
  htmlToMarkdown,
} from '../framework/conversion-adapter.mjs';

export function registerTier8Tests(harness) {
  harness.suite('Tier 8: Graded Markdown Inputs', () => {
    harness.suite('Easy: Plain text and basic Markdown', () => {
      harness.test('Leaves angle brackets and ampersands in plain text alone', () => {
        assertEqual(convertTextToMarkdown('  1 < 2 & 3 > 2  '), '1 < 2 & 3 > 2');
      });

      harness.test('Normalizes CRLF without removing a Markdown hard break', () => {
        const input = '# Update\r\n\r\n**Ready**  \r\n[Details](https://example.com/details)';
        assertEqual(
          convertTextToMarkdown(input),
          '# Update\n\n**Ready**  \n[Details](https://example.com/details)',
        );
      });

      harness.test('Returns an empty string for empty and whitespace-only input', () => {
        assertEqual(convertTextToMarkdown(''), '');
        assertEqual(convertTextToMarkdown('\uFEFF \t\r\n'), '');
      });
    });

    harness.suite('Intermediate: Lists, tables, and code blocks', () => {
      harness.test('Converts a nested unordered list under a non-default ordered list', () => {
        const input = '<ol start="9"><li>Setup<ul><li>Install</li></ul></li><li>Run</li></ol>';
        assertEqual(htmlToMarkdown(input), '9.  Setup\n    *   Install\n10.  Run');
      });

      harness.test('Pads a short HTML table row while preserving inline code and pipes', () => {
        const input =
          '<table><tr><th>Command</th><th>Result</th></tr>' +
          '<tr><td><code>echo</code></td><td>A | B</td></tr>' +
          '<tr><td>Skipped</td></tr></table>';
        assertEqual(
          htmlToMarkdown(input),
          '| Command | Result |\n| --- | --- |\n| `echo` | A \\| B |\n| Skipped |  |',
        );
      });

      harness.test('Preserves shorter backtick runs inside a fenced code block', () => {
        const input = ['````markdown', '```js', 'const x = 1;', '```', '````'].join('\n');
        assertEqual(convertTextToMarkdown(input), input);
      });
    });

    harness.suite('Hard: Unicode, mixed markup, and incomplete input', () => {
      harness.test('Decodes HTML entities without changing CJK, combining marks, or emoji', () => {
        const input =
          '<p>中文・日本語・한글 · cafe\u0301 · 👩🏽‍💻 &amp; &#x1F680; <strong>你好</strong></p>';
        assertEqual(
          convertTextToMarkdown(input),
          '中文・日本語・한글 · cafe\u0301 · 👩🏽‍💻 & 🚀 **你好**',
        );
      });

      harness.test('Preserves inline HTML in an otherwise Markdown document', () => {
        const input = '# Release notes\n\n<span lang="ja">日本語</span> · **Ready**';
        assertEqual(convertTextToMarkdown(input), input);
      });

      harness.test('Retains unfinished Markdown without inventing closing delimiters', () => {
        const input = '# Draft\n\nAn **unfinished note\n\n```sh\necho done';
        assertEqual(convertTextToMarkdown(input), input);
      });

      harness.test('Recovers text and emphasis from an unclosed HTML fragment', () => {
        const input = '<section><h2>Notes</h2><p>Still readable <em>after truncation';
        assertEqual(convertTextToMarkdown(input), '## Notes\n\nStill readable _after truncation_');
      });
    });

    harness.suite('Hardest: Deep nesting, code fidelity, and large documents', () => {
      harness.test('Preserves all 32 levels of nested HTML blockquotes', () => {
        const depth = 32;
        const input =
          '<blockquote>'.repeat(depth) + '<p>Deep quote</p>' + '</blockquote>'.repeat(depth);
        assertEqual(htmlToMarkdown(input), '> '.repeat(depth) + 'Deep quote');
      });

      harness.test(
        'Preserves significant trailing spaces and blank lines inside a code fence',
        () => {
          const input = ['```text', 'keep three spaces   ', '', '', '', 'next line', '```'].join(
            '\n',
          );
          assertEqual(convertTextToMarkdown(input), input);
        },
      );

      harness.test('Ignores shorter and mismatched delimiters inside a tilde fence', () => {
        const input = [
          '   ~~~~text',
          '~~~',
          '```',
          '~~~~ not a closer',
          '  keep spaces   ',
          '  ~~~~~',
          'Clean up outside\t',
        ];
        const expected = [
          '~~~~text',
          '~~~',
          '```',
          '~~~~ not a closer',
          '  keep spaces   ',
          '  ~~~~~',
          'Clean up outside',
        ];
        assertEqual(convertTextToMarkdown(input.join('\r\n')), expected.join('\n'));
      });

      harness.test('Keeps trailing whitespace at EOF when a fence is unclosed', () => {
        const input = '```text\n  keep spaces   \n\n\n';
        assertEqual(convertTextToMarkdown(input), input);
      });

      harness.test('Pairs list fences without treating their closers as top-level openers', () => {
        const rootFence = '```\nroot code   \n\n\n\n```';
        const listFences = [
          '- ```text\n  list code   \n\n\n\n  ```',
          '10. ```text\n    list code   \n\n\n\n       ```',
        ];
        for (const listFence of listFences) {
          const input = `${listFence}\n\n\n\nProse\t\n\n${rootFence}`;
          assertEqual(convertTextToMarkdown(input), `${listFence}\n\n\nProse\n\n${rootFence}`);
        }
      });

      harness.test('Ends an unclosed nested fence when its Markdown container ends', () => {
        const fence = '> - Item\n>   ~~~\n>   body   \n>\n>\n>\n';
        const input = `${fence}Outside\t\n\n\n\nNext`;
        assertEqual(convertTextToMarkdown(input), `${fence}Outside\n\n\nNext`);
      });

      harness.test(
        'Converts a large Markdown file without dropping or reordering lines',
        async () => {
          const dir = await mkdtemp(path.join(tmpdir(), 'markdown-them-graded-'));
          try {
            const file = path.join(dir, 'inventory.markdown');
            const rows = Array.from(
              { length: 12000 },
              (_, index) => `- **Item ${index + 1}** — 在庫あり 📦 — ready for inventory review`,
            );
            const expected = ['# Inventory', '', ...rows];
            await writeFile(file, expected.join('\r\n') + '\r\n', 'utf8');

            const actual = (await generateMarkdown(file)).split('\n');
            assertEqual(actual.length, expected.length);
            for (const [index, line] of expected.entries()) {
              assertEqual(actual[index], line, `Content mismatch on line ${index + 1}`);
            }
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        },
      );
    });
  });
}
