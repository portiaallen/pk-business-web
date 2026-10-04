import { logSecurityEvent } from '@/lib/security-log';
import { getSessionUser, getSessionTokenFromRequest } from '@/lib/auth';
import { ApiError } from '@/lib/api-error';
import { createIntent } from '@/lib/ordinary-transfer/service';
import { smallJSON } from '@/lib/ordinary-transfer/json';
import { handleApiError } from '@/lib/api-error';
export async function POST(request: Request) {
    try {
        if (!await getSessionUser(getSessionTokenFromRequest(request)))
            throw ApiError.unauthorized();
        return Response.json(await createIntent(request, await smallJSON(request)), { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    catch (error) {
        logSecurityEvent('TRANSFER_FAILURE');
        return handleApiError(error);
    }
}
