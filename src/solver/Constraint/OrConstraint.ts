import { Board } from '../Board';
import { valueBit, minValue, CellIndex, CellValue, CandidateIndex } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult } from './Constraint';

interface OrConstraintParams {
    subboards: Board[];
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
            const { subboards } = params;
            super(board, constraintName, specificName);
            this.numCells = board.size * board.size;
            this.numCandidates = board.size * board.size * board.size;
            this.subboards = subboards;
            this.subboardsChanged = true;
        }
    }

    init(board: Board, isRepeat: boolean): InitResult {
        this.subboards = this.subboards.filter(subboard => {
            // Copy state downwards
            for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
                subboard.keepCellMask(cellIndex, board.cells[cellIndex]);
            }
            for (const { name, fromConstraint, type, cells } of board.regions) {
                subboard.addRegion(name, cells, type, fromConstraint, false);
            }

            // Init constraints
            // If init fails, filter out the subboard immediately
            const keepSubboard = subboard.initConstraints(isRepeat);
            if (!keepSubboard) {
                subboard.release();
            }
            return keepSubboard;
        });

        // No more subboards left == puzzle is broken
        if (this.subboards.length === 0) {
            return ConstraintResult.INVALID;
        }

        // Transfer presolve deductions shared by all subboards up
        let changed = ConstraintResult.UNCHANGED;
        for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
            const cellMask = this.subboards.reduce((mask, subboard) => mask | subboard.cells[cellIndex], 0);
            const result = board.keepCellMask(cellIndex, cellMask);
            if (result === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            } else if (result === ConstraintResult.CHANGED) {
                changed = ConstraintResult.CHANGED;
            }
        }

        // Transfer weak links shared by all subboards up
        let scratch: CandidateIndex[] = [];
        for (let candidate = 0; candidate < this.numCandidates; ++candidate) {
            // Find the interesction of all subboard weak links for this candidate
            let newLinks = this.subboards[0].binaryImplications.getTopLayerNegConsequences(candidate);

            for (let subboardIndex = 1; subboardIndex < this.subboards.length; ++subboardIndex) {
                if (newLinks.length === 0) {
                    break;
                }
                scratch.length = 0;
                this.subboards[subboardIndex].binaryImplications.filterOutTopLayerNegConsequences(candidate, newLinks, scratch);
                [newLinks, scratch] = [scratch, newLinks];
            }

            if (newLinks.length === 0) {
                continue;
            }

            changed = ConstraintResult.CHANGED;

            for (const subboard of this.subboards) {
                for (const link of newLinks) {
                    subboard.transferWeakLinkToParentSubboard(candidate, link);
                }
            }
        }

        // Only a single subboard, send up all our constraints onto the main board and delete ourselves
        if (this.subboards.length === 1) {
            return { result: changed, addConstraints: this.subboards[0].constraints.slice(), deleteConstraints: [this] };
        }

        return changed;
    }

    finalize() {
        this.subboards = this.subboards.filter(subboard => {
            if (!subboard.finalizeConstraintsNoInit()) {
                subboard.release();
                return false;
            }
            return true;
        });

        // No more subboards left == puzzle is broken
        return this.subboards.length === 0 ? ConstraintResult.INVALID : ConstraintResult.UNCHANGED;
    }

    clone() {
        // Shallow copy everything
        const clone = Object.assign(new OrConstraint(undefined, undefined, undefined, undefined), this);

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
            if (!subboard.setAsGiven(cellIndex, value)) {
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
            if (!subboard.clearValue(cellIndex, value)) {
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

    logicStep(board: Board, logicalStepDescription: string[]) {
        this.subboards = this.subboards.filter(subboard => {
            // Step all subconstraints repeatedly until no more further deductions are possible
            let changed = false;
            do {
                changed = false;

                for (const constraint of subboard.constraints) {
                    // Don't bother with logical deductions made in subboards, they get a bit too noisy to show.
                    const result = constraint.logicStep(subboard, null);
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
            logicalStepDescription === null || logicalStepDescription.push('All cases broken, this Or constraint cannot be satisfied.');
            return ConstraintResult.INVALID;
        }

        if (!this.subboardsChanged) {
            return ConstraintResult.UNCHANGED;
        }
        this.subboardsChanged = false;

        // Transfer deductions shared by all subboards upward
        let changed = ConstraintResult.UNCHANGED;
        const elims = [];
        for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
            let cellMask = 0;
            for (const subboard of this.subboards) {
                cellMask |= subboard.cells[cellIndex];
            }
            let removedMask = board.cells[cellIndex] & ~cellMask;
            while (removedMask !== 0) {
                const value = minValue(removedMask);
                removedMask ^= valueBit(value);
                elims.push(board.candidateIndex(cellIndex, value));
            }
            const result = board.keepCellMask(cellIndex, cellMask);
            if (result === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            } else if (result === ConstraintResult.CHANGED) {
                changed = ConstraintResult.CHANGED;
            }
        }
        if (changed && logicalStepDescription !== null) {
            logicalStepDescription.push(`${board.describeElims(elims)}.`);
        }

        return changed;
    }
}

export interface OrConstraintBuilderParams {
    constraints: Constraint[];
}
