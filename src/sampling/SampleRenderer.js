/**
 * SampleRenderer: renders samples and updates the color legend.
 */

export default class SampleRenderer {
    constructor(container) { this.container = container; }

    render(samples) {
        this.clear();
        if (!samples || samples.length === 0) { this.updateLegend(); return; }
        const values = samples.map(s => s.value);
        const minValue = Math.min(...values); const maxValue = Math.max(...values); const range = maxValue - minValue;
        samples.forEach(s => {
            const point = document.createElement('div'); point.className = 'sample-point';
            point.style.left = `${s.x * 100}%`; point.style.top = `${s.y * 100}%`;
            const t = range > 0 ? (s.value - minValue) / range : 0; point.style.backgroundColor = this.color(t);
            point.title = `x: ${s.x.toFixed(3)}, y: ${s.y.toFixed(3)}, value: ${s.value.toFixed(3)}`;
            this.container.appendChild(point);
        });
        this.updateLegend(minValue, maxValue);
    }

    clear() {
        this.container.querySelectorAll('.sample-point').forEach(p => p.remove());
    }

    color(t) { const hue = (1 - t) * 240; return `hsl(${hue}, 70%, 50%)`; }

    updateLegend(minValue, maxValue) {
        const minEl = document.getElementById('minValue');
        const maxEl = document.getElementById('maxValue');
        if (!minEl || !maxEl) return;
        if (minValue === undefined || maxValue === undefined) { minEl.textContent = 'Min'; maxEl.textContent = 'Max'; }
        else { minEl.textContent = minValue.toFixed(2); maxEl.textContent = maxValue.toFixed(2); }
    }
}

