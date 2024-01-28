import { Board, ReadonlyBoard } from '../Board';
import { valueBit, minValue, CellIndex, CellValue, CandidateIndex, WeakLink } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult, LogicalDeduction } from './Constraint';

interface OrConstraintParams {
    subboards: Board[];
    cells: CellIndex[];
}

export class OrConstraint extends Constraint {
    numCells: number;
    numCandidates: number;
    subboards: Board[];
    subboardsChanged: boolean;

    constructor(constraintName: string, specificName: string, board: Board, params: OrConstraintParams) {
        if (constraintName === undefined || specificName === undefined || board === undefined || params === undefined) {
            super(undefined, undefined, undefined);
            this.numCells = undefined;
            this.numCandidates = undefined;
            this.subboards = undefined;
            this.subboardsChanged = undefined;
        } else {
            const { subboards, cells } = params;
            super(constraintName, specificName, cells);
            this.numCells = board.size * board.size;
            this.numCandidates = board.size * board.size * board.size;
            this.subboards = subboards;
            this.subboardsChanged = true;
        }
    }

    init(board: Board): InitResult {
        this.subboards = this.subboards.filter(subboard => {
            // Copy state downwards
            if (
                subboard.newApplyCellMasks(
                    Array.from({ length: this.numCells }, (_, i) => i),
                    board.cells
                ) === ConstraintResult.INVALID
            ) {
                return false;
            }
            for (const { name, fromConstraint, type, cells } of board.regions) {
                subboard.addRegion(name, cells, type, fromConstraint, false);
            }

            // Init constraints
            // If init fails, filter out the subboard immediately
            const keepSubboard = subboard.finalizeConstraints();
            if (!keepSubboard) {
                subboard.release();
            }
            return keepSubboard;
        });

        // No more subboards left == puzzle is broken
        if (this.subboards.length === 0) {
            return ConstraintResult.INVALID;
        }
    }

    clone() {
        // Shallow copy everything
        const clone: OrConstraint = Object.assign(new OrConstraint(undefined, undefined, undefined, undefined), this);

        // Clone each subboard
        clone.subboards = this.subboards.map(subboard => subboard.clone());

        return clone;
    }

