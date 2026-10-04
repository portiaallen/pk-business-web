// Synthetic disposable SQLite and private memory objects only. No external transports.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
const root = mkdtempSync(join(tmpdir(), 'pk-transfer-synthetic-'));
for (const key of ['NETLIFY', 'CONTEXT', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'GMAIL_APP_PASSWORD', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY', 'PK_TRANSFER_ORIGIN', 'PK_TRANSFER_SERVICE_SECRET'])
    delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', PK_ENVIRONMENT: 'test', PK_AUTH_ENVIRONMENT: 'test', AUTH_SECRET: 'synthetic-only-transfer-secret', DATABASE_URL: `file:${join(root, 'test.db')}` });
const baselineSchema = join(root, 'baseline.prisma');
writeFileSync(baselineSchema, execFileSync('git', ['show', 'bb43bafc3a1a92c2be847e5df77394c93b0b8c32:prisma/schema.prisma']));
const sqlite = new Database(join(root, 'test.db'));
sqlite.exec(execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const { prisma } = await import('../src/lib/prisma');
const auth = await import('../src/lib/auth');
const service = await import('../src/lib/ordinary-transfer/service');
const providers = await import('../src/lib/ordinary-transfer/provider');
const { createTransferEndpoint } = await import('../src/lib/ordinary-transfer/endpoint');
const { safeReturnTo, publicError, safeOrigin } = await import('../src/lib/url-privacy');
const { installSafeRuntimeConsole } = await import('../src/lib/runtime-log');
const { safeAuditMetadata } = await import('../src/lib/security-log');
const { smallJSON } = await import('../src/lib/ordinary-transfer/json');
const origin = 'https://pk-synthetic.example.test';
const tokens: Record<string, string> = {};
for (const id of ['staff', 'admin', 'support', 'entry', 'client']) {
    await prisma.user.create({ data: { id, name: 'Synthetic', email: id + '@example.test', role: id === 'client' ? 'CLIENT' : id === 'admin' ? 'ADMIN' : 'STAFF', passwordHash: 'synthetic' } });
    tokens[id] = await auth.createSession(id, id === 'client' ? 'PASSWORD' : 'WEBAUTHN');
    await prisma.session.updateMany({ where: { userId: id }, data: { activeClientId: 'one' } });
}
for (const id of ['one', 'two', 'inactive'])
    await prisma.client.create({ data: { id, name: 'Synthetic', status: id === 'inactive' ? 'INACTIVE' : 'ACTIVE' } });
await prisma.service.create({ data: { id: 'service', slug: 'synthetic', name: 'Synthetic', shortName: 'Synthetic', description: 'Synthetic', shortDescription: 'Synthetic', priceDisplay: '$1', priceCents: 100 } });
for (const [id, clientId] of [['request', 'one'], ['other', 'one'], ['cross', 'two'], ['inactive-request', 'inactive']])
    await prisma.verificationRequest.create({ data: { id, clientId, serviceId: 'service', requestType: 'Synthetic' } });
await prisma.clientMember.create({ data: { clientId: 'one', userId: 'client', role: 'OWNER' } });
for (const id of ['staff', 'admin'])
    for (const capability of ['confidential_access', 'bookkeeping', 'disposal'])
        await prisma.capabilityGrant.create({ data: { userId: id, capability, scope: 'REQUEST', clientId: 'one', requestId: 'request' } });
const objects = new Map<string, {
    bytes: Uint8Array;
    state: {
        size: number;
        mime: string;
        digest: string;
    };
}>();
const tombstones = new Set<string>();
let deletionFails = false;
const storage = { async putIfAbsent(key: string, bytes: Uint8Array, state: {
        size: number;
        mime: string;
        digest: string;
    }) { if (objects.has(key) || tombstones.has(key))
        throw Error('Unavailable'); objects.set(key, { bytes, state }); }, async read(key: string) { return objects.get(key)?.bytes || null; }, async stat(key: string) { return objects.get(key)?.state || null; }, async remove(key: string) { if (deletionFails)
        throw Error('Synthetic outage'); tombstones.add(key); objects.delete(key); } };
providers.installSyntheticTransferProvider({ endpoint: 'https://transfer-synthetic.example.test/transfer', verifyObjectState: storage.stat, requestDelete: storage.remove });
const digest = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const endpoint = createTransferEndpoint(storage, service, digest, origin);
function request(id = 'staff') { return new Request(origin + '/api/ordinary-transfer', { method: 'POST', headers: { origin, cookie: 'pk_business_session=' + (tokens[id] || 'invalid') } }); }
const input = { operation: 'UPLOAD', kind: 'DOCUMENT', requestId: 'request', size: 4, mime: 'text/plain', fileName: 'SYNTHETIC_CONFIDENTIAL_NAME.txt' };
async function intent(overrides: object = {}, id = 'staff') { return service.createIntent(request(id), { ...input, ...overrides }); }
async function transfer(grant: Awaited<ReturnType<typeof intent>>, bytes = new Uint8Array([65, 66, 67, 68]), mime = 'text/plain') {
    assert.ok('authorization' in grant);
    return endpoint(new Request('https://transfer-synthetic.example.test/transfer', { method: 'POST', headers: { origin, authorization: grant.authorization!, 'content-type': mime }, body: bytes as BodyInit }));
}
async function uploaded() { const grant = await intent(); assert.equal((await transfer(grant)).status, 200); const doc = await service.confirmUpload(request(), grant.intentId); return { grant, doc }; }
after(async () => { await prisma.$disconnect(); sqlite.close(); rmSync(root, { recursive: true, force: true }); });
test('anonymous intent denied', async () => { await assert.rejects(() => intent({}, 'anonymous')); });
test('unassigned staff denied', async () => { await assert.rejects(() => intent({}, 'support')); });
test('ADMIN is not global authority', async () => { await assert.rejects(() => intent({ requestId: 'other' }, 'admin')); });
test('inactive client denied', async () => { await assert.rejects(() => intent({ requestId: 'inactive-request' })); });
test('cross-client intent denied', async () => { await assert.rejects(() => intent({ requestId: 'cross' })); });
test('wrong engagement denied', async () => { await assert.rejects(() => intent({ requestId: 'other' })); });
test('DATA ENTRY boundary', async () => { await assert.rejects(() => intent({}, 'entry')); });
test('25 MiB plus one rejected', async () => { await assert.rejects(() => intent({ size: 25 * 1024 * 1024 + 1 })); });
test('MIME policy rejects executable', async () => { await assert.rejects(() => intent({ mime: 'application/x-executable' })); });
test('arbitrary object injection rejected', async () => { await assert.rejects(() => intent({ objectKey: 'attacker' })); });
test('preview/origin confusion denied', async () => { await assert.rejects(() => service.createIntent(new Request(origin + '/api/ordinary-transfer', { headers: { origin: 'https://evil.example.test', cookie: 'pk_business_session=' + tokens.staff } }), input)); });
test('expired intent rejected', async () => { const grant = await intent(); await prisma.ordinaryTransferIntent.update({ where: { id: grant.intentId }, data: { expiresAt: new Date(0) } }); assert.equal((await transfer(grant)).status, 403); });
test('single-use replay denied', async () => { const grant = await intent(); assert.equal((await transfer(grant)).status, 200); assert.equal((await transfer(grant)).status, 403); });
test('body MIME mismatch denied', async () => { assert.equal((await transfer(await intent(), undefined, 'application/pdf')).status, 403); });
test('interrupted short upload denied', async () => { assert.equal((await transfer(await intent(), new Uint8Array(3))).status, 403); });
test('oversized stream denied', async () => { assert.equal((await transfer(await intent(), new Uint8Array(5))).status, 403); });
test('browser completion cannot create metadata', async () => { const grant = await intent(); await assert.rejects(() => service.confirmUpload(request(), grant.intentId)); });
test('opaque identifiers and sanitized filenames', async () => { const grant = await intent({ fileName: '../../SYNTHETIC\r\nname.txt' }); const row = await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id: grant.intentId } }); assert.match(row.objectKey, /^[a-f0-9-]{36}$/); assert.equal(row.fileName, 'SYNTHETIC__name.txt'); assert.ok(!row.tokenHash.includes('authorization' in grant ? (grant.authorization || '').slice(7) : 'impossible')); });
test('metadata confirmation verified once', async () => { const { grant, doc } = await uploaded(); assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).fileSizeBytes, 4); await assert.rejects(() => service.confirmUpload(request(), grant.intentId)); });
test('revoked session cannot consume intent', async () => { const grant = await intent({}, 'admin'); await prisma.session.deleteMany({ where: { userId: 'admin' } }); assert.equal((await transfer(grant)).status, 403); tokens.admin = await auth.createSession('admin', 'WEBAUTHN'); await prisma.session.updateMany({ where: { userId: 'admin' }, data: { activeClientId: 'one' } }); });
test('permission revocation prevents completion', async () => { const grant = await intent(); await transfer(grant); await prisma.capabilityGrant.deleteMany({ where: { userId: 'staff', capability: 'confidential_access' } }); await assert.rejects(() => service.confirmUpload(request(), grant.intentId)); await prisma.capabilityGrant.create({ data: { userId: 'staff', capability: 'confidential_access', scope: 'REQUEST', clientId: 'one', requestId: 'request' } }); });
test('download authorization and pre-delivery audit', async () => { const { doc } = await uploaded(); const grant = await intent({ operation: 'DOWNLOAD', resourceId: doc.id }); const response = await transfer(grant); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); const row = await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id: grant.intentId } }); assert.equal(row.status, 'COMPLETE'); assert.equal((await response.arrayBuffer()).byteLength, 4); assert.equal((await transfer(grant)).status, 403); });
test('cross-client download denied', async () => { const { doc } = await uploaded(); await prisma.session.updateMany({ where: { userId: 'staff' }, data: { activeClientId: 'two' } }); await assert.rejects(() => intent({ operation: 'DOWNLOAD', resourceId: doc.id })); await prisma.session.updateMany({ where: { userId: 'staff' }, data: { activeClientId: 'one' } }); });
test('expired download denied', async () => { const { doc } = await uploaded(); const grant = await intent({ operation: 'DOWNLOAD', resourceId: doc.id }); await prisma.ordinaryTransferIntent.update({ where: { id: grant.intentId }, data: { expiresAt: new Date(0) } }); assert.equal((await transfer(grant)).status, 403); });
test('legal hold blocks deletion', async () => { const { doc } = await uploaded(); await prisma.document.update({ where: { id: doc.id }, data: { ordinaryLegalHold: true } }); await assert.rejects(() => intent({ operation: 'DELETE', resourceId: doc.id }, 'admin')); });
test('deletion failure remains pending and revokes access', async () => { const { doc } = await uploaded(); deletionFails = true; const grant = await intent({ operation: 'DELETE', resourceId: doc.id }, 'admin'); assert.equal((await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id: grant.intentId } })).status, 'DELETE_PENDING'); await assert.rejects(() => intent({ operation: 'DOWNLOAD', resourceId: doc.id })); deletionFails = false; await service.reconcileIntent(grant.intentId); const row = await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id: grant.intentId } }); assert.equal(row.status, 'DELETE_COMPLETE'); assert.equal(await storage.stat(row.objectKey), null); await assert.rejects(() => storage.putIfAbsent(row.objectKey, new Uint8Array(4), { size: 4, mime: 'text/plain', digest: '0'.repeat(64) })); });
test('ambiguous client fails closed', async () => { await prisma.clientMember.create({ data: { clientId: 'two', userId: 'client', role: 'OWNER' } }); await prisma.session.updateMany({ where: { userId: 'client' }, data: { activeClientId: null } }); await assert.rejects(() => intent({}, 'client')); });
test('25 MiB bytes bypass application control requests', async () => { const bytes = new Uint8Array(25 * 1024 * 1024).fill(65); const metadata = { ...input, size: bytes.length }; assert.ok(JSON.stringify(metadata).length < 8192); const grant = await service.createIntent(request(), metadata); assert.equal((await transfer(grant, bytes)).status, 200); assert.ok(JSON.stringify({ intentId: grant.intentId }).length < 8192); const doc = await service.confirmUpload(request(), grant.intentId); assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).fileSizeBytes, bytes.length); });
test('small metadata reader blocks payload path', async () => { await assert.rejects(() => smallJSON(new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'A'.repeat(8193) }))); });
test('audit metadata excludes filenames URLs tokens', () => { const result = safeAuditMetadata({ action: 'TRANSFER_DOWNLOAD', fileName: 'SYNTHETIC_CONFIDENTIAL_NAME', url: 'https://x.test/?token=secret', token: 'secret' }); assert.equal(result, '{"action":"TRANSFER_DOWNLOAD"}'); });
test('runtime console suppresses signed URL and filenames', () => { const out: string[] = []; const fake = { log: (x: unknown) => out.push(String(x)), info: (x: unknown) => out.push(String(x)), warn: (x: unknown) => out.push(String(x)), error: (x: unknown) => out.push(String(x)), debug: (x: unknown) => out.push(String(x)) }; const restore = installSafeRuntimeConsole(fake); for (const value of ['https://x.test/file?X-Amz-Signature=CANARY', 'password-reset?token=CANARY', 'SYNTHETIC_CONFIDENTIAL_NAME', new Error('https://provider.test/?key=CANARY')])
    fake.error(value); restore(); assert.ok(!out.join('').includes('CANARY')); assert.ok(!out.join('').includes('SYNTHETIC')); });
