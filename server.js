require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const DB_SSL = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PUBLIC_SIGNUP_ENABLED = String(process.env.PUBLIC_SIGNUP_ENABLED || 'false').toLowerCase() === 'true';
const ADMIN_BOOTSTRAP_USERNAME = (process.env.ADMIN_BOOTSTRAP_USERNAME || '').trim();
const ADMIN_BOOTSTRAP_PASSWORD = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me';
if (!process.env.JWT_SECRET) {
    console.warn('[Security Warning] JWT_SECRET is not set. Using insecure fallback secret.');
}

const SYNC_ENCRYPTION_KEY = parseEncryptionKey(process.env.SYNC_ENCRYPTION_KEY || '');
if (!SYNC_ENCRYPTION_KEY) {
    console.warn('[Security Warning] SYNC_ENCRYPTION_KEY is missing or invalid. Encrypted sync APIs are disabled.');
}

const SYNC_TABLE = 'app_sync_data_secure';

let dbPool = null;

function parseEncryptionKey(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;

    if (/^[0-9a-fA-F]{64}$/.test(value)) {
        return Buffer.from(value, 'hex');
    }

    try {
        const buf = Buffer.from(value, 'base64');
        if (buf.length === 32) return buf;
    } catch {
        // ignored
    }

    return null;
}

function getAllowedOrigins() {
    if (!CORS_ORIGIN || CORS_ORIGIN === '*') return '*';
    return CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean);
}

function getDbPool() {
    if (!DATABASE_URL) return null;

    if (!dbPool) {
        dbPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: DB_SSL ? { rejectUnauthorized: false } : false
        });
    }

    return dbPool;
}

