// tools/todo.js
(function initTodoTool() {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const progressText = document.getElementById('progress-text');

    if (!todoForm) return;

    const DEFAULT_TASKS = [
        {
            id: 'preset-math-rant',
            text: '吐槽一张数学卷子 (0/1)',
            completed: false,
            createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString()
        },
        {
            id: 'preset-milk',
            text: '喝一杯温牛奶，奖励辛苦的脑细胞 (0/1)',
            completed: false,
            createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString()
        },
        {
            id: 'preset-rest',
            text: '允许自己发呆 10 分钟 (0/1)',
            completed: false,
            createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
        },
        {
            id: 'preset-mock-exam',
            text: '意识到“一模”只是模拟，不是结局 (Done)',
            completed: true,
            createdAt: new Date(Date.now() - 60 * 1000).toISOString()
        }
    ];

    const storedTasks = JSON.parse(localStorage.getItem('tasks'));
    let tasks = Array.isArray(storedTasks) && storedTasks.length > 0 ? storedTasks : DEFAULT_TASKS;
    let currentFilter = 'all';

    if (!Array.isArray(storedTasks) || storedTasks.length === 0) {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    renderTasks();

    todoInput.addEventListener('input', (e) => {
        emitComfortSignal(e.target.value);
    });

    // Filter Tasks
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    // Clear Completed
    clearCompletedBtn.addEventListener('click', () => {
        tasks = tasks.filter(task => !task.completed);
        saveAndRender();
    });

    // Add new task
    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskText = todoInput.value.trim();

        if (taskText !== '') {
            const newTask = {
                id: Date.now().toString(),
                text: taskText,
                completed: false,
                createdAt: new Date().toISOString()
            };

            tasks.push(newTask);
            emitComfortSignal(taskText);
            saveAndRender();
            todoInput.value = '';

            if (currentFilter === 'completed') {
                document.querySelector('[data-filter="all"]').click();
            }
        }
    });

    function renderTasks() {
        todoList.innerHTML = '';
        const completedCount = tasks.filter(t => t.completed).length;
        progressText.textContent = `${completedCount}/${tasks.length} completed`;

        let filteredTasks = tasks;
        if (currentFilter === 'active') {
            filteredTasks = tasks.filter(task => !task.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(task => task.completed);
        }

        if (filteredTasks.length === 0) {
            const emptyMsg = currentFilter === 'all'
                ? 'No tasks yet. Add one above!'
                : `No ${currentFilter} tasks.`;
            todoList.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 20px 0;">${emptyMsg}</p>`;
            return;
        }

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `todo-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;

            if (currentFilter === 'all') {
                li.setAttribute('draggable', 'true');
            }

            const dateObj = task.createdAt ? new Date(task.createdAt) : new Date();
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            li.innerHTML = `
                <div class="checkbox-wrapper" onclick="toggleTask('${task.id}')">
                    <div class="checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                <div class="task-content">
                    <span class="task-text" ondblclick="editTask('${task.id}')">${escapeHTML(task.text)}</span>
                    <input type="text" class="edit-input" value="${escapeHTML(task.text)}" 
                           onblur="saveEdit('${task.id}', this.value)" 
                           onkeydown="handleEditKey(event, '${task.id}', this.value)">
                    <span class="task-date">${dateStr}</span>
                </div>
                <button class="delete-btn" onclick="deleteTask('${task.id}')" aria-label="Delete task">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            if (currentFilter === 'all') {
                li.addEventListener('dragstart', handleDragStart);
                li.addEventListener('dragover', handleDragOver);
                li.addEventListener('drop', handleDrop);
                li.addEventListener('dragenter', handleDragEnter);
                li.addEventListener('dragleave', handleDragLeave);
                li.addEventListener('dragend', handleDragEnd);
            }

            todoList.appendChild(li);
        });
    }

    let dragSrcEl = null;

    function handleDragStart(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        this.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (dragSrcEl !== this) {
            const srcId = dragSrcEl.dataset.id;
            const targetId = this.dataset.id;

            const srcIndex = tasks.findIndex(t => t.id === srcId);
            const targetIndex = tasks.findIndex(t => t.id === targetId);

            const [draggedItem] = tasks.splice(srcIndex, 1);
            tasks.splice(targetIndex, 0, draggedItem);

            saveAndRender();
        }

        return false;
    }

    function handleDragEnd(e) {
        const items = document.querySelectorAll('.todo-item');
        items.forEach(item => {
            item.classList.remove('drag-over');
            item.classList.remove('dragging');
        });
    }

    window.editTask = (id) => {
        const li = document.querySelector(`[data-id="${id}"]`);
        if (!li || li.classList.contains('completed')) return;

        li.classList.add('editing');
        const input = li.querySelector('.edit-input');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    };

    window.saveEdit = (id, newText) => {
        const li = document.querySelector(`[data-id="${id}"]`);
        const trimmedText = newText.trim();

        if (trimmedText === '') {
            window.deleteTask(id);
            return;
        }

        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, text: trimmedText };
            }
            return task;
        });

        emitComfortSignal(trimmedText);
        saveAndRender();
        if (li) li.classList.remove('editing');
    };

    window.handleEditKey = (e, id, value) => {
        if (e.key === 'Enter') {
            window.saveEdit(id, value);
        } else if (e.key === 'Escape') {
            const li = document.querySelector(`[data-id="${id}"]`);
            if (li) {
                li.classList.remove('editing');
                li.querySelector('.edit-input').value = li.querySelector('.task-text').textContent;
            }
        }
    };

    window.toggleTask = (id) => {
        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, completed: !task.completed };
            }
            return task;
        });
        saveAndRender();
    };

    window.deleteTask = (id) => {
        const li = document.querySelector(`[data-id="${id}"]`);
        if (!li) return;

        li.style.animation = 'none';
        li.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        li.style.opacity = '0';
        li.style.transform = 'translateX(20px)';

        setTimeout(() => {
            tasks = tasks.filter(task => task.id !== id);
            saveAndRender();
        }, 200);
    };

    function saveAndRender() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }

    function emitComfortSignal(inputText) {
        document.dispatchEvent(new CustomEvent('toolbox:todo-input', {
            detail: {
                text: inputText || ''
            }
        }));
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
})();
