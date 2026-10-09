'use client';
import { useState, type ReactNode } from 'react';
import { downloadOrdinaryFile } from '@/lib/ordinary-transfer/client';
export function OrdinaryDownload({ href, className, children }: {
    href: string;
    className?: string;
    children: ReactNode;
    target?: string;
    rel?: string;
    download?: boolean;
}) {
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    return <span><a href={href} className={className} aria-disabled={busy} onClick={async (event) => { event.preventDefault(); if (busy)
        return; setBusy(true); setError(''); try {
        await downloadOrdinaryFile(href);
    }
    catch {
        setError('Document unavailable. Please retry.');
    }
    finally {
        setBusy(false);
    } }}>{children}</a>{error && <span role="alert" className="block text-sm">{error}</span>}</span>;
}
