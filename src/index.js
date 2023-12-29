import { Board } from './solver/Board';
import { registerAllConstraints } from './solver/Constraint/ConstraintLoader';
import ConstraintBuilder from './solver/ConstraintBuilder';
import { minValue, valueBit, valuesList, valuesMask } from './solver/SolveUtility';

/**
 * Represents a solver for a Sudoku variant puzzle.
 */
class SudokuVariantSolver {
    eventCanceled = false;
    constraintBuilder = null;

    constructor() {
        this.constraintBuilder = new ConstraintBuilder();
        registerAllConstraints(this.constraintBuilder);
    }

    /**
     * Solves the Sudoku variant puzzle.
     * @param {Object} data - The data object containing the Sudoku board and options.
     * @param {Object} data.board - The Sudoku board in the f-puzzles format.
     * @param {Object} [data.options] - The options for solving.
     */
    async solve(data) {
        this.eventCanceled = false;

        const board = this.createBoard(data.board);
        if (!board) {
            self.postMessage({ result: 'invalid' });
        } else {
            const solution = await board.findSolution(data.options || {}, () => this.eventCanceled);
            if (solution) {
                if (solution.cancelled) {
                    self.postMessage({ result: 'cancelled' });
                } else {
                    const solutionValues = solution.getValueArray();
                    self.postMessage({ result: 'solution', solution: solutionValues });
                }
            } else {
                self.postMessage({ result: 'no solution' });
            }
        }
    }

    /**
     * Counts the number of solutions for a given Sudoku board.
     * @param {Object} data - The data object containing the Sudoku board and options.
     * @param {Object} data.board - The Sudoku board in the f-puzzles format.
     * @param {Object} [data.options] - The options for counting solutions.
     * @param {number} [data.options.maxSolutions=0] - The maximum number of solutions to count.
     * @returns {Promise<void>} - A promise that resolves when the counting is complete.
     */
    async countSolutions(data) {
        this.eventCanceled = false;

        const board = this.createBoard(data.board);
        if (!board) {
            self.postMessage({ result: 'invalid' });
        } else {
            const { maxSolutions = 0 } = data.options || {};
            const countResult = await board.countSolutions(
                maxSolutions,
                count => {
                    self.postMessage({ result: 'count', count: count, complete: false });
                },
                () => this.eventCanceled
            );
            if (countResult.isCancelled) {
                self.postMessage({ result: 'count', count: countResult.numSolutions, complete: false, cancelled: true });
            } else {
                self.postMessage({ result: 'count', count: countResult.numSolutions, complete: true });
            }
        }
    }

    /**
     * Expands the candidates array by mapping each mask value to its corresponding values list.
     * If a givenBit is provided, it marks the values that contain the givenBit as "given" and returns the minimum value.
     * @param {number[]} candidates - The array of mask values representing the candidates.
     * @param {number} givenBit - The bit value to check against the mask values.
     * @returns {Array<{given: boolean, value: number[]}>} - The expanded candidates array.
     */
    expandCandidates(candidates, givenBit) {
        if (!givenBit) {
            return candidates?.map(mask => valuesList(mask));
        }

        return candidates?.map(mask => {
            if (mask & givenBit) {
                return { given: true, value: minValue(mask) };
            }
            return valuesList(mask);
        });
    }

    /**
     * Calculates the true candidates for the given Sudoku board.
     * @param {Object} data - The data object containing the Sudoku board and options.
     * @param {Object} data.board - The Sudoku board in the f-puzzles format.
     * @param {Object} [data.options] - The options for calculating true candidates.
     * @param {number} [data.options.maxSolutionsPerCandidate=1] - The maximum number of solutions per candidate.
     * @returns {Promise<void>} - A promise that resolves when the true candidates are calculated.
     */
    async trueCandidates(data) {
        this.eventCanceled = false;

        const board = this.createBoard(data.board);
        if (!board) {
            self.postMessage({ result: 'invalid' });
        } else {
            const { maxSolutionsPerCandidate = 1 } = data.options || {};

            const trueCandidatesResult = await board.calcTrueCandidates(maxSolutionsPerCandidate, () => this.eventCanceled);
            if (trueCandidatesResult.invalid) {
                self.postMessage({ result: 'invalid' });
            } else if (trueCandidatesResult.cancelled) {
                self.postMessage({ result: 'cancelled' });
            } else {
                const { candidates, counts } = trueCandidatesResult;
                const expandedCandidates = this.expandCandidates(candidates);
                self.postMessage({ result: 'truecandidates', candidates: expandedCandidates, counts: counts });
            }
        }
    }