for (const path of ['//evil.test', '/\\evil.test', '/portal/%2f%2fevil.test', '/portal/%252fadmin', '/portal/../public', 'https://evil.test', '/portal/%0aevil'])
    test('returnTo rejects ' + path, () => assert.equal(safeReturnTo(path), null));
test('returnTo strips credential query and fragments', () => assert.equal(safeReturnTo('/portal/dashboard?token=CANARY#secret'), '/portal/dashboard'));
test('provider errors with sensitive URL suppressed', () => assert.equal(publicError('Provider failed https://x.test/file?token=CANARY'), 'Operation unavailable. Please retry.'));
test('origin rejects userinfo/query/qualification confusion', () => { for (const value of ['https://secret@x.test', 'https://x.test/?token=secret', 'https://x.test/path'])
    assert.throws(() => safeOrigin(value)); });
test('new reset links use fragment, never query', () => assert.match(readFileSync('src/lib/password-reset.ts', 'utf8'), /forgot-password#token=/));
test('audit outage blocks download bytes', async () => { const { doc } = await uploaded(); const grant = await intent({ operation: 'DOWNLOAD', resourceId: doc.id }); sqlite.exec(`CREATE TRIGGER audit_outage BEFORE INSERT ON AuditLog WHEN NEW.metadata LIKE '%TRANSFER_DOWNLOAD%' BEGIN SELECT RAISE(ABORT,'Synthetic audit outage'); END;`); try {
    const res = await transfer(grant);
    assert.equal(res.status, 403);
    assert.ok(!(await res.text()).includes('ABCD'));
}
finally {
    sqlite.exec('DROP TRIGGER audit_outage');
} });
test('simultaneous claim admits only one use', async () => { const grant = await intent(); const results = await Promise.all([transfer(grant), transfer(grant)]); assert.equal(results.filter(x => x.status === 200).length, 1); });
test('permission change after claim blocks byte delivery', async () => { const { doc } = await uploaded(); const grant = await intent({ operation: 'DOWNLOAD', resourceId: doc.id }); assert.ok(grant.authorization); const token = grant.authorization!.slice(7); await service.claim(token, origin); await prisma.user.update({ where: { id: 'staff' }, data: { securityVersion: { increment: 1 } } }); await assert.rejects(() => service.auditDownload(token)); tokens.staff = await auth.createSession('staff', 'WEBAUTHN'); await prisma.session.updateMany({ where: { userId: 'staff' }, data: { activeClientId: 'one' } }); });
test('provider outage never produces metadata', async () => { const grant = await intent(); await transfer(grant); providers.installSyntheticTransferProvider({ endpoint: 'https://transfer-synthetic.example.test/transfer', async verifyObjectState() { throw Error('https://synthetic.invalid/?token=CANARY'); }, requestDelete: storage.remove }); await assert.rejects(() => service.confirmUpload(request(), grant.intentId)); providers.installSyntheticTransferProvider({ endpoint: 'https://transfer-synthetic.example.test/transfer', verifyObjectState: storage.stat, requestDelete: storage.remove }); });
test('SQL artifact applies only to disposable baseline', () => { const db = new Database(':memory:'); try {
    db.exec(execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', baselineSchema, '--script'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    db.exec(readFileSync('prisma/security-migrations/ordinary-transfer.sql', 'utf8'));
    assert.ok((db.prepare('PRAGMA table_info(Document)').all() as {
        name: string;
    }[]).some(x => x.name === 'transferDeleteState'));
    assert.ok((db.prepare('PRAGMA table_info(OrdinaryTransferIntent)').all() as {
        name: string;
    }[]).some(x => x.name === 'tokenHash'));
}
finally {
    db.close();
} });
test('actual browser upload helper sends 25 MiB only to transfer origin', async () => {
    const { uploadOrdinaryFile } = await import('../src/lib/ordinary-transfer/client');
    const original = globalThis.fetch;
    const appBodies: number[] = [];
    let providerBytes = 0;
    globalThis.fetch = async (url, init) => {
        const path = String(url);
        if (path === '/api/ordinary-transfer/config')
            return Response.json({ available: true, required: true });
        if (path === 'https://transfer-synthetic.example.test/transfer') {
            assert.ok(init?.body instanceof File);
            providerBytes = init.body.size;
            const headers = new Headers(init.headers);
            headers.set('origin', origin);
            return endpoint(new Request(path, { ...init, headers }));
        }
        assert.equal(typeof init?.body, 'string');
        appBodies.push(String(init?.body).length);
        const headers = new Headers(init?.headers);
        headers.set('origin', origin);
        headers.set('cookie', 'pk_business_session=' + tokens.staff);
        const req = new Request(origin + path, { ...init, headers });
        const body = await smallJSON(req) as {
            intentId: string;
        };
        if (path === '/api/ordinary-transfer')
            return Response.json(await service.createIntent(req, body));
        if (path === '/api/ordinary-transfer/confirm')
            return Response.json(await service.confirmUpload(req, body.intentId));
        throw Error('Unexpected destination');
    };
    try {
        const form = new FormData();
        form.set('file', new File([new Uint8Array(25 * 1024 * 1024).fill(65)], 'SYNTHETIC.txt', { type: 'text/plain' }));
        form.set('requestId', 'request');
        form.set('category', 'OTHER');
        const res = await uploadOrdinaryFile('/api/portal/documents/upload', form);
        assert.equal(res.status, 200);
        assert.equal(providerBytes, 25 * 1024 * 1024);
        assert.equal(appBodies.length, 2);
        assert.ok(appBodies.every(x => x < 8192));
    }
    finally {
        globalThis.fetch = original;
    }
});
test('Netlify missing adapter never falls back to multipart', async () => { const { uploadOrdinaryFile } = await import('../src/lib/ordinary-transfer/client'); const original = globalThis.fetch; let requests = 0; globalThis.fetch = async () => { requests++; return Response.json({ available: false, required: true }); }; try {
    await assert.rejects(() => uploadOrdinaryFile('/api/portal/documents/upload', new FormData()));
    assert.equal(requests, 1);
}
finally {
    globalThis.fetch = original;
} });
test('25 MiB download bypasses PK body response', async () => { const bytes = new Uint8Array(25 * 1024 * 1024).fill(65); const upload = await intent({ size: bytes.length }); assert.equal((await transfer(upload, bytes)).status, 200); const doc = await service.confirmUpload(request(), upload.intentId); const grant = await intent({ operation: 'DOWNLOAD', resourceId: doc.id }); const response = await transfer(grant); assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, bytes.length); });
test('external authority RPC accepts only bounded metadata and hides errors',async()=>{const {createHTTPAuthority}=await import('../src/lib/ordinary-transfer/authority-http');let requests=0;const authority=createHTTPAuthority(origin,'synthetic-only-service-secret-of-sufficient-length',async(_url,init)=>{requests++;assert.ok(String(init?.body).length<8192);throw Error('https://provider.invalid/?token=SYNTHETIC_CANARY');});await assert.rejects(()=>authority.claim('A'.repeat(64),origin),{message:'Transfer authority unavailable'});assert.equal(requests,1);});
test('declared PDF with binary spoof rejected',async()=>{const grant=await intent({mime:'application/pdf',fileName:'SYNTHETIC.pdf'});assert.equal((await transfer(grant,new Uint8Array([65,66,67,68]),'application/pdf')).status,403);});
test('expired failed upload is reconciled with fenced storage deletion',async()=>{const grant=await intent();await transfer(grant);await prisma.ordinaryTransferIntent.update({where:{id:grant.intentId},data:{expiresAt:new Date(0)}});await service.reconcileIntent(grant.intentId);const row=await prisma.ordinaryTransferIntent.findUniqueOrThrow({where:{id:grant.intentId}});assert.equal(row.status,'EXPIRED');assert.equal(await storage.stat(row.objectKey),null);await assert.rejects(()=>transfer(grant).then(res=>{assert.equal(res.status,200);}));});
test('remote protocol round trip separates metadata from private bytes',async()=>{
 const {createHTTPAuthority}=await import('../src/lib/ordinary-transfer/authority-http');const {createControlEndpoint}=await import('../src/lib/ordinary-transfer/control-endpoint');const api=await import('../src/app/api/ordinary-transfer/internal/route');const original=globalThis.fetch;
 const secret='synthetic-only-remote-service-secret-12345';Object.assign(process.env,{PK_TRANSFER_ORIGIN:'https://transfer-synthetic.example.test',PK_TRANSFER_SERVICE_SECRET:secret,PK_STORAGE_ENVIRONMENT:'test'});
 const control=createControlEndpoint(storage,secret,digest);const sizes:number[]=[];
 globalThis.fetch=async(url,init)=>{sizes.push(String(init?.body).length);const req=new Request(String(url),init);if(String(url).endsWith('/control'))return control(req);if(String(url).endsWith('/api/ordinary-transfer/internal'))return api.POST(req);throw Error('Prohibited destination');};
 providers.installSyntheticTransferProvider(undefined);
 try{const remoteAuthority=createHTTPAuthority(origin,secret);const remoteEndpoint=createTransferEndpoint(storage,remoteAuthority,digest,origin);const grant=await intent();const res=await remoteEndpoint(new Request('https://transfer-synthetic.example.test/transfer',{method:'POST',headers:{origin,authorization:grant.authorization!,'content-type':'text/plain'},body:new Uint8Array([65,66,67,68])}));assert.equal(res.status,200);await service.confirmUpload(request(),grant.intentId);assert.ok(sizes.every(size=>size<8192));const denied=await control(new Request('https://transfer-synthetic.example.test/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'STATE',key:'arbitrary'})}));assert.equal(denied.status,403);}finally{globalThis.fetch=original;providers.installSyntheticTransferProvider({endpoint:'https://transfer-synthetic.example.test/transfer',verifyObjectState:storage.stat,requestDelete:storage.remove});delete process.env.PK_TRANSFER_ORIGIN;delete process.env.PK_TRANSFER_SERVICE_SECRET;delete process.env.PK_STORAGE_ENVIRONMENT;}
});
test('anonymous and unassigned download intent denied',async()=>{const {doc}=await uploaded();for(const id of ['anonymous','support','entry'])await assert.rejects(()=>intent({operation:'DOWNLOAD',resourceId:doc.id},id));});
test('previously issued download fails after verified disposal',async()=>{const {doc}=await uploaded();const download=await intent({operation:'DOWNLOAD',resourceId:doc.id});await intent({operation:'DELETE',resourceId:doc.id},'admin');assert.equal((await transfer(download)).status,403);await assert.rejects(()=>intent({operation:'DOWNLOAD',resourceId:doc.id}));});
test('concurrent upload confirmation creates one record',async()=>{const grant=await intent();await transfer(grant);const results=await Promise.allSettled([service.confirmUpload(request(),grant.intentId),service.confirmUpload(request(),grant.intentId)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);});
test('hosted qualification origin cannot issue grant for another host', async () => {
  Object.assign(process.env,{NETLIFY:'true',CONTEXT:'deploy-preview',PK_ENVIRONMENT:'preview',PK_AUTH_ENVIRONMENT:'preview',PK_STORAGE_ENVIRONMENT:'preview',PK_WEBAUTHN_ORIGIN:'https://qualification.example.test',PK_TRANSFER_ORIGIN:'https://transfer-synthetic.example.test',PK_TRANSFER_SERVICE_SECRET:'synthetic-qualification-only-service-secret'});
  try {
    await assert.rejects(()=>intent(),(error:unknown)=>Boolean(error && typeof error==='object' && 'statusCode' in error && error.statusCode===403));
    // Positive control: same synthetic identity/database, correct declared origin, no provider network.
    const qualified=new Request('https://qualification.example.test/api/ordinary-transfer',{method:'POST',headers:{origin:'https://qualification.example.test',cookie:'pk_business_session='+tokens.staff}});
    const grant=await service.createIntent(qualified,input);
    assert.ok(grant.authorization);
  } finally {
    for(const key of ['NETLIFY','CONTEXT','PK_WEBAUTHN_ORIGIN','PK_TRANSFER_ORIGIN','PK_TRANSFER_SERVICE_SECRET','PK_STORAGE_ENVIRONMENT'])delete process.env[key];
    process.env.PK_ENVIRONMENT='test';process.env.PK_AUTH_ENVIRONMENT='test';
  }
});
test('reset preview origin must match explicit qualification origin',async()=>{const {getSiteOrigin}=await import('../src/lib/password-reset');Object.assign(process.env,{NETLIFY:'true',CONTEXT:'deploy-preview',PK_ENVIRONMENT:'preview',NEXT_PUBLIC_SITE_URL:'https://production.example.test',PK_WEBAUTHN_ORIGIN:'https://qualification.example.test'});try{assert.throws(()=>getSiteOrigin());process.env.NEXT_PUBLIC_SITE_URL='https://qualification.example.test';assert.equal(getSiteOrigin(),'https://qualification.example.test');}finally{for(const key of ['NETLIFY','CONTEXT','NEXT_PUBLIC_SITE_URL','PK_WEBAUTHN_ORIGIN'])delete process.env[key];process.env.PK_ENVIRONMENT='test';}});
test('disposable qualification provider listens only locally and denies untrusted control',async()=>{
 const child=spawn(process.execPath,['--import','tsx','scripts/synthetic-transfer-server.mts'],{env:{NODE_ENV:'test',PATH:process.env.PATH,PK_ENVIRONMENT:'test',PK_TRANSFER_SYNTHETIC_ONLY:'true',PK_TRANSFER_SYNTHETIC_APP_ORIGIN:'https://pk-qualification-synthetic.netlify.app',PK_TRANSFER_SERVICE_SECRET:'synthetic-service-key-not-a-real-credential',PK_TRANSFER_SYNTHETIC_PORT:'4352'},stdio:['ignore','pipe','pipe']});
 try{await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Synthetic provider did not start')),10000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve();});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Synthetic provider stopped'));});});const res=await fetch('http://127.0.0.1:4352/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'STATE',key:'synthetic'})});assert.equal(res.status,403);assert.match(res.headers.get('cache-control')!,/no-store/);}finally{child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});}
});
test('authorized fresh session can resume pending deletion without stale-session reuse',async()=>{const {doc}=await uploaded();deletionFails=true;const old=await intent({operation:'DELETE',resourceId:doc.id},'admin');deletionFails=false;await prisma.session.deleteMany({where:{userId:'admin'}});await assert.rejects(()=>service.reconcileIntent(old.intentId));tokens.admin=await auth.createSession('admin','WEBAUTHN');await prisma.session.updateMany({where:{userId:'admin'},data:{activeClientId:'one'}});const next=await intent({operation:'DELETE',resourceId:doc.id},'admin');assert.equal(next.status,'DELETE_COMPLETE');assert.equal((await prisma.ordinaryTransferIntent.findUniqueOrThrow({where:{id:old.intentId}})).status,'DELETE_SUPERSEDED');});