    release() {
        for (const subboard of this.subboards) {
            subboard.release();
        }
    }

    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        this.subboardsChanged = true;
        let invalidSubboards: Board[] | null = null;
        for (const subboard of this.subboards) {
            if (subboard.newApplySingle(board.candidateIndex(cellIndex, value)) === ConstraintResult.INVALID) {
                if (invalidSubboards === null) {
                    invalidSubboards = [];
                }
                invalidSubboards.push(subboard);
                subboard.release();
            }
        }
        if (invalidSubboards !== null) {
            this.subboards = this.subboards.filter(subboard => !invalidSubboards.includes(subboard));
            return this.subboards.length > 0;
        }
        return true;
    }

    enforceCandidateElim(board: Board, cellIndex: CellIndex, value: CellValue) {
        this.subboardsChanged = true;
        let invalidSubboards: Board[] | null = null;
        for (const subboard of this.subboards) {
            if (subboard.newApplyElim(board.candidateIndex(cellIndex, value)) === ConstraintResult.INVALID) {
                if (invalidSubboards === null) {
                    invalidSubboards = [];
                }
                invalidSubboards.push(subboard);
                subboard.release();
            }
        }
        if (invalidSubboards !== null) {
            this.subboards = this.subboards.filter(subboard => !invalidSubboards.includes(subboard));
            return this.subboards.length > 0;
        }
        return true;
    }

    // No obvious steps

    logicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        this.subboards = this.subboards.filter(subboard => {
            subboard.binaryImplications.sortGraph();
            // No need to transfer deductions downward since that's already handled in `enforce/enforceCandidateElim`

            // Step all subconstraints repeatedly until no more further deductions are possible
            let changed = false;
            do {
                changed = false;

                for (const constraint of subboard.constraints) {
                    const deductions = Constraint.flattenDeductions(constraint.obviousLogicalStep(subboard).concat(constraint.logicalStep(subboard)));
                    const result = subboard.applyLogicalDeduction(deductions);
                    if (result === ConstraintResult.INVALID) {
                        // Subboard is broken, filter it out
                        this.subboardsChanged = true;
                        subboard.release();
                        return false;
                    } else if (result === ConstraintResult.CHANGED) {
                        this.subboardsChanged = true;
                        changed = true;
                    }
                }
            } while (changed);

            // Subboard not broken at this point, keep it
            return true;
        });

        if (this.subboards.length === 0) {
            return [
                {
                    explanation: 'All cases broken, this Or constraint cannot be satisfied',
                    invalid: true,
                },
            ];
        }

        // Can't unset subboardsChanged here since the user may not necessarily apply the deductions we suggest
        // That's fine though, this isn't perf sensitive

        const deductions = [];

        // Transfer deductions shared by all subboards upward
        const eliminations = [];
        for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
            let cellMask = 0;
            for (const subboard of this.subboards) {
                cellMask |= subboard.cells[cellIndex];
            }
            let removedMask = board.cells[cellIndex] & board.allValues & ~cellMask;
            while (removedMask !== 0) {
                const value = minValue(removedMask);
                removedMask ^= valueBit(value);
                eliminations.push(board.candidateIndex(cellIndex, value));
            }
        }
        if (eliminations.length > 0) {
            deductions.push({
                explanation: '',
                eliminations,
            });
        }

        let scratch: CandidateIndex[] = [];
        const weakLinks: WeakLink[] = [];
        for (let candidate = 0; candidate < this.numCandidates; ++candidate) {
            let newLinks = this.subboards[0].binaryImplications.getTopLayerNegConsequences(candidate).slice();
            for (let subboardIndex = 1; subboardIndex < this.subboards.length; ++subboardIndex) {
                if (newLinks.length === 0) {
                    break;
                }
                scratch.length = 0;
                this.subboards[subboardIndex].binaryImplications.filterOutTopLayerNegConsequences(candidate, newLinks, scratch);
                [newLinks, scratch] = [scratch, newLinks];
            }
            scratch.length = 0;
            board.binaryImplications.filterOutNegConsequences(candidate, newLinks, scratch);
            for (const link of scratch) {
                for (const subboard of this.subboards) {
                    subboard.binaryImplications.transferImplicationToParent(candidate, ~link);
                }
            }
            if (scratch.length > 0) {
                for (const constraint of board.constraints) {
                    constraint.constraintCells[0] !== undefined && board.markCellAsModified(constraint.constraintCells[0]);
                }
            }
            for (const link of newLinks) {
                weakLinks.push([candidate, link]);
            }
        }
        if (weakLinks.length > 0) {
            deductions.push({
                explanation: 'Weak links shared by all subboards',
                weakLinks,
            });
        }

        if (this.subboards.length === 1) {
            deductions.push({
                explanation: 'Restricted to only 1 subboard, adding weak links and constraints of subboard to main board',
                addConstraints: this.subboards[0].constraints.slice(),
                deleteConstraints: [this],
                weakLinks: Array.from({ length: board.size * board.size * board.size }, (_, candidate) =>
                    this.subboards[0].binaryImplications
                        .getTopLayerNegConsequences(candidate)
                        .map((link: CandidateIndex): WeakLink => [candidate, link])
                ).flat(),
            });
        }

        return deductions;
    }

    bruteForceStep(board: Board): ConstraintResult {
        this.subboards = this.subboards.filter(subboard => {
            // Step all subconstraints repeatedly until no more further deductions are possible
            let changed = false;
            do {
                changed = false;

                for (const constraint of subboard.constraints) {
                    const result = constraint.bruteForceStep(subboard);
                    if (result === ConstraintResult.INVALID) {
                        // Subboard is broken, filter it out
                        this.subboardsChanged = true;
                        subboard.release();
                        return false;
                    } else if (result === ConstraintResult.CHANGED) {
                        this.subboardsChanged = true;
                        changed = true;
                    }
                }
            } while (changed);

            // Subboard not broken at this point, keep it
            return true;
        });

        if (this.subboards.length === 0) {
            return ConstraintResult.INVALID;
        }

        if (!this.subboardsChanged) {
            return ConstraintResult.UNCHANGED;
        }
        this.subboardsChanged = false;

        // Transfer deductions shared by all subboards upward
        const sharedMasks = [];
        for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
            let cellMask = 0;
            for (const subboard of this.subboards) {
                cellMask |= subboard.cells[cellIndex];
            }
            sharedMasks.push(cellMask);
        }

        return board.newApplyCellMasks(
            Array.from({ length: this.numCells }, (_, i) => i),
            sharedMasks
        );
    }
}

export interface OrConstraintBuilderParams {
    constraints: Constraint[];
}
