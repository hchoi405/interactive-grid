import GridState from '../grid/GridState.js';
import GridView from '../grid/GridView.js';
import HeatmapService from '../heatmap/HeatmapService.js';
import Sampler from '../sampling/Sampler.js';
import SampleRenderer from '../sampling/SampleRenderer.js';
import { groundTruthMean as computeGroundTruth } from '../stats/Stats.js';
import StatsPresenter from '../stats/StatsPresenter.js';

export default class InteractiveGrid {
    constructor() {
        this.gridContainer = document.getElementById('grid');
        this.canvas = document.getElementById('visualization');
        this.ctx = this.canvas.getContext('2d');

        this.cellMeans = {};
        this.cellVariances = {};
        this.heatmapVisible = false;
        this.cacheKey = 'interactiveGrid_config';

        this.gridState = new GridState(2, 2);
        this.gridView = new GridView(this.gridContainer, this.gridState);
        this.gridView.setOnGridChange(() => this.handleGridChange());
        this.heatmap = new HeatmapService(this.gridContainer);
        this.sampler = new Sampler(this.gridState);
        this.sampleRenderer = new SampleRenderer(this.gridContainer);
        this.statsPresenter = new StatsPresenter();

        this.samples = [];
        this.distributionParams = null;
        this.frozenGroundTruthMean = null;
        this.frozenColorScale = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConfiguration();
        this.createCellMeanControls();
        this.recreateCellStatistics();
        this.gridView.render();
        this.updateStatistics();
        this.syncLegendWidth();
    }

