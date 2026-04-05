// tools/notes.js
(function initNotesTool() {
    const listEl = document.getElementById('notes-list');
    const titleInput = document.getElementById('quick-notes-title');
    const contentInput = document.getElementById('quick-notes-input');
    const newNoteBtn = document.getElementById('new-note-btn');

    if (!listEl || !titleInput || !contentInput || !newNoteBtn) return;

    let notes = [];
    let activeNoteId = null;

    // Phase 15 Migration: Load existing data
    function loadData() {
        const v2Data = localStorage.getItem('quick-notes-v2');
        if (v2Data) {
            notes = JSON.parse(v2Data);
        } else {
            // Check for v1 string data and migrate
            const v1Data = localStorage.getItem('quick-notes');
            if (v1Data) {
                notes = [{
                    id: Date.now().toString(),
                    title: "Migrated Note",
                    content: v1Data,
                    updatedAt: Date.now()
                }];
                localStorage.removeItem('quick-notes'); // Cleanup old datastore
            } else {
                notes = [];
            }
        }
    }

    function saveData() {
        localStorage.setItem('quick-notes-v2', JSON.stringify(notes));
    }

    function createNote() {
        const newNote = {
            id: Date.now().toString(),
            title: "Untitled Note",
            content: "",
            updatedAt: Date.now()
        };
        notes.unshift(newNote); // Add to top
        activeNoteId = newNote.id;
        saveData();
        render();
    }

    function deleteNote(id, event) {
        event.stopPropagation(); // Prevent row click
        notes = notes.filter(n => n.id !== id);

        if (activeNoteId === id) {
            activeNoteId = notes.length > 0 ? notes[0].id : null;
        }

        saveData();
        render();
    }

    function selectNote(id) {
        activeNoteId = id;
        render();
    }

    function updateActiveNote() {
        if (!activeNoteId) return;
        const note = notes.find(n => n.id === activeNoteId);
        if (note) {
            note.title = titleInput.value;
            note.content = contentInput.value;
            note.updatedAt = Date.now();

            // Re-sort notes so the updated one is at the top conceptually
            notes.sort((a, b) => b.updatedAt - a.updatedAt);

            saveData();
            renderList(); // Only re-render list to prevent cursor loss in editor
        }
    }

    function formatDate(ms) {
        const d = new Date(ms);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function renderList() {
        listEl.innerHTML = '';
        notes.forEach(note => {
            const li = document.createElement('li');
            li.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
            li.onclick = () => selectNote(note.id);

            const displayTitle = note.title.trim() === '' ? 'Untitled Note' : note.title;

            li.innerHTML = `
                <div class="note-item-content">
                    <span class="note-title">${displayTitle}</span>
                    <span class="note-date">${formatDate(note.updatedAt)}</span>
                </div>
                <button class="note-delete-btn" aria-label="Delete note" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            `;

            li.querySelector('.note-delete-btn').onclick = (e) => deleteNote(note.id, e);
            listEl.appendChild(li);
        });
    }

    function renderEditor() {
        if (!activeNoteId) {
            titleInput.value = '';
            contentInput.value = '';
            titleInput.disabled = true;
            contentInput.disabled = true;
            contentInput.placeholder = "Create a new note to start typing...";
            updatePreview();
            return;
        }

        const note = notes.find(n => n.id === activeNoteId);
        if (note) {
            titleInput.disabled = false;
            contentInput.disabled = false;
            contentInput.placeholder = "Type your Markdown here... It will automatically save.";
            titleInput.value = note.title;
            contentInput.value = note.content;
            updatePreview();
        }
    }

    function render() {
        renderList();
        renderEditor();
    }

    // --- Markdown & UI Features ---
    const previewPane = document.getElementById('quick-notes-preview');
    const workspace = document.getElementById('notes-workspace');
    const btnEdit = document.getElementById('view-edit-btn');
    const btnSplit = document.getElementById('view-split-btn');
    const btnPreview = document.getElementById('view-preview-btn');

    function updatePreview() {
        if (!previewPane) return;
        const rawText = contentInput.value;
        if (!rawText.trim()) {
            previewPane.innerHTML = '<div class="markdown-placeholder">Markdown preview will appear here...</div>';
            return;
        }

        if (window.marked) {
            // Configure marked for safer parsing if needed, or just parse
            previewPane.innerHTML = window.marked.parse(rawText);
        } else {
            previewPane.innerHTML = '<div class="markdown-placeholder" style="color:red;">Error: marked.js failed to load.</div>';
        }
    }

    // View Toggles
    function setViewMode(mode) {
        if (!workspace) return;
        
        // Reset buttons
        [btnEdit, btnSplit, btnPreview].forEach(btn => btn?.classList.remove('active'));
        
        // Reset workspace classes
        workspace.classList.remove('edit-only', 'split-view', 'preview-only');
        
        // Apply new mode
        if (mode === 'edit') {
            workspace.classList.add('edit-only');
            btnEdit?.classList.add('active');
        } else if (mode === 'split') {
            workspace.classList.add('split-view');
            btnSplit?.classList.add('active');
        } else if (mode === 'preview') {
            workspace.classList.add('preview-only');
            btnPreview?.classList.add('active');
        }

        // Adjust sync scrolling if needed, handled passively
    }

    btnEdit?.addEventListener('click', () => setViewMode('edit'));
    btnSplit?.addEventListener('click', () => setViewMode('split'));
    btnPreview?.addEventListener('click', () => setViewMode('preview'));

    // Sync Scrolling (Editor -> Preview)
    contentInput.addEventListener('scroll', () => {
        if (workspace?.classList.contains('split-view') && previewPane) {
            const percentage = contentInput.scrollTop / (contentInput.scrollHeight - contentInput.clientHeight);
            if (!isNaN(percentage)) {
                previewPane.scrollTop = percentage * (previewPane.scrollHeight - previewPane.clientHeight);
            }
        }
    });

    // Event Listeners
    newNoteBtn.addEventListener('click', createNote);

    // Auto-save on input
    titleInput.addEventListener('input', updateActiveNote);
    contentInput.addEventListener('input', () => {
        updateActiveNote();
        updatePreview();
    });

    // Initialization logic
    loadData();
    if (notes.length > 0 && !activeNoteId) {
        activeNoteId = notes[0].id;
    } else if (notes.length === 0) {
        createNote(); // Auto-create first note if empty
    } else {
        render(); // Just render if everything is setup
    }
    
    // Default to split view if screen is wide enough, else edit
    if (window.innerWidth > 768) {
        setViewMode('split');
    } else {
        setViewMode('edit');
    }
})();