    /**
     * Checks if the candidate values in the board differ from the candidate values in the data.
     * @param {Board} board - The Sudoku board in the f-puzzles format.
     * @param {Data} data - The data containing candidate values.
     * @param {Object} data.board - The Sudoku board in the f-puzzles format.
     * @returns {boolean} - True if the candidate values differ, false otherwise.
     */
    candidatesDiffer(board, data) {
        const size = board.size;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const cellIndex = i * size + j;
                const cellMask = board.cells[cellIndex] & board.allValues;
                const dataCell = data.board.grid[i][j];
                let dataCellMask = board.allValues;
                if (dataCell.value) {
                    dataCellMask = valueBit(dataCell.value);
                } else {
                    const haveGivenPencilmarks = dataCell.givenPencilMarks?.length > 0;
                    const haveCenterPencilmarks = dataCell.centerPencilMarks?.length > 0;
                    if (haveGivenPencilmarks && haveCenterPencilmarks) {
                        dataCellMask = valuesMask(dataCell.givenPencilMarks.filter(value => dataCell.centerPencilMarks.includes(value)));
                    } else if (haveGivenPencilmarks) {
                        dataCellMask = valuesMask(dataCell.givenPencilMarks);
                    } else if (haveCenterPencilmarks) {
                        dataCellMask = valuesMask(dataCell.centerPencilMarks);
                    }
                }

                if (cellMask !== dataCellMask) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Performs a single step in the Sudoku solving process.
     * @param {Object} data - The data object containing the Sudoku board.
     * @param {Object} data.board - The Sudoku board in the f-puzzles format.
     * @returns {void}
     */
    async step(data) {
        this.eventCanceled = false;

        const board = this.createBoard(data.board, true);
        if (!board) {
            self.postMessage({ result: 'step', desc: 'Board is invalid!', invalid: true, changed: false });
            return;
        }

        if (this.candidatesDiffer(board, data)) {
            const expandedCandidates = this.expandCandidates(board.cells, board.givenBit);
            self.postMessage({ result: 'step', desc: 'Initial Candidates', candidates: expandedCandidates, invalid: false, changed: true });
            return;
        }

        // Perform a single step
        const stepResult = await board.logicalStep(() => this.eventCanceled);
        if (stepResult.cancelled) {
            self.postMessage({ result: 'cancelled' });
            return;
        }

        if (stepResult.unchanged) {
            if (board.nonGivenCount === 0) {
                self.postMessage({ result: 'step', desc: 'Solved!' });
            } else {
                self.postMessage({ result: 'step', desc: 'No logical steps found.' });
            }
            return;
        }

        const expandedCandidates = this.expandCandidates(board.cells, board.givenBit);
        self.postMessage({
            result: 'step',
            desc: stepResult.desc,
            candidates: expandedCandidates,
            invalid: stepResult.invalid,
            changed: stepResult.changed,
        });
    }

    async logicalSolve(data) {
        this.eventCanceled = false;

        const board = this.createBoard(data.board, true);
        if (!board) {
            self.postMessage({ result: 'logicalsolve', desc: ['Board is invalid!'], invalid: true, changed: false });
            return;
        }

        const solveResult = await board.logicalSolve(() => this.eventCanceled);
        if (solveResult.cancelled) {
            self.postMessage({ result: 'cancelled' });
            return;
        }

        let desc = solveResult.desc;
        if (board.nonGivenCount === 0) {
            desc.push('Solved!');
        } else if (solveResult.invalid) {
            desc.push('Board is invalid!');
        } else {
            desc.push('No logical steps found.');
        }

        const expandedCandidates = this.expandCandidates(board.cells, board.givenBit);
        self.postMessage({
            result: 'logicalsolve',
            desc,
            candidates: expandedCandidates,
            invalid: solveResult.invalid,
            changed: solveResult.changed,
        });
    }

    /**
     * Create a board from the given board data.
     * For now, the board data uses the f-puzzles format, but that will change.
     * @param {object} boardData - The board data.
     * @param {boolean} keepPencilMarks - True to keep pencil marks, false to remove them.
     * @returns {Board} The board.
     */
    createBoard(boardData, keepPencilMarks = false) {
        const size = boardData.size;
        const board = new Board(size);

        // Apply default regions
        this.applyDefaultRegions(boardData);

        // Add regions

        // Rows
        for (let row = 0; row < size; row++) {
            const rowCells = Array.from({ length: size }, (_, i) => board.cellIndex(row, i));
            board.addRegion(`Row ${row + 1}`, rowCells, 'row');
        }

        // Columns
        for (let col = 0; col < size; col++) {
            const colCells = Array.from({ length: size }, (_, i) => board.cellIndex(i, col));
            board.addRegion(`Col ${col + 1}`, colCells, 'col');
        }

        // Regions
        const uniqueRegions = new Map();
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const region = boardData.grid[row][col].region;
                if (region >= 0) {
                    const regionKey = (region + 1).toString();
                    if (!uniqueRegions.has(regionKey)) {
                        uniqueRegions.set(regionKey, []);
                    }
                    uniqueRegions.get(regionKey).push(board.cellIndex(row, col));
                }
            }
        }
        for (const regionKey of uniqueRegions.keys()) {
            const region = uniqueRegions.get(regionKey);
            if (region.length == size) {
                board.addRegion(`Region ${regionKey}`, region, 'region');
            }
        }

