/**
 * GridState: holds rows/cols and divider positions, no DOM.
 */

export default class GridState {
    constructor(rows = 2, cols = 2) {
        this.rows = rows;
        this.cols = cols;
        this.horizontalDividers = [50];
        this.verticalDividers = [50];
        this.resetDividers();
    }

    resetDividers() {
        this.horizontalDividers = [];
        this.verticalDividers = [];
        for (let i = 1; i < this.rows; i++) this.horizontalDividers.push((i / this.rows) * 100);
        for (let i = 1; i < this.cols; i++) this.verticalDividers.push((i / this.cols) * 100);
    }

    setDimensions(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.resetDividers();
    }

    getCellForPoint(x, y) {
        const yPositions = [0, ...this.horizontalDividers.map(p => p/100), 1];
        const xPositions = [0, ...this.verticalDividers.map(p => p/100), 1];
        let row = 0, col = 0;
        for (let i = 0; i < yPositions.length - 1; i++) { if (y >= yPositions[i] && y < yPositions[i + 1]) { row = i; break; } }
        for (let i = 0; i < xPositions.length - 1; i++) { if (x >= xPositions[i] && x < xPositions[i + 1]) { col = i; break; } }
        return { row, col };
    }
}

