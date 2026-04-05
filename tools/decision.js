// tools/decision.js
(function initDecisionTool() {
    const decisionOptionsInput = document.getElementById('decision-options');
    const decisionBtn = document.getElementById('decision-btn');
    const decisionResult = document.getElementById('decision-result');
    const decisionResultBox = document.querySelector('.decision-result-box');
    if (!decisionBtn) return;

    let isDeciding = false;
    const C_OPTION_HINT = '找凪学长吐苦水，直到心情变好。';

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
        const maxSpins = 28 + Math.floor(Math.random() * 10);
        let delay = 80;

        function spin() {
            const tempResult = options[Math.floor(Math.random() * options.length)];
            decisionResult.textContent = tempResult;

            spinCount++;

            if (spinCount < maxSpins) {
                if (spinCount > maxSpins * 0.55) {
                    delay += 25;
                }
                setTimeout(spin, delay);
            } else {
                const finalResult = pickFinalResult(options);
                decisionResult.textContent = `🎯 ${finalResult} 🎯`;
                decisionResultBox.classList.add('highlight');
                if (finalResult === C_OPTION_HINT) {
                    window.alert('别纠结了，选 C 吧。');
                } else {
                    window.alert('别纠结了，选 C 吧。今晚先对自己好一点。');
                }
                isDeciding = false;
                decisionBtn.disabled = false;
            }
        }

        spin();
    });

    function pickFinalResult(options) {
        const preferred = options.find(opt => opt.includes('凪学长'));
        if (preferred && Math.random() < 0.72) {
            return preferred;
        }
        return options[Math.floor(Math.random() * options.length)];
    }
})();