async function ensureDbSchema() {
    const pool = getDbPool();
    if (!pool) return false;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${SYNC_TABLE} (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            tool_key TEXT NOT NULL,
            payload_ciphertext TEXT NOT NULL,
            data_hash TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, tool_key)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_secure_user_id ON ${SYNC_TABLE} (user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_secure_tool_key ON ${SYNC_TABLE} (tool_key);
    `);

    await maybeCreateBootstrapAdmin(pool);

    return true;
}

async function maybeCreateBootstrapAdmin(pool) {
    if (!ADMIN_BOOTSTRAP_USERNAME || !ADMIN_BOOTSTRAP_PASSWORD) return;

    if (ADMIN_BOOTSTRAP_PASSWORD.length < 8) {
        console.warn('[Bootstrap Admin] Password must be at least 8 chars.');
        return;
    }

    const existing = await pool.query('SELECT id FROM app_users WHERE username = $1', [ADMIN_BOOTSTRAP_USERNAME]);
    if (existing.rowCount > 0) {
        await pool.query(
            `
            UPDATE app_users
            SET role = 'admin', is_active = TRUE
            WHERE username = $1
            `,
            [ADMIN_BOOTSTRAP_USERNAME]
        );
        return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_BOOTSTRAP_PASSWORD, 12);
    await pool.query(
        `
        INSERT INTO app_users (username, password_hash, role, is_active)
        VALUES ($1, $2, 'admin', TRUE)
        `,
        [ADMIN_BOOTSTRAP_USERNAME, passwordHash]
    );

    console.log(`[Bootstrap Admin] Created admin user: ${ADMIN_BOOTSTRAP_USERNAME}`);
}

function sanitizeUserRow(row) {
    return {
        id: Number(row.id),
        username: row.username,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at
    };
}

function createToken(user) {
    return jwt.sign(
        {
            sub: String(user.id),
            role: user.role,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function getBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim();
}

async function requireDatabase(req, res, next) {
    const pool = getDbPool();
    if (!pool) {
        return res.status(503).json({ error: 'Database is not configured. Set DATABASE_URL first.' });
    }

    req.dbPool = pool;
    next();
}

async function requireAuth(req, res, next) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: missing bearer token.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = Number(decoded.sub);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ error: 'Unauthorized: invalid token subject.' });
        }

        const pool = getDbPool();
        if (!pool) {
            return res.status(503).json({ error: 'Database is not configured. Set DATABASE_URL first.' });
        }

        const result = await pool.query(
            'SELECT id, username, role, is_active, created_at, last_login_at FROM app_users WHERE id = $1',
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Unauthorized: user not found.' });
        }

        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is locked by administrator.' });
        }

        req.authUser = sanitizeUserRow(user);
        req.dbPool = pool;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Unauthorized: invalid or expired token.' });
        }
        console.error('[Auth Middleware Error]:', error);
        return res.status(500).json({ error: 'Authentication middleware failed.' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.authUser || req.authUser.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: admin role required.' });
    }
    next();
}

function ensureEncryptionEnabled(req, res, next) {
    if (!SYNC_ENCRYPTION_KEY) {
        return res.status(503).json({ error: 'SYNC_ENCRYPTION_KEY is required for encrypted sync.' });
    }
    next();
}

function isValidToolKey(toolKey) {
    return /^[a-zA-Z0-9_-]{1,64}$/.test(toolKey);
}

function parseExpectedVersion(value) {
    if (value === null || typeof value === 'undefined' || value === '') {
        return null;
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) return NaN;
    return num;
}

function encryptPayload(data) {
    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', SYNC_ENCRYPTION_KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return JSON.stringify({
        v: 1,
        alg: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ciphertext.toString('base64')
    });
}

function decryptPayload(payloadCiphertext) {
    const envelope = JSON.parse(payloadCiphertext);
    if (!envelope || envelope.alg !== 'aes-256-gcm') {
        throw new Error('Unknown encrypted payload format.');
    }

    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ct, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', SYNC_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext);
}

function hashPayload(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

const allowedOrigins = getAllowedOrigins();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(
    typeof allowedOrigins === 'string'
        ? { origin: allowedOrigins }
        : { origin: allowedOrigins, credentials: true }
));
app.use(express.json({ limit: '1mb' }));

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const API_PROVIDERS = {
    zhipu: {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        key: ZHIPU_API_KEY
    },
    nvidia_llama_70b: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY },
    nvidia_llama_8b: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY },
    nvidia_nemotron: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY },
    nvidia_mixtral: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY },
    nvidia_glm: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY },
    nvidia_minimax: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: NVIDIA_API_KEY }
};

app.get('/api/health', async (_req, res) => {
    try {
        const pool = getDbPool();
        if (!pool) {
            return res.json({
                status: 'ok',
                db: 'disabled',
                auth: 'jwt',
                encryption: SYNC_ENCRYPTION_KEY ? 'enabled' : 'disabled'
            });
        }

        await pool.query('SELECT 1');
        return res.json({
            status: 'ok',
            db: 'connected',
            auth: 'jwt',
            encryption: SYNC_ENCRYPTION_KEY ? 'enabled' : 'disabled'
        });
    } catch (error) {
        console.error('[Health Check Error]:', error);
        return res.status(500).json({ status: 'error', db: 'unreachable' });
    }
});

app.post('/api/auth/register', requireDatabase, async (req, res) => {
    try {
        if (!PUBLIC_SIGNUP_ENABLED) {
            return res.status(403).json({ error: 'Public signup is disabled. Ask admin to create users.' });
        }

        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');

        if (!username || username.length < 3 || username.length > 64) {
            return res.status(400).json({ error: 'Username length must be between 3 and 64.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password length must be at least 8.' });
        }

        const exists = await req.dbPool.query('SELECT id FROM app_users WHERE username = $1', [username]);
        if (exists.rowCount > 0) {
            return res.status(409).json({ error: 'Username already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const created = await req.dbPool.query(
            `
            INSERT INTO app_users (username, password_hash, role, is_active)
            VALUES ($1, $2, 'user', TRUE)
            RETURNING id, username, role, is_active, created_at, last_login_at
            `,
            [username, passwordHash]
        );

        return res.status(201).json({ user: sanitizeUserRow(created.rows[0]) });
    } catch (error) {
        console.error('[Auth Register Error]:', error);
        return res.status(500).json({ error: 'Failed to register user.' });
    }
});

app.post('/api/auth/login', requireDatabase, async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).json({ error: 'Missing username or password.' });
        }

        const userResult = await req.dbPool.query(
            'SELECT id, username, password_hash, role, is_active, created_at, last_login_at FROM app_users WHERE username = $1',
            [username]
        );

        if (userResult.rowCount === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const row = userResult.rows[0];
        const matched = await bcrypt.compare(password, row.password_hash);
        if (!matched) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        if (!row.is_active) {
            return res.status(403).json({ error: 'Account is locked by administrator.' });
        }

        await req.dbPool.query('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [row.id]);

        const user = sanitizeUserRow({ ...row, last_login_at: new Date().toISOString() });
        const accessToken = createToken(user);

        return res.json({
            tokenType: 'Bearer',
            accessToken,
            user
        });
    } catch (error) {
        console.error('[Auth Login Error]:', error);
        return res.status(500).json({ error: 'Failed to login.' });
    }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    return res.json({ user: req.authUser });
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await req.dbPool.query(
            `
            SELECT
                u.id,
                u.username,
                u.role,
                u.is_active,
                u.created_at,
                u.last_login_at,
                COUNT(s.id)::int AS sync_records
            FROM app_users u
            LEFT JOIN ${SYNC_TABLE} s ON s.user_id = u.id
            GROUP BY u.id
            ORDER BY u.id ASC
            `
        );

        return res.json({
            users: users.rows.map((row) => ({
                ...sanitizeUserRow(row),
                syncRecords: Number(row.sync_records || 0)
            }))
        });
    } catch (error) {
        console.error('[Admin Users Error]:', error);
        return res.status(500).json({ error: 'Failed to load users.' });
    }
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');
        const role = String(req.body.role || 'user').trim();
        const isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : true;

        if (!username || username.length < 3 || username.length > 64) {
            return res.status(400).json({ error: 'Username length must be between 3 and 64.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password length must be at least 8.' });
        }

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const exists = await req.dbPool.query('SELECT id FROM app_users WHERE username = $1', [username]);
        if (exists.rowCount > 0) {
            return res.status(409).json({ error: 'Username already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const created = await req.dbPool.query(
            `
            INSERT INTO app_users (username, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, role, is_active, created_at, last_login_at
            `,
            [username, passwordHash, role, isActive]
        );

        return res.status(201).json({ user: sanitizeUserRow(created.rows[0]) });
    } catch (error) {
        console.error('[Admin Create User Error]:', error);
        return res.status(500).json({ error: 'Failed to create user.' });
    }
});

app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const role = String(req.body.role || '').trim();

        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        if (role === 'user') {
            const target = await req.dbPool.query('SELECT role, is_active FROM app_users WHERE id = $1', [targetId]);
            if (target.rowCount === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }

            const admins = await req.dbPool.query("SELECT COUNT(*)::int AS count FROM app_users WHERE role = 'admin' AND is_active = TRUE");
            const activeAdminCount = Number(admins.rows[0].count || 0);
            const isTargetActiveAdmin = target.rows[0].role === 'admin' && target.rows[0].is_active;

            if (isTargetActiveAdmin && activeAdminCount <= 1) {
                return res.status(409).json({ error: 'Cannot demote the last active admin.' });
            }
        }

        const updated = await req.dbPool.query(
            'UPDATE app_users SET role = $1 WHERE id = $2 RETURNING id, username, role, is_active, created_at, last_login_at',
            [role, targetId]
        );

        if (updated.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        return res.json({ user: sanitizeUserRow(updated.rows[0]) });
    } catch (error) {
        console.error('[Admin Role Update Error]:', error);
        return res.status(500).json({ error: 'Failed to update role.' });
    }
});

app.patch('/api/admin/users/:id/lock', requireAuth, requireAdmin, async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const isActive = Boolean(req.body.isActive);

        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }

        if (!isActive) {
            const target = await req.dbPool.query('SELECT role, is_active FROM app_users WHERE id = $1', [targetId]);
            if (target.rowCount === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }

            const admins = await req.dbPool.query("SELECT COUNT(*)::int AS count FROM app_users WHERE role = 'admin' AND is_active = TRUE");
            const activeAdminCount = Number(admins.rows[0].count || 0);
            const isTargetActiveAdmin = target.rows[0].role === 'admin' && target.rows[0].is_active;

            if (isTargetActiveAdmin && activeAdminCount <= 1) {
                return res.status(409).json({ error: 'Cannot lock the last active admin.' });
            }
        }

        const updated = await req.dbPool.query(
            'UPDATE app_users SET is_active = $1 WHERE id = $2 RETURNING id, username, role, is_active, created_at, last_login_at',
            [isActive, targetId]
        );

        if (updated.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        return res.json({ user: sanitizeUserRow(updated.rows[0]) });
    } catch (error) {
        console.error('[Admin Lock Update Error]:', error);
        return res.status(500).json({ error: 'Failed to update account lock.' });
    }
});

app.get('/api/admin/sync/overview', requireAuth, requireAdmin, async (req, res) => {
    try {
        const records = await req.dbPool.query(
            `
            SELECT
                s.id,
                s.user_id,
                u.username,
                s.tool_key,
                s.version,
                s.updated_at
            FROM ${SYNC_TABLE} s
            INNER JOIN app_users u ON u.id = s.user_id
            ORDER BY s.updated_at DESC
            LIMIT 300
            `
        );

        return res.json({
            records: records.rows.map((row) => ({
                id: Number(row.id),
                userId: Number(row.user_id),
                username: row.username,
                toolKey: row.tool_key,
                version: Number(row.version),
                updatedAt: row.updated_at
            }))
        });
    } catch (error) {
        console.error('[Admin Sync Overview Error]:', error);
        return res.status(500).json({ error: 'Failed to load sync overview.' });
    }
});

app.get('/api/sync/:toolKey', requireAuth, ensureEncryptionEnabled, async (req, res) => {
    try {
        const toolKey = String(req.params.toolKey || '').trim();
        if (!isValidToolKey(toolKey)) {
            return res.status(400).json({ error: 'Invalid tool key.' });
        }

        const result = await req.dbPool.query(
            `
            SELECT payload_ciphertext, version, updated_at
            FROM ${SYNC_TABLE}
            WHERE user_id = $1 AND tool_key = $2
            `,
            [req.authUser.id, toolKey]
        );

        if (result.rowCount === 0) {
            return res.json({
                userId: req.authUser.id,
                toolKey,
                data: null,
                updatedAt: null,
                version: 0
            });
        }

        const row = result.rows[0];
        return res.json({
            userId: req.authUser.id,
            toolKey,
            data: decryptPayload(row.payload_ciphertext),
            updatedAt: row.updated_at,
            version: Number(row.version)
        });
    } catch (error) {
        console.error('[Sync Read Error]:', error);
        return res.status(500).json({ error: 'Failed to read synchronized data.' });
    }
});

app.put('/api/sync/:toolKey', requireAuth, ensureEncryptionEnabled, async (req, res) => {
    const client = await req.dbPool.connect();
    try {
        const toolKey = String(req.params.toolKey || '').trim();
        if (!isValidToolKey(toolKey)) {
            return res.status(400).json({ error: 'Invalid tool key.' });
        }

        const payload = req.body.data;
        if (typeof payload === 'undefined') {
            return res.status(400).json({ error: 'Missing request body field: data' });
        }

        const expectedVersion = parseExpectedVersion(req.body.expectedVersion);
        if (Number.isNaN(expectedVersion)) {
            return res.status(400).json({ error: 'expectedVersion must be a non-negative integer.' });
        }

        await client.query('BEGIN');

        const existing = await client.query(
            `
            SELECT payload_ciphertext, version, updated_at
            FROM ${SYNC_TABLE}
            WHERE user_id = $1 AND tool_key = $2
            FOR UPDATE
            `,
            [req.authUser.id, toolKey]
        );

        if (existing.rowCount === 0) {
            if (expectedVersion !== null && expectedVersion !== 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: 'Version conflict: record does not exist.',
                    current: {
                        data: null,
                        updatedAt: null,
                        version: 0
                    }
                });
            }

            const inserted = await client.query(
                `
                INSERT INTO ${SYNC_TABLE} (user_id, tool_key, payload_ciphertext, data_hash, version)
                VALUES ($1, $2, $3, $4, 1)
                RETURNING updated_at, version
                `,
                [req.authUser.id, toolKey, encryptPayload(payload), hashPayload(payload)]
            );

            await client.query('COMMIT');

            return res.json({
                ok: true,
                userId: req.authUser.id,
                toolKey,
                updatedAt: inserted.rows[0].updated_at,
                version: Number(inserted.rows[0].version)
            });
        }

        const current = existing.rows[0];
        const currentVersion = Number(current.version);

        if (expectedVersion !== null && expectedVersion !== currentVersion) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Version conflict: data was updated by another session.',
                current: {
                    data: decryptPayload(current.payload_ciphertext),
                    updatedAt: current.updated_at,
                    version: currentVersion
                }
            });
        }

        const nextVersion = currentVersion + 1;
        const updated = await client.query(
            `
            UPDATE ${SYNC_TABLE}
            SET payload_ciphertext = $3,
                data_hash = $4,
                version = $5,
                updated_at = NOW()
            WHERE user_id = $1 AND tool_key = $2
            RETURNING updated_at, version
            `,
            [req.authUser.id, toolKey, encryptPayload(payload), hashPayload(payload), nextVersion]
        );

        await client.query('COMMIT');

        return res.json({
            ok: true,
            userId: req.authUser.id,
            toolKey,
            updatedAt: updated.rows[0].updated_at,
            version: Number(updated.rows[0].version)
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignored
        }
        console.error('[Sync Write Error]:', error);
        return res.status(500).json({ error: 'Failed to save synchronized data.' });
    } finally {
        client.release();
    }
});

app.delete('/api/sync/:toolKey', requireAuth, ensureEncryptionEnabled, async (req, res) => {
    const client = await req.dbPool.connect();
    try {
        const toolKey = String(req.params.toolKey || '').trim();
        if (!isValidToolKey(toolKey)) {
            return res.status(400).json({ error: 'Invalid tool key.' });
        }

        const expectedVersion = parseExpectedVersion(req.query.expectedVersion);
        if (Number.isNaN(expectedVersion)) {
            return res.status(400).json({ error: 'expectedVersion must be a non-negative integer.' });
        }

        await client.query('BEGIN');

        const existing = await client.query(
            `
            SELECT version
            FROM ${SYNC_TABLE}
            WHERE user_id = $1 AND tool_key = $2
            FOR UPDATE
            `,
            [req.authUser.id, toolKey]
        );

        if (existing.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Record not found.' });
        }

        const currentVersion = Number(existing.rows[0].version);
        if (expectedVersion !== null && expectedVersion !== currentVersion) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Version conflict while deleting.',
                current: { version: currentVersion }
            });
        }

        await client.query(
            `
            DELETE FROM ${SYNC_TABLE}
            WHERE user_id = $1 AND tool_key = $2
            `,
            [req.authUser.id, toolKey]
        );

        await client.query('COMMIT');

        return res.json({ ok: true, userId: req.authUser.id, toolKey });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignored
        }
        console.error('[Sync Delete Error]:', error);
        return res.status(500).json({ error: 'Failed to delete synchronized data.' });
    } finally {
        client.release();
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { providerId, requestBody } = req.body;
        const config = API_PROVIDERS[providerId];

        if (!config) {
            return res.status(400).json({ error: `Unknown provider mapping: ${providerId}` });
        }

        console.log(`[Proxy] Forwarding request to ${providerId} (${requestBody.model})...`);

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.key}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Proxy Error] API responded with ${response.status}`, errText);
            return res.status(response.status).send(errText);
        }

        const data = await response.json();
        return res.json(data);
    } catch (error) {
        console.error('[Proxy Internal Error]:', error);
        return res.status(500).json({ error: 'Backend proxy server failed to fetch from LLM API.' });
    }
});

async function startServer() {
    try {
        const dbEnabled = await ensureDbSchema();
        app.listen(PORT, () => {
            console.log(`Web Toolbox API Server running on http://localhost:${PORT}`);
            console.log(`Loaded ${Object.keys(API_PROVIDERS).length} AI Provider configurations.`);
            console.log(`PostgreSQL sync: ${dbEnabled ? 'enabled' : 'disabled (DATABASE_URL not set)'}`);
            console.log(`Public signup: ${PUBLIC_SIGNUP_ENABLED ? 'enabled' : 'disabled'}`);
            console.log(`Encrypted sync: ${SYNC_ENCRYPTION_KEY ? 'enabled' : 'disabled'}`);
        });
    } catch (error) {
        console.error('[Startup Error] Failed to initialize backend:', error);
        process.exit(1);
    }
}

startServer();

process.on('SIGINT', async () => {
    if (dbPool) {
        await dbPool.end();
    }
    process.exit(0);
});
