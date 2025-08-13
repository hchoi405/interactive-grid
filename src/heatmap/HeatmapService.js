/**
 * HeatmapService: orchestrates workers and draws error heatmap.
 */

export default class HeatmapService {
    constructor(container) {
        this.container = container;
        this.heatmapStartTime = null;
    }

    addLogEntry(message, type = '') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;
        const timestamp = new Date().toLocaleTimeString();
        const el = document.createElement('div');
        el.className = `log-entry ${type}`;
        el.textContent = `[${timestamp}] ${message}`;
        logContainer.appendChild(el);
        logContainer.scrollTop = logContainer.scrollHeight;
        while (logContainer.children.length > 50) logContainer.removeChild(logContainer.firstChild);
    }

    showErrorHeatmap(samples, groundTruthMean) {
        if (!samples || samples.length === 0 || groundTruthMean === null) {
            this.addLogEntry('Cannot generate heatmap: No samples or ground truth available', 'error');
            return;
        }
        
        // Calculate grid mean MSE for comparison
        const gridMean = samples.reduce((sum, s) => sum + s.value, 0) / samples.length;
        const gridMeanMSE = Math.pow(gridMean - groundTruthMean, 2);
        
        this.addLogEntry('Starting heatmap calculation...', 'info');
        this.heatmapStartTime = performance.now();
        let heatmapCanvas = this.container.querySelector('.heatmap-canvas');
        if (!heatmapCanvas) {
            heatmapCanvas = document.createElement('canvas');
            heatmapCanvas.className = 'heatmap-canvas';
            Object.assign(heatmapCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '-1', opacity: '0.6' });
            this.container.appendChild(heatmapCanvas);
        }
        const rect = this.container.getBoundingClientRect();
        heatmapCanvas.width = rect.width; heatmapCanvas.height = rect.height;
        const ctx = heatmapCanvas.getContext('2d');
        // Use nearest neighbor interpolation for crisp pixels
        ctx.imageSmoothingEnabled = false;
        const resolution = 1000;
        this.calculateHeatmapParallel(samples, groundTruthMean, gridMeanMSE, resolution, ctx, heatmapCanvas);
    }

    calculateHeatmapParallel(samples, groundTruthMean, gridMeanMSE, resolution, ctx, canvas) {
        const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 24);
        const numWorkers = Math.min(maxWorkers, resolution);
        const rowsPerWorker = Math.ceil(resolution / numWorkers);
        this.addLogEntry(`Using ${numWorkers} workers for ${resolution}x${resolution} calculation (${(resolution*resolution).toLocaleString()} points)`, 'info');
        let completedWorkers = 0; let globalMinError = Infinity; let globalMaxError = -Infinity;
        const allErrors = Array.from({length: resolution}, () => new Array(resolution));
        const workers = [];
        for (let workerIndex = 0; workerIndex < numWorkers; workerIndex++) {
            const startRow = workerIndex * rowsPerWorker; const endRow = Math.min(startRow + rowsPerWorker, resolution);
            if (startRow >= resolution) break;
            const workerUrl = new URL('../workers/heatmap-worker.js', import.meta.url);
            const worker = new Worker(workerUrl, { type: 'module' });
            workers.push(worker);
            worker.postMessage({ samples, groundTruthMean, gridMeanMSE, startRow, endRow, resolution });
            worker.onmessage = (e) => {
                const { errors, minError, maxError, startRow: sRow } = e.data;
                for (let i = 0; i < errors.length; i++) allErrors[sRow + i] = errors[i];
                if (minError !== null) globalMinError = Math.min(globalMinError, minError);
                if (maxError !== null) globalMaxError = Math.max(globalMaxError, maxError);
                completedWorkers++; this.addLogEntry(`Worker ${completedWorkers}/${numWorkers} completed`, 'info');
                if (completedWorkers === numWorkers) {
                    const calcTime = performance.now() - this.heatmapStartTime;
                    this.addLogEntry(`Calculation completed in ${calcTime.toFixed(2)}ms`, 'success');
                    this.addLogEntry('Drawing heatmap...', 'info');
                    const drawStart = performance.now();
                    this.drawHeatmap(ctx, canvas, allErrors, globalMinError, globalMaxError, gridMeanMSE, resolution);
                    const drawTime = performance.now() - drawStart; const totalTime = performance.now() - this.heatmapStartTime;
                    this.addLogEntry(`Drawing completed in ${drawTime.toFixed(2)}ms`, 'success');
                    this.addLogEntry(`Total heatmap generation: ${totalTime.toFixed(2)}ms`, 'success');
                    workers.forEach(w => w.terminate());
                }
            };
            worker.onerror = (error) => {
                console.error('Worker error:', error); this.addLogEntry(`Worker ${workerIndex + 1} failed: ${error.message}`, 'error');
                completedWorkers++;
                if (completedWorkers === numWorkers) { workers.forEach(w => w.terminate()); this.addLogEntry('All workers failed, falling back to single-threaded calculation', 'warning'); this.showErrorHeatmapFallback(samples, groundTruthMean, gridMeanMSE); }
            };
        }
    }

    drawHeatmap(ctx, canvas, errors, minError, maxError, gridMeanMSE, resolution) {
        const cw = canvas.width / resolution; const ch = canvas.height / resolution;
        
        // Calculate log-scale ranges for better differentiation of large improvement ranges
        let minLogRatio = Infinity;
        let maxLogRatio = -Infinity;
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const error = errors[i][j];
                if (error !== null && gridMeanMSE > 0) {
                    const ratio = error / gridMeanMSE;
                    const logRatio = Math.log10(ratio);
                    minLogRatio = Math.min(minLogRatio, logRatio);
                    maxLogRatio = Math.max(maxLogRatio, logRatio);
                }
            }
        }
        
        const logRatioRange = maxLogRatio - minLogRatio;
        
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const error = errors[i][j];
                if (error === null) { ctx.fillStyle = 'rgb(0,0,0)'; }
                else {
                    const ratio = gridMeanMSE > 0 ? error / gridMeanMSE : 1;
                    const logRatio = Math.log10(ratio);
                    
                    // Normalize log ratio within the actual range for color mapping
                    const normalizedLogRatio = logRatioRange > 0 ? (logRatio - minLogRatio) / logRatioRange : 0.5;
                    
                    if (ratio < 1) {
                        // Post-stratification is better - use blue-green gradient with log scale
                        // Better performance (smaller ratio, more negative log) gets brighter colors
                        const intensity = 1 - normalizedLogRatio;
                        const red = Math.round(0 + 80 * (1 - intensity));
                        const green = Math.round(100 + 155 * intensity);
                        const blue = Math.round(200 + 55 * intensity);
                        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                    } else {
                        // Post-stratification is worse - use yellow-red gradient with log scale
                        // Worse performance (larger ratio, more positive log) gets redder colors
                        const intensity = normalizedLogRatio;
                        const red = Math.round(255);
                        const green = Math.round(200 * (1 - intensity));
                        const blue = Math.round(0);
                        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                    }
                }
                ctx.fillRect(j * cw, i * ch, cw, ch);
            }
        }
    }

    showErrorHeatmapFallback(samples, groundTruthMean, gridMeanMSE) {
        const start = performance.now();
        const canvas = this.container.querySelector('.heatmap-canvas'); if (!canvas) return;
        const ctx = canvas.getContext('2d'); 
        // Use nearest neighbor interpolation for crisp pixels
        ctx.imageSmoothingEnabled = false;
        const resolution = 500; const step = 1 / resolution;
        const errors = []; let minError = Infinity; let maxError = -Infinity;
        for (let i = 0; i < resolution; i++) {
            errors[i] = []; const testHPos = (i + 1) * step;
            for (let j = 0; j < resolution; j++) {
                const testVPos = (j + 1) * step;
                const e = calculatePostStratificationError(samples, [testHPos * 100], [testVPos * 100], groundTruthMean);
                errors[i][j] = e; if (e !== null) { minError = Math.min(minError, e); maxError = Math.max(maxError, e); }
            }
        }
        this.addLogEntry(`Single-threaded calculation completed in ${(performance.now()-start).toFixed(2)}ms`, 'success');
        const drawStart = performance.now(); this.drawHeatmap(ctx, canvas, errors, minError, maxError, gridMeanMSE, resolution);
        const drawTime = performance.now() - drawStart; const totalTime = performance.now() - this.heatmapStartTime;
        this.addLogEntry(`Drawing completed in ${drawTime.toFixed(2)}ms`, 'success'); this.addLogEntry(`Total heatmap generation: ${totalTime.toFixed(2)}ms`, 'success');
    }
}

