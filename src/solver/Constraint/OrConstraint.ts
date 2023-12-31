import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { valueBit, minValue, CellIndex, CellValue } from '../SolveUtility';
import { Constraint, ConstraintResult } from './Constraint';

interface OrConstraintParams {
    subboards: Board[];
}

export class OrConstraint extends Constraint {
    numCells: number;
    numCandidates: number;
    subboards: Board[];

    constructor(constraintName: string, specificName: string, board: Board, params: OrConstraintParams) {
        const { subboards } = params;
        super(board, constraintName, specificName);
        this.numCells = board.size * board.size;
        this.numCandidates = board.size * board.size * board.size;
        this.subboards = subboards;
    }

    init(board: Board, isRepeat: boolean) {
        this.subboards = this.subboards.filter(subboard => {
            // Copy state downwards
            for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
                subboard.keepCellMask(cellIndex, board.cells[cellIndex]);
            }
            for (let candidate = 0; candidate < this.numCandidates; ++candidate) {
                for (const weakLink of board.weakLinks[candidate]) {
                    subboard.addWeakLink(candidate, weakLink);
                }
            }
            for (const { name, fromConstraint, type, cells } of board.regions) {
                subboard.addRegion(name, cells, type, fromConstraint, false);
            }

            // Init constraints
            // If init fails, filter out the subboard immediately
            return subboard.initConstraints(isRepeat);
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
            if (result == ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            } else if (result == ConstraintResult.CHANGED) {
                changed = ConstraintResult.CHANGED;
            }
        }

        // Transfer weak links shared by all subboards up
        for (let candidate = 0; candidate < this.numCandidates; ++candidate) {
            const boardLinks = board.weakLinks[candidate];

            // Find the interesction of all subboard weak links for this candidate
            let newLinks = this.subboards[0].weakLinks[candidate].filter(link => !boardLinks.includes(link));
            if (newLinks.length === 0) {
                continue;
            }

            for (let subBoardIndex = 1; subBoardIndex < this.subboards.length; ++subBoardIndex) {
                const subBoardLinks1 = this.subboards[subBoardIndex].weakLinks[candidate];
                newLinks = newLinks.filter(link => subBoardLinks1.includes(link));
                if (newLinks.length === 0) {
                    break;
                }
            }

            if (newLinks.length > 0) {
                for (const link of newLinks) {
                    board.addWeakLink(candidate, link);
                }
                changed = ConstraintResult.CHANGED;
            }
        }

        return changed;
    }

    finalize() {
        this.subboards = this.subboards.filter(subboard => {
            for (const constraint of subboard.constraints) {
                const result = constraint.finalize(subboard);
                if (result === ConstraintResult.INVALID) {
                    return false;
                }
                if (result === ConstraintResult.CHANGED) {
                    throw new Error('finalize is not allowed to change the board');
                }
            }
            subboard.constraintsFinalized = true;
            return true;
        });

        // No more subboards left == puzzle is broken
        return this.subboards.length === 0 ? ConstraintResult.INVALID : ConstraintResult.UNCHANGED;
    }

    clone() {
        // Shallow copy everything
        const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);

        // Clone each subboard
        clone.subboards = this.subboards.map(subboard => subboard.clone());

        return clone;
    }

    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        let invalidSubboards: Board[] | null = null;
        for (const subboard of this.subboards) {
            if (!subboard.setAsGiven(cellIndex, value)) {
                if (invalidSubboards === null) {
                    invalidSubboards = [];
                }
                invalidSubboards.push(subboard);
            }
        }
        if (invalidSubboards !== null) {
            this.subboards = this.subboards.filter(subboard => !invalidSubboards.includes(subboard));
            return this.subboards.length > 0;
        }
        return true;
    }

    enforceCandidateElim(board: Board, cellIndex: CellIndex, value: CellValue) {
        let invalidSubboards: Board[] | null = null;
        for (const subboard of this.subboards) {
            if (!subboard.clearValue(cellIndex, value)) {
                if (invalidSubboards === null) {
                    invalidSubboards = [];
                }
                invalidSubboards.push(subboard);
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
            // Transfer deductions downward
            for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
                subboard.keepCellMask(cellIndex, board.cells[cellIndex]);
            }

            // Step all subconstraints repeatedly until no more further deductions are possible
            let changed = false;
            do {
                changed = false;

                for (const constraint of subboard.constraints) {
                    // Don't bother with logical deductions made in subboards, they get a bit too noisy to show.
                    const result = constraint.logicStep(subboard, null);
                    if (result === ConstraintResult.INVALID) {
                        // Subboard is broken, filter it out
                        return false;
                    } else if (result === ConstraintResult.CHANGED) {
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

        // Transfer deductions shared by all subboards upward
        let changed = ConstraintResult.UNCHANGED;
        const elims = [];
        for (let cellIndex = 0; cellIndex < this.numCells; ++cellIndex) {
            const cellMask = this.subboards.reduce((mask, subboard) => mask | subboard.cells[cellIndex], 0);
            let removedMask = board.cells[cellIndex] & ~cellMask;
            while (removedMask !== 0) {
                const value = minValue(removedMask);
                removedMask ^= valueBit(value);
                elims.push(board.candidateIndex(cellIndex, value));
            }
            const result = board.keepCellMask(cellIndex, cellMask);
            if (result == ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            } else if (result == ConstraintResult.CHANGED) {
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

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('orconstraint', (board: Board, params: OrConstraintBuilderParams) => {
        const subboards: Board[] = [];
        for (const constraint of params.constraints) {
            const subboard = board.subboardClone();
            constraintBuilder.buildConstraints(constraint, subboard, false);

            subboards.push(subboard);
        }
        return new OrConstraint(
            `Or Constraint on (${subboards.map(sub => sub.constraints.map(constraint => constraint.toString()).join(' && ')).join(') || (')})`,
            `Or Constraint on (${subboards
                .map(sub => sub.constraints.map(constraint => constraint.toSpecificString()).join(' && '))
                .join(') || (')})`,
            board,
            { subboards: subboards }
        );
    });
}
