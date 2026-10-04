import { logSecurityEvent } from '@/lib/security-log';
import { requireTransferService } from '@/lib/ordinary-transfer/provider';
import { claim, finish, fail, auditDownload, reconcileIntent } from '@/lib/ordinary-transfer/service';
import { smallJSON } from '@/lib/ordinary-transfer/json';
import { ApiError, handleApiError } from '@/lib/api-error';
import { z } from 'zod';
const input = z.object({ action: z.enum(['CLAIM', 'FINISH', 'FAIL', 'DOWNLOAD_AUDIT', 'RECONCILE']), token: z.string().regex(/^[A-Za-z0-9_-]{64}$/).optional(), origin: z.string().max(200).optional(), intentId: z.string().uuid().optional(), state: z.object({ size: z.number().int().positive().max(25 * 1024 * 1024), mime: z.string().max(120), digest: z.string().regex(/^[a-f0-9]{64}$/) }).optional() }).strict();
export async function POST(request: Request) {
    try {
        requireTransferService(request); // Independent service authentication before parsing or DB access.
        const parsed = input.safeParse(await smallJSON(request));
        if (!parsed.success)
            throw ApiError.badRequest();
        const data = parsed.data;
        if (data.action === 'RECONCILE') {
            if (!data.intentId)
                throw ApiError.badRequest();
            await reconcileIntent(data.intentId);
        }
        else {
            if (!data.token)
                throw ApiError.badRequest();
            if (data.action === 'CLAIM') {
                if (!data.origin)
                    throw ApiError.badRequest();
                return Response.json(await claim(data.token, data.origin), { headers: { 'Cache-Control': 'private, no-store' } });
            }
            if (data.action === 'FINISH') {
                if (!data.state)
                    throw ApiError.badRequest();
                await finish(data.token, data.state);
            }
            if (data.action === 'FAIL')
                await fail(data.token);
            if (data.action === 'DOWNLOAD_AUDIT')
                await auditDownload(data.token);
        }
        return Response.json({ accepted: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        logSecurityEvent('TRANSFER_FAILURE');
        return handleApiError(error);
    }
}
