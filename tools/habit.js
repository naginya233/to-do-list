// tools/habit.js
(function initHabitTool() {
    const sync = window.ToolboxSync || null;
    const habitTitleInput = document.getElementById('habit-title');
    const habitGrid = document.getElementById('habit-grid');
    if (!habitTitleInput) return;

    const HABIT_DAYS = 30;
    const defaultHabitData = {
        title: '',
        days: Array(HABIT_DAYS).fill(false)
    };
    let habitData = sync
        ? sync.readLocal('habit-data', defaultHabitData)
        : (JSON.parse(localStorage.getItem('habit-data')) || defaultHabitData);

    if (!Array.isArray(habitData.days)) {
        habitData.days = Array(HABIT_DAYS).fill(false);
    }
    if (habitData.days.length < HABIT_DAYS) {
        habitData.days = habitData.days.concat(Array(HABIT_DAYS - habitData.days.length).fill(false));
    }
    if (habitData.days.length > HABIT_DAYS) {
        habitData.days = habitData.days.slice(0, HABIT_DAYS);
    }

    habitTitleInput.value = habitData.title;

    habitTitleInput.addEventListener('input', (e) => {
        habitData.title = e.target.value;
        saveHabitData();
    });

    function saveHabitData() {
        if (sync) {
            sync.save({
                toolKey: 'habit',
                storageKey: 'habit-data',
                data: habitData,
                debounceMs: 500
            });
            return;
        }

        localStorage.setItem('habit-data', JSON.stringify(habitData));
    }

    function toggleHabitDay(index) {
        habitData.days[index] = !habitData.days[index];
        saveHabitData();
        renderHabitGrid();
    }

    function renderHabitGrid() {
        habitGrid.innerHTML = '';

        for (let i = 0; i < HABIT_DAYS; i++) {
            const dayBox = document.createElement('div');
            dayBox.className = `habit-day ${habitData.days[i] ? 'completed' : ''}`;

            const dayNum = document.createElement('span');
            dayNum.className = 'habit-day-num';
            dayNum.textContent = i + 1;

            dayBox.appendChild(dayNum);
            dayBox.addEventListener('click', () => toggleHabitDay(i));
            habitGrid.appendChild(dayBox);
        }
    }

    renderHabitGrid();

    if (sync) {
        sync.reconcile({
            toolKey: 'habit',
            storageKey: 'habit-data',
            defaultData: habitData,
            onResolved: ({ data, changed }) => {
                if (!data || typeof data !== 'object') return;
                if (!changed) return;

                habitData = {
                    title: String(data.title || ''),
                    days: Array.isArray(data.days) ? data.days.slice(0, HABIT_DAYS) : Array(HABIT_DAYS).fill(false)
                };
                if (habitData.days.length < HABIT_DAYS) {
                    habitData.days = habitData.days.concat(Array(HABIT_DAYS - habitData.days.length).fill(false));
                }

                habitTitleInput.value = habitData.title;
                renderHabitGrid();
            }
        });
    }
})();
