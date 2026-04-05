// tools/password.js
(function initPasswordTool() {
    const pwdResult = document.getElementById('pwd-result');
    const pwdGenerateBtn = document.getElementById('pwd-generate-btn');
    const pwdCopyBtn = document.getElementById('pwd-copy-btn');
    const pwdLengthSlider = document.getElementById('pwd-length');
    const pwdLengthVal = document.getElementById('pwd-length-val');

    const pwdUpper = document.getElementById('pwd-upper');
    const pwdLower = document.getElementById('pwd-lower');
    const pwdNumbers = document.getElementById('pwd-numbers');
    const pwdSymbols = document.getElementById('pwd-symbols');

    if (!pwdGenerateBtn) return;

    const pwdChars = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
    };

    pwdLengthSlider.addEventListener('input', (e) => {
        pwdLengthVal.textContent = e.target.value;
    });

    function generatePassword() {
        let charPool = '';
        if (pwdUpper.checked) charPool += pwdChars.upper;
        if (pwdLower.checked) charPool += pwdChars.lower;
        if (pwdNumbers.checked) charPool += pwdChars.numbers;
        if (pwdSymbols.checked) charPool += pwdChars.symbols;

        if (charPool === '') {
            pwdResult.textContent = 'Select at least one option!';
            return;
        }

        const length = parseInt(pwdLengthSlider.value);
        let password = '';
        const randomValues = new Uint32Array(length);
        window.crypto.getRandomValues(randomValues);

        for (let i = 0; i < length; i++) {
            password += charPool[randomValues[i] % charPool.length];
        }

        pwdResult.textContent = password;
        pwdResult.style.color = 'var(--text-main)';
    }

    pwdGenerateBtn.addEventListener('click', generatePassword);

    pwdCopyBtn.addEventListener('click', () => {
        const passwordToCopy = pwdResult.textContent;
        if (passwordToCopy === 'Select at least one option!' || passwordToCopy === 'P@ssw0rd123!') return;

        navigator.clipboard.writeText(passwordToCopy).then(() => {
            const originalHTML = pwdCopyBtn.innerHTML;
            pwdCopyBtn.innerHTML = '<i class="fas fa-check" style="color: #34c759;"></i>';
            setTimeout(() => {
                pwdCopyBtn.innerHTML = originalHTML;
            }, 2000);
        });
    });
})();
