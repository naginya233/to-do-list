(function initAdminConsole() {
    const sync = window.ToolboxSync || null;

    const sessionLabel = document.getElementById('session-label');
    const logoutBtn = document.getElementById('logout-btn');
    const notice = document.getElementById('notice');

    const loginCard = document.getElementById('login-card');
    const loginForm = document.getElementById('login-form');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginSubmit = document.getElementById('login-submit');

    const dashboard = document.getElementById('dashboard');
    const createUserForm = document.getElementById('create-user-form');
    const createUsername = document.getElementById('create-username');
    const createPassword = document.getElementById('create-password');
    const createRole = document.getElementById('create-role');
    const createActive = document.getElementById('create-active');

    const usersBody = document.getElementById('users-body');
    const syncBody = document.getElementById('sync-body');

    const statUsers = document.getElementById('stat-users');
    const statActive = document.getElementById('stat-active');
    const statAdmins = document.getElementById('stat-admins');
    const statSync = document.getElementById('stat-sync');

    const refreshUsersBtn = document.getElementById('refresh-users');
    const refreshSyncBtn = document.getElementById('refresh-sync');

    const state = {
        user: null,
        users: [],
        records: []
    };

    if (!sync) {
        showNotice('未检测到同步客户端，无法加载管理页。', 'error');
        return;
    }

    function showNotice(message, kind) {
        notice.textContent = message;
        notice.classList.remove('hidden', 'success');

        if (kind === 'success') {
            notice.classList.add('success');
        } else {
            notice.classList.remove('success');
        }
    }

    function hideNotice() {
        notice.classList.add('hidden');
        notice.classList.remove('success');
    }

    function formatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (tag) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    async function api(path, method, body) {
        const token = sync.getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${sync.apiBase}${path}`, {
            method: method || 'GET',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const text = await response.text();
        let payload = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }

        if (!response.ok) {
            const message = payload?.error || `HTTP ${response.status}`;
            const err = new Error(message);
            err.status = response.status;
            err.payload = payload;
            throw err;
        }

        return payload;
    }

    function setSessionUI(user) {
        if (user) {
            sessionLabel.textContent = `已登录: ${user.username} (${user.role})`;
            sessionLabel.classList.remove('idle', 'warn');
            sessionLabel.classList.add('ok');
            logoutBtn.disabled = false;
            return;
        }

        sessionLabel.textContent = '未登录';
        sessionLabel.classList.remove('ok', 'warn');
        sessionLabel.classList.add('idle');
        logoutBtn.disabled = true;
    }

    function ensureAdmin(user) {
        if (!user || user.role !== 'admin') {
            setSessionUI(user || null);
            sessionLabel.classList.remove('idle', 'ok');
            sessionLabel.classList.add('warn');
            sessionLabel.textContent = user
                ? `权限不足: ${user.username} 不是 admin`
                : '未登录';
            dashboard.classList.add('hidden');
            loginCard.classList.remove('hidden');
            showNotice('请使用管理员账号登录该页面。', 'error');
            return false;
        }

        return true;
    }

    function renderStats() {
        const users = state.users || [];
        const records = state.records || [];

        const activeUsers = users.filter((u) => u.isActive).length;
        const admins = users.filter((u) => u.role === 'admin').length;

        statUsers.textContent = String(users.length);
        statActive.textContent = String(activeUsers);
        statAdmins.textContent = String(admins);
        statSync.textContent = String(records.length);
    }

    function renderUsers() {
        if (!Array.isArray(state.users) || state.users.length === 0) {
            usersBody.innerHTML = '<tr><td class="empty" colspan="7">暂无用户数据</td></tr>';
            return;
        }

        usersBody.innerHTML = state.users.map((user) => {
            const roleBadgeClass = user.role === 'admin' ? 'admin' : 'user';
            const lockBadgeClass = user.isActive ? 'active' : 'locked';
            const lockText = user.isActive ? 'Active' : 'Locked';
            const lockBtnClass = user.isActive ? 'danger' : 'warn';
            const lockBtnText = user.isActive ? '锁定' : '解锁';

            return `
                <tr>
                    <td>${user.id}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td><span class="badge ${roleBadgeClass}">${escapeHtml(user.role)}</span></td>
                    <td><span class="badge ${lockBadgeClass}">${lockText}</span></td>
                    <td>${user.syncRecords ?? 0}</td>
                    <td>${formatDate(user.lastLoginAt)}</td>
                    <td>
                        <div class="row-actions">
                            <select data-role-select="${user.id}">
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                            </select>
                            <button class="inline-btn" data-role-save="${user.id}" type="button">保存角色</button>
                            <button class="inline-btn ${lockBtnClass}" data-lock-toggle="${user.id}" data-active="${user.isActive}" type="button">${lockBtnText}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderSyncOverview() {
        if (!Array.isArray(state.records) || state.records.length === 0) {
            syncBody.innerHTML = '<tr><td class="empty" colspan="5">暂无同步记录</td></tr>';
            return;
        }

        syncBody.innerHTML = state.records.map((row) => `
            <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)} (#${row.userId})</td>
                <td>${escapeHtml(row.toolKey)}</td>
                <td>v${row.version}</td>
                <td>${formatDate(row.updatedAt)}</td>
            </tr>
        `).join('');
    }

    async function loadUsers() {
        const payload = await api('/api/admin/users', 'GET');
        state.users = Array.isArray(payload?.users) ? payload.users : [];
        renderUsers();
        renderStats();
    }

    async function loadSyncOverview() {
        const payload = await api('/api/admin/sync/overview', 'GET');
        state.records = Array.isArray(payload?.records) ? payload.records : [];
        renderSyncOverview();
        renderStats();
    }

    async function loadDashboard() {
        await Promise.all([loadUsers(), loadSyncOverview()]);
    }

    async function bootstrapSession() {
        hideNotice();
        setSessionUI(null);

        if (!sync.isAuthenticated()) {
            loginCard.classList.remove('hidden');
            dashboard.classList.add('hidden');
            return;
        }

        try {
            const user = await sync.loadCurrentUser();
            state.user = user;
            setSessionUI(user);

            if (!ensureAdmin(user)) {
                return;
            }

            loginCard.classList.add('hidden');
            dashboard.classList.remove('hidden');
            await loadDashboard();
        } catch (error) {
            sync.clearAuthSession();
            state.user = null;
            setSessionUI(null);
            loginCard.classList.remove('hidden');
            dashboard.classList.add('hidden');
            showNotice(`会话验证失败：${error.message}`, 'error');
        }
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideNotice();

        const username = loginUsername.value.trim();
        const password = loginPassword.value;

        if (!username || !password) {
            showNotice('请输入用户名和密码。', 'error');
            return;
        }

        loginSubmit.disabled = true;

        try {
            await sync.login(username, password);
            await bootstrapSession();
            showNotice('登录成功。', 'success');
            loginPassword.value = '';
        } catch (error) {
            showNotice(`登录失败：${error.message}`, 'error');
        } finally {
            loginSubmit.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        sync.clearAuthSession();
        state.user = null;
        setSessionUI(null);
        dashboard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        showNotice('已退出登录。', 'success');
    });

    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideNotice();

        const username = createUsername.value.trim();
        const password = createPassword.value;
        const role = createRole.value;
        const isActive = createActive.checked;

        if (!username || !password) {
            showNotice('请填写用户名和密码。', 'error');
            return;
        }

        try {
            await api('/api/admin/users', 'POST', { username, password, role, isActive });
            createUserForm.reset();
            createRole.value = 'user';
            createActive.checked = true;
            await loadUsers();
            showNotice(`用户 ${username} 创建成功。`, 'success');
        } catch (error) {
            showNotice(`创建用户失败：${error.message}`, 'error');
        }
    });

    usersBody.addEventListener('click', async (event) => {
        const roleBtn = event.target.closest('[data-role-save]');
        const lockBtn = event.target.closest('[data-lock-toggle]');

        if (roleBtn) {
            const userId = roleBtn.getAttribute('data-role-save');
            const select = usersBody.querySelector(`[data-role-select="${userId}"]`);
            if (!select) return;

            try {
                await api(`/api/admin/users/${userId}/role`, 'PATCH', { role: select.value });
                await loadUsers();
                showNotice(`用户 #${userId} 角色已更新。`, 'success');
            } catch (error) {
                showNotice(`更新角色失败：${error.message}`, 'error');
            }
            return;
        }

        if (lockBtn) {
            const userId = lockBtn.getAttribute('data-lock-toggle');
            const currentActive = lockBtn.getAttribute('data-active') === 'true';

            try {
                await api(`/api/admin/users/${userId}/lock`, 'PATCH', { isActive: !currentActive });
                await loadUsers();
                showNotice(`用户 #${userId} 状态已更新。`, 'success');
            } catch (error) {
                showNotice(`更新锁状态失败：${error.message}`, 'error');
            }
        }
    });

    refreshUsersBtn.addEventListener('click', async () => {
        hideNotice();
        try {
            await loadUsers();
            showNotice('用户列表已刷新。', 'success');
        } catch (error) {
            showNotice(`刷新用户失败：${error.message}`, 'error');
        }
    });

    refreshSyncBtn.addEventListener('click', async () => {
        hideNotice();
        try {
            await loadSyncOverview();
            showNotice('同步概览已刷新。', 'success');
        } catch (error) {
            showNotice(`刷新同步概览失败：${error.message}`, 'error');
        }
    });

    bootstrapSession();
})();
