/**
 * Thin fetch wrapper. Every endpoint file in api/ goes through this so that
 * error handling lives in exactly one place.
 *
 * Paths are relative ("/api/..."). In dev, Vite proxies them to :8080.
 * In the production jar they hit the same origin.
 */

export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(status: number, message: string, body: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

async function parseBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text; // non-JSON (e.g. an HTML error page)
    }
}

async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    const init: RequestInit = { method, headers, signal: options.signal };

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    let res: Response;
    try {
        res = await fetch(path, init);
    } catch (e) {
        // Network failure: backend down, proxy target unreachable, aborted, etc.
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        throw new ApiError(0, 'Cannot reach the backend. Is Spring Boot running on :8080?', null);
    }

    const data = await parseBody(res);

    if (!res.ok) {
        // Spring's default error JSON has a "message" field.
        const message =
            typeof data === 'object' && data !== null && 'message' in data
                ? String((data as { message: unknown }).message)
                : `Request failed: ${res.status} ${res.statusText}`;
        throw new ApiError(res.status, message, data);
    }

    return data as T;
}

export const api = {
    get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, { signal }),

    post: <T>(
        path: string,
        body?: unknown,
        headers?: Record<string, string>,
        signal?: AbortSignal,
    ) => request<T>('POST', path, { body, headers, signal }),
};