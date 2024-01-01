import { Board } from '../Board';
import { CellIndex, CellValue, minValue, valueBit } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { Constraint, ConstraintResult } from './Constraint';

// EqualSumConstraint: There must be a common-sum S such that for every i, S = sum([...cells[i], offsets[i]]).
export class EqualSumConstraint extends Constraint {
    // Only contains the sum groups with nonempty cell sets
    cells: CellIndex[][];
    offsets: number[];
    // If there's a sum group with no cells, then it means this sum is fixed
    fixedSum?: number; // null if there is no fixed sum
    invalid: boolean; // indicates if the constraint was broken even before init

    // Cached info / helpers
    flatCells: CellIndex[]; // flatten sumCells
    flatCellsSet: Set<CellIndex>; // convert to set
    helpers: SumCellsHelper[];

    constructor(constraintName: string, specificName: string, board: Board, params: { cells: CellIndex[][]; offsets?: number[] }) {
        super(board, constraintName, specificName);

        this.cells = [];
        this.offsets = [];
        this.fixedSum = null;
        this.invalid = false;
        this.flatCells = params.cells.flat();
        this.flatCellsSet = new Set(this.flatCells);
        this.helpers = [];

        for (let i = 0; i < params.cells.length; ++i) {
            if (params.cells[i].length === 0) {
                // This is a fixed sum
                if (this.fixedSum !== null && this.fixedSum !== params.offsets[i]) {
                    // Inconsistent fixed sums, report board is invalid at init
                    this.invalid = true;
                    return;
                }
                this.fixedSum = params.offsets[i];
            } else {
                this.cells.push(params.cells[i].slice());
                this.offsets.push(params.offsets ? params.offsets[i] : 0);
            }
        }

        this.helpers = this.cells.map(cellSet => new SumCellsHelper(board, cellSet));
    }

    init(board: Board, isRepeat: boolean) {
        if (this.invalid) {
            return ConstraintResult.INVALID;
        }

        return this.logicStep(board, null);
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        if (!this.flatCellsSet.has(cellIndex)) {
            return true;
        }

        const possibleSums = this.possibleSums(board);
        if (possibleSums.length === 0) {
            return false;
        }

        return true;
    }

    logicStep(board: Board, logicalStepDescription: string[]) {
        // If we have a fixed sum, we can skip finding possible sums and instead use logicStep to find conflicts.
        const possibleSums = this.fixedSum === null ? this.possibleSums(board) : [this.fixedSum];

        if (possibleSums.length === 0) {
            if (logicalStepDescription) {
                logicalStepDescription.push('No possible sum works for all cell sets.');
            }
            return ConstraintResult.INVALID;
        }

        let origMasks = null;
        if (logicalStepDescription) {
            origMasks = this.flatCells.map(cell => board.cells[cell]);
        }

        let changed = false;
        for (let i = 0; i < this.cells.length; ++i) {
            const sumHelper = this.helpers[i];
            const offset = this.offsets[i];
            const restrictResult = sumHelper.logicStep(
                board,
                possibleSums.map(sum => sum - offset),
                logicalStepDescription
            );
            if (restrictResult === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            if (restrictResult === ConstraintResult.CHANGED) {
                changed = true;
            }
        }

        if (changed && logicalStepDescription) {
            const elims = [];
            for (let i = 0; i < this.cells.length; i++) {
                const cell = this.flatCells[i];
                const origMask = origMasks[i];
                const newMask = board.cells[cell];
                let removedMask = origMask & ~newMask;
                while (removedMask !== 0) {
                    const value = minValue(removedMask);
                    removedMask &= ~valueBit(value);

                    const candidate = board.candidateIndex(cell, value);
                    elims.push(candidate);
                }
            }

            logicalStepDescription.push(
                `Restricted to sum${possibleSums.length === 1 ? '' : 's'} ${possibleSums.join(',')} => ${board.describeElims(elims)}.`
            );
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    possibleSums(board: Board): number[] {
        let sums: Set<number> | null = this.fixedSum === null ? null : new Set([this.fixedSum]);
        for (let i = 0; i < this.cells.length; ++i) {
            const helper = this.helpers[i];
            const offset = this.offsets[i];
            const possibleSums = helper.possibleSums(board).map(x => x + offset);
            if (possibleSums.length === 0) {
                return [];
            }

            if (sums === null) {
                sums = new Set(possibleSums);
            } else {
                sums = new Set(possibleSums.filter(x => sums!.has(x)));
            }
        }

        if (sums === null) {
            return [];
        }
        return Array.from(sums).sort((a, b) => a - b);
    }
}
