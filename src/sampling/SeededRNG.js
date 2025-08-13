export class SeededRNG {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.current = seed;
    }

    next() {
        this.current = (this.current * 16807) % 2147483647;
        return this.current / 2147483647;
    }

    reset() {
        this.current = this.seed;
    }
}

