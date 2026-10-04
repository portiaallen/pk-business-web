import { ApiError } from '@/lib/api-error';
/** Control-plane JSON only; never accept binary/multipart on application transfer endpoints. */
export async function smallJSON(request: Request): Promise<unknown> {
    if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body)
        throw ApiError.badRequest('JSON metadata required');
    const reader = request.body.getReader();
    let length = 0;
    const parts: Uint8Array[] = [];
    for (;;) {
        const part = await reader.read();
        if (part.done)
            break;
        length += part.value.length;
        if (length > 8192) {
            await reader.cancel();
            throw new ApiError(413, 'Transfer metadata exceeds limit');
        }
        parts.push(part.value);
    }
    try {
        return JSON.parse(Buffer.concat(parts).toString());
    }
    catch {
        throw ApiError.badRequest('Invalid JSON metadata');
    }
}
