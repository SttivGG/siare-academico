import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { themePreference, themeBootstrap } from '../src/lib/theme.ts';
import vm from 'node:vm';

const directory = new URL('../.cache/nexo-components/', import.meta.url);
await mkdir(directory, { recursive: true });
const source = (await readFile(new URL('../src/components/ui/primitives.tsx', import.meta.url), 'utf8')).replace('import styles from "./primitives.module.css";', 'const styles = {};');
const target = new URL('primitives.mjs', directory);
await writeFile(target, ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { Field, Button, IconButton, Notice, Progress } = await import(target.href);
const render = (component, props, child) => renderToStaticMarkup(React.createElement(component, props, child));

test('Nexo fields associate visible labels, hints and errors without erasing supplied constraints', () => {
  const html = render(Field, { label: 'Correo', id: 'correo', error: 'Revisa el correo', hint: 'Usa tu correo', type: 'email', autoComplete: 'email', required: true, defaultValue: 'alumno@example.test', 'aria-describedby': 'otra-ayuda' });
  assert.match(html, /for="correo"/); assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="otra-ayuda correo-hint correo-error"/);
  assert.match(html, /value="alumno@example.test"/); assert.match(html, /autoComplete="email"/); assert.match(html, /required=""/);
});
test('Nexo buttons prevent form submission by default and expose loading and accessible icon names', () => {
  assert.match(render(Button, { busy: true }, 'Guardando'), /type="button"[^>]*disabled=""[^>]*aria-busy="true"/);
  assert.match(render(Button, { type: 'submit' }, 'Entrar'), /type="submit"/);
  assert.match(render(IconButton, { label: 'Abrir fuentes' }, '＋'), /aria-label="Abrir fuentes"/);
});
test('Nexo notices distinguish critical errors and progress never invents a percentage', () => {
  assert.match(render(Notice, { tone: 'error' }, 'Error'), /role="alert"/);
  assert.match(render(Notice, { tone: 'success' }, 'Guardado'), /role="status"/);
  assert.doesNotMatch(render(Progress, { label: 'Procesando' }), /value=/);
  assert.match(render(Progress, { label: 'Subiendo', value: 25 }), /value="25"/);
});
test('initial theme accepts only visual enums, runs with storage denied, and never reads identity', () => {
  for (const value of ['dark', 'light', 'system', 'untrusted', null]) {
    const root = { dataset: {} }, meta = { content: 'light dark' };
    vm.runInNewContext(themeBootstrap, { document: { documentElement: root, querySelector: () => meta }, localStorage: { getItem(key) { assert.equal(key, 'siare-theme'); return value; } } });
    assert.equal(meta.content, value === 'dark' || value === 'light' ? value : 'light dark');
    assert.equal(themePreference(value), value === 'dark' || value === 'light' ? value : 'system');
  }
  assert.doesNotThrow(() => vm.runInNewContext(themeBootstrap, { localStorage: { getItem() { throw Error('denied'); } } }));
});
