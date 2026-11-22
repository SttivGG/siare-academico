import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayDate } from '../src/lib/display-date.ts';
test('identity dates never invent a value and consistently use Bogota across server/browser timezones', () => {
  for (const value of [null, undefined, '', 'invalid']) assert.equal(displayDate(value), 'Fecha no disponible');
  const before = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Tokyo'; const tokyo = displayDate('2026-11-20T02:00:00Z');
    process.env.TZ = 'America/Bogota'; assert.equal(displayDate('2026-11-20T02:00:00Z'), tokyo);
    assert.match(tokyo, /19/);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
