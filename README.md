# Grid Resizer + Sampling Heatmap

An interactive lab to compare post‑stratification estimates against Monte Carlo (simple sample‑mean) estimates as grid boundaries change. Drag cell boundaries, sample from global or per‑cell distributions, and watch both estimators update along with MSE vs a ground‑truth mean (computed analytically from area‑weighted cell means). The heatmap sweeps possible single‑split boundaries to reveal where post‑stratification improves or degrades accuracy relative to the MC estimate. Zero‑build, vanilla JS.

## Features
- Draggable grid with live area percentages.
- Random or stratified sampling; optional seed.
- Global or per‑cell normal distributions (mean/variance).
- Sample point colors with legend; optional per‑cell color overlay.
- Stats: overall mean/variance, mean of cell means, post‑stratification mean with MSE vs ground truth.
- Error heatmap via parallel Web Workers, with a small performance log.

## Run Locally
This is a static site with ES modules and Web Workers. Serve over HTTP:

- Python: `python3 -m http.server 8000`

Open `http://localhost:8000` in a modern browser and load `index.html`.

## Usage
1) Set rows/cols; drag dividers or intersections. 
2) Configure samples, mean/std (or per‑cell means/variances), seed, and stratified toggle. 
3) Click Generate, then optionally Show Error Heatmap.

## Structure
- `index.html`, `styles.css` — UI shell and styling.
- `src/app/InteractiveGrid.js` — App controller.
- `src/grid/*` — Grid model + view (DOM + drag).
- `src/sampling/*` — Sampler, renderer, seeded RNG.
- `src/stats/*` — Stat helpers + presenter.
- `src/heatmap/*`, `src/workers/*` — Heatmap orchestration and worker.

## Requirements
- Modern browser (ES modules, Module Workers, localStorage). No external deps.

## License
MIT — see `LICENSE`.
