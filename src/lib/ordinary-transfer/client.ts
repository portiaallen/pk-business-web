/** Browser holds only a short-lived one-operation grant, never storage/service credentials. */
async function configuration() {
    const response = await fetch('/api/ordinary-transfer/config', { cache: 'no-store' });
    if (!response.ok)
        throw new Error('Secure transfer unavailable');
    const config = await response.json() as {
        available: boolean;
        required: boolean;
    };
    if (config.required && !config.available)
        throw new Error('Secure transfer unavailable');
    return config;
}
async function issue(body: object) {
    const response = await fetch('/api/ordinary-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!response.ok)
        throw new Error('Transfer authorization unavailable');
    return response.json() as Promise<{
        intentId: string;
        endpoint: string;
        authorization: string;
        mime: string;
    }>;
}
function endpoint(value: string) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/transfer')
        throw new Error('Invalid transfer endpoint');
    return url.toString();
}
export async function uploadOrdinaryFile(legacyUrl: string, form: FormData) {
    const config = await configuration();
    if (!config.available)
        return fetch(legacyUrl, { method: 'POST', body: form }); // Vercel/local behavior preserved.
    const file = form.get('file');
    if (!(file instanceof File))
        throw new Error('Choose a file');
    const requestId = String(form.get('requestId') || legacyUrl.split('/')[4]);
    const kind = legacyUrl.includes('/admin/') ? 'DELIVERABLE' : 'DOCUMENT';
    const grant = await issue({ operation: 'UPLOAD', kind, requestId, size: file.size, mime: file.type, fileName: file.name, ...(kind === 'DELIVERABLE' ? { title: form.get('title') } : { category: form.get('category') || 'OTHER', ...(form.get('documentRequestId') ? { documentRequestId: form.get('documentRequestId') } : {}) }) });
    const transfer = await fetch(endpoint(grant.endpoint), { method: 'POST', credentials: 'omit', headers: { 'Authorization': grant.authorization, 'Content-Type': file.type }, body: file, cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error' });
    if (!transfer.ok)
        throw new Error('File transfer unavailable');
    // Browser completion is not evidence; PK separately verifies private provider state.
    return fetch('/api/ordinary-transfer/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: grant.intentId }), cache: 'no-store' });
}
function documentTarget(path: string) {
    const parts = path.split('/');
    const isDeliverable = parts.includes('deliverables');
    if (!/^\/api\/(portal|admin)\//.test(path) || /[?#\\]/.test(path))
        throw new Error('Invalid document action');
    return { kind: isDeliverable ? 'DELIVERABLE' : 'DOCUMENT', resourceId: parts.at(-1), ...(isDeliverable ? { requestId: parts[4] } : {}) };
}
export async function downloadOrdinaryFile(path: string) {
    const config = await configuration();
    if (!config.available) {
        window.location.assign(path);
        return;
    }
    const grant = await issue({ operation: 'DOWNLOAD', ...documentTarget(path) });
    const response = await fetch(endpoint(grant.endpoint), { method: 'POST', credentials: 'omit', headers: { 'Authorization': grant.authorization }, cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error' });
    if (!response.ok)
        throw new Error('Document unavailable');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PK-document';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function deleteOrdinaryFile(path: string) {
    const config = await configuration();
    if (!config.available) {
        if (/^\/api\/admin\/documents\/[a-zA-Z0-9_-]+$/.test(path))
            return fetch('/api/admin/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: path.split('/').at(-1) }) });
        return fetch(path, { method: 'DELETE' });
    }
    return fetch('/api/ordinary-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'DELETE', ...documentTarget(path) }), cache: 'no-store' });
}
