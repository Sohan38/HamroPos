const UPDATE_RELOAD_KEY = '__sohan_update_reload__';

export function isStaleChunkError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /chunk|dynamically imported module|failed to fetch module|import\(|loading css chunk|module script/i.test(message);
}

export function reloadOnceForUpdate(): boolean {
    try {
        if (sessionStorage.getItem(UPDATE_RELOAD_KEY) === '1') return false;
        sessionStorage.setItem(UPDATE_RELOAD_KEY, '1');
        window.location.reload();
        return true;
    } catch {
        return false;
    }
}

export function markAppBooted(): void {
    try {
        window.setTimeout(() => {
            try {
                sessionStorage.removeItem(UPDATE_RELOAD_KEY);
            } catch {
                // Ignore storage restrictions after a successful boot.
            }
        }, 5000);
    } catch {
        // Storage can be unavailable in private or restricted WebView contexts.
    }
}
