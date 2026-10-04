/** Local synthetic adapter hooks only: no Netlify CLI/API, login, site or deploy operation. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Never let .env loading or inherited provider credentials enter qualification builds.
for (const filename of ['.env','.env.local','.env.production','.env.production.local']) {
  if (existsSync(filename)) throw new Error('Use an isolated checkout without environment files');
}
const originalNextEnv = existsSync('next-env.d.ts') ? readFileSync('next-env.d.ts') : null;
const safe = {};
for (const key of ['PATH','HOME','TMPDIR','SYSTEMROOT','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','NODE_EXTRA_CA_CERTS']) {
  if (process.env[key]) safe[key] = process.env[key];
}
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, safe, {
  NODE_ENV:'production', NETLIFY:'true', CONTEXT:'deploy-preview',
  PK_ENVIRONMENT:'preview', NEXT_TELEMETRY_DISABLED:'1',
  PK_WEBAUTHN_ORIGIN:'https://pk-qualification.example.test',
  NEXT_PUBLIC_SITE_URL:'https://pk-qualification.example.test',
  NEXT_PUBLIC_APP_URL:'https://pk-qualification.example.test',
});
mkdirSync('.netlify/qualification', {recursive:true});
const report = { mode:'local synthetic only', adapter:JSON.parse(readFileSync('node_modules/@netlify/plugin-nextjs/package.json')).version, deployed:false, vaultEnabled:false, stages:[] };
const save = () => writeFileSync('.netlify/qualification/result.json',JSON.stringify(report,null,2));
const options = {
  constants:{ IS_LOCAL:true, PUBLISH_DIR:resolve('.next'), PACKAGE_PATH:'', NETLIFY_BUILD_VERSION:'local-qualification' },
  netlifyConfig:{build:{publish:resolve('.next')}, redirects:[], headers:[], functions:{}},
  featureFlags:{}, utils:{ build:{ failBuild:(message)=>{throw new Error(message);} } },
};
try {
  const plugin=await import('@netlify/plugin-nextjs');
  await plugin.onPreBuild(options);
  report.stages.push({stage:'adapter pre-build',result:'PASS'});save();
  const build=spawnSync('npm',['run','build'],{env:process.env,stdio:'inherit'});
  if(build.status!==0)throw new Error('Local Next build failed');
  report.stages.push({stage:'Next production build',result:'PASS'});save();
  await plugin.onBuild(options);
  report.stages.push({stage:'adapter packaging',result:'PASS'});save();
  // Post-build mutates publish directories; local artifacts only, never application resources.
  await plugin.onPostBuild(options);
  report.stages.push({stage:'adapter post-build',result:'PASS'});save();
  console.log('Local adapter qualification packaged; hosted runtime acceptance remains outstanding.');
} catch {
  // Do not serialize provider exception messages, environment or generated server code.
  report.stages.push({stage:'qualification',result:'FAIL'});save();
  console.error('Local adapter qualification failed. Inspect local synthetic build evidence; no deployment occurred.');
  process.exitCode=1;
} finally {
  // Next's generated declaration may point at staged directories after packaging.
  if (originalNextEnv) writeFileSync('next-env.d.ts', originalNextEnv);
}
