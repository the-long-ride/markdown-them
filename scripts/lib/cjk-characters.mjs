import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const cjkFamilies = { zh: 'Noto Sans SC', ja: 'Noto Sans JP', ko: 'Noto Sans KR' };
export const cjkWeights = [400, 500, 550, 600, 700];
const cjk =
  /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}\p{Script_Extensions=Bopomofo}\u3000-\u303f\uff00-\uffef]/u;

export function cjkCharacters(text) {
  return new Set(
    [...text]
      .filter((character) => cjk.test(character))
      .map((character) => character.codePointAt(0)),
  );
}

function strings(node) {
  const values = [];
  function visit(child) {
    if (
      ts.isStringLiteralLike(child) ||
      ts.isTemplateHead(child) ||
      ts.isTemplateMiddle(child) ||
      ts.isTemplateTail(child)
    )
      values.push(child.text);
    ts.forEachChild(child, visit);
  }
  visit(node);
  return values.join('');
}

export async function localeCharacters(root) {
  const result = Object.fromEntries(Object.keys(cjkFamilies).map((code) => [code, new Set()]));
  const context = path.join(root, 'src/app/context');
  async function parse(file) {
    return ts.createSourceFile(
      file,
      await readFile(path.join(context, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
  }
  function add(code, text) {
    const characters = cjkCharacters(text);
    if (!characters.size) return;
    if (!result[code])
      throw new Error(`CJK text in unsupported locale ${code}; assign its font coverage`);
    for (const character of characters) result[code].add(character);
  }
  for (const file of await readdir(path.join(context, 'translations'))) {
    if (file.endsWith('.ts')) add(file.slice(0, -3), strings(await parse(`translations/${file}`)));
  }
  function visit(node) {
    if (ts.isPropertyAssignment(node) && result[node.name.getText()]) {
      add(node.name.getText(), strings(node.initializer));
    }
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(
        node.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => [property.name.getText(), property.initializer]),
      );
      const code = properties.get('code');
      const label = properties.get('label');
      if (code && label && ts.isStringLiteralLike(code)) add(code.text, strings(label));
    }
    ts.forEachChild(node, visit);
  }
  visit(await parse('supportPromptTranslations.ts'));
  visit(await parse('LanguageContext.tsx'));
  return Object.fromEntries(
    Object.entries(result).map(([code, points]) => [code, [...points].sort((a, b) => a - b)]),
  );
}
