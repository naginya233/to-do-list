// sync-client.js
// Unified local cache + /api/sync dual-write client with JWT auth + optimistic concurrency.
(function initToolboxSyncClient() {
    const META_PREFIX = 'sync-meta:';
    const AUTH_TOKEN_KEY = 'auth-access-token';
    const AUTH_USER_KEY = 'auth-user-profile';
    const DEFAULT_DEBOUNCE_MS = 800;
    const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

    const pendingWrites = new Map();

    function cloneJSON(value) {
        if (typeof value === 'undefined') return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function safeParseJSON(raw, fallback) {
        if (typeof raw !== 'string' || raw.trim() === '') return fallback;
        try {
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    function toMillis(isoString) {
        const t = Date.parse(isoString || '');
        return Number.isFinite(t) ? t : 0;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function getAuthToken() {
        return localStorage.getItem(AUTH_TOKEN_KEY) || '';
    }

    function getCurrentUser() {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        return safeParseJSON(raw, null);
    }

    function setAuthSession(accessToken, user) {
        if (accessToken) {
            localStorage.setItem(AUTH_TOKEN_KEY, String(accessToken));
        }
        if (user) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
    }

    function clearAuthSession() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }

    function isAuthenticated() {
        return Boolean(getAuthToken());
    }

    function getMeta(toolKey) {
        const raw = localStorage.getItem(`${META_PREFIX}${toolKey}`);
        const parsed = safeParseJSON(raw, {});
        const version = Number(parsed.version);
        return {
            localUpdatedAt: typeof parsed.localUpdatedAt === 'string' ? parsed.localUpdatedAt : null,
            remoteUpdatedAt: typeof parsed.remoteUpdatedAt === 'string' ? parsed.remoteUpdatedAt : null,
            version: Number.isInteger(version) && version >= 0 ? version : null
        };
    }

    function setMeta(toolKey, nextMeta) {
        localStorage.setItem(`${META_PREFIX}${toolKey}`, JSON.stringify({
            localUpdatedAt: nextMeta.localUpdatedAt || null,
            remoteUpdatedAt: nextMeta.remoteUpdatedAt || null,
            version: Number.isInteger(nextMeta.version) && nextMeta.version >= 0 ? nextMeta.version : null
        }));
    }

    function readLocal(storageKey, fallbackValue) {
        const raw = localStorage.getItem(storageKey);
        if (raw === null) return cloneJSON(fallbackValue);
        return safeParseJSON(raw, cloneJSON(fallbackValue));
    }

    function writeLocal(storageKey, data) {
        localStorage.setItem(storageKey, JSON.stringify(data));
    }

    function removeLocal(storageKey) {
        localStorage.removeItem(storageKey);
    }

    function dispatchSyncUpdated(toolKey) {
        document.dispatchEvent(new CustomEvent('toolbox:sync-updated', {
            detail: { toolKey }
        }));
    }

    async function requestJSON(path, options) {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options?.headers || {})
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });

        const text = await response.text();
        const body = safeParseJSON(text, text || null);

        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.status = response.status;
            err.body = body;
            throw err;
        }

        return body;
    }

    async function register(username, password) {
        return await requestJSON('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async function login(username, password) {
        const result = await requestJSON('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (result?.accessToken) {
            setAuthSession(result.accessToken, result.user || null);
        }

        return result;
    }

    async function loadCurrentUser() {
        const result = await requestJSON('/api/auth/me', {
            method: 'GET'
        });

        if (result?.user) {
            setAuthSession(getAuthToken(), result.user);
        }

        return result?.user || null;
    }

    async function fetchRemote(toolKey) {
        return await requestJSON(`/api/sync/${encodeURIComponent(toolKey)}`, {
            method: 'GET'
        });
    }

    async function pushRemoteNow(toolKey, data, expectedVersion) {
        return await requestJSON(`/api/sync/${encodeURIComponent(toolKey)}`, {
            method: 'PUT',
            body: JSON.stringify({
                data,
                expectedVersion
            })
        });
    }

    async function resolveWriteConflict(toolKey, storageKey, localData, conflictBody) {
        const current = conflictBody?.current;
        if (!current) return;

        const meta = getMeta(toolKey);
        const localTs = toMillis(meta.localUpdatedAt || nowIso());
        const remoteTs = toMillis(current.updatedAt);

        // Last-write-wins fallback on conflict: newer timestamp wins.
        if (localTs > remoteTs) {
            try {
                const retried = await pushRemoteNow(toolKey, localData, Number(current.version) || 0);
                const nextMeta = getMeta(toolKey);
                setMeta(toolKey, {
                    ...nextMeta,
                    remoteUpdatedAt: retried.updatedAt || nowIso(),
                    version: Number(retried.version) || (Number(current.version) || 0)
                });
            } catch (retryError) {
                console.warn(`[Sync] Retry after conflict failed for ${toolKey}:`, retryError.message);
            }
            return;
        }

        writeLocal(storageKey, current.data);
        setMeta(toolKey, {
            localUpdatedAt: current.updatedAt || nowIso(),
            remoteUpdatedAt: current.updatedAt || nowIso(),
            version: Number(current.version) || 0
        });
        dispatchSyncUpdated(toolKey);
    }

    async function flushPendingWrite(toolKey) {
        const pending = pendingWrites.get(toolKey);
        if (!pending) return;

        pendingWrites.delete(toolKey);

        try {
            const meta = getMeta(toolKey);
            const response = await pushRemoteNow(toolKey, pending.data, meta.version ?? 0);
            const nextMeta = getMeta(toolKey);
            setMeta(toolKey, {
                ...nextMeta,
                remoteUpdatedAt: response.updatedAt || nowIso(),
                version: Number(response.version) || nextMeta.version || 0
            });
        } catch (error) {
            if (error.status === 409) {
                await resolveWriteConflict(toolKey, pending.storageKey, pending.data, error.body);
                return;
            }
            if (error.status === 401 || error.status === 403) {
                console.warn(`[Sync] Auth required for ${toolKey}. Using local cache only.`);
                return;
            }
            console.warn(`[Sync] Remote write failed for ${toolKey}:`, error.message);
        }
    }

    function scheduleRemoteWrite(toolKey, storageKey, data, debounceMs) {
        const effectiveDebounce = Number.isFinite(debounceMs) ? debounceMs : DEFAULT_DEBOUNCE_MS;
        const existing = pendingWrites.get(toolKey);
        if (existing?.timerId) {
            clearTimeout(existing.timerId);
        }

        const timerId = setTimeout(() => {
            flushPendingWrite(toolKey);
        }, Math.max(0, effectiveDebounce));

        pendingWrites.set(toolKey, {
            storageKey,
            data: cloneJSON(data),
            timerId
        });
    }

    function save(options) {
        const {
            toolKey,
            storageKey,
            data,
            debounceMs = DEFAULT_DEBOUNCE_MS,
            immediate = false
        } = options;

        if (!toolKey || !storageKey) {
            throw new Error('save() requires toolKey and storageKey');
        }

        writeLocal(storageKey, data);
        const meta = getMeta(toolKey);
        setMeta(toolKey, {
            ...meta,
            localUpdatedAt: nowIso()
        });

        if (!isAuthenticated()) {
            return;
        }

        if (immediate) {
            const pending = pendingWrites.get(toolKey);
            if (pending?.timerId) {
                clearTimeout(pending.timerId);
            }
            pendingWrites.delete(toolKey);

            const latestMeta = getMeta(toolKey);
            pushRemoteNow(toolKey, data, latestMeta.version ?? 0)
                .then((response) => {
                    const nextMeta = getMeta(toolKey);
                    setMeta(toolKey, {
                        ...nextMeta,
                        remoteUpdatedAt: response.updatedAt || nowIso(),
                        version: Number(response.version) || nextMeta.version || 0
                    });
                })
                .catch(async (error) => {
                    if (error.status === 409) {
                        await resolveWriteConflict(toolKey, storageKey, data, error.body);
                        return;
                    }
                    if (error.status === 401 || error.status === 403) {
                        console.warn(`[Sync] Auth required for ${toolKey}. Using local cache only.`);
                        return;
                    }
                    console.warn(`[Sync] Immediate remote write failed for ${toolKey}:`, error.message);
                });
            return;
        }

        scheduleRemoteWrite(toolKey, storageKey, data, debounceMs);
    }

    async function reconcile(options) {
        const {
            toolKey,
            storageKey,
            defaultData,
            onResolved
        } = options;

        if (!toolKey || !storageKey) {
            throw new Error('reconcile() requires toolKey and storageKey');
        }

        const existingLocalRaw = localStorage.getItem(storageKey);
        let localData = existingLocalRaw === null
            ? cloneJSON(defaultData)
            : safeParseJSON(existingLocalRaw, cloneJSON(defaultData));

        if (existingLocalRaw === null && typeof defaultData !== 'undefined') {
            writeLocal(storageKey, localData);
        }

        const currentMeta = getMeta(toolKey);
        if (!currentMeta.localUpdatedAt) {
            setMeta(toolKey, {
                ...currentMeta,
                localUpdatedAt: nowIso()
            });
        }

        let finalData = localData;
        let mode = 'local-only';
        let changed = false;

        if (!isAuthenticated()) {
            const result = {
                data: finalData,
                changed,
                mode: 'auth-required'
            };

            if (typeof onResolved === 'function') {
                onResolved(result);
            }

            return result;
        }

        try {
            const remote = await fetchRemote(toolKey);
            const remoteData = remote?.data;
            const remoteUpdatedAt = remote?.updatedAt || null;
            const remoteVersion = Number(remote?.version || 0);

            const meta = getMeta(toolKey);
            const localTs = toMillis(meta.localUpdatedAt);
            const remoteTs = toMillis(remoteUpdatedAt);

            if (remoteData === null || typeof remoteData === 'undefined') {
                mode = 'remote-empty';
                if (typeof finalData !== 'undefined' && finalData !== null) {
                    const pushed = await pushRemoteNow(toolKey, finalData, 0);
                    const pushedMeta = getMeta(toolKey);
                    setMeta(toolKey, {
                        ...pushedMeta,
                        remoteUpdatedAt: pushed.updatedAt || nowIso(),
                        version: Number(pushed.version) || 1
                    });
                    mode = 'local-pushed';
                }
            } else if (remoteTs > localTs) {
                finalData = remoteData;
                writeLocal(storageKey, finalData);
                setMeta(toolKey, {
                    localUpdatedAt: remoteUpdatedAt || nowIso(),
                    remoteUpdatedAt: remoteUpdatedAt || nowIso(),
                    version: remoteVersion
                });
                changed = true;
                mode = 'remote-won';
            } else if (localTs > remoteTs) {
                const pushed = await pushRemoteNow(toolKey, finalData, remoteVersion);
                const pushedMeta = getMeta(toolKey);
                setMeta(toolKey, {
                    ...pushedMeta,
                    remoteUpdatedAt: pushed.updatedAt || nowIso(),
                    version: Number(pushed.version) || (remoteVersion + 1)
                });
                mode = 'local-won';
            } else {
                setMeta(toolKey, {
                    localUpdatedAt: meta.localUpdatedAt,
                    remoteUpdatedAt: remoteUpdatedAt || meta.remoteUpdatedAt,
                    version: remoteVersion
                });
                mode = 'equal';
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                mode = 'auth-required';
            } else {
                mode = 'offline';
            }
            console.warn(`[Sync] Reconcile skipped for ${toolKey}:`, error.message);
        }

        const result = {
            data: finalData,
            changed,
            mode
        };

        if (typeof onResolved === 'function') {
            onResolved(result);
        }

        return result;
    }

    window.ToolboxSync = {
        apiBase: API_BASE,
        register,
        login,
        loadCurrentUser,
        isAuthenticated,
        getAuthToken,
        getCurrentUser,
        setAuthSession,
        clearAuthSession,
        readLocal,
        removeLocal,
        save,
        reconcile
    };
})();
