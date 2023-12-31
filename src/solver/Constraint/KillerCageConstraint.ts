import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, CellValue, cellIndexFromName, cellName, hasValue, valueBit } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { Constraint, ConstraintResult } from './Constraint';
import { FPuzzlesKillerCageEntry } from './FPuzzlesInterfaces';

interface KillerCageConstraintParams {
    cells: CellIndex[];
    value: number;
}

export class KillerCageConstraint extends Constraint {
    cells: CellIndex[];
    cellsSet: Set<CellIndex>;
    sum: number;
    sumCells: SumCellsHelper;

    constructor(board: Board, params: KillerCageConstraintParams) {
        const cells = params.cells.toSorted((a, b) => a - b);
        const specificName =
            params.value > 0
                ? `Killer Cage ${params.value} at ${cellName(cells[0], board.size)}`
                : `Killer Cage at ${cellName(cells[0], board.size)}`;
        super(board, 'Killer Cage', specificName);

        const value = params.value;
        if (isNaN(value) || value < 0) {
            this.sum = 0;
        } else {
            this.sum = value;
        }
        this.cells = cells.toSorted((a, b) => a - b);
        this.cellsSet = new Set(this.cells);
    }

    init(board: Board, isRepeat: boolean) {
        // Size 1 killer cages are givens
        if (this.cells.length === 1) {
            if (isRepeat) {
                return ConstraintResult.UNCHANGED;
            }

            if (this.sum > 0) {
                if (this.sum > board.size) {
                    return ConstraintResult.INVALID;
                }

                const cell = this.cells[0];
                return board.keepCellMask(cell, valueBit(this.sum));
            }

            return ConstraintResult.UNCHANGED;
        }

        // Killer Cages size > 1 are a region
        if (!isRepeat) {
            board.addRegion(this.specificName, this.cells, 'killer', this);
        }

        // Size 2 killer cages act like sum dots via weak links
        if (this.cells.length === 2) {
            if (this.sum > 0) {
                const [cell1, cell2] = this.cells;
                const valueUsed1 = Array.from({ length: board.size + 1 }, () => false);
                const valueUsed2 = Array.from({ length: board.size + 1 }, () => false);
                for (let value1 = 1; value1 <= board.size; value1++) {
                    if (!hasValue(board.cells[cell1], value1)) {
                        continue;
                    }
                    const cell1Candidate = board.candidateIndex(cell1, value1);

                    for (let value2 = 1; value2 <= board.size; value2++) {
                        // Check for a weak link between these candidates
                        const cell2Candidate = board.candidateIndex(cell2, value2);
                        if (board.isWeakLink(cell1Candidate, cell2Candidate)) {
                            continue;
                        }

                        if (!hasValue(board.cells[cell2], value2)) {
                            continue;
                        }

                        if (value1 + value2 !== this.sum) {
                            if (!isRepeat) {
                                board.addWeakLink(cell1Candidate, cell2Candidate);
                            }
                        } else {
                            valueUsed1[value1] = true;
                            valueUsed2[value2] = true;
                        }
                    }
                }

                // Only keep candidates used by the sum
                const valueUsedMask1 = valueUsed1.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
                const valueUsedMask2 = valueUsed2.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
                const result1 = board.keepCellMask(cell1, valueUsedMask1);
                const result2 = board.keepCellMask(cell2, valueUsedMask2);

                if (result1 === ConstraintResult.INVALID || result2 === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }

                if (result1 === ConstraintResult.CHANGED || result2 === ConstraintResult.CHANGED) {
                    return ConstraintResult.CHANGED;
                }

                return ConstraintResult.UNCHANGED;
            }

            return ConstraintResult.UNCHANGED;
        }

        if (this.sum > 0) {
            this.sumCells = new SumCellsHelper(board, this.cells);
            return this.sumCells.init(board, [this.sum]);
        }

        return ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        if (this.sum > 0 && this.cellsSet.has(cellIndex)) {
            const givenSum = this.getGivenSum(board);
            if (givenSum > this.sum || (givenSum !== this.sum && this.isCompleted(board))) {
                return false;
            }
        }
        return true;
    }

    logicStep(board: Board, logicalStepDescription: string[]) {
        if (this.sumCells) {
            return this.sumCells.logicStep(board, [this.sum], logicalStepDescription);
        }
        return ConstraintResult.UNCHANGED;
    }

    // Returns if all the cells in the cage are givens
    isCompleted(board: Board) {
        return this.cells.every(cell => board.isGiven(cell));
    }

    // Returns the sum of all the given cells in the cage
    getGivenSum(board: Board) {
        return this.cells
            .filter(cell => board.isGiven(cell))
            .map(cell => board.getValue(cell))
            .reduce((result, value) => result + value, 0);
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('killercage', (board: Board, params: FPuzzlesKillerCageEntry) => {
        const cells = params.cells.map(cellName => cellIndexFromName(cellName, board.size));
        return new KillerCageConstraint(board, { cells: cells, value: parseInt(params.value, 10) });
    });
}
