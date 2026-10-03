// Synthetic-only tests execute actual TypeScript modules with isolated persistence/network boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(path.resolve('package.json'));
const canary='SYNTHETIC-CONFIDENTIAL-CANARY';
function harness({env={},prisma={},mocks={},inventory=false,fetchMock}={}) {
 const cache=new Map(), logs=[], calls=[];
 const base=inventory?'apps/inventory-tracker/src':'src';
 function load(relative) {
  const filename=path.resolve(relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const loaded={exports:{}};cache.set(filename,loaded);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const resolve=id=>{
   if(Object.hasOwn(mocks,id))return mocks[id];
   if(id==='@/lib/prisma'||id==='@/server/db/client')return {prisma};
   if(id==='@/generated/prisma/client')return {AuditAction:new Proxy({},{get:(_,key)=>key})};
   if(id.startsWith('@/'))return load(`${base}/${id.slice(2)}.ts`);
   return require(id);
  };
  const context={process:{env,cwd:()=>process.cwd()},console:{error:(...v)=>logs.push(v),log:(...v)=>logs.push(v)},Response,Request,URL,URLSearchParams,Buffer,File,fetch:async(...v)=>{calls.push(v);if(fetchMock)return fetchMock(...v);throw new Error('Unexpected external request');}};
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,context,{filename})(resolve,loaded,loaded.exports);
  return loaded.exports;
 }
 return {load,logs,calls};
}
const prod={NODE_ENV:'production',PK_ENVIRONMENT:'production',PK_AUTH_ENVIRONMENT:'production',AUTH_SECRET:'synthetic-test-only-secret'};
const user={id:'synthetic-staff',role:'STAFF',status:'ACTIVE',name:'Synthetic',email:'synthetic@example.test'};
const session={expiresAt:new Date(Date.now()+60000),user};
const authMock={getSessionTokenFromRequest:()=> 'fixture',getSessionUser:async()=>user,hasRole:(u,...roles)=>roles.includes(u.role)};
test('logger drops unrecognized content and errors never disclose exception content',()=>{
 const h=harness();h.load('src/lib/security-log.ts').logSecurityEvent(canary);
 const response=h.load('src/lib/api-error.ts').handleApiError(new Error(canary));
 assert.equal(response.status,500);assert.ok(!JSON.stringify(h.logs).includes(canary));
});
for(const [label,env,pass] of [
 ['local synthetic default',{},true],['production undeclared',{NODE_ENV:'production'},false],
 ['preview undeclared',{VERCEL:'1',VERCEL_ENV:'preview'},false],
 ['host/declaration mismatch',{VERCEL:'1',VERCEL_ENV:'preview',PK_ENVIRONMENT:'production'},false],
 ['valid preview',{VERCEL:'1',VERCEL_ENV:'preview',PK_ENVIRONMENT:'preview'},true],
 ['invalid declaration',{PK_ENVIRONMENT:'invalid'},false],
])test(`environment: ${label}`,()=>{
 const e=harness({env}).load('src/lib/security-environment.ts');
 if(pass)assert.doesNotThrow(()=>e.securityEnvironment());else assert.throws(()=>e.securityEnvironment());
});
for(const resource of ['AUTH','DATABASE','STORAGE','EMAIL'])test(`${resource}: mismatched binding fails closed`,()=>{
 const h=harness({env:{...prod,[`PK_${resource}_ENVIRONMENT`]:'preview'}});
 assert.throws(()=>h.load('src/lib/security-environment.ts').assertResourceEnvironment(resource));
});
for(const [label,env,allowed] of [
 ['default off',{},false],['opted local file',{PK_ALLOW_SYNTHETIC_SETUP:'true',DATABASE_URL:'file:synthetic.db'},true],
 ['remote target',{PK_ALLOW_SYNTHETIC_SETUP:'true',DATABASE_URL:'libsql://synthetic.invalid'},false],
 ['production',{...prod,PK_ALLOW_SYNTHETIC_SETUP:'true'},false],
 ['hosted preview',{VERCEL:'1',VERCEL_ENV:'preview',PK_ENVIRONMENT:'preview',PK_ALLOW_SYNTHETIC_SETUP:'true'},false],
])test(`setup: ${label}`,()=>assert.equal(harness({env}).load('src/lib/security-environment.ts').localSyntheticSetupAllowed(),allowed));
test('setup route denies without touching persistence',async()=>{
 const h=harness({env:prod,prisma:new Proxy({},{get:()=>{throw new Error('Unexpected persistence');}})});
 assert.equal((await h.load('src/app/api/setup/seed/route.ts').POST(new Request('https://pk.example.test/api/setup/seed',{method:'POST'}))).status,403);
});
for(const [label,members,expected] of [
 ['active single',[{clientId:'synthetic-client',role:'VIEWER',client:{name:'Synthetic',status:'ACTIVE'}}],true],
 ['inactive',[{clientId:'synthetic-client',role:'OWNER',client:{status:'INACTIVE'}}],false],
 ['none',[],false],['ambiguous',[{clientId:'one'},{clientId:'two'}],false],
])test(`client context: ${label}`,async()=>{
 const h=harness({env:prod,prisma:{session:{findUnique:async()=>({...session,user:{...user,role:"CLIENT"}})},clientMember:{findMany:async()=>members}}});
 const ctx=await h.load('src/lib/auth.ts').getAuthContext('fixture');assert.equal(Boolean(ctx),expected);
});
test('expired and inactive sessions are denied',async()=>{
 for(const fixture of [{...session,expiresAt:new Date(0)},{...session,user:{...user,status:'INACTIVE'}}]){
  const h=harness({env:prod,prisma:{session:{findUnique:async()=>fixture,delete:async()=>{}}}});
  assert.equal(await h.load('src/lib/auth.ts').getSessionUser('fixture'),null);
 }
});
test('cookie parser rejects malformed, old, inventory, and duplicate credentials',()=>{
 const auth=harness().load('src/lib/auth.ts');
 for(const cookie of ['pk_business_session=%xx','pk_session='+ 'a'.repeat(64),'pk_inventory_session='+ 'a'.repeat(64),'pk_business_session=invalid'])assert.equal(auth.getSessionTokenFromRequest(new Request('https://pk.example.test',{headers:{cookie}})),undefined);
 assert.equal(auth.getSessionTokenFromRequest(new Request('https://pk.example.test',{headers:{cookie:'pk_business_session='+ 'a'.repeat(64)}})),'a'.repeat(64));
 const secured=harness({env:prod}).load('src/lib/auth.ts');
 for(const value of [secured.buildSessionCookie('fixture'),secured.clearSessionCookie()]){assert.ok(value.includes('Secure'));assert.ok(value.includes('HttpOnly'));assert.ok(!value.includes('Domain='));}
});
for(const [label,role,assigned,status,allow] of [
 ['assigned staff','STAFF',user.id,'ACTIVE',true],['unassigned staff','STAFF','other','ACTIVE',false],
 ['client role','CLIENT',user.id,'ACTIVE',false],['inactive client','ADMIN',null,'INACTIVE',false],['admin','ADMIN',null,'ACTIVE',true],
])test(`document scope: ${label}`,async()=>{
 const h=harness({prisma:{verificationRequest:{findUnique:async()=>({assignedStaffId:assigned,client:{status}})}}});
 const call=()=>h.load('src/lib/document-access.ts').requireDocumentRequestAccess({...user,role},'synthetic-request');
 if(allow)await call();else await assert.rejects(call);
});
test('unassigned staff download never reaches object storage',async()=>{
 let reads=0;
 const h=harness({mocks:{'@/lib/auth':authMock,'@/lib/storage':{getObject:async()=>{reads++;return Buffer.from(canary);}}},prisma:{document:{findUnique:async()=>({requestId:'synthetic-request',uploadStatus:'UPLOADED',retentionStatus:'ACTIVE'})},verificationRequest:{findUnique:async()=>({assignedStaffId:'other',client:{status:'ACTIVE'}})}}});
 assert.equal((await h.load('src/app/api/admin/documents/[id]/route.ts').GET(new Request('https://pk.example.test'),{params:Promise.resolve({id:'synthetic-doc'})})).status,404);assert.equal(reads,0);
});
test('assigned staff download returns private content',async()=>{
 const h=harness({mocks:{'@/lib/auth':authMock,'@/lib/storage':{getObject:async()=>Buffer.from(canary)}},prisma:{document:{findUnique:async()=>({requestId:'synthetic-request',uploadStatus:'UPLOADED',retentionStatus:'ACTIVE',fileName:'synthetic.txt',mimeType:'text/plain'})},verificationRequest:{findUnique:async()=>({assignedStaffId:user.id,client:{status:'ACTIVE'}})}}});
 const response=await h.load('src/app/api/admin/documents/[id]/route.ts').GET(new Request('https://pk.example.test'),{params:Promise.resolve({id:'synthetic-doc'})});assert.equal(response.status,200);assert.ok(response.headers.get('cache-control').includes('no-store'));assert.equal(await response.text(),canary);
});
test('external chat blocked even with provider credential configured; no context reads or writes',async()=>{
 const h=harness({env:{ANTHROPIC_API_KEY:'synthetic-not-a-key'},mocks:{'@/lib/auth':{...authMock,getSessionUser:async()=>({...user,role:'ADMIN'})},'@/lib/ai/context':{getEngagementContext:()=>{throw new Error('Unexpected context read');}},'@/lib/ai/activity':{getOrCreateAiReview:()=>{throw new Error('Unexpected write');}}}});
 const response=await h.load('src/app/api/admin/requests/[id]/ai-assistant/route.ts').POST(new Request('https://pk.example.test',{method:'POST',body:JSON.stringify({action:'chat',message:canary})}),{params:Promise.resolve({id:'synthetic-request'})});assert.equal(response.status,403);assert.equal(h.calls.length,0);
});
test('no provider imports/calls remain in client engagement engine or API',()=>{
 for(const p of ['src/lib/ai/review-engine.ts','src/app/api/admin/requests/[id]/ai-assistant/route.ts'])assert.ok(!/@anthropic|messages\.create|ANTHROPIC_API_KEY/.test(fs.readFileSync(p,'utf8')));
});
test('contact email contains no client payload or reply-to; transport intercepted',async()=>{
 const sent=[];
 const h=harness({env:{...prod,PK_EMAIL_ENVIRONMENT:'production',GMAIL_APP_PASSWORD:'synthetic-not-a-password'},mocks:{nodemailer:{createTransport:()=>({sendMail:async value=>sent.push(value)})}}});
 const email=h.load('src/lib/contact-email.ts');await email.sendContactEmail({fullName:canary,description:canary,email:canary});assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes(canary));assert.equal(sent[0].replyTo,undefined);assert.equal(h.calls.length,0);
});
test('invoice email omits all confidential invoice fields and untrusted URLs',()=>{
 const h=harness();const body=h.load('src/lib/invoices.ts').buildInvoiceEmailHtml({invoiceNumber:canary,clientName:canary,paymentTerms:canary,portalUrl:'https://evil.invalid/'+canary,totalCents:123456});assert.ok(!body.includes(canary));assert.ok(!body.includes('1234.56'));assert.ok(!body.includes('evil.invalid'));
});
test('new storage keys do not contain original filename',()=>{
 const h=harness();const key=h.load('src/lib/storage.ts').buildStorageKey('synthetic-client','synthetic-request',canary+'.pdf');assert.ok(!key.includes(canary));assert.match(key,/^clients\/synthetic-client\/synthetic-request\/[a-f0-9-]+$/);
});
test('cookie verifier domains differ even with the same synthetic secret and token',async()=>{
 const hashes=[];const prisma={session:{findUnique:async q=>{hashes.push(q.where.tokenHash);return null;}}};
 await harness({env:prod,prisma}).load('src/lib/auth.ts').getSessionUser('synthetic-token');
 await harness({inventory:true,env:{...prod,PK_INVENTORY_AUTH_ENVIRONMENT:'production'},prisma}).load('apps/inventory-tracker/src/server/auth/session.ts').getSessionUser('synthetic-token');assert.notEqual(hashes[0],hashes[1]);
});
test('inventory cannot auto-grant owner or mutate schema at request time',()=>{
 const auth=fs.readFileSync('apps/inventory-tracker/src/server/inventory/auth.ts','utf8');assert.ok(!auth.includes('inventoryMember.create'));
 const schema=fs.readFileSync('apps/inventory-tracker/src/server/db/apply-turso-schema.ts','utf8');assert.ok(!schema.includes('executeMultiple'));
});
test('mutation proxy rejects foreign and absent origin; accepts same-origin; webhook exempt',()=>{
 const {NextRequest}=require('next/server');const proxy=harness().load('src/proxy.ts').proxy;
 for(const origin of ['https://evil.invalid',null]){const headers=origin?{origin}:{};assert.equal(proxy(new NextRequest('https://pk.example.test/api/contact',{method:'POST',headers})).status,403);}
 assert.equal(proxy(new NextRequest('https://pk.example.test/api/contact',{method:'POST',headers:{origin:'https://pk.example.test'}})).status,200);
 assert.equal(proxy(new NextRequest('https://pk.example.test/api/stripe/webhook',{method:'POST'})).status,200);
});
test('confidential routes configured no-store and reset links do not leak referrers',async()=>{
 const config=harness().load('next.config.ts').default;const headers=await config.headers();
 for(const source of ['/api/:path*','/portal/:path*','/admin/:path*','/b2b/:path*','/forgot-password'])assert.ok(headers.some(r=>r.source===source&&r.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('no-store'))));
 assert.ok(headers[0].headers.some(h=>h.key==='Referrer-Policy'&&h.value==='no-referrer'));
});
test('audit metadata drops free text/names and preserves operational codes',()=>{
 const h=harness();const audit=h.load('src/lib/security-log.ts').safeAuditMetadata({fileName:canary,notes:canary,email:canary,changes:{notes:canary},clientName:canary,action:'DOCUMENT_UPLOADED',requestId:'synthetic-request',size:123});
 assert.ok(!audit.includes(canary));assert.equal(JSON.parse(audit).action,'DOCUMENT_UPLOADED');assert.equal(JSON.parse(audit).size,123);
});
test('b2b rewrite cannot bypass anonymous page guard',()=>{
 const {NextRequest}=require('next/server');const proxy=harness().load('src/proxy.ts').proxy;
 assert.equal(proxy(new NextRequest('https://pk.example.test/b2b/documents')).status,307);
});
test('duplicate session cookies are denied',()=>{
 const a=harness().load('src/lib/auth.ts');const cookie='pk_business_session='+ 'a'.repeat(64)+'; pk_business_session='+ 'b'.repeat(64);assert.equal(a.getSessionTokenFromRequest(new Request('https://pk.example.test',{headers:{cookie}})),undefined);
});
test('AI activity does not persist prompts or free-text details',async()=>{
 const records=[];const h=harness({prisma:{aiActivityLog:{create:async input=>records.push(input)}}});await h.load('src/lib/ai/activity.ts').logAiActivity('synthetic-review','CHAT_MESSAGE',canary);assert.equal(records[0].data.detail,null);
});
test('production seed and schema utility restrictions are present',()=>{
 for(const p of ['scripts/seed-demo.ts','scripts/seed-security-test.ts'])assert.ok(fs.readFileSync(p,'utf8').includes('if (!localSyntheticSetupAllowed())'));
 for(const p of ['scripts/apply-schema-turso.ts','scripts/push-schema-if-turso.mjs'])assert.ok(fs.readFileSync(p,'utf8').includes('PK_ALLOW_SCHEMA_CHANGE'));
});
test('inactive context is used consistently by formerly divergent portal handlers',async()=>{
 for(const p of ['documents','dashboard','invoices','payments','requests/[id]']){
  const h=harness({mocks:{'@/lib/auth':{getSessionTokenFromRequest:()=> 'fixture',requireAuthContext:()=>{throw h.load('src/lib/api-error.ts').ApiError.unauthorized();}}}});
  const response=await h.load(`src/app/api/portal/${p}/route.ts`).GET(new Request('https://pk.example.test'),{params:Promise.resolve({id:'synthetic-request'})});assert.equal(response.status,401);
 }
});
test('rule review still completes locally with external AI key configured',async()=>{
 const ctx={engagement:{clientName:canary,engagementName:'Synthetic',period:'synthetic-year',status:'SUBMITTED'},financialExpectations:{quotedHours:null},workTracking:{hoursWorked:0,activeTimer:false},reviewState:{manualItemsCompleted:0,manualItemsTotal:0,manualFindingsOpen:0,clientQuestionsOpen:0,documentsLogged:0}};
 const h=harness({env:{ANTHROPIC_API_KEY:'synthetic-not-a-key'},mocks:{'@/lib/ai/context':{getEngagementContext:async()=>ctx},'@/lib/ai/activity':{logAiActivity:async()=>{}}},prisma:{aiReview:{findUnique:async()=>({id:'synthetic-review',status:'PENDING'}),update:async()=>{}},qbCleanupReview:{findUnique:async()=>null},aiFinding:{findMany:async()=>[]},aiScopeAlert:{findMany:async()=>[]}}});
 const result=await h.load('src/lib/ai/review-engine.ts').runInitialReview('synthetic-request','synthetic-user');assert.equal(result.engine,'rules');assert.equal(h.calls.length,0);assert.ok(result.summary.includes('Initial Review Summary'));
});
test('invoice notification transport and persisted record contain no invoice content',async()=>{
 const records=[],updates=[];
 const h=harness({env:{...prod,PK_EMAIL_ENVIRONMENT:'production',RESEND_API_KEY:'synthetic-not-a-key'},prisma:{notification:{create:async q=>{records.push(q);return {id:'synthetic-notification'};},update:async q=>updates.push(q)}},fetchMock:async()=>new Response('',{status:200})});
 const result=await h.load('src/lib/invoices.ts').deliverInvoiceNotification({userId:'synthetic-user',toEmail:'synthetic@example.test',invoiceNumber:canary,clientName:canary,totalCents:987654,dueAt:null,paymentTerms:canary,portalUrl:'https://evil.invalid/'+canary,isResend:false});
 assert.equal(result.delivered,true);assert.ok(!JSON.stringify(records).includes(canary));assert.ok(!h.calls[0][1].body.includes(canary));assert.ok(!h.calls[0][1].body.includes('9876.54'));assert.equal(updates[0].data.status,'SENT');
});
test('provider error contents do not enter notification or activity details',async()=>{
 const h=harness({env:{...prod,PK_EMAIL_ENVIRONMENT:'production',RESEND_API_KEY:'synthetic-not-a-key'},prisma:{notification:{create:async()=>({id:'synthetic'}),update:async()=>{}}},fetchMock:async()=>new Response(canary,{status:400})});
 const result=await h.load('src/lib/invoices.ts').deliverInvoiceNotification({userId:'synthetic-user',toEmail:'synthetic@example.test'});assert.equal(result.delivered,false);assert.ok(!JSON.stringify(result).includes(canary));
});
test('consultation persists before failed generic notification, with content-free errors',async()=>{
 const records=[];
 const h=harness({prisma:{intakeSubmission:{create:async q=>{records.push(q);return {id:'synthetic-intake'};}}},mocks:{'@/lib/contact-email':{sendContactEmail:async()=>{assert.equal(records.length,1);throw new Error(canary);}}}});
 const response=await h.load('src/app/api/contact/route.ts').POST(new Request('https://pk.example.test/api/contact',{method:'POST',body:JSON.stringify({fullName:'Synthetic',email:'synthetic@example.test',service:'not-sure',description:canary,contactMethod:'email'})}));
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.success,true);assert.equal(result.emailSent,false);assert.equal(records[0].data.description,canary);assert.ok(!JSON.stringify(h.logs).includes(canary));
});
test('logout verifies session user, revokes hashed session and audits actor',async()=>{
 let deleted,actor;const h=harness({env:prod,prisma:{session:{findUnique:async()=>session,deleteMany:async q=>{deleted=q.where.tokenHash;}},auditLog:{create:async q=>{actor=q.data.actorId;}}}});
 const response=await h.load('src/app/api/auth/logout/route.ts').POST(new Request('https://pk.example.test/api/auth/logout',{method:'POST',headers:{cookie:'pk_business_session='+ 'a'.repeat(64)}}));assert.equal(response.status,200);assert.notEqual(deleted,'a'.repeat(64));assert.equal(actor,user.id);assert.ok(response.headers.get('set-cookie').includes('Max-Age=0'));
});
test('inventory unprovisioned membership is denied without creating owner',async()=>{
 const h=harness({inventory:true,mocks:{'@/server/auth/session':{getSessionTokenFromRequest:()=> 'fixture',getSessionUser:async()=>user},'@/server/db/apply-turso-schema':{ensureTursoReady:async()=>{}}},prisma:{client:{findUnique:async()=>({id:'synthetic-client',status:'ACTIVE'})},inventoryMember:{findUnique:async()=>null,create:()=>{throw new Error('Unexpected privilege grant');}}}});
 await assert.rejects(()=>h.load('apps/inventory-tracker/src/server/inventory/auth.ts').requireInventoryContext(new Request('https://inventory.example.test')));
});
test('password reset refuses missing preview auth secret and uses a separate verifier domain',()=>{
 const preview=harness({env:{NODE_ENV:'production',PK_ENVIRONMENT:'preview'}}).load('src/lib/password-reset.ts');assert.throws(()=>preview.hashResetToken('synthetic-token'));
 const h=harness({env:prod});assert.equal(h.load('src/lib/password-reset.ts').hashResetToken('synthetic-token').length,64);
});
for(const [environment,mode,allowed] of [['production','live',true],['production','test',false],['preview','live',false],['preview','test',true],['test','live',false],['test','test',true]])test(`Stripe environment: ${environment}/${mode}`,()=>{
 const h=harness({env:{PK_ENVIRONMENT:environment,PK_STRIPE_ENVIRONMENT:environment,STRIPE_SECRET_KEY:`sk_${mode}_synthetic_not_a_key`,STRIPE_WEBHOOK_SECRET:'synthetic-not-a-secret'}});assert.equal(h.load('src/lib/invoices.ts').isStripeConfigured(),allowed);
});
test('Stripe declaration mismatch denies card availability and webhook before persistence',async()=>{
 const h=harness({env:{PK_ENVIRONMENT:'preview',PK_STRIPE_ENVIRONMENT:'production',STRIPE_SECRET_KEY:'sk_live_synthetic_not_a_key',STRIPE_WEBHOOK_SECRET:'synthetic-not-a-secret'}});assert.equal(h.load('src/lib/invoices.ts').isStripeConfigured(),false);assert.equal((await h.load('src/app/api/stripe/webhook/route.ts').POST(new Request('https://pk.example.test/api/stripe/webhook',{method:'POST',body:'{}'}))).status,503);
});
for(const endpoint of ['http://synthetic.r2.cloudflarestorage.com','https://evil.invalid','https://synthetic.r2.cloudflarestorage.com/?sensitive=synthetic'])test(`R2 rejects unapproved endpoint ${new URL(endpoint).protocol}/${new URL(endpoint).hostname}`,async()=>{
 let constructed=0;const h=harness({env:{R2_ACCOUNT_ID:'synthetic',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET_NAME:'synthetic',R2_ENDPOINT:endpoint},mocks:{'@aws-sdk/client-s3':{S3Client:class{constructor(){constructed++;}},PutObjectCommand:class{}}}});
 await assert.rejects(()=>h.load('src/lib/storage-r2.ts').r2Put('synthetic',Buffer.from('synthetic')));assert.equal(constructed,0);assert.equal(h.calls.length,0);
});
test('internal staff membership cannot bypass assignment through the client portal',async()=>{
 const h=harness({env:prod,prisma:{session:{findUnique:async()=>session},clientMember:{findMany:async()=>[{clientId:'synthetic-client',role:'OWNER',client:{status:'ACTIVE'}}]}}});assert.equal(await h.load('src/lib/auth.ts').getAuthContext('synthetic-token'),null);
});
