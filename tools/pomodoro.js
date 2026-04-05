// tools/pomodoro.js
(function initPomodoroTool() {
    const pomodoroModes = {
        focus: 25 * 60,
        break: 5 * 60
    };

    let currentMode = 'focus';
    let timerTime = pomodoroModes[currentMode];
    let timerInterval = null;
    let isTimerRunning = false;

    const timerTimeEl = document.getElementById('timer-time');
    const timerMainBtn = document.getElementById('timer-main-btn');
    const timerResetBtn = document.getElementById('timer-reset-btn');
    const timerTabs = document.querySelectorAll('.timer-tab');
    const timerCircle = document.querySelector('.timer-progress');

    if (!timerTimeEl) return;

    const circleRadius = 45;
    const circleCircumference = 2 * Math.PI * circleRadius;
    timerCircle.style.strokeDasharray = `${circleCircumference}`;

    function updateTimerDisplay() {
        const minutes = Math.floor(timerTime / 60);
        const seconds = timerTime % 60;
        timerTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const totalDuration = pomodoroModes[currentMode];
        const progress = timerTime / totalDuration;
        const dashoffset = circleCircumference * (1 - progress);
        timerCircle.style.strokeDashoffset = dashoffset;

        if (currentMode === 'focus') {
            timerCircle.style.stroke = 'var(--danger)';
        } else {
            timerCircle.style.stroke = 'var(--primary)';
        }
    }

    function switchMode(mode) {
        if (isTimerRunning) pauseTimer();
        currentMode = mode;
        timerTime = pomodoroModes[currentMode];

        timerTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        updateTimerDisplay();
        timerResetBtn.disabled = true;
    }

    function formatMainBtn(state) {
        if (state === 'start') {
            timerMainBtn.innerHTML = '<i class="fas fa-play"></i> Start';
            timerMainBtn.classList.add('primary');
            timerMainBtn.classList.remove('secondary');
        } else {
            timerMainBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        }
    }

    function startTimer() {
        isTimerRunning = true;
        formatMainBtn('pause');
        timerResetBtn.disabled = false;

        timerInterval = setInterval(() => {
            timerTime--;
            updateTimerDisplay();

            if (timerTime <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                formatMainBtn('start');
                // Auto switch and reset
                if (currentMode === 'focus') {
                    switchMode('break');
                } else {
                    switchMode('focus');
                }
                alert('Time is up!');
            }
        }, 1000);
    }

    function pauseTimer() {
        isTimerRunning = false;
        clearInterval(timerInterval);
        formatMainBtn('start');
    }

    function resetTimer() {
        if (isTimerRunning) pauseTimer();
        timerTime = pomodoroModes[currentMode];
        updateTimerDisplay();
        timerResetBtn.disabled = true;
    }

    timerMainBtn.addEventListener('click', () => {
        if (isTimerRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    timerResetBtn.addEventListener('click', resetTimer);

    timerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.dataset.mode !== currentMode) {
                switchMode(tab.dataset.mode);
            }
        });
    });

    updateTimerDisplay();
})();
