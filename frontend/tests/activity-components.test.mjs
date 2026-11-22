import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcademicController } from '../src/lib/academic-state.ts';

// Compile the real TSX; replace only the HTTP boundary (SSR must never call it).
const directory = new URL('../.cache/components/', import.meta.url);
await mkdir(directory, { recursive: true });
const ownerPath = new URL('owner.mjs', directory);
await writeFile(ownerPath, `import {useSyncExternalStore} from 'react'; let entry; export function configure(value){entry=value} export function useAcademic(){return {...entry,state:useSyncExternalStore(entry.controller.subscribe,entry.controller.getSnapshot,entry.controller.getSnapshot)}}`);
const { configure } = await import(ownerPath.href);
function owner(activity) { const controller = new AcademicController('user', activity?.subjectId ?? 'subject'); if (activity) controller.open(activity); configure({controller, recovery:{getSnapshot:()=>({enabled:false})}}); }
async function compile(name) {
  const source = (await readFile(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8'))
    .replaceAll("'../lib/api'", "'data:text/javascript,export async function api(){throw new Error(%22Unexpected HTTP request%22)}'")
    .replaceAll("'./academic-provider'", JSON.stringify(ownerPath.href))
    .replaceAll("'../lib/academic-state'", JSON.stringify(new URL('../src/lib/academic-state.ts', import.meta.url).href))
    .replaceAll("'../lib/activities'", JSON.stringify(new URL('../src/lib/activities.ts', import.meta.url).href));
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = new URL(`${name}.mjs`, directory); await writeFile(target, output); return import(target.href);
}
const { ActivityPlayer, EvaluationView } = await compile('activity-player');
const { ActivityBankEditor } = await compile('activity-bank-editor');
const read = name => readFile(new URL(`./fixtures/h3/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
test('quiz presents real options and navigation without any answer key before evaluation', async () => {
  const activity = await read('quiz'); owner(activity);
  const html = renderToStaticMarkup(React.createElement(ActivityPlayer, { activity, archived: false, onResult() {}, onPending() {} }));
  assert.match(html, /¿Cuánto es 2 \+ 2/); assert.match(html, /type="radio"/); assert.match(html, /Siguiente/);
  assert.doesNotMatch(html, /Respuesta esperada|correctOptionId|2 \+ 2 = 4/);
});
test('crossword renders only public cells, numbered clues and keyboard instructions', async () => {
  const activity = await read('crossword'); owner(activity);
  const html = renderToStaticMarkup(React.createElement(ActivityPlayer, { activity, archived: false, onResult() {}, onPending() {} }));
  assert.equal((html.match(/autoComplete="off"/g) ?? []).length, 6);
  assert.match(html, /Horizontales/); assert.match(html, /Verticales/); assert.match(html, /Retroceso/);
  assert.doesNotMatch(html, /SOL|LUNA|Respuesta esperada/);
});
test('authorized evaluation renders server score, expected answers and rationale', async () => {
  const html = renderToStaticMarkup(React.createElement(EvaluationView, { result: await read('result') }));
  assert.match(html, /50/); assert.match(html, /Respuesta esperada/); assert.match(html, /2 \+ 2 = 4/);
});

test('DT-02: only valid evaluation dates render, consistently in America/Bogota', async () => {
  const result = await read('result');
  for (const occurredAt of ['', undefined, null, 'not-a-date']) {
    const html = renderToStaticMarkup(React.createElement(EvaluationView, { result: { ...result, occurredAt } }));
    assert.match(html, /Fecha no disponible/); assert.doesNotMatch(html, /Invalid Date/);
  }
  const html = renderToStaticMarkup(React.createElement(EvaluationView, { result: { ...result, occurredAt: '2026-11-20T02:30:00Z' } }));
  assert.match(html, /19\/11\/2026/);
});
test('an empty bank starts with publication disabled and no automatic-generation promise', () => {
  owner();
  const html = renderToStaticMarkup(React.createElement(ActivityBankEditor, { subjectId: 'subject', document: null, onCreated() {} }));
  assert.match(html, /pendiente de integración con ML/); assert.match(html, /disabled=""[^>]*>Crear Quiz revisado/);
});
