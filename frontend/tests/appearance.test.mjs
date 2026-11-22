import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { BACKGROUNDS, DEFAULT_APPEARANCE, normalizeAppearance, appearanceBootstrap } from '../src/lib/appearance.ts';

test('appearance restore accepts only known version, finite bounded numbers and allowlisted background IDs', () => {
  for (const value of [null, [], 'dark', {}, {version:2,background:'library'}]) assert.deepEqual(normalizeAppearance(value), DEFAULT_APPEARANCE);
  const actual = normalizeAppearance({version:1, background:'url(https://untrusted.test/a)', transparency: Infinity, blur: -50, veil: 500, expanded:'true', token:'never retained'});
  assert.deepEqual(actual, {...DEFAULT_APPEARANCE, blur:0,veil:100});
  assert.deepEqual(normalizeAppearance({version:1,background:'library',transparency:0,blur:99,veil:NaN,expanded:true}), {...DEFAULT_APPEARANCE,background:'library',transparency:20,blur:24,expanded:true});
});

test('before-paint bootstrap and live validation agree; blocked or corrupt storage never inserts a URL or secret', () => {
  for (const stored of [null, '{bad', JSON.stringify({version:1,background:'javascript:alert(1)',blur:200,transparency:-7,veil:77,expanded:true}), ...BACKGROUNDS.map(b=>JSON.stringify({...DEFAULT_APPEARANCE,background:b.id}))]) {
    const styles = {}, root = {dataset:{},style:{setProperty:(k,v)=>styles[k]=v}};
    vm.runInNewContext(appearanceBootstrap, {document:{documentElement:root},localStorage:{getItem:()=>stored}});
    let input;try{input=JSON.parse(stored)}catch{}
    const expected = normalizeAppearance(input);
    assert.equal(root.dataset.background, expected.background);
    assert.equal(root.dataset.rail, expected.expanded?'expanded':'collapsed');
    assert.equal(styles['--appearance-blur'],`${expected.blur}px`);
    assert.equal(styles['--appearance-opacity'],String((100-expected.transparency)/100));
    assert.equal(Object.values(styles).some(v=>v.includes('url')), false);
  }
  assert.doesNotThrow(()=>vm.runInNewContext(appearanceBootstrap,{document:{documentElement:{dataset:{},style:{setProperty(){}}}},localStorage:{getItem(){throw Error('blocked')}}}));
});
