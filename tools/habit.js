// tools/habit.js
(function initHabitTool() {
    const habitTitleInput = document.getElementById('habit-title');
    const habitGrid = document.getElementById('habit-grid');
    if (!habitTitleInput) return;

    const HABIT_DAYS = 30;
    let habitData = JSON.parse(localStorage.getItem('habit-data')) || {
        title: '',
        days: Array(HABIT_DAYS).fill(false)
    };

    habitTitleInput.value = habitData.title;

    habitTitleInput.addEventListener('input', (e) => {
        habitData.title = e.target.value;
        saveHabitData();
    });

    function saveHabitData() {
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
})();
