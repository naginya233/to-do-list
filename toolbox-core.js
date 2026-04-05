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
});
