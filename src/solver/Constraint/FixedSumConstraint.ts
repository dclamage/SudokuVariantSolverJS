import { Board } from '../Board';
import { CellIndex, CellValue, hasValue, valueBit } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { Constraint, ConstraintResult, LogicalDeduction, PreprocessingResult } from './Constraint';

export interface FixedSumConstraintParams {
    cells: CellIndex[];
    sum: number;
}

export class FixedSumConstraint extends Constraint {
    cells: CellIndex[];
    cellsSet: Set<CellIndex>;
    sum: number;
    sumHelper: SumCellsHelper;

    constructor(constraintName: string, specificName: string, board: Board, params: FixedSumConstraintParams) {
        super(constraintName, specificName);

        this.sum = params.sum;
        this.cells = params.cells.toSorted((a: number, b: number) => a - b);
        this.cellsSet = new Set(this.cells);
        this.sumHelper = undefined;
    }

    init(board: Board) {
        // Size 1 is just a given
        if (this.cells.length === 1) {
            if (this.sum > board.size) {
                return ConstraintResult.INVALID;
            }

            const cell = this.cells[0];
            return {
                result: board.keepCellMask(cell, valueBit(this.sum)),
                deleteConstraints: [this],
            };
        }

        // Size 2 act like sum dots via weak links
        if (this.cells.length === 2) {
            const [cell1, cell2] = this.cells;
            const valueUsed1 = Array.from({ length: board.size + 1 }, () => false);
            const valueUsed2 = Array.from({ length: board.size + 1 }, () => false);
            for (let value1 = 1; value1 <= board.size; value1++) {
                if (!hasValue(board.cells[cell1], value1)) {
                    continue;
                }
                const cell1Candidate = board.candidateIndex(cell1, value1);

                for (let value2 = 1; value2 <= board.size; value2++) {
                    if (!hasValue(board.cells[cell2], value2)) {
                        continue;
                    }

                    // Check for a weak link between these candidates
                    const cell2Candidate = board.candidateIndex(cell2, value2);
                    if (board.isWeakLink(cell1Candidate, cell2Candidate)) {
                        continue;
                    }

                    if (value1 + value2 !== this.sum) {
                        board.addWeakLink(cell1Candidate, cell2Candidate);
                    } else {
                        valueUsed1[value1] = true;
                        valueUsed2[value2] = true;
                    }
                }
            }
            if (!valueUsed1.some(v => v) || !valueUsed2.some(v => v) || board.invalidInit) {
                // No possible values for one of the cells or something went wrong while adding weak links, invalid board
                return ConstraintResult.INVALID;
            }
            return {
                result: ConstraintResult.CHANGED,
                deleteConstraints: [this],
            };
        }

        // Create the sum helper which does most of the work
        this.sumHelper = new SumCellsHelper(board, this.cells);
        return this.sumHelper.init(board, [this.sum]);
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        if (this.cellsSet.has(cellIndex)) {
            const givenSum = this.getGivenSum(board);
            if (givenSum > this.sum || (givenSum !== this.sum && this.isCompleted(board))) {
                return false;
            }
        }
        return true;
    }

    logicalStep(board: Board): LogicalDeduction[] {
        // Re-create the sum helper in case new regions have been added
        this.sumHelper = new SumCellsHelper(board, this.cells);
        // no need to `init`, that mutates the board and is actually to try and find some pre solve "obvious deductions"
        // we should add those separately.
        const result = this.sumHelper.getRestrictSumsEliminations(board, [this.sum]);

        if (result.result === ConstraintResult.UNCHANGED) {
            return [];
        }
        if (result.result === ConstraintResult.INVALID) {
            return [
                {
                    invalid: true,
                    explanation: result.explanation,
                },
            ];
        }

        return [
            {
                explanation: '',
                eliminations: result.eliminations,
            },
        ];
    }

    preprocessingStep(board: Board): PreprocessingResult {
        // Re-create the sum helper in case new regions have been added
        this.sumHelper = new SumCellsHelper(board, this.cells);
        return this.sumHelper.logicStep(board, [this.sum], null);
    }

    bruteForceStep(board: Board): ConstraintResult {
        // No need to recreate sum helper as regions cannot be added mid-solve
        return this.sumHelper.logicStep(board, [this.sum], null);
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