function calculatePostStratificationError(samples, testHorizontalDividers, testVerticalDividers, groundTruthMean) {
    const cellSamples = {}; const y = [0, ...testHorizontalDividers.map(p=>p/100), 1]; const x = [0, ...testVerticalDividers.map(p=>p/100), 1];
    samples.forEach(s => {
        let R = 0, C = 0; for (let r=0;r<y.length-1;r++){ if (s.y >= y[r] && s.y < y[r+1]) { R=r; break; } }
        for (let c=0;c<x.length-1;c++){ if (s.x >= x[c] && s.x < x[c+1]) { C=c; break; } }
        const key = `${R}-${C}`; if (!cellSamples[key]) cellSamples[key] = []; cellSamples[key].push(s.value);
    });
    const rows = y.length - 1, cols = x.length - 1;
    for (let r=0;r<rows;r++){ for (let c=0;c<cols;c++){ const values = cellSamples[`${r}-${c}`] || []; if (values.length < 2) return null; }}
    let stratifiedMean = 0; for (let r=0;r<rows;r++){ for (let c=0;c<cols;c++){ const key = `${r}-${c}`; const values = cellSamples[key]; if (values && values.length>0){ const w = (x[c+1]-x[c])*(y[r+1]-y[r]); const n=values.length; const sum=values.reduce((a,b)=>a+b,0); stratifiedMean += (w/n)*sum; } }}
    return Math.pow(stratifiedMean - groundTruthMean, 2);
}

