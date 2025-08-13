/**
 * GridView: renders grid DOM and handles interactions; depends on GridState.
 */

export default class GridView {
    constructor(container, gridState) {
        this.container = container;
        this.state = gridState;
        this.isDragging = false;
        this.dragElement = null;
        this.onGridChange = null;
        this.attachEvents();
    }

    setOnGridChange(cb) { this.onGridChange = cb; }

    render() {
        const overlay = this.container.querySelector('.overlay-container');
        const heatmapCanvas = this.container.querySelector('.heatmap-canvas');
        let preserveOverlay = null, preserveHeatmap = null;
        if (overlay) { preserveOverlay = overlay; overlay.remove(); }
        if (heatmapCanvas) { preserveHeatmap = heatmapCanvas; preserveHeatmap.remove(); }
        this.container.innerHTML = '';
        this.createCells();
        this.createDividers();
        if (preserveOverlay) this.container.appendChild(preserveOverlay);
        if (preserveHeatmap) this.container.appendChild(preserveHeatmap);
        if (this.onGridChange) this.onGridChange();
    }

    createCells() {
        const y = [0, ...this.state.horizontalDividers, 100];
        const x = [0, ...this.state.verticalDividers, 100];
        for (let r = 0; r < this.state.rows; r++) {
            for (let c = 0; c < this.state.cols; c++) {
                const cell = document.createElement('div');
                // Don't add fade-in animation when dragging boundary control points
                cell.className = this.isDragging ? 'grid-cell' : 'grid-cell fade-in';
                cell.dataset.row = r; cell.dataset.col = c; cell.id = `grid-cell-${r}-${c}`;
                const top = y[r], bottom = y[r+1], left = x[c], right = x[c+1];
                const width = right - left, height = bottom - top;
                const area = (width * height / 10000 * 100).toFixed(1);
                cell.style.left = `${left}%`; cell.style.top = `${top}%`;
                cell.style.width = `${width}%`; cell.style.height = `${height}%`;
                cell.textContent = `Cell ${r+1},${c+1}\n${area}%`;
                this.container.appendChild(cell);
            }
        }
    }

    createDividers() {
        this.state.horizontalDividers.forEach((pos, idx) => {
            const d = document.createElement('div');
            d.className = 'grid-divider horizontal'; d.style.top = `${pos}%`;
            d.dataset.type = 'horizontal'; d.dataset.index = idx;
            this.container.appendChild(d);
        });
        this.state.verticalDividers.forEach((pos, idx) => {
            const d = document.createElement('div');
            d.className = 'grid-divider vertical'; d.style.left = `${pos}%`;
            d.dataset.type = 'vertical'; d.dataset.index = idx;
            this.container.appendChild(d);
        });
        this.state.horizontalDividers.forEach((hPos, hIndex) => {
            this.state.verticalDividers.forEach((vPos, vIndex) => {
                const i = document.createElement('div');
                i.className = 'grid-divider intersection';
                i.style.left = `${vPos}%`; i.style.top = `${hPos}%`;
                i.dataset.type = 'intersection'; i.dataset.hIndex = hIndex; i.dataset.vIndex = vIndex;
                this.container.appendChild(i);
            });
        });
    }

