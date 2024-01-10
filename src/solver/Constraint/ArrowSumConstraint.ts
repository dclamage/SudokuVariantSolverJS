import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellIndexFromName, cellName, minValue, valueBit, valuesList, removeDuplicates, CellIndex } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { Constraint, ConstraintResult, LogicalDeduction } from './Constraint';
import { EqualSumConstraint } from './EqualSumConstraint';
import { FPuzzlesArrowEntry } from './FPuzzlesInterfaces';
import { OrConstraint } from './OrConstraint';

export interface ArrowSumConstraintParams {
    circleCells: CellIndex[];
    arrowCells: CellIndex[];
}

export class ArrowSumConstraint extends Constraint {
    circleCells: number[];
    arrowCells: number[];
    arrowCellsSum: SumCellsHelper;
    allCells: number[];
    allCellsSet: Set<number>;

    constructor(board: Board, params: ArrowSumConstraintParams) {
        const specificName = `Arrow at ${cellName(params.circleCells[0], board.size)}`;
        super('Arrow', specificName);

        this.circleCells = params.circleCells.slice();

        this.arrowCells = params.arrowCells.slice();
        this.arrowCellsSum = new SumCellsHelper(board, this.arrowCells);

        this.allCells = [...this.circleCells, ...this.arrowCells];
        this.allCellsSet = new Set(this.allCells);
    }

    init(board: Board) {
        if (this.arrowCells.length === 1 && this.circleCells.length === 1) {
            board.addCloneWeakLinks(this.arrowCells[0], this.circleCells[0]);
            return {
                result: ConstraintResult.UNCHANGED,
                deleteConstraints: [this],
            };
        }

        if (this.circleCells.length === 1) {
            return {
                result: ConstraintResult.UNCHANGED,
                addConstraints: [
                    new EqualSumConstraint(this.constraintName, this.specificName, board, { cells: [this.arrowCells, this.circleCells] }),
                ],
                deleteConstraints: [this],
            };
        }

        // For grids smaller than 10x10 and 2 cell pills, use Or constraint instead

        if (this.circleCells.length === 2 && board.size <= 9) {
            const subboards = [];
            for (let tensDigit = 1; tensDigit <= board.size; ++tensDigit) {
                const subboard = board.subboardClone();
                subboard.keepCellMask(this.circleCells[0], valueBit(tensDigit));
                subboard.addConstraint(
                    new EqualSumConstraint(
                        `Hypothetical ${this.toString()}`,
                        `Hypothetical ${this.toSpecificString()} if tens digit in pill = ${tensDigit}`,
                        board,
                        { cells: [this.arrowCells, [this.circleCells[1]]], offsets: [0, 10 * tensDigit] }
                    )
                );
                subboards.push(subboard);
            }
            return {
                result: ConstraintResult.UNCHANGED,
                addConstraints: [new OrConstraint(this.constraintName, this.specificName, board, { subboards })],
                deleteConstraints: [this],
            };
        }

        return this.initPill(board);
    }

    // eslint-disable-next-line no-unused-vars
    initPill(board: Board) {
        const [sumMin, sumMax] = this.arrowCellsSum.sumRange(board);
        const sumMinLength = sumMin.toString().length;
        const sumMaxLength = sumMax.toString().length;

        // 9x9 and smaller is much easier to work with, because the concatination of values can't make awkward two-digit numbers.
        if (board.size <= 9) {
            const numDigits = this.circleCells.length;
            if (sumMaxLength < numDigits) {
                // The maximum sum is too small to fit in the pill
                return ConstraintResult.INVALID;
            }

            if (sumMinLength > numDigits) {
                // The minimum sum is too large to fit in the pill
                return ConstraintResult.INVALID;
            }

            // The leading digit of the min and max sums limit the digits that can go in the first cell
            const minSumLeadingDigit = Math.max(Math.floor(sumMin / Math.pow(10, numDigits - 1)), 1);
            const maxSumLeadingDigit = Math.min(Math.floor(sumMax / Math.pow(10, numDigits - 1)), board.size);
            if (maxSumLeadingDigit < minSumLeadingDigit) {
                return ConstraintResult.INVALID;
            }

            const firstCircleCell = this.circleCells[0];
            const keepResult = board.keepCellMask(firstCircleCell, board.maskBetweenInclusive(minSumLeadingDigit, maxSumLeadingDigit));
            return keepResult;
        }

        const maxDigitLength = board.size.toString().length;
        const minNumDigits = this.circleCells.length;
        const maxNumDigits = this.circleCells.length * maxDigitLength;
        if (sumMaxLength < minNumDigits) {
            // The maximum sum is too small to fit in the pill
            return ConstraintResult.INVALID;
        }

        if (sumMinLength > maxNumDigits) {
            // The minimum sum is too large to fit in the pill
            return ConstraintResult.INVALID;
        }

        return ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board: Board, cellIndex: number, value: number) {
        // Clones are enforced entirely by weak links
        if (this.arrowCells.length === 1 && this.circleCells.length === 1) {
            return true;
        }

        // Only react if the cell is part of the constraint
        if (!this.allCellsSet.has(cellIndex)) {
            return true;
        }

        // If all cells are given, then check the exact sum
        if (this.allCells.every(cell => board.isGiven(cell))) {
            const circleValue = this.getCircleValue(board);
            const arrowSum = this.getArrowSum(board);
            return circleValue === arrowSum;
        }

        // If the circle value is known, ensure the current arrow sum does not exceed it in a quick and dirty way
        if (this.circleCells.every(cell => board.isGiven(cell))) {
            const circleValue = this.getCircleValue(board);
            const arrowSum = this.getArrowSum(board);
            return arrowSum <= circleValue;
        }

        return true;
    }

