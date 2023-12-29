/**
 * Class to build board data as the public interface expects it.
 *
 * TODO: This is a work in progress and not yet used.
 * Ideally, it would not have f-puzzles data specific functionality, and that will be removed.
 */
export default class BoardDataBuilder {
    constructor() {
        this._size = 0;
        this._cells = [];
        this._regions = [];
        this._constraints = [];
    }

    /**
     * Set the size of the board.
     * @param {number} value - The size of the board.
     * @returns {BoardDataBuilder} This object.
     */
    size(value) {
        this._size = value;
        this._cells = Array.from(value * value, () => Array.from({ length: value }, i => i + 1));
        return this;
    }

    /**
     * Set the given value for a cell.
     * @param {number} cell - The cell index.
     * @param {number} value - The value for the cell.
     * @returns {BoardDataBuilder} This object.
     */
    setGiven(cell, value) {
        this._cells[cell] = [value];
        return this;
    }

    /**
     * Set available values for a cell.
     * @param {number} cell - The cell index.
     * @param {number[]} values - The available values for the cell.
     * @returns {BoardDataBuilder} This object.
     */
    setCandidates(cell, values) {
        // Ensure that the values are sorted
        values.sort((a, b) => a - b);
        this._cells[cell] = values;
        return this;
    }

    /**
     * Add a region to the board (e.g. a row, column, or box).
     * @param {string} name - The name of the region.
     * @param {number[]} cells - The cells in the region (must be length size).
     * @param {string} type - The type of region (e.g. 'row', 'col', 'region').
     * @returns
     */
    addRegion(name, cells, type) {
        if (cells.length !== this._size) {
            throw new Error(`Region ${name} must have ${this._size} cells.`);
        }

        // Ensure type is lowercase
        type = type.toLowerCase();

        // Correct common types
        if (type === 'column') {
            type = 'col';
        } else if (type === 'box') {
            type = 'region';
        }

        this._regions.push({ name, cells, type });
        return this;
    }

    /**
     * Add a constraint to the board.
     * @param {string} type - The type of constraint.
     * @param {object} params - The parameters for the constraint.
     * @returns {BoardDataBuilder} This object.
     */
    addConstraint(type, params) {
        this._constraints.push({ type, params });
        return this;
    }

    /**
     * Initializes from the f-puzzles format.
     * @param {object} fpuzzlesData - The fpuzzles data, already parsed from JSON.
     */
    fromFPuzzles(fpuzzlesData) {
        const size = fpuzzlesData.size;
        this.size(size);

        // Apply the default regions to any cells that don't have a region
        const regionSizes = {};
        for (let h = 1; h * h <= size; h++) {
            if (size % h === 0) {
                regionSizes.w = size / h;
                regionSizes.h = h;
            }
        }

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const cell = fpuzzlesData.grid[row][col];
                if (cell.region === undefined) {
                    cell.region = Math.floor(row / regionSizes.h) * regionSizes.h + Math.floor(col / regionSizes.w);
                }
            }
        }

        // Add the regions

        // Rows
        for (let row = 0; row < size; row++) {
            const rowCells = Array.from({ length: size }, (_, i) => row * size + i);
            this.addRegion(`Row ${row + 1}`, rowCells, 'row');
        }

        // Columns
        for (let col = 0; col < size; col++) {
            const colCells = Array.from({ length: size }, (_, i) => i * size + col);
            this.addRegion(`Column ${col + 1}`, colCells, 'col');
        }

        // Regions
        const uniqueRegions = new Map();
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const region = fpuzzlesData.grid[row][col].region;
                if (region >= 0) {
                    const regionKey = (region + 1).toString();
                    if (!uniqueRegions.has(regionKey)) {
                        uniqueRegions.set(regionKey, []);
                    }
                    uniqueRegions.get(regionKey).push(row * size + col);
                }
            }
        }
        // Sort the unique regions by key
        const sortedKeys = Array.from(uniqueRegions.keys()).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        for (const regionKey of sortedKeys) {
            const region = uniqueRegions.get(regionKey);
            if (region.length == size) {
                this.addRegion(`Region ${regionKey}`, region, 'region');
            }
        }

        // F-puzzles has some constraints that are just additional regions
        if (fpuzzlesData['diagonal+']) {
            this.addRegion(
                'Diagonal+',
                Array.from({ length: size }, (_, i) => (size - i - 1) * size + i),
                'diagonal'
            );
        }

        if (fpuzzlesData['diagonal-']) {
            this.addRegion(
                'Diagonal-',
                Array.from({ length: size }, (_, i) => i * size + i),
                'diagonal'
            );
        }

        if (fpuzzlesData['disjointgroups']) {
            // Disjoint groups only works if we have exactly size regions tagged as "region"
            const regions = this._regions.filter(region => region.type === 'region');
            if (regions.length === size) {
                // Each disjoint group is a specific index within each region
                for (let i = 0; i < size; i++) {
                    const cells = regions.map(region => region.cells[i]);
                    this.addRegion(`Disjoint Group ${i + 1}`, cells, 'disjointgroup');
                }
            }
        }

        // TODO: Convert f-puzzle constraint formats to a more sane format
        // TODO: Combine certain constraints together, like kropki and xv

        // Assume any unknown members of the data are constraints
        const knownMembers = ['size', 'grid', 'solution'];
        for (const key of Object.keys(fpuzzlesData)) {
            if (knownMembers.includes(key) || !Array.isArray(fpuzzlesData[key])) {
                continue;
            }

            // Check for a negative constraint and add that as a boolean
            const hasNegative =
                (fpuzzlesData.negative && fpuzzlesData.negative.includes(key)) || (key === 'difference' && fpuzzlesData.nonconsecutive);
            for (const constraint of fpuzzlesData[key]) {
                // Make a deep copy of the constraint
                let params = JSON.parse(JSON.stringify(constraint));
                if (hasNegative && (key !== 'difference' || !params.value || params.value === 1)) {
                    params.negative = true;
                }
                this.addConstraint(key, params);
            }
        }

        // F-Puzzles has specific chess constraints as booleans
        if (fpuzzlesData.antiking && fpuzzlesData.antiknight) {
            this.addConstraint('chess', {
                offsets: [
                    [1, 1],
                    [1, 2],
                ],
            });
        } else if (fpuzzlesData.antiknight) {
            this.addConstraint('chess', { offsets: [[1, 2]] });
        } else if (fpuzzlesData.antiking) {
            this.addConstraint('chess', { offsets: [[1, 1]] });
        }
    }

    /**
     * Build the board data.
     * @returns {object} The board data.
     */
    build() {
        return {
            size: this._size,
            cells: this._cells,
            regions: this._regions,
            constraints: this._constraints,
        };
    }
}
