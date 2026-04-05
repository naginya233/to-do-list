/**
 * toolbox-core.js
 * The main application shell engine.
 * Reads configurations from ToolboxConfig and mounts tools dynamically.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const mainContent = document.getElementById('main-content');
    const themeToggle = document.getElementById('theme-toggle');

    let loadedScripts = new Set();
    let isDarkMode = localStorage.getItem('theme') === 'dark';

    // 1. Theme Initialization
    initTheme();
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        initTheme();
    });

    function initTheme() {
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    // 2. Generate Sidebar Buttons
    ToolboxConfig.forEach((tool, index) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');

        btn.className = `nav-btn ${index === 0 ? 'active' : ''}`;
        btn.dataset.target = tool.id;
        btn.innerHTML = `<i class="${tool.icon}"></i> ${tool.name}`;

        li.appendChild(btn);
        sidebarNav.appendChild(li);

        // Click Event Setup
        btn.addEventListener('click', () => switchTool(tool.id));

        // Create the hidden DOM container for this tool right away
        const section = document.createElement('section');
        section.id = `${tool.id}-view`;
        section.className = `${tool.containerClass} ${index === 0 ? 'active' : 'hidden'}`;
        section.innerHTML = tool.htmlGenerator();
        mainContent.appendChild(section);
    });

    // 3. Switch Tool & Lazy Load Scripts
    function switchTool(toolId) {
        // Update Sidebar UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === toolId);
        });

        // Update Main View Visibility
        document.querySelectorAll(`.${ToolboxConfig[0].containerClass}`).forEach(view => {
            if (view.id === `${toolId}-view`) {
                view.classList.remove('hidden');
                view.classList.add('active');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        // Lazy load the tool's script if not loaded yet
        const targetTool = ToolboxConfig.find(t => t.id === toolId);
        if (targetTool && !loadedScripts.has(targetTool.id)) {
            loadScript(targetTool.id, targetTool.scriptToLoad);
        }
    }

    // Loader Function
    function loadScript(toolId, scriptPath) {
        const scriptConfig = document.createElement('script');
        scriptConfig.src = scriptPath;
        scriptConfig.onload = () => {
            console.log(`[Toolbox] Module Loaded: ${toolId}`);
            loadedScripts.add(toolId);
        };
        scriptConfig.onerror = () => {
            console.error(`[Toolbox] Failed to load module: ${toolId} from ${scriptPath}`);
        };
        document.body.appendChild(scriptConfig);
    }

    // 4. Initial Load - Boot the first tool (To-Do List)
    if (ToolboxConfig.length > 0) {
        loadScript(ToolboxConfig[0].id, ToolboxConfig[0].scriptToLoad);
        loadedScripts.add(ToolboxConfig[0].id);
    }

    // 5. Comfort Easter Egg for sensitive Todo inputs
    setupComfortMonitor();
    setupForHerWelcome();

    function setupComfortMonitor() {
        const triggerKeywords = ['信心', '难', '失败'];
        let lastTriggerAt = 0;

        document.addEventListener('toolbox:todo-input', (event) => {
            const text = event?.detail?.text || '';
            maybeTriggerComfort(text);
        });

        document.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (target.id !== 'todo-input' && !target.classList.contains('edit-input')) return;
            maybeTriggerComfort(target.value || '');
        });

        function maybeTriggerComfort(text) {
            const raw = String(text || '').trim();
            if (!raw) return;

            const matched = triggerKeywords.some(keyword => raw.includes(keyword));
            if (!matched) return;

            const now = Date.now();
            if (now - lastTriggerAt < 1800) return;
            lastTriggerAt = now;

            console.log("%c 凪君提示：检测到学妹心情不佳，正在启动最高等级安抚程序...", "color: #ff7f50; font-weight: bold;");
            spawnComfortParticles();
        }

        function spawnComfortParticles() {
            const layer = ensureParticleLayer();
            const total = 16;

            for (let i = 0; i < total; i++) {
                const particle = document.createElement('span');
                const useAg = Math.random() > 0.5;

                particle.className = 'comfort-particle';
                particle.textContent = useAg ? 'Ag' : '✦';
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.animationDuration = `${3 + Math.random() * 1.8}s`;
                particle.style.animationDelay = `${Math.random() * 0.5}s`;
                particle.style.fontSize = `${0.75 + Math.random() * 0.55}rem`;
                particle.style.opacity = `${0.5 + Math.random() * 0.45}`;

                layer.appendChild(particle);
                setTimeout(() => particle.remove(), 5200);
            }
        }

        function ensureParticleLayer() {
            let layer = document.getElementById('comfort-particle-layer');
            if (!layer) {
                layer = document.createElement('div');
                layer.id = 'comfort-particle-layer';
                layer.className = 'comfort-particle-layer';
                document.body.appendChild(layer);
            }
            return layer;
        }
    }

    function setupForHerWelcome() {
        const seenKey = 'for-her-welcome-seen-v1';
        if (localStorage.getItem(seenKey) === 'yes') return;

        const overlay = document.createElement('div');
        overlay.className = 'for-her-overlay';
        overlay.innerHTML = `
            <div class="for-her-card" role="dialog" aria-modal="true" aria-label="晚安补给站开场">
                <p class="for-her-kicker">for her</p>
                <h2>先别急着赢，先把自己抱稳。</h2>
                <p>
                    今晚的任务不是证明你有多厉害，
                    是让心跳慢一点，让肩膀松一点。
                </p>
                <p>
                    你可以先休息，也可以把选择交给我。
                    现在，先对自己温柔一点。
                </p>
                <div class="for-her-actions">
                    <button type="button" class="for-her-btn secondary" id="for-her-close-btn">我先缓一缓</button>
                    <button type="button" class="for-her-btn primary" id="for-her-decision-btn">带我去决策辅助</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#for-her-close-btn');
        const decisionBtn = overlay.querySelector('#for-her-decision-btn');

        const closeOverlay = () => {
            overlay.classList.add('leaving');
            localStorage.setItem(seenKey, 'yes');
            setTimeout(() => overlay.remove(), 250);
        };

        closeBtn?.addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeOverlay();
        });

        decisionBtn?.addEventListener('click', () => {
            closeOverlay();
            switchTool('decision');
        });
    }
});
