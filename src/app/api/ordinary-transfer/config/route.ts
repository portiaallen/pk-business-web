import { getTransferProvider, transferRequired } from '@/lib/ordinary-transfer/provider';
export function GET() {
    let available = false;
    try {
        getTransferProvider();
        available = true;
    }
    catch { /* no configuration disclosure */ }
    return Response.json({ available, required: transferRequired() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
