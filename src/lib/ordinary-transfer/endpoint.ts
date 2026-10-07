import { validOrdinaryBytes } from './file-policy';
import type { PrivateTransferStorage, TransferAuthority } from './contracts';
/** Standards-based transfer endpoint; adapters supply private storage, authority and digest primitives. */
export function createTransferEndpoint(storage: PrivateTransferStorage, authority: TransferAuthority, sha256: (bytes: Uint8Array) => Promise<string>, allowedOrigin: string) {
    return async function transfer(request: Request): Promise<Response> {
        const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin' };
        let token = '';
        let claimed = false;
        try {
            const url = new URL(request.url);
            if (url.search || url.hash || url.pathname !== '/transfer' || request.headers.get('origin') !== allowedOrigin)
                throw new Error();
            if (request.method === 'OPTIONS')
                return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '0' } });
            if (request.method !== 'POST')
                throw new Error();
            const authorization = request.headers.get('authorization') || '';
            if (!/^Bearer [A-Za-z0-9_-]{64}$/.test(authorization))
                throw new Error();
            token = authorization.slice(7);
            const lease = await authority.claim(token, allowedOrigin);
            claimed = true;
            if (lease.operation === 'DOWNLOAD') {
                const bytes = await storage.read(lease.key);
                if (!bytes || bytes.byteLength !== lease.size)
                    throw new Error();
                const state = await storage.stat(lease.key);
                if (!state || await sha256(bytes) !== state.digest)
                    throw new Error();
                await authority.auditDownload(token); // Current scope/state and mandatory audit before any response bytes.
                return new Response(bytes as BodyInit, { headers: { ...headers, 'Content-Type': lease.mime, 'Content-Disposition': 'attachment; filename="PK-document"' } });
            }
            if (lease.operation !== 'UPLOAD' || request.headers.get('content-type') !== lease.mime || !request.body)
                throw new Error();
            const length = request.headers.get('content-length');
            if (length && (!/^\d+$/.test(length) || Number(length) !== lease.size))
                throw new Error();
            const reader = request.body.getReader();
            const chunks: Uint8Array[] = [];
            let size = 0;
            for (;;) {
                const part = await reader.read();
                if (part.done)
                    break;
                size += part.value.length;
                if (size > lease.size || size > 25 * 1024 * 1024) {
                    await reader.cancel();
                    throw new Error();
                }
                chunks.push(part.value);
            }
            if (size !== lease.size)
                throw new Error();
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
            }
            if(!validOrdinaryBytes(bytes,lease.mime)) throw new Error();
            const state = { size, mime: lease.mime, digest: await sha256(bytes) };
            await storage.putIfAbsent(lease.key, bytes, state);
            await authority.finish(token, state); // Trusted provider receipt; reauthorization, no browser completion claim.
            return Response.json({ received: true }, { headers });
        }
        catch {
            if (claimed) {
                try {
                    await authority.fail(token);
                }
                catch { /* remains pending for reconciliation */ }
            }
            return Response.json({ error: 'Transfer unavailable' }, { status: 403, headers });
        }
    };
}
