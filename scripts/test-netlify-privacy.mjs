// Exercise the generated wrapper with synthetic request URLs and mocked tracing/server failure.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path='.netlify/functions-internal/___netlify-server-handler/___netlify-server-handler.mjs';
let source=readFileSync(path,'utf8');
assert.ok(!source.includes("'http.target': req.url"));
source=source.replace(/import[\s\S]*?from '[^']+'\n/g,'').replace('export default async function handler','async function handler').replace('export const config','const config');
let calls=0;
const original = Object.fromEntries(['NETLIFY','CONTEXT','VERCEL','VERCEL_ENV'].map(key=>[key,process.env[key]]));
for (const key of Object.keys(original)) delete process.env[key];
for(const requestPath of ['/api/ordinary-transfer/opaque?token=SYNTHETIC_CANARY','/api/auth/reset-password?token=SYNTHETIC_CANARY','/api/portal/documents/SYNTHETIC_CANARY?X-Amz-Signature=SYNTHETIC_CANARY','/portal/requests/SYNTHETIC_CANARY','/admin/documents/SYNTHETIC_CANARY','/forgot-password?token=SYNTHETIC_CANARY']){
 const traces=[];
 const factory=new Function('createRequestContext','runWithRequestContext','serverHandler','getTracer','withActiveSpan',source+'; return handler');
 const handler=factory(req=>{assert.ok(!req.headers.has('x-next-debug-logging'));assert.ok(!req.headers.has('x-nf-debug-logging'));return {};},(_ctx,fn)=>fn(),async()=>{throw Error('https://provider.invalid/?token=SYNTHETIC_CANARY');},()=>({}),(_tracer,_name,fn)=>fn({setAttributes:value=>traces.push(value)}));
 assert.equal(process.env.NETLIFY,'true');
 assert.ok(['production','deploy-preview','branch-deploy','dev'].includes(process.env.CONTEXT));
 const res=await handler(new Request('https://qualification.example.test'+requestPath,{headers:{'x-next-debug-logging':'1','x-nf-debug-logging':'1'}}),{account:{id:'synthetic'},deploy:{id:'synthetic'},site:{id:'synthetic'},requestId:'synthetic'});
 assert.equal(res.status,503);assert.ok(!JSON.stringify(traces).includes('SYNTHETIC_CANARY'));assert.ok(!(await res.text()).includes('SYNTHETIC_CANARY'));calls++;
}
const factory=new Function('createRequestContext','runWithRequestContext','serverHandler','getTracer','withActiveSpan',source+'; return handler');
process.env.CONTEXT='conflicting-context';
assert.throws(()=>factory(),/Conflicting hosting context/);calls++;
delete process.env.CONTEXT;process.env.VERCEL='1';
assert.throws(()=>factory(),/Conflicting hosting context/);calls++;
for(const [key,value] of Object.entries(original)) { if(value===undefined)delete process.env[key];else process.env[key]=value; }
console.log(`${calls} generated-handler privacy checks passed; no provider ingress-log proof claimed.`);
