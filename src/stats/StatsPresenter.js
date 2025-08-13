import { overall, meanOfCellMeans, postStratificationMean } from './Stats.js';

export default class StatsPresenter {
    update(samples, groundTruthMeanValue, rows, cols, h, v, getCellForPoint) {
        const o = overall(samples);
        if (o.count > 0) {
            document.getElementById('overallCount').textContent = o.count;
            document.getElementById('overallMean').textContent = o.mean.toFixed(3);
            if (groundTruthMeanValue !== null) {
                const mse = Math.pow(o.mean - groundTruthMeanValue, 2);
                document.getElementById('overallMeanMSE').textContent = `MSE: ${mse.toFixed(6)}`;
            } else {
                document.getElementById('overallMeanMSE').textContent = '';
            }
            document.getElementById('overallVariance').textContent = o.variance.toFixed(3);
        } else {
            document.getElementById('overallCount').textContent = '0';
            document.getElementById('overallMean').textContent = '-';
            document.getElementById('overallMeanMSE').textContent = '';
            document.getElementById('overallVariance').textContent = '-';
        }

        if (groundTruthMeanValue !== null) {
            document.getElementById('overallGroundTruthMean').textContent = groundTruthMeanValue.toFixed(3);
        } else {
            document.getElementById('overallGroundTruthMean').textContent = '-';
        }

        const mCell = meanOfCellMeans(samples, rows, cols, h, v, getCellForPoint);
        if (mCell !== null) {
            document.getElementById('meanOfCellMeans').textContent = mCell.toFixed(3);
            if (groundTruthMeanValue !== null) {
                const mse = Math.pow(mCell - groundTruthMeanValue, 2);
                document.getElementById('meanOfCellMeansMSE').textContent = `MSE: ${mse.toFixed(6)}`;
            } else {
                document.getElementById('meanOfCellMeansMSE').textContent = '';
            }
        } else {
            document.getElementById('meanOfCellMeans').textContent = '-';
            document.getElementById('meanOfCellMeansMSE').textContent = '';
        }

        const postStrat = postStratificationMean(samples, rows, cols, h, v, getCellForPoint);
        if (postStrat !== null) {
            document.getElementById('postStratificationMean').textContent = postStrat.toFixed(3);
            if (groundTruthMeanValue !== null) {
                const mse = Math.pow(postStrat - groundTruthMeanValue, 2);
                const overallMeanMse = o.count > 0 ? Math.pow(o.mean - groundTruthMeanValue, 2) : null;
                let mseText = `MSE: ${mse.toFixed(6)}`;
                if (overallMeanMse !== null && mse !== 0) {
                    const comparison = overallMeanMse / mse;
                    mseText += ` (x${comparison.toFixed(2)})`;
                }
                document.getElementById('postStratificationMeanMSE').textContent = mseText;
            } else {
                document.getElementById('postStratificationMeanMSE').textContent = '';
            }
        } else {
            document.getElementById('postStratificationMean').textContent = '-';
            document.getElementById('postStratificationMeanMSE').textContent = '';
        }

        this.updateCellStats(samples, rows, cols, getCellForPoint);
    }

    updateCellStats(samples, rows, cols, getCellForPoint) {
        if (!samples || samples.length === 0) {
            for (let r=0;r<rows;r++){ for (let c=0;c<cols;c++){ const key = `${r}-${c}`; const ce = document.getElementById(`count-${key}`); const me = document.getElementById(`mean-${key}`); const ve = document.getElementById(`variance-${key}`); if (ce) ce.textContent = '0'; if (me) me.textContent = '-'; if (ve) ve.textContent = '-'; }}
            return;
        }
        const cellSamples = {};
        samples.forEach(s => { const cell = getCellForPoint(s.x, s.y); const k = `${cell.row}-${cell.col}`; (cellSamples[k] ||= []).push(s.value); });
        for (let r=0;r<rows;r++){
            for (let c=0;c<cols;c++){
                const key = `${r}-${c}`; const values = cellSamples[key] || [];
                const ce = document.getElementById(`count-${key}`); const me = document.getElementById(`mean-${key}`); const ve = document.getElementById(`variance-${key}`);
                if (values.length > 0) {
                    const mean = values.reduce((a,b)=>a+b,0)/values.length;
                    const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0)/values.length;
                    if (ce) ce.textContent = values.length; if (me) me.textContent = mean.toFixed(3); if (ve) ve.textContent = variance.toFixed(3);
                } else { if (ce) ce.textContent = '0'; if (me) me.textContent = '-'; if (ve) ve.textContent = '-'; }
            }
        }
    }
}

