/** Browser/server shared URL policy. Never include query strings or fragments in return paths. */
export function safeReturnTo(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || /[\\\u0000-\u0020]/.test(value) || value.startsWith('//'))
        return null;
    try {
        const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
        if (/[\\%\u0000-\u0020]/.test(decoded) || decoded.includes('//'))
            return null;
        const target = new URL(decoded, 'https://pk.invalid');
        if (target.origin !== 'https://pk.invalid' || !/^\/(portal|admin|b2b|security)(\/|$)/.test(target.pathname))
            return null;
        return target.pathname;
    }
    catch {
        return null;
    }
}
export function publicError(message: string): string {
    // Business messages remain useful; provider credentials/URLs/paths never become public errors.
    return /https?:|[?#]|bearer\s|(?:token|secret|signature|credential|api[_-]?key)\s*[=:]|[\\/]/i.test(message)
        ? 'Operation unavailable. Please retry.' : message;
}
export function safeOrigin(value: string): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Invalid site origin'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port)
        throw new Error('Invalid site origin');
    return url.origin;
}
