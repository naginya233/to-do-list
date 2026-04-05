// tools/color.js
(function initColorTool() {
    const colorPreview = document.getElementById('color-preview');
    const colorPreviewText = document.getElementById('color-preview-text');
    const hexInput = document.getElementById('color-hex');
    const rgbInput = document.getElementById('color-rgb');
    const hslInput = document.getElementById('color-hsl');
    if (!colorPreview) return;

    function isValidHex(hex) {
        return /^#?([0-9A-Fa-f]{3}){1,2}$/.test(hex);
    }

    function hexToRgb(hex) {
        let c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgb(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ')})`;
    }

    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }

    function hexToHsl(hex) {
        let c = hex.substring(1).split('');
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x' + c.join('');
        return rgbToHsl((c >> 16) & 255, (c >> 8) & 255, c & 255);
    }

    function updateColorsFromHex(hex) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (!isValidHex(hex)) return;

        colorPreview.style.backgroundColor = hex;
        colorPreviewText.textContent = hex.toUpperCase();

        rgbInput.value = hexToRgb(hex);
        hslInput.value = hexToHsl(hex);
    }

    hexInput.addEventListener('input', (e) => {
        updateColorsFromHex(e.target.value.trim());
    });

    function cssColorToHex(colorStr) {
        const dummy = document.createElement('div');
        dummy.style.color = colorStr;
        document.body.appendChild(dummy);
        const computed = window.getComputedStyle(dummy).color;
        document.body.removeChild(dummy);

        const rgb = computed.match(/\d+/g);
        if (!rgb || rgb.length < 3) return null;

        const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
        const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
        const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`.toUpperCase();
    }

    rgbInput.addEventListener('change', (e) => {
        const hex = cssColorToHex(e.target.value);
        if (hex) {
            hexInput.value = hex;
            updateColorsFromHex(hex);
        }
    });

    hslInput.addEventListener('change', (e) => {
        const hex = cssColorToHex(e.target.value);
        if (hex) {
            hexInput.value = hex;
            updateColorsFromHex(hex);
        }
    });
})();
