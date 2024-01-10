import { Board } from '../Board';
import { CandidateIndex, CellIndex, CellValue } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { ConstraintV2, ConstraintResult, LogicalDeduction, PreprocessingResult } from './ConstraintV2';
import { FixedSumConstraint } from './FixedSumConstraint';

// EqualSumConstraint: There must be a common-sum S such that for every i, S = sum([...cells[i], offsets[i]]).
export class EqualSumConstraint extends ConstraintV2 {
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
        super(constraintName, specificName);

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

    init(board: Board) {
        if (this.invalid) {
            return ConstraintResult.INVALID;
        }

        if (this.fixedSum !== null) {
            // If we have a fixed sum, replace ourselves with individual FixedSumConstraints
            const addConstraints = [];
            for (let i = 0; i < this.cells.length; ++i) {
                addConstraints.push(
                    new FixedSumConstraint(this.toString(), this.toSpecificString(), board, {
                        cells: this.cells[i],
                        sum: this.fixedSum - this.offsets[i],
                    })
                );
            }
            return { result: ConstraintResult.UNCHANGED, addConstraints, deleteConstraints: [this] };
        }

        return ConstraintResult.UNCHANGED;
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

    logicalStep(board: Board): LogicalDeduction[] {
        // If we have a fixed sum, we can skip finding possible sums and instead use logicStep to find conflicts.
        const possibleSums = this.fixedSum === null ? this.possibleSums(board) : [this.fixedSum];

        if (possibleSums.length === 0) {
            return [
                {
                    explanation: 'No possible sum works for all cell sets',
                    invalid: true,
                },
            ];
        }

        const eliminations: CandidateIndex[] = [];

        for (let i = 0; i < this.cells.length; ++i) {
            const sumHelper = this.helpers[i];
            const offset = this.offsets[i];
            const restrictResult = sumHelper.getRestrictSumsEliminations(
                board,
                possibleSums.map(sum => sum - offset)
            );
            if (restrictResult.result === ConstraintResult.INVALID) {
                return [
                    {
                        invalid: true,
                        explanation: restrictResult.explanation,
                    },
                ];
            }
            if (restrictResult.result === ConstraintResult.CHANGED) {
                for (const elim of restrictResult.eliminations) {
                    eliminations.push(elim);
                }
            }
        }

        if (eliminations.length > 0) {
            return [
                {
                    explanation: `Restricted to sum${possibleSums.length === 1 ? '' : 's'} ${possibleSums.join(',')}`,
                    eliminations,
                },
            ];
        }

        return [];
    }

    preprocessingStep(board: Board): PreprocessingResult {
        // For now we don't do any adding constraint stuff, so just call bruteForceStep
        return this.bruteForceStep(board);
    }

    bruteForceStep(board: Board): ConstraintResult {
        // If we have a fixed sum, we can skip finding possible sums and instead use logicStep to find conflicts.
        const possibleSums = this.fixedSum === null ? this.possibleSums(board) : [this.fixedSum];

        if (possibleSums.length === 0) {
            return ConstraintResult.INVALID;
        }

        let changed = false;

        for (let i = 0; i < this.cells.length; ++i) {
            const sumHelper = this.helpers[i];
            const offset = this.offsets[i];
            const restrictResult = sumHelper.logicStep(
                board,
                possibleSums.map(sum => sum - offset),
                null
            );
            if (restrictResult === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            if (restrictResult === ConstraintResult.CHANGED) {
                changed = true;
            }
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
