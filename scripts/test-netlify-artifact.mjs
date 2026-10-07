// Local artifact contract checks. No SDK calls, deployment, credentials or data access.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const manifest=JSON.parse(readFileSync('.netlify/edge-functions/manifest.json','utf8'));
for(const path of ['/api/auth/login','/api/stripe/webhook','/api/vault/documents','/portal/documents','/admin/team','/b2b/documents']) {
  assert.ok(manifest.functions.some(item=>new RegExp(item.pattern).test(path)),`Missing proxy coverage: ${path}`);
}
assert.ok(existsSync('.netlify/functions-internal/___netlify-server-handler/___netlify-server-handler.mjs'));
const build=JSON.parse(readFileSync('.netlify/.next/routes-manifest.json','utf8'));
for(const source of ['/api/:path*','/portal/:path*','/admin/:path*','/vault']) {
  assert.ok(build.headers.some(rule=>rule.source===source && rule.headers.some(header=>header.key==='Cache-Control' && header.value.includes('no-store'))));
}
assert.ok(build.rewrites.afterFiles.some(rule=>rule.source==='/b2b/:path*' && rule.destination==='/portal/:path*'));
const result=JSON.parse(readFileSync('.netlify/qualification/result.json','utf8'));
assert.equal(result.deployed,false);
assert.equal(result.vaultEnabled,false);
assert.equal(result.stages.every(stage=>stage.result==='PASS'),true);
console.log('15 local adapter artifact/routing/header/gate checks passed; hosted execution not verified.');