    logicalStep(board: Board): LogicalDeduction[] {
        const circleCellGiven = this.circleCells.every(cellIndex => board.isGiven(cellIndex));
        const arrowCellsGiven = this.arrowCells.every(cellIndex => board.isGiven(cellIndex));
        if (circleCellGiven && arrowCellsGiven) {
            // Done: enforce should have already verified the sum.
            return [{ deleteConstraints: [this] }];
        }

        const possiblePillValues: number[] = removeDuplicates(
            this.getPillSums(board, 0, '')
                .map((val: string) => parseInt(val, 10))
                .sort((a: number, b: number) => a - b)
        );

        // Make the arrow sum conform to the possible pill values
        const sumStepResult = this.arrowCellsSum.getRestrictSumsEliminations(board, possiblePillValues);
        if (sumStepResult.result === ConstraintResult.INVALID) {
            return [
                {
                    explanation: sumStepResult.explanation,
                    invalid: true,
                },
            ];
        }

        const deductions: LogicalDeduction[] = [];
        if (sumStepResult.result === ConstraintResult.CHANGED) {
            deductions.push({
                explanation: 'Restricting arrow to possible pill values',
                eliminations: sumStepResult.eliminations,
            });
        }

        // If the arrow sum is known, then force the pill values to be that value
        if (arrowCellsGiven) {
            const arrowSum = this.getArrowSum(board);

            // Generate all ways to fill the pill
            const possiblePillValues = this.getPillValuesForSum(board, arrowSum.toString());
            if (possiblePillValues.length === 0) {
                return [
                    {
                        explanation: `Arrow sum of ${arrowSum} cannot be filled into the pill.`,
                        invalid: true,
                    },
                ];
            }

            // Keep only the possible pill values
            const possiblePillValuesMask = new Array(this.circleCells.length).fill(0);
            for (let i = 0; i < this.circleCells.length; i++) {
                for (const possiblePillValue of possiblePillValues) {
                    possiblePillValuesMask[i] |= valueBit(possiblePillValue[i]);
                }
            }

            const eliminations = [];
            for (let i = 0; i < this.circleCells.length; i++) {
                const circleCell = this.circleCells[i];
                const originalMask = board.cells[circleCell] & board.allValues;
                const keepMask = possiblePillValuesMask[i] & board.allValues;
                const elimMask = originalMask & ~keepMask;
                if (elimMask !== 0) {
                    eliminations.push(...valuesList(elimMask).map(value => board.candidateIndex(circleCell, value)));
                }
            }

            if (eliminations.length > 0) {
                deductions.push({
                    explanation: 'Arrow sum is known',
                    eliminations,
                });
            }
        }

        return deductions;
    }

    private getPillSums(board: Board, circleIndex: number, sumPrefix = ''): string[] {
        if (circleIndex >= this.circleCells.length) {
            return [sumPrefix];
        }

        const sums = [];
        const circleCell = this.circleCells[circleIndex];
        let circleCellMask = board.cells[circleCell] & board.allValues;
        while (circleCellMask !== 0) {
            const circleValue = minValue(circleCellMask);
            circleCellMask &= ~valueBit(circleValue);

            const newPrefix = sumPrefix + circleValue.toString();
            const curSums = this.getPillSums(board, circleIndex + 1, newPrefix);
            sums.push(...curSums);
        }

        return sums;
    }

    private getPillValuesForSum(board: Board, sumStr: string, circleIndex: number = 0, sumValues: number[] = []): number[][] {
        if (circleIndex >= this.circleCells.length) {
            if (sumStr === sumValues.join('')) {
                return [sumValues];
            }
            return [];
        }

        const sums = [];
        const circleCell = this.circleCells[circleIndex];
        let circleCellMask = board.cells[circleCell] & board.allValues;
        while (circleCellMask !== 0) {
            const circleValue = minValue(circleCellMask);
            circleCellMask &= ~valueBit(circleValue);

            const newSumValues = [...sumValues, circleValue];
            if (sumStr.startsWith(newSumValues.join(''))) {
                const curSums = this.getPillValuesForSum(board, sumStr, circleIndex + 1, newSumValues);
                sums.push(...curSums);
            }
        }

        return sums;
    }

    private getCircleValue(board: Board) {
        if (this.circleCells.length === 1) {
            return minValue(board.cells[this.circleCells[0]]);
        }

        const circleValue = this.circleCells.reduce((acc, circleCell) => acc + minValue(board.cells[circleCell]).toString(), '');
        return parseInt(circleValue, 10);
    }

    private getArrowSum(board: Board) {
        let arrowSum = 0;
        for (const arrowCell of this.arrowCells) {
            arrowSum += minValue(board.cells[arrowCell]);
        }
        return arrowSum;
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('arrow', (board: Board, params: FPuzzlesArrowEntry) => {
        const constraints = [];
        for (const line of params.lines) {
            const circleCells = params.cells.map((cellName: string) => cellIndexFromName(cellName, board.size));
            const arrowCells = line.slice(1).map((cellName: string) => cellIndexFromName(cellName, board.size));
            const arrowParams: ArrowSumConstraintParams = {
                circleCells,
                arrowCells,
            };
            constraints.push(new ArrowSumConstraint(board, arrowParams));
        }
        return constraints;
    });
}