        // Add a weak link between all candidates within the same cell
        for (let cell = 0; cell < size * size; cell++) {
            for (let value1 = 1; value1 < size; value1++) {
                const cell1Candidate = board.candidateIndex(cell, value1);
                for (let value2 = value1 + 1; value2 <= size; value2++) {
                    const cell2Candidate = board.candidateIndex(cell, value2);
                    board.addWeakLink(cell1Candidate, cell2Candidate);
                }
            }
        }

        // Add constraints
        if (!this.constraintBuilder.buildConstraints(boardData, board)) {
            return null;
        }

        // At this point, all weak links should be added

        // Set the givens
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const srcCell = boardData.grid[i][j];
                const haveGivenPencilmarks = srcCell.givenPencilMarks?.length > 0;
                const haveCenterPencilmarks = srcCell.centerPencilMarks?.length > 0;
                const cellIndex = board.cellIndex(i, j);
                if (keepPencilMarks) {
                    if (srcCell.value) {
                        if (!board.setAsGiven(cellIndex, srcCell.value)) {
                            return null;
                        }
                    } else if (haveGivenPencilmarks && haveCenterPencilmarks) {
                        const pencilMarks = srcCell.givenPencilMarks.filter(value => srcCell.centerPencilMarks.includes(value));
                        if (!board.applyGivenPencilMarks(cellIndex, pencilMarks)) {
                            return null;
                        }
                    } else if (haveGivenPencilmarks) {
                        if (!board.applyGivenPencilMarks(cellIndex, srcCell.givenPencilMarks)) {
                            return null;
                        }
                    } else if (haveCenterPencilmarks) {
                        if (!board.applyGivenPencilMarks(cellIndex, srcCell.centerPencilMarks)) {
                            return null;
                        }
                    }
                } else {
                    if (srcCell.given) {
                        if (!board.setAsGiven(cellIndex, srcCell.value)) {
                            return null;
                        }
                    } else if (haveGivenPencilmarks) {
                        if (!board.applyGivenPencilMarks(cellIndex, srcCell.givenPencilMarks)) {
                            return null;
                        }
                    }
                }
            }
        }

        // Clean up any naked singles which are alreay set as given
        const newNakedSingles = [];
        for (const cellIndex of board.nakedSingles) {
            if (!board.isGiven(cellIndex)) {
                newNakedSingles.push(cellIndex);
            }
        }
        board.nakedSingles = newNakedSingles;

        return board;
    }

    /**
     * Applies default regions to the f-puzzles board data.
     * f-puzzles data omits the region for cells that are in their default region.
     * This function fills in the missing regions.
     *
     * Default regions are calculated as follows:
     * 1. Find the largest factor of the board size that is less than or equal to the square root of the board size.
     * 2. The width of the default region is the board size divided by the factor.
     * 3. The height of the default region is the factor.
     *
     * @param {object} boardData - The board data.
     */
    applyDefaultRegions(boardData) {
        const size = boardData.size;

        const regionSizes = {};
        for (let h = 1; h * h <= size; h++) {
            if (size % h === 0) {
                regionSizes.w = size / h;
                regionSizes.h = h;
            }
        }

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const cell = boardData.grid[row][col];
                if (cell.region === undefined) {
                    cell.region = Math.floor(row / regionSizes.h) * regionSizes.h + Math.floor(col / regionSizes.w);
                }
            }
        }
    }

    /**
     * Cancels the current operation.
     */
    cancel() {
        this.eventCanceled = true;
    }
}

export default SudokuVariantSolver;