    createCellMeanControls() {
        const container = document.getElementById('cellMeansContainer');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.gridState.cols}, 1fr)`;
        for (let row = 0; row < this.gridState.rows; row++) {
            for (let col = 0; col < this.gridState.cols; col++) {
                const key = `${row}-${col}`;
                if (!(key in this.cellMeans)) this.cellMeans[key] = (row + col + 2) * 2;
                const controlDiv = document.createElement('div');
                controlDiv.className = 'cell-control';
                const label = document.createElement('label'); label.textContent = `C${row+1},${col+1}:`;
                const meanInput = document.createElement('input');
                meanInput.type = 'number'; meanInput.id = `cellMean-${key}`; meanInput.min = '-10'; meanInput.max = '10'; meanInput.step = '0.1'; meanInput.value = this.cellMeans[key]; meanInput.title = 'Mean';
                const varianceInput = document.createElement('input');
                varianceInput.type = 'number'; varianceInput.id = `cellVariance-${key}`; varianceInput.min = '0.1'; varianceInput.max = '10'; varianceInput.step = '0.1'; varianceInput.value = this.cellVariances[key]; varianceInput.title = 'Variance';
                if (!(key in this.cellVariances)) { this.cellVariances[key] = 2; varianceInput.value = 2; }
                meanInput.addEventListener('input', (e) => { this.cellMeans[key] = parseFloat(e.target.value); if (this.samples.length > 0) this.updateStatistics(); this.saveConfiguration(); });
                varianceInput.addEventListener('input', (e) => { this.cellVariances[key] = parseFloat(e.target.value); if (this.samples.length > 0) this.updateStatistics(); this.saveConfiguration(); });
                controlDiv.appendChild(label); controlDiv.appendChild(meanInput); controlDiv.appendChild(varianceInput); container.appendChild(controlDiv);
            }
        }
    }

    syncLegendWidth() {
        const gridContainer = document.querySelector('.grid-container');
        const colorLegend = document.querySelector('.color-legend');
        if (gridContainer && colorLegend) {
            const w = gridContainer.offsetWidth; colorLegend.style.width = `${w}px`; colorLegend.style.minWidth = `${w}px`; colorLegend.style.maxWidth = `${w}px`;
        }
    }

    setupEventListeners() {
        document.getElementById('rows').addEventListener('change', (e) => {
            this.gridState.setDimensions(parseInt(e.target.value), this.gridState.cols);
            this.createCellMeanControls();
            this.recreateCellStatistics();
            this.gridView.render();
            if (this.samples.length > 0) this.updateStatistics();
            this.saveConfiguration();
        });
        document.getElementById('cols').addEventListener('change', (e) => {
            this.gridState.setDimensions(this.gridState.rows, parseInt(e.target.value));
            this.createCellMeanControls();
            this.recreateCellStatistics();
            this.gridView.render();
            if (this.samples.length > 0) this.updateStatistics();
            this.saveConfiguration();
        });
        document.getElementById('sampleCountInput').addEventListener('input', (e) => { const v = Math.max(1, Math.min(10000, parseInt(e.target.value) || 1)); e.target.value = v; this.saveConfiguration(); });
        document.getElementById('globalMean').addEventListener('input', () => { this.saveConfiguration(); });
        document.getElementById('stdDev').addEventListener('input', () => { this.saveConfiguration(); });
        document.getElementById('seed').addEventListener('input', () => { this.saveConfiguration(); });
        document.getElementById('perCellDistribution').addEventListener('change', () => { this.saveConfiguration(); });
        document.getElementById('stratifiedSampling').addEventListener('change', () => { this.saveConfiguration(); });
        document.getElementById('generateBtn').addEventListener('click', () => { this.generateSamples(); });
        document.getElementById('clearBtn').addEventListener('click', () => { this.clearSamples(); });
        document.getElementById('resetBtn').addEventListener('click', () => { this.resetGrid(); });
        document.getElementById('heatmapBtn').addEventListener('click', () => { this.toggleErrorHeatmap(); });
        window.addEventListener('resize', () => { this.syncLegendWidth(); });
    }

    handleGridChange() {
        this.updateCanvas();
        if (this.samples.length > 0) {
            this.sampleRenderer.render(this.samples);
            this.updateStatistics();
            if (!this.heatmapVisible) {
                const distributionParams = this.distributionParams;
                const frozenColorScale = this.frozenColorScale;
                if (distributionParams && distributionParams.perCell && distributionParams.cellMeans && frozenColorScale && distributionParams.gridConfiguration) {
                    this.gridView.updateCellColors(distributionParams.cellMeans, frozenColorScale, distributionParams.gridConfiguration);
                }
            }
        }
        setTimeout(() => this.syncLegendWidth(), 0);
        this.saveConfiguration();
    }

    generateSamples() {
        const sampleCount = parseInt(document.getElementById('sampleCountInput').value);
        const perCellDistribution = document.getElementById('perCellDistribution').checked;
        const stratifiedSampling = document.getElementById('stratifiedSampling').checked;
        const globalMean = parseFloat(document.getElementById('globalMean').value);
        const stdDev = parseFloat(document.getElementById('stdDev').value);
        const seedInput = document.getElementById('seed').value; const seed = seedInput.trim() === '' ? null : parseInt(seedInput);

        const result = this.sampler.generate({ sampleCount, perCellDistribution, stratifiedSampling, globalMean, stdDev, cellMeans: this.cellMeans, cellVariances: this.cellVariances, seed });
        this.samples = result.samples;
        this.distributionParams = result.distributionParams;
        this.frozenGroundTruthMean = result.frozenGroundTruthMean;
        this.frozenColorScale = result.frozenColorScale;

        this.sampleRenderer.render(this.samples);

        if (perCellDistribution) {
            const dp = this.distributionParams; const cs = this.frozenColorScale;
            if (dp && dp.cellMeans && cs && dp.gridConfiguration) this.gridView.updateCellColors(dp.cellMeans, cs, dp.gridConfiguration);
        } else { this.gridView.clearOverlays(); }

        this.recreateCellStatistics();
        this.updateStatistics();

        if (this.heatmapVisible) {
            this.heatmapVisible = false; const btn = document.getElementById('heatmapBtn'); btn.textContent = 'Show Error Heatmap'; btn.classList.remove('primary'); btn.classList.add('secondary');
        }
    }

    getCellMeanForPosition(row, col) {
        const dp = this.distributionParams; if (!dp || !dp.perCell) return dp ? dp.globalMean : 5;
        const key = `${row}-${col}`; return dp.cellMeans && dp.cellMeans[key] ? dp.cellMeans[key] : 5;
    }

    calculateGroundTruthMean() {
        return computeGroundTruth(
            this.distributionParams,
            this.gridState.rows,
            this.gridState.cols,
            this.gridState.horizontalDividers,
            this.gridState.verticalDividers,
            (row, col) => this.getCellMeanForPosition(row, col)
        );
    }

    updateStatistics() {
        const samples = this.samples;
        const groundTruthMean = samples.length > 0 ? this.frozenGroundTruthMean : this.calculateGroundTruthMean();
        this.statsPresenter.update(
            samples,
            groundTruthMean,
            this.gridState.rows,
            this.gridState.cols,
            this.gridState.horizontalDividers,
            this.gridState.verticalDividers,
            (x, y) => this.gridState.getCellForPoint(x, y)
        );
    }

    recreateCellStatistics() {
        const container = document.getElementById('cellStatsContainer');
        container.innerHTML = '';
        for (let row = 0; row < this.gridState.rows; row++) {
            for (let col = 0; col < this.gridState.cols; col++) {
                const key = `${row}-${col}`;
                const cellDiv = document.createElement('div'); cellDiv.className = 'cell-stat fade-in'; cellDiv.id = `cell-stat-${key}`;
                const title = document.createElement('h5'); title.textContent = `Cell ${row + 1},${col + 1}`; cellDiv.appendChild(title);
                const countItem = document.createElement('div'); countItem.className = 'stat-item'; countItem.innerHTML = '<span>Count:</span><span id="count-' + key + '\">0</span>'; cellDiv.appendChild(countItem);
                const meanItem = document.createElement('div'); meanItem.className = 'stat-item'; meanItem.innerHTML = '<span>Mean:</span><span id="mean-' + key + '\">-</span>'; cellDiv.appendChild(meanItem);
                const varianceItem = document.createElement('div'); varianceItem.className = 'stat-item'; varianceItem.innerHTML = '<span>Variance:</span><span id="variance-' + key + '\">-</span>'; cellDiv.appendChild(varianceItem);
                container.appendChild(cellDiv);
            }
        }
    }

    updateCanvas() {
        const rect = this.gridContainer.getBoundingClientRect(); this.canvas.width = rect.width - 4; this.canvas.height = rect.height - 4;
    }

    clearSamples() {
        this.samples = [];
        this.sampleRenderer.clear();
        this.gridView.clearOverlays();
        this.heatmapVisible = false; const btn = document.getElementById('heatmapBtn'); btn.textContent = 'Show Error Heatmap'; btn.classList.remove('primary'); btn.classList.add('secondary');
        this.updateStatistics();
    }

    saveConfiguration() {
        const config = {
            rows: this.gridState.rows,
            cols: this.gridState.cols,
            horizontalDividers: [...this.gridState.horizontalDividers],
            verticalDividers: [...this.gridState.verticalDividers],
            cellMeans: { ...this.cellMeans },
            cellVariances: { ...this.cellVariances },
            globalMean: parseFloat(document.getElementById('globalMean').value),
            stdDev: parseFloat(document.getElementById('stdDev').value),
            seed: document.getElementById('seed').value,
            sampleCount: parseInt(document.getElementById('sampleCountInput').value),
            perCellDistribution: document.getElementById('perCellDistribution').checked,
            stratifiedSampling: document.getElementById('stratifiedSampling').checked,
            savedAt: new Date().toISOString()
        };
        try { localStorage.setItem(this.cacheKey, JSON.stringify(config)); } catch (e) { console.warn('Failed to save configuration:', e); }
    }

    loadConfiguration() {
        try {
            const saved = localStorage.getItem(this.cacheKey); if (!saved) return; const c = JSON.parse(saved);
            this.gridState.rows = c.rows || 2; this.gridState.cols = c.cols || 2; this.gridState.horizontalDividers = c.horizontalDividers || [50]; this.gridState.verticalDividers = c.verticalDividers || [50];
            this.cellMeans = c.cellMeans || {}; this.cellVariances = c.cellVariances || {};
            document.getElementById('rows').value = c.rows || 2; document.getElementById('cols').value = c.cols || 2;
            document.getElementById('globalMean').value = c.globalMean || 5; document.getElementById('stdDev').value = c.stdDev || 2;
            document.getElementById('seed').value = c.seed || ''; document.getElementById('sampleCountInput').value = c.sampleCount || 64;
            document.getElementById('perCellDistribution').checked = c.perCellDistribution !== false; document.getElementById('stratifiedSampling').checked = c.stratifiedSampling || false;
        } catch (e) { console.warn('Failed to load configuration:', e); }
    }

    clearConfiguration() { try { localStorage.removeItem(this.cacheKey); } catch (e) { console.warn('Failed to clear configuration:', e); } }

    resetGrid() {
        this.gridState.resetDividers(); this.gridView.render(); if (this.samples.length > 0) this.updateStatistics();
    }

    toggleErrorHeatmap() {
        const samples = this.samples; const groundTruthMean = this.frozenGroundTruthMean; const btn = document.getElementById('heatmapBtn');
        if (samples.length === 0) { alert('Please generate samples first to show the error heatmap.'); return; }
        if (groundTruthMean === null) { alert('No ground truth mean available for error calculation.'); return; }
        this.heatmapVisible = !this.heatmapVisible;
        if (this.heatmapVisible) { 
            this.gridView.clearOverlays(); // Clear cell background colors when showing heatmap
            this.heatmap.showErrorHeatmap(samples, groundTruthMean); 
            btn.textContent = 'Hide Error Heatmap'; btn.classList.remove('secondary'); btn.classList.add('primary'); 
        }
        else { this.restoreNormalView(); btn.textContent = 'Show Error Heatmap'; btn.classList.remove('primary'); btn.classList.add('secondary'); }
    }

    restoreNormalView() {
        const dp = this.distributionParams; const cs = this.frozenColorScale;
        if (dp && dp.perCell && dp.cellMeans && cs && dp.gridConfiguration) this.gridView.updateCellColors(dp.cellMeans, cs, dp.gridConfiguration);
        else this.gridView.clearOverlays();
    }
}
