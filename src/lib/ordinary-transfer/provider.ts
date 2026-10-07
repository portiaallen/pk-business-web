import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/api-error';
import { assertResourceEnvironment, isHostedRuntime, securityEnvironment } from '@/lib/security-environment';
import type { TransferProvider, ObjectState } from './contracts';
let synthetic: TransferProvider | undefined;
/** Disposable test injection only; no environment flag can install a hosted fake provider. */
export function installSyntheticTransferProvider(provider: TransferProvider | undefined) {
    if (isHostedRuntime() || !['test', 'development'].includes(securityEnvironment()) || process.env.NODE_ENV === 'production')
        throw ApiError.forbidden();
    synthetic = provider;
}
export function transferRequired() { return Boolean(process.env.NETLIFY || process.env.CONTEXT); }
function serviceConfiguration() {
    assertResourceEnvironment('STORAGE');
    let base: URL;
    try { base = new URL(process.env.PK_TRANSFER_ORIGIN || 'https://unconfigured.invalid'); } catch { throw new ApiError(503,'Secure transfer is not configured'); }
    if (!process.env.PK_TRANSFER_ORIGIN || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/')
        throw new ApiError(503, 'Secure transfer is not configured');
    const secret = process.env.PK_TRANSFER_SERVICE_SECRET;
    if (!secret || secret.length < 32)
        throw new ApiError(503, 'Secure transfer is not configured');
    return { origin: base.origin, secret };
}
export function requireTransferService(request: Request) {
    const { secret } = serviceConfiguration();
    const incoming = request.headers.get('authorization') || '';
    const digest = (text: string) => createHash('sha256').update(text).digest();
    if (!timingSafeEqual(digest(incoming), digest('Bearer ' + secret)))
        throw ApiError.unauthorized();
}
export function getTransferProvider(): TransferProvider {
    if (synthetic && !isHostedRuntime() && ['test', 'development'].includes(securityEnvironment()) && process.env.NODE_ENV !== 'production')
        return synthetic;
    const { origin, secret } = serviceConfiguration();
    async function control(operation: string, key: string) {
        try {
            const response = await fetch(origin + '/control', { method: 'POST', redirect: 'error', cache:'no-store', signal: AbortSignal.timeout(15000), headers: { 'authorization': 'Bearer ' + secret, 'content-type': 'application/json' }, body: JSON.stringify({ operation, key }) });
            if (!response.ok)
                throw new Error();
            const reader = response.body?.getReader();
            if (!reader)
                throw new Error();
            const chunks: Uint8Array[] = [];
            let size = 0;
            for (;;) {
                const part = await reader.read();
                if (part.done)
                    break;
                size += part.value.length;
                if (size > 8192) {
                    await reader.cancel();
                    throw new Error();
                }
                chunks.push(part.value);
            }
            return JSON.parse(Buffer.concat(chunks).toString()) as {
                state: ObjectState | null;
            };
        }
        catch {
            throw new ApiError(503, 'Secure transfer provider is unavailable');
        }
    }
    return { endpoint: origin + '/transfer', verifyObjectState: async (key) => {
            const { state } = await control('STATE', key);
            if (state !== null && (!Number.isSafeInteger(state?.size) || state.size < 1 || typeof state.mime !== 'string' || !/^[a-f0-9]{64}$/.test(state.digest)))
                throw new ApiError(503, 'Secure transfer verification failed');
            return state;
        }, requestDelete: async (key) => { await control('DELETE', key); } };
}
export function forbidNetlifyPayload() {
    if (transferRequired())
        throw new ApiError(409, 'Use the secure file transfer action');
}
