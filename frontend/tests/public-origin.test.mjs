import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appOrigin, internalLocation } from '../src/lib/public-origin.ts';
import { matchesOidcCallback } from '../src/lib/oidc-policy.ts';

test('public origin accepts explicit loopback ports and HTTPS domains, never guesses a port', () => {
  for (const origin of ['http://127.0.0.1:3107','http://127.0.0.1:3100','http://localhost:4321','https://study.example.test'])
    assert.equal(appOrigin(origin), origin);
  for (const value of ['', ' ', 'https://user:pass@example.test', 'http://external.test', 'https://example.test/path', 'https://example.test/?x=1', 'https://example.test/#x', '//example.test', 'javascript:alert(1)'])
    assert.equal(appOrigin(value), '');
});

test('relative internal redirects cannot select another origin or use ambiguous separators', () => {
  for (const origin of ['http://127.0.0.1:3107','http://127.0.0.1:3100','https://study.example.test']) {
    for (const path of ['/login','/inicio','/seguridad?oidc=vinculada','/login?sesion=expirada'])
      assert.equal(new URL(internalLocation(path), origin).origin, origin);
  }
  for (const path of ['https://evil.test','//evil.test','/\\evil.test','/login\r\nLocation: https://evil.test',' login',''])
    assert.throws(() => internalLocation(path));
});

test('OIDC callback matches exact deployment, provider and unique redirect_uri', () => {
  for (const origin of ['http://127.0.0.1:3107','http://127.0.0.1:3100','https://study.example.test']) for (const provider of ['google','gitlab']) {
    const auth = new URL(provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://gitlab.com/oauth/authorize');
    auth.searchParams.set('redirect_uri', `${origin}/api/oidc/callback/${provider}`);
    assert.equal(matchesOidcCallback(auth.href, provider, origin), true);
    for (const target of ['http://127.0.0.1:3199/api/oidc/callback/'+provider,'https://evil.test','//evil.test',`${origin}/api/oidc/callback/other`,`${origin}/api/oidc/callback/${provider}?next=evil`]) {
      auth.searchParams.set('redirect_uri', target);
      assert.equal(matchesOidcCallback(auth.href, provider, origin), false);
    }
    auth.searchParams.set('redirect_uri', `${origin}/api/oidc/callback/${provider}`);
    auth.searchParams.append('redirect_uri', `${origin}/api/oidc/callback/${provider}`);
    assert.equal(matchesOidcCallback(auth.href, provider, origin), false);
    assert.equal(matchesOidcCallback(auth.href, provider, ''), false);
  }
});
