import { safeRuntimeEvent } from './security-log';
/** Last-resort runtime boundary for legacy/provider console calls. No message/body/URL is retained. */
export function installSafeRuntimeConsole(target: Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'> = console) {
    const levels = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const originals = levels.map(level => target[level]);
    for (const level of levels) {
        const write = target[level].bind(target);
        target[level] = (...values: unknown[]) => {
            // Only the application's content-free event shape is preserved.
            let event = 'PK_RUNTIME_EVENT';
            if (values.length === 1 && typeof values[0] === 'string') {
                try {
                    const parsed = JSON.parse(values[0]);
                    if (Object.keys(parsed).length === 1 && safeRuntimeEvent(parsed.event) !== 'PK_RUNTIME_EVENT')
                        event = parsed.event;
                }
                catch { /* Never forward arbitrary strings or exception messages. */ }
            }
            write(JSON.stringify({ event }));
        };
    }
    return () => { levels.forEach((level, index) => { target[level] = originals[index]; }); };
}
