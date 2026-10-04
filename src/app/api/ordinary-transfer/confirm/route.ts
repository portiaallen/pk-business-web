import { logSecurityEvent } from '@/lib/security-log';
import { confirmUpload } from '@/lib/ordinary-transfer/service';
import { smallJSON } from '@/lib/ordinary-transfer/json';
import { ApiError, handleApiError } from '@/lib/api-error';
export async function POST(request: Request) {
    try {
        const input = await smallJSON(request) as {
            intentId?: string;
        };
        if (typeof input.intentId !== 'string')
            throw ApiError.badRequest();
        return Response.json(await confirmUpload(request, input.intentId), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        logSecurityEvent('TRANSFER_FAILURE');
        return handleApiError(error);
    }
}