    updateCellColors(cellMeans, frozenColorScale, frozenGridConfig) {
        if (!cellMeans || Object.keys(cellMeans).length === 0 || !frozenColorScale || !frozenGridConfig) {
            this.clearOverlays();
            return;
        }
        this.clearOverlays();
        const overlay = document.createElement('div');
        overlay.className = 'overlay-container';
        Object.assign(overlay.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '-1' });
        this.container.appendChild(overlay);
        const { minValue, maxValue } = frozenColorScale; const range = maxValue - minValue;
        const fr = frozenGridConfig.rows, fc = frozenGridConfig.cols;
        const fy = [0, ...frozenGridConfig.horizontalDividers.map(p=>p/100), 1];
        const fx = [0, ...frozenGridConfig.verticalDividers.map(p=>p/100), 1];
        for (let r = 0; r < fr; r++) {
            for (let c = 0; c < fc; c++) {
                const key = `${r}-${c}`; if (cellMeans[key] === undefined) continue;
                const top = fy[r] * 100, bottom = fy[r+1] * 100, left = fx[c] * 100, right = fx[c+1] * 100;
                const div = document.createElement('div');
                div.className = 'frozen-cell-color';
                Object.assign(div.style, { position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${right-left}%`, height: `${bottom-top}%`, pointerEvents: 'none' });
                const normalized = range > 0 ? (cellMeans[key] - minValue) / range : 0;
                const hue = (1 - normalized) * 240;
                div.style.backgroundColor = `hsla(${hue}, 50%, 75%, 0.7)`;
                overlay.appendChild(div);
            }
        }
    }

    clearOverlays() {
        const overlay = this.container.querySelector('.overlay-container');
        if (overlay) overlay.remove();
        const heatmapCanvas = this.container.querySelector('.heatmap-canvas');
        if (heatmapCanvas) heatmapCanvas.remove();
        for (let r = 0; r < this.state.rows; r++) {
            for (let c = 0; c < this.state.cols; c++) {
                const cell = document.getElementById(`grid-cell-${r}-${c}`);
                if (cell) cell.style.backgroundColor = '';
            }
        }
    }

    renderDividers() {
        // Update horizontal dividers
        this.state.horizontalDividers.forEach((pos, idx) => {
            const divider = this.container.querySelector(`[data-type="horizontal"][data-index="${idx}"]`);
            if (divider) divider.style.top = `${pos}%`;
        });
        // Update vertical dividers
        this.state.verticalDividers.forEach((pos, idx) => {
            const divider = this.container.querySelector(`[data-type="vertical"][data-index="${idx}"]`);
            if (divider) divider.style.left = `${pos}%`;
        });
        // Update intersections
        this.state.horizontalDividers.forEach((hPos, hIndex) => {
            this.state.verticalDividers.forEach((vPos, vIndex) => {
                const intersection = this.container.querySelector(`[data-type="intersection"][data-h-index="${hIndex}"][data-v-index="${vIndex}"]`);
                if (intersection) {
                    intersection.style.left = `${vPos}%`;
                    intersection.style.top = `${hPos}%`;
                }
            });
        });
    }

    updateCellPositions() {
        const y = [0, ...this.state.horizontalDividers, 100];
        const x = [0, ...this.state.verticalDividers, 100];
        for (let r = 0; r < this.state.rows; r++) {
            for (let c = 0; c < this.state.cols; c++) {
                const cell = document.getElementById(`grid-cell-${r}-${c}`);
                if (cell) {
                    const top = y[r], bottom = y[r+1], left = x[c], right = x[c+1];
                    const width = right - left, height = bottom - top;
                    const area = (width * height / 10000 * 100).toFixed(1);
                    cell.style.left = `${left}%`;
                    cell.style.top = `${top}%`;
                    cell.style.width = `${width}%`;
                    cell.style.height = `${height}%`;
                    cell.textContent = `Cell ${r+1},${c+1}\n${area}%`;
                }
            }
        }
    }

    updateDraggedDivider() {
        if (!this.dragElement) return;
        const type = this.dragElement.dataset.type;
        
        if (type === 'horizontal') {
            const idx = parseInt(this.dragElement.dataset.index);
            const pos = this.state.horizontalDividers[idx];
            this.dragElement.style.top = `${pos}%`;
            
            // Update any intersections that use this horizontal divider
            this.state.verticalDividers.forEach((vPos, vIndex) => {
                const intersection = this.container.querySelector(`[data-type="intersection"][data-h-index="${idx}"][data-v-index="${vIndex}"]`);
                if (intersection) intersection.style.top = `${pos}%`;
            });
            
        } else if (type === 'vertical') {
            const idx = parseInt(this.dragElement.dataset.index);
            const pos = this.state.verticalDividers[idx];
            this.dragElement.style.left = `${pos}%`;
            
            // Update any intersections that use this vertical divider
            this.state.horizontalDividers.forEach((hPos, hIndex) => {
                const intersection = this.container.querySelector(`[data-type="intersection"][data-h-index="${hIndex}"][data-v-index="${idx}"]`);
                if (intersection) intersection.style.left = `${pos}%`;
            });
            
        } else if (type === 'intersection') {
            const hIndex = parseInt(this.dragElement.dataset.hIndex);
            const vIndex = parseInt(this.dragElement.dataset.vIndex);
            const hPos = this.state.horizontalDividers[hIndex];
            const vPos = this.state.verticalDividers[vIndex];
            
            this.dragElement.style.left = `${vPos}%`;
            this.dragElement.style.top = `${hPos}%`;
            
            // Update related horizontal and vertical dividers
            const hDivider = this.container.querySelector(`[data-type="horizontal"][data-index="${hIndex}"]`);
            if (hDivider) hDivider.style.top = `${hPos}%`;
            
            const vDivider = this.container.querySelector(`[data-type="vertical"][data-index="${vIndex}"]`);
            if (vDivider) vDivider.style.left = `${vPos}%`;
            
            // Update other intersections
            this.state.verticalDividers.forEach((otherVPos, otherVIndex) => {
                if (otherVIndex !== vIndex) {
                    const otherIntersection = this.container.querySelector(`[data-type="intersection"][data-h-index="${hIndex}"][data-v-index="${otherVIndex}"]`);
                    if (otherIntersection) otherIntersection.style.top = `${hPos}%`;
                }
            });
            
            this.state.horizontalDividers.forEach((otherHPos, otherHIndex) => {
                if (otherHIndex !== hIndex) {
                    const otherIntersection = this.container.querySelector(`[data-type="intersection"][data-h-index="${otherHIndex}"][data-v-index="${vIndex}"]`);
                    if (otherIntersection) otherIntersection.style.left = `${vPos}%`;
                }
            });
        }
    }

    attachEvents() {
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
    }

    onMouseDown(e) {
        if (e.target.classList.contains('grid-divider')) {
            this.isDragging = true; this.dragElement = e.target; document.body.classList.add('dragging'); 
            e.preventDefault();
        }
    }

    onMouseMove(e) {
        if (!this.isDragging || !this.dragElement) return;
        const rect = this.container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const type = this.dragElement.dataset.type;
        if (type === 'horizontal') {
            const idx = parseInt(this.dragElement.dataset.index); this.state.horizontalDividers[idx] = Math.max(5, Math.min(95, y));
        } else if (type === 'vertical') {
            const idx = parseInt(this.dragElement.dataset.index); this.state.verticalDividers[idx] = Math.max(5, Math.min(95, x));
        } else if (type === 'intersection') {
            const hi = parseInt(this.dragElement.dataset.hIndex); const vi = parseInt(this.dragElement.dataset.vIndex);
            this.state.horizontalDividers[hi] = Math.max(5, Math.min(95, y));
            this.state.verticalDividers[vi] = Math.max(5, Math.min(95, x));
        }
        // Only update the specific divider being dragged for maximum performance
        this.updateDraggedDivider();
    }

    onMouseUp() {
        this.isDragging = false; this.dragElement = null; document.body.classList.remove('dragging');
        // Do full update when dragging finishes
        this.render();
        if (this.onGridChange) this.onGridChange();
    }
}

