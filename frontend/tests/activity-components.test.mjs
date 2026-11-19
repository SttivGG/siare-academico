import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile the real TSX; replace only the HTTP boundary (SSR must never call it).
const directory = new URL('../.cache/components/', import.meta.url);
await mkdir(directory, { recursive: true });
async function compile(name) {
  const source = (await readFile(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8'))
    .replaceAll("'../lib/api'", "'data:text/javascript,export async function api(){throw new Error(%22Unexpected HTTP request%22)}'")
    .replaceAll("'../lib/activities'", JSON.stringify(new URL('../src/lib/activities.ts', import.meta.url).href));
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = new URL(`${name}.mjs`, directory); await writeFile(target, output); return import(target.href);
}
const { ActivityPlayer, EvaluationView } = await compile('activity-player');
const { ActivityBankEditor } = await compile('activity-bank-editor');
const read = name => readFile(new URL(`./fixtures/h3/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
test('quiz presents real options and navigation without any answer key before evaluation', async () => {
  const html = renderToStaticMarkup(React.createElement(ActivityPlayer, { activity: await read('quiz'), archived: false, onResult() {}, onPending() {} }));
  assert.match(html, /¿Cuánto es 2 \+ 2/); assert.match(html, /type="radio"/); assert.match(html, /Siguiente/);
  assert.doesNotMatch(html, /Respuesta esperada|correctOptionId|2 \+ 2 = 4/);
});
test('crossword renders only public cells, numbered clues and keyboard instructions', async () => {
  const html = renderToStaticMarkup(React.createElement(ActivityPlayer, { activity: await read('crossword'), archived: false, onResult() {}, onPending() {} }));
  assert.equal((html.match(/autoComplete="off"/g) ?? []).length, 6);
  assert.match(html, /Horizontales/); assert.match(html, /Verticales/); assert.match(html, /Retroceso/);
  assert.doesNotMatch(html, /SOL|LUNA|Respuesta esperada/);
});
test('authorized evaluation renders server score, expected answers and rationale', async () => {
  const html = renderToStaticMarkup(React.createElement(EvaluationView, { result: await read('result') }));
  assert.match(html, /50/); assert.match(html, /Respuesta esperada/); assert.match(html, /2 \+ 2 = 4/);
});
test('an empty bank starts with publication disabled and no automatic-generation promise', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityBankEditor, { subjectId: 'subject', document: null, onCreated() {} }));
  assert.match(html, /pendiente de integración con ML/); assert.match(html, /disabled=""[^>]*>Crear Quiz revisado/);
});
