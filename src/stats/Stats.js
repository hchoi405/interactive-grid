/**
 * Stats: pure statistical computations.
 */

export function overall(samples) {
    if (!samples || samples.length === 0) return { mean: null, variance: null, count: 0 };
    const values = samples.map(s => s.value);
    const count = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / count;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
    return { mean, variance, count };
}

export function meanOfCellMeans(samples, rows, cols, h, v, getCellForPoint) {
    if (!samples || samples.length === 0) return null;
    const cellSamples = {};
    samples.forEach(s => { const c = getCellForPoint(s.x, s.y); const k = `${c.row}-${c.col}`; (cellSamples[k] ||= []).push(s.value); });
    const cellMeans = [];
    for (let r=0;r<rows;r++){ for (let c=0;c<cols;c++){ const values = cellSamples[`${r}-${c}`]; if (values?.length){ cellMeans.push(values.reduce((a,b)=>a+b,0)/values.length); } }}
    if (cellMeans.length === 0) return null;
    return cellMeans.reduce((a,b)=>a+b,0)/cellMeans.length;
}

export function postStratificationMean(samples, rows, cols, h, v, getCellForPoint) {
    if (!samples || samples.length === 0) return null;
    const cellSamples = {};
    samples.forEach(s => { const c = getCellForPoint(s.x, s.y); const k = `${c.row}-${c.col}`; (cellSamples[k] ||= []).push(s.value); });
    const y = [0, ...h.map(p=>p/100), 1]; const x = [0, ...v.map(p=>p/100), 1];
    let stratified = 0;
    for (let r=0;r<rows;r++){
        for (let c=0;c<cols;c++){
            const values = cellSamples[`${r}-${c}`]; if (values?.length){
                const w = (x[c+1]-x[c])*(y[r+1]-y[r]); const n = values.length; const sum = values.reduce((a,b)=>a+b,0);
                stratified += (w/n) * sum;
            }
        }
    }
    return stratified;
}

export function groundTruthMean(distributionParams, rows, cols, h, v, getCellMeanForPosition) {
    if (!distributionParams) return null;
    if (!distributionParams.perCell) return distributionParams.globalMean;
    const y = [0, ...h.map(p=>p/100), 1]; const x = [0, ...v.map(p=>p/100), 1];
    let total = 0, area = 0;
    for (let r=0;r<rows;r++){
        for (let c=0;c<cols;c++){
            const a = (y[r+1]-y[r])*(x[c+1]-x[c]); const m = getCellMeanForPosition(r,c); total += m * a; area += a;
        }
    }
    return total / area;
}

