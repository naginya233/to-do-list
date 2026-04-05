// tools/decision.js
(function initDecisionTool() {
    const decisionOptionsInput = document.getElementById('decision-options');
    const decisionBtn = document.getElementById('decision-btn');
    const decisionResult = document.getElementById('decision-result');
    const decisionResultBox = document.querySelector('.decision-result-box');
    if (!decisionBtn) return;

    let isDeciding = false;

    decisionBtn.addEventListener('click', () => {
        if (isDeciding) return;

        const rawText = decisionOptionsInput.value;
        if (!rawText.trim()) {
            decisionResult.textContent = 'Please enter some options first!';
            return;
        }

        const options = rawText.split(/[,\n]/).map(opt => opt.trim()).filter(opt => opt !== '');

        if (options.length < 2) {
            decisionResult.textContent = 'Enter at least two options!';
            return;
        }

        isDeciding = true;
        decisionBtn.disabled = true;
        decisionResultBox.classList.remove('highlight');

        let spinCount = 0;
        const maxSpins = 20 + Math.floor(Math.random() * 10);
        let delay = 50;

        function spin() {
            const tempResult = options[Math.floor(Math.random() * options.length)];
            decisionResult.textContent = tempResult;

            spinCount++;

            if (spinCount < maxSpins) {
                if (spinCount > maxSpins * 0.7) {
                    delay += 20;
                }
                setTimeout(spin, delay);
            } else {
                const finalResult = options[Math.floor(Math.random() * options.length)];
                decisionResult.textContent = `🎯 ${finalResult} 🎯`;
                decisionResultBox.classList.add('highlight');
                isDeciding = false;
                decisionBtn.disabled = false;
            }
        }

        spin();
    });
})();
