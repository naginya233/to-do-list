/**
 * toolbox-config.js
 * Central registry for all Toolbox app plugins.
 * 
 * To add a new tool:
 * 1. Create a tools/new-tool.js file with a render() function.
 * 2. Add an object to the `ToolboxConfig` array below.
 */

const ToolboxConfig = [
    {
        id: 'todo',
        name: 'To-Do List',
        icon: 'fas fa-list-check',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>To-Do List</h1>
                <p>Stay organized, stay productive.</p>
            </div>
            
            <form id="todo-form">
                <input type="text" id="todo-input" placeholder="What needs to be done?" autocomplete="off">
                <button type="submit" id="add-btn" aria-label="Add task"><i class="fas fa-plus"></i></button>
            </form>

            <div class="filters-container">
                <div class="progress-text" id="progress-text">0/0 completed</div>
                <div class="filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="active">Active</button>
                    <button class="filter-btn" data-filter="completed">Completed</button>
                </div>
                <button id="clear-completed" class="clear-btn">Clear</button>
            </div>

            <ul id="todo-list"></ul>
        `,
        scriptToLoad: 'tools/todo.js'
    },
    {
        id: 'pomodoro',
        name: 'Pomodoro',
        icon: 'fas fa-clock',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>Pomodoro Timer</h1>
                <p>Focus for 25 minutes, then take a break.</p>
            </div>
            <div class="pomodoro-container">
                <div class="timer-tabs">
                    <button class="timer-tab active" data-mode="focus">Focus</button>
                    <button class="timer-tab" data-mode="break">Break</button>
                </div>
                
                <div class="timer-display-container">
                    <svg class="timer-svg" viewBox="0 0 100 100">
                        <circle class="timer-track" cx="50" cy="50" r="45"></circle>
                        <circle class="timer-progress" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <div class="timer-time" id="timer-time">25:00</div>
                </div>

                <div class="timer-controls">
                    <button id="timer-main-btn" class="timer-btn primary"><i class="fas fa-play"></i> Start</button>
                    <button id="timer-reset-btn" class="timer-btn secondary" disabled><i class="fas fa-rotate-right"></i></button>
                </div>
            </div>
        `,
        scriptToLoad: 'tools/pomodoro.js'
    },
    {
        id: 'notes',
        name: 'Quick Notes',
        icon: 'fas fa-note-sticky',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header notes-view-header">
                <div>
                    <h1>Quick Notes</h1>
                    <p>A multi-document vault with Markdown support.</p>
                </div>
                <div class="notes-actions">
                    <button id="view-edit-btn" class="notes-view-btn active" title="Edit Mode"><i class="fas fa-pen"></i></button>
                    <button id="view-split-btn" class="notes-view-btn" title="Split View"><i class="fas fa-columns"></i></button>
                    <button id="view-preview-btn" class="notes-view-btn" title="Preview Mode"><i class="fas fa-eye"></i></button>
                </div>
            </div>
            <div class="notes-app-container">
                <div class="notes-sidebar">
                    <button id="new-note-btn" class="pwd-btn" style="width: 100%; margin-bottom: 15px;"><i class="fas fa-plus"></i> New Note</button>
                    <ul id="notes-list" class="notes-list">
                        <!-- Populated by JS -->
                    </ul>
                </div>
                <div class="notes-editor-area split-view" id="notes-workspace">
                    <div class="notes-editor-pane" id="notes-editor-pane">
                        <input type="text" id="quick-notes-title" placeholder="Note Title..." autocomplete="off">
                        <textarea id="quick-notes-input" placeholder="Type your Markdown here..." spellcheck="false"></textarea>
                    </div>
                    <div class="notes-preview-pane" id="quick-notes-preview">
                        <!-- Markdown rendered here -->
                        <div class="markdown-placeholder">Markdown preview will appear here...</div>
                    </div>
                </div>
            </div>
        `,
        scriptToLoad: 'tools/notes.js'
    },
    {
        id: 'password',
        name: 'Passwords',
        icon: 'fas fa-key',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>Password Generator</h1>
                <p>Create secure, random passwords instantly.</p>
            </div>
            <div class="pwd-gen-container">
                <div class="pwd-display-box">
                    <span id="pwd-result">P@ssw0rd123!</span>
                    <button id="pwd-copy-btn" aria-label="Copy Password"><i class="fas fa-copy"></i></button>
                </div>

                <div class="pwd-options">
                    <div class="pwd-length-slider">
                        <label for="pwd-length">Length: <span id="pwd-length-val">16</span></label>
                        <input type="range" id="pwd-length" min="8" max="32" value="16">
                    </div>

                    <div class="pwd-switches">
                        <label class="pwd-switch-container">
                            <input type="checkbox" id="pwd-upper" checked>
                            <span class="pwd-switch-label">Uppercase Letters (A-Z)</span>
                        </label>
                        <label class="pwd-switch-container">
                            <input type="checkbox" id="pwd-lower" checked>
                            <span class="pwd-switch-label">Lowercase Letters (a-z)</span>
                        </label>
                        <label class="pwd-switch-container">
                            <input type="checkbox" id="pwd-numbers" checked>
                            <span class="pwd-switch-label">Numbers (0-9)</span>
                        </label>
                        <label class="pwd-switch-container">
                            <input type="checkbox" id="pwd-symbols" checked>
                            <span class="pwd-switch-label">Symbols (!@#$%)</span>
                        </label>
                    </div>
                </div>

                <button id="pwd-generate-btn" class="pwd-btn"><i class="fas fa-bolt"></i> Generate Password</button>
            </div>
        `,
        scriptToLoad: 'tools/password.js'
    },
    {
        id: 'habit',
        name: 'Habit Tracker',
        icon: 'fas fa-calendar-check',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>Habit Tracker</h1>
                <p>Track a daily habit over the last 30 days.</p>
            </div>
            <div class="habit-container">
                <div class="habit-header">
                    <input type="text" id="habit-title" placeholder="What habit are you tracking? (e.g. Reading, Exercise)" autocomplete="off">
                </div>
                <div class="habit-grid" id="habit-grid">
                    <!-- 30 days generated by JS -->
                </div>
                <div class="habit-footer">
                    <span class="habit-legend"><span class="legend-box active"></span> Completed</span>
                    <span class="habit-legend"><span class="legend-box"></span> Missed / Pending</span>
                </div>
            </div>
        `,
        scriptToLoad: 'tools/habit.js'
    },
    {
        id: 'color',
        name: 'Color Converter',
        icon: 'fas fa-palette',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>Color Converter</h1>
                <p>Live convert between HEX, RGB, and HSL.</p>
            </div>
            <div class="color-container">
                <div class="color-preview" id="color-preview">
                    <span id="color-preview-text">#007AFF</span>
                </div>
                <div class="color-inputs">
                    <div class="color-input-group">
                        <label for="color-hex">HEX</label>
                        <input type="text" id="color-hex" value="#007AFF" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="color-input-group">
                        <label for="color-rgb">RGB</label>
                        <input type="text" id="color-rgb" value="rgb(0, 122, 255)" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="color-input-group">
                        <label for="color-hsl">HSL</label>
                        <input type="text" id="color-hsl" value="hsl(211, 100%, 50%)" autocomplete="off" spellcheck="false">
                    </div>
                </div>
            </div>
        `,
        scriptToLoad: 'tools/color.js'
    },
    {
        id: 'decision',
        name: 'Random Picker',
        icon: 'fas fa-dice',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header">
                <h1>Random Picker</h1>
                <p>Can't decide? Let the wheels choose for you.</p>
            </div>
            <div class="decision-container">
                <textarea id="decision-options" placeholder="Enter options here, separated by commas or new lines (e.g. Pizza, Sushi, Burgers)" spellcheck="false"></textarea>
                
                <div class="decision-result-box">
                    <span id="decision-result">Ready to decide?</span>
                </div>

                <button id="decision-btn" class="decision-btn"><i class="fas fa-dice"></i> Pick Randomly!</button>
            </div>
        `,
        scriptToLoad: 'tools/decision.js'
    },
    {
        id: 'jupyter',
        name: 'Python Notebook',
        icon: 'brands fa-python',
        containerClass: 'tool-view',
        htmlGenerator: () => `
            <div class="view-header notes-view-header">
                <div>
                    <h1>Python Notebook</h1>
                    <p>Powered by Pyodide. Runs entirely in your browser.</p>
                </div>
                <div class="notes-actions">
                    <button id="nb-add-code-btn" class="notes-view-btn" title="Add Code Cell"><i class="fas fa-plus"></i> <i class="fas fa-code"></i></button>
                    <button id="nb-clear-all-btn" class="notes-view-btn" title="Clear All Data" style="color: var(--danger);"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            
            <div id="nb-loading-indicator" class="nb-loading-indicator">
                <i class="fas fa-circle-notch fa-spin"></i> Initializing Python Environment (WebAssembly)... this may take a moment.
            </div>

            <div class="nb-container" id="nb-cells-container">
                <!-- Cells generated by JS -->
            </div>
        `,
        scriptToLoad: 'tools/jupyter.js'
    }
];
