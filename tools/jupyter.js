// tools/jupyter.js
(function initJupyterTool() {
    const sync = window.ToolboxSync || null;
    const cellsContainer = document.getElementById('nb-cells-container');
    const addCodeBtn = document.getElementById('nb-add-code-btn');
    const clearAllBtn = document.getElementById('nb-clear-all-btn');
    const loaderId = document.getElementById('nb-loading-indicator');

    if (!cellsContainer || !addCodeBtn || !clearAllBtn) return;

    let pyodideInstance = null;
    let isPyodideLoading = false;
    
    // Notebook State
    let cells = sync
        ? sync.readLocal('jupyter-cells', [])
        : (JSON.parse(localStorage.getItem('jupyter-cells')) || []);
    
    // Output buffering for Pyodide
    let stdoutBuffer = [];
    let stderrBuffer = [];

    // --- Pyodide Initialization ---
    async function initPyodide() {
        if (pyodideInstance || isPyodideLoading) return;
        isPyodideLoading = true;
        
        try {
            // Load the script dynamically if not present
            if (!window.loadPyodide) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.body.appendChild(script);
                });
            }

            pyodideInstance = await window.loadPyodide({
                stdout: (text) => { stdoutBuffer.push(text); },
                stderr: (text) => { stderrBuffer.push(text); }
            });

            console.log("Pyodide loaded successfully.");
            if (loaderId) loaderId.style.display = 'none';

        } catch (error) {
            console.error("Failed to load Pyodide:", error);
            if (loaderId) {
                loaderId.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed to load Python environment: ${error.message}`;
                loaderId.style.color = 'var(--danger)';
            }
        } finally {
            isPyodideLoading = false;
        }
    }

    // --- Cell Management ---
    function saveCells() {
        if (sync) {
            sync.save({
                toolKey: 'jupyter',
                storageKey: 'jupyter-cells',
                data: cells,
                debounceMs: 600
            });
            return;
        }

        localStorage.setItem('jupyter-cells', JSON.stringify(cells));
    }

    function createCell(code = "") {
        const newCell = {
            id: 'cell_' + Date.now(),
            code: code,
            output: '',
            error: false
        };
        cells.push(newCell);
        saveCells();
        renderCells();
    }

    function deleteCell(id) {
        cells = cells.filter(c => c.id !== id);
        saveCells();
        renderCells();
    }

    function moveCell(id, direction) {
        const index = cells.findIndex(c => c.id === id);
        if (index < 0) return;
        
        if (direction === 'up' && index > 0) {
            const temp = cells[index - 1];
            cells[index - 1] = cells[index];
            cells[index] = temp;
        } else if (direction === 'down' && index < cells.length - 1) {
            const temp = cells[index + 1];
            cells[index + 1] = cells[index];
            cells[index] = temp;
        }
        saveCells();
        renderCells();
    }

    // --- Execution ---
    async function runCell(id) {
        const cell = cells.find(c => c.id === id);
        const cellDOM = document.getElementById(id);
        if (!cell || !cellDOM) return;

        // Update code from textarea before running
        const textarea = cellDOM.querySelector('.nb-cell-input');
        cell.code = textarea.value;

        const runBtnIcon = cellDOM.querySelector('.nb-run-btn i');
        const outputDOM = cellDOM.querySelector('.nb-cell-output');
        
        // Wait for Pyodide if still loading
        if (!pyodideInstance) {
            outputDOM.textContent = "Waiting for Python environment to initialize...";
            outputDOM.style.display = 'block';
            await initPyodide();
        }

        if (!pyodideInstance) {
            outputDOM.textContent = "Error: Python environment is not available.";
            return;
        }

        // UI Loading state
        runBtnIcon.className = "fas fa-spinner fa-spin";
        outputDOM.style.display = 'block';
        outputDOM.className = 'nb-cell-output running';
        outputDOM.textContent = "Running...";

        // Clear buffers
        stdoutBuffer = [];
        stderrBuffer = [];

        try {
            // Execute Python Code
            let result = await pyodideInstance.runPythonAsync(cell.code);
            
            // Format output safely
            let finalOutput = stdoutBuffer.join("\n");
            
            // If the last expression evaluates to something (and isn't explicitly printed)
            if (result !== undefined && result !== null) {
                if (finalOutput) finalOutput += "\n";
                finalOutput += String(result);
            }

            cell.output = finalOutput;
            cell.error = false;

            outputDOM.className = 'nb-cell-output success';
            outputDOM.textContent = cell.output || "✅ (No output)";

        } catch (err) {
            cell.output = stderrBuffer.join("\n") + "\n" + err.message;
            cell.error = true;
            
            outputDOM.className = 'nb-cell-output error';
            outputDOM.textContent = cell.output;
        }

        runBtnIcon.className = "fas fa-play";
        saveCells();
    }

    // --- Rendering ---
    function renderCells() {
        cellsContainer.innerHTML = '';
        
        if (cells.length === 0) {
            cellsContainer.innerHTML = `
                <div class="placeholder-content" style="margin-top: 20px;">
                    <i class="brands fa-python" style="font-size: 3rem; margin-bottom: 15px; color: var(--text-muted); opacity: 0.5;"></i>
                    <p>No notebook cells. Click the "+ Add Code Cell" button to start coding in Python!</p>
                </div>
            `;
            return;
        }

        cells.forEach((cell, index) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'nb-cell';
            cellDiv.id = cell.id;

            cellDiv.innerHTML = `
                <div class="nb-cell-controls">
                    <span class="nb-cell-index">[${index + 1}]</span>
                    <div class="nb-cell-actions">
                        <button class="nb-btn nb-run-btn" title="Run Cell (Shift+Enter)"><i class="fas fa-play"></i></button>
                        <button class="nb-btn nb-move-up" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                        <button class="nb-btn nb-move-down" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                        <button class="nb-btn nb-delete-btn" title="Delete Cell"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <textarea class="nb-cell-input" spellcheck="false" placeholder="# Type Python code here...">${cell.code}</textarea>
                <div class="nb-cell-output ${cell.error ? 'error' : (cell.output ? 'success' : '')}" style="${cell.output || cell.error ? 'display: block;' : 'display: none;'}">
                    ${cell.output}
                </div>
            `;

            // Auto-resize textarea logic
            const textarea = cellDiv.querySelector('textarea');
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
                
                // Save state softly
                cell.code = this.value;
                saveCells();
            });
            // Initial resize
            setTimeout(() => {
                textarea.style.height = 'auto';
                textarea.style.height = (textarea.scrollHeight) + 'px';
            }, 0);

            // Shift+Enter to run
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    runCell(cell.id);
                }
            });

            // Bind buttons
            cellDiv.querySelector('.nb-run-btn').onclick = () => runCell(cell.id);
            cellDiv.querySelector('.nb-move-up').onclick = () => moveCell(cell.id, 'up');
            cellDiv.querySelector('.nb-move-down').onclick = () => moveCell(cell.id, 'down');
            cellDiv.querySelector('.nb-delete-btn').onclick = () => deleteCell(cell.id);

            cellsContainer.appendChild(cellDiv);
        });
    }

    // --- Initialization & Bindings ---
    addCodeBtn.addEventListener('click', () => createCell(""));
    
    clearAllBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete all notebook cells?")) {
            cells = [];
            saveCells();
            renderCells();
        }
    });

    renderCells();

    if (sync) {
        sync.reconcile({
            toolKey: 'jupyter',
            storageKey: 'jupyter-cells',
            defaultData: cells,
            onResolved: ({ data, changed }) => {
                if (!Array.isArray(data) || !changed) return;
                cells = data;
                renderCells();
            }
        });
    }
    
    // Start loading Python in the background immediately
    initPyodide();

})();
