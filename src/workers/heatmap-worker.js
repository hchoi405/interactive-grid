/**
 * Web Worker for heatmap calculations (module)
 */

self.onmessage = function(e) {
    const { samples, groundTruthMean, gridMeanMSE, startRow, endRow, resolution } = e.data;

    const errors = [];
    const step = 1 / resolution;
    let minError = Infinity;
    let maxError = -Infinity;

    for (let i = startRow; i < endRow; i++) {
        errors[i - startRow] = [];
        const testHPos = (i + 1) * step;
        for (let j = 0; j < resolution; j++) {
            const testVPos = (j + 1) * step;
            const testError = calculatePostStratificationError(
                samples,
                [testHPos * 100],
                [testVPos * 100],
                groundTruthMean
            );
            errors[i - startRow][j] = testError;
            if (testError !== null) {
                minError = Math.min(minError, testError);
                maxError = Math.max(maxError, testError);
            }
        }
    }

    self.postMessage({
        errors,
        minError: minError === Infinity ? null : minError,
        maxError: maxError === -Infinity ? null : maxError,
        startRow,
        endRow
    });
};

function calculatePostStratificationError(samples, testHorizontalDividers, testVerticalDividers, groundTruthMean) {
    const cellSamples = {};
    const yPositions = [0, ...testHorizontalDividers.map(p => p/100), 1];
    const xPositions = [0, ...testVerticalDividers.map(p => p/100), 1];
    samples.forEach(sample => {
        let cellRow = 0;
        let cellCol = 0;
        for (let r = 0; r < yPositions.length - 1; r++) {
            if (sample.y >= yPositions[r] && sample.y < yPositions[r + 1]) { cellRow = r; break; }
        }
        for (let c = 0; c < xPositions.length - 1; c++) {
            if (sample.x >= xPositions[c] && sample.x < xPositions[c + 1]) { cellCol = c; break; }
        }
        const key = `${cellRow}-${cellCol}`;
        if (!cellSamples[key]) cellSamples[key] = [];
        cellSamples[key].push(sample.value);
    });
    const testRows = yPositions.length - 1;
    const testCols = xPositions.length - 1;
    for (let row = 0; row < testRows; row++) {
        for (let col = 0; col < testCols; col++) {
            const key = `${row}-${col}`;
            const values = cellSamples[key] || [];
            if (values.length < 2) return null;
        }
    }
    let stratifiedMean = 0;
    for (let row = 0; row < testRows; row++) {
        for (let col = 0; col < testCols; col++) {
            const key = `${row}-${col}`;
            const values = cellSamples[key];
            if (values && values.length > 0) {
                const cellWidth = xPositions[col + 1] - xPositions[col];
                const cellHeight = yPositions[row + 1] - yPositions[row];
                const cellVolume = cellWidth * cellHeight;
                const numSamples = values.length;
                const sumValues = values.reduce((a, b) => a + b, 0);
                stratifiedMean += (cellVolume / numSamples) * sumValues;
            }
        }
    }
    return Math.pow(stratifiedMean - groundTruthMean, 2);
}

