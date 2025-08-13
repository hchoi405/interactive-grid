/**
 * Sampler: pure sample generation over a grid.
 */

import { SeededRNG } from './SeededRNG.js';

export default class Sampler {
    constructor(gridState) {
        this.grid = gridState;
        this.rng = null;
    }

    setSeed(seed) { this.rng = seed !== null && seed !== undefined ? new SeededRNG(seed) : null; }

    random() { return this.rng ? this.rng.next() : Math.random(); }

    generate({ sampleCount, perCellDistribution, stratifiedSampling, globalMean, stdDev, cellMeans, cellVariances, seed }) {
        this.setSeed(seed);
        const samples = stratifiedSampling
            ? this.generateStratified(sampleCount, perCellDistribution, globalMean, stdDev, cellMeans, cellVariances)
            : this.generateRandom(sampleCount, perCellDistribution, globalMean, stdDev, cellMeans, cellVariances);

        const distributionParams = {
            perCell: perCellDistribution,
            stratified: stratifiedSampling,
            globalMean,
            stdDev,
            cellMeans: { ...cellMeans },
            cellVariances: { ...cellVariances },
            gridConfiguration: {
                rows: this.grid.rows,
                cols: this.grid.cols,
                horizontalDividers: [...this.grid.horizontalDividers],
                verticalDividers: [...this.grid.verticalDividers]
            }
        };

        const frozenGroundTruthMean = this.calculateGroundTruthMean(distributionParams);
        const frozenColorScale = samples.length
            ? { minValue: Math.min(...samples.map(s => s.value)), maxValue: Math.max(...samples.map(s => s.value)) }
            : null;

        return { samples, distributionParams, frozenGroundTruthMean, frozenColorScale };
    }

    generateStratified(count, perCellDistribution, globalMean, stdDev, cellMeans, cellVariances) {
        const totalCells = this.grid.rows * this.grid.cols;
        const perCell = Math.floor(count / totalCells);
        const remainder = count % totalCells;
        const yPos = [0, ...this.grid.horizontalDividers.map(p => p/100), 1];
        const xPos = [0, ...this.grid.verticalDividers.map(p => p/100), 1];
        const samples = []; let idx = 0;
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.cols; c++) {
                const key = `${r}-${c}`;
                const n = perCell + (idx < remainder ? 1 : 0);
                const yMin = yPos[r], yMax = yPos[r+1];
                const xMin = xPos[c], xMax = xPos[c+1];
                for (let i = 0; i < n; i++) {
                    const x = xMin + this.random() * (xMax - xMin);
                    const y = yMin + this.random() * (yMax - yMin);
                    const value = this.sampleValue(perCellDistribution, globalMean, stdDev, cellMeans, cellVariances, key);
                    samples.push({ x, y, value });
                }
                idx++;
            }
        }
        return samples;
    }

    generateRandom(count, perCellDistribution, globalMean, stdDev, cellMeans, cellVariances) {
        const samples = [];
        for (let i = 0; i < count; i++) {
            const x = this.random(); const y = this.random();
            let value;
            if (perCellDistribution) {
                const cell = this.grid.getCellForPoint(x, y);
                const key = `${cell.row}-${cell.col}`;
                value = this.sampleValue(perCellDistribution, globalMean, stdDev, cellMeans, cellVariances, key);
            } else {
                value = this.normal(globalMean, stdDev);
            }
            samples.push({ x, y, value });
        }
        return samples;
    }

    sampleValue(perCellDistribution, globalMean, stdDev, cellMeans, cellVariances, key) {
        if (perCellDistribution) {
            const mean = cellMeans[key] || 5; const variance = cellVariances[key] || 2; return this.normal(mean, Math.sqrt(variance));
        } else { return this.normal(globalMean, stdDev); }
    }

    normal(mean=0, std=1) {
        let u=0, v=0; while (u===0) u = this.random(); while(v===0) v = this.random();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); return z * std + mean;
    }

    calculateGroundTruthMean(distributionParams) {
        if (!distributionParams) return null;
        if (!distributionParams.perCell) return distributionParams.globalMean;
        const y = [0, ...this.grid.horizontalDividers.map(p => p/100), 1];
        const x = [0, ...this.grid.verticalDividers.map(p => p/100), 1];
        let total = 0, areaSum = 0;
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.cols; c++) {
                const a = (y[r+1]-y[r]) * (x[c+1]-x[c]);
                const key = `${r}-${c}`; const mean = distributionParams.cellMeans?.[key] ?? 5;
                total += mean * a; areaSum += a;
            }
        }
        return total / areaSum;
    }
}

