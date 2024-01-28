import { Board, ReadonlyBoard } from '../Board';
import { CandidateIndex, CellIndex, CellValue, StateKey, removeDuplicates, valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult, LogicalDeduction } from './Constraint';

class CardinalityConstraintState {
    numSatisfiedCandidates: number;
    candidates: CandidateIndex[];

    constructor(candidates: CandidateIndex[]) {
        this.numSatisfiedCandidates = 0;
        this.candidates = candidates.slice();
    }

    clone() {
        const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        clone.candidates = this.candidates.slice();
        return clone;
    }
}

export interface CardinalityConstraintParams {
    candidates: CandidateIndex[];
    allowedCounts: number[];
}

// TODO: CardinalityConstraint can be specialized for a couple cases for better perf:
//       1) All candidates are of the same digit (quadruple)
//       2) The candidates are a cartesian product of a set of cells and a set of digits (global entropy)
//       3) The allowed counts form an interval, e.g. [1, n]
// For now, we only implement the generic case where none of this is taken into account,
// which will also become the fallback case when the special cases do not apply.
export class CardinalityConstraint extends Constraint {
    allowedCounts: number[];
    initialCandidates: Uint8Array; // Dense array of 729 bytes is less memory than a sparse array of even just 4 elements, and faster too
    stateKey: StateKey<CardinalityConstraintState>;

    constructor(constraintName: string, specificName: string, board: Board, params: CardinalityConstraintParams) {
        super(
            constraintName,
            specificName,
            params.candidates.map(candidate => board.cellIndexFromCandidate(candidate))
        );

        // Check that candidates contains no duplicates
        for (let i = 0; i < params.candidates.length - 1; ++i) {
            for (let j = i + 1; j < params.candidates.length; ++j) {
                if (params.candidates[i] === params.candidates[j]) {
                    throw new Error(`Duplicate candidates not allowed for CardinalityConstraint: ${params.candidates.join(',')}`);
                }
            }
        }

        this.allowedCounts = params.allowedCounts.filter((count: number) => count <= params.candidates.length).sort();
        this.stateKey = board.registerState(new CardinalityConstraintState(params.candidates));
        this.initialCandidates = new Uint8Array(board.size * board.size * board.size);
        for (const candidate of params.candidates) {
            this.initialCandidates[candidate] = 1;
        }
    }

    init(board: Board): InitResult {
        if (this.allowedCounts.length === 0) {
            // No allowed counts == broken constraint
            // Handle this case gracefully as encodings may include this in an Or constraint;
            // it's not necessary the case that this is an encoding bug
            return ConstraintResult.INVALID;
        }

        const state = board.getStateMut<CardinalityConstraintState>(this.stateKey);

        // Check if any candidates have already been eliminated or satisfied
        state.candidates = state.candidates.filter((candidate: CandidateIndex) => {
            const [cellIndex, value] = board.candidateToIndexAndValue(candidate);
            if ((board.cells[cellIndex] & valueBit(value)) === 0) {
                // Candidate was eliminated
                return false;
            } else if (board.isGiven(cellIndex)) {
                // Candidate was a given that matches our digit, so it's true
                state.numSatisfiedCandidates++;
                return false;
            }
            // Candidate is unresolved, keep it
            // Naked singles will get enforced later, so it's ok to ignore them for now
            return true;
        });
        this.constraintCells = removeDuplicates(state.candidates.map(candidate => board.cellIndexFromCandidate(candidate)).sort((a, b) => a - b));

        if (state.candidates.length === 0) {
            // No candidates means we're either always satisfied or we're always broken. Either way we can delete ourselves.
            return {
                result: this.allowedCounts.includes(state.numSatisfiedCandidates) ? ConstraintResult.UNCHANGED : ConstraintResult.INVALID,
                deleteConstraints: [this],
            };
        }

        // If the max count is 1, we can add weak links
        if (this.allowedCounts[this.allowedCounts.length - 1] === 1) {
            for (const candidate1 of state.candidates) {
                for (const candidate2 of state.candidates) {
                    if (candidate1 <= candidate2) {
                        continue;
                    }
                    board.addWeakLink(candidate1, candidate2);
                }
            }

            // If the min count is 0, the weak links are all that's necessary.
            if (this.allowedCounts[0] === 0) {
                // Fully encoded in board, so we can delete ourselves
                return { result: ConstraintResult.CHANGED, deleteConstraints: [this] };
            }
            return ConstraintResult.CHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }

    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        // Early exit
        const candidate = board.candidateIndex(cellIndex, value);
        if (!this.initialCandidates[candidate]) {
            return true;
        }

        // This prevents the accidental use of constState beyond this scope.
        let candidatePos;
        {
            const constState = board.getState<CardinalityConstraintState>(this.stateKey);

            // Early exit for pre-encoded / satisfied constraints
            if (constState.candidates.length === 0) {
                return this.allowedCounts.includes(constState.numSatisfiedCandidates);
            }

            candidatePos = constState.candidates.indexOf(candidate);
            if (candidatePos === -1) {
                // Unrelated candidate, ignore
                return true;
            }
        }

        // Remove candidate and increment numSatisfiedCandidates
        const mutState = board.getStateMut<CardinalityConstraintState>(this.stateKey);
        mutState.numSatisfiedCandidates++;
        mutState.candidates.splice(candidatePos, 1);

        // If there are no candidates left, numSatisfiedCandidates must be in allowedCounts
        if (mutState.candidates.length === 0) {
            return this.allowedCounts.includes(mutState.numSatisfiedCandidates);
        }

        const maxCount = this.allowedCounts[this.allowedCounts.length - 1];
        return mutState.numSatisfiedCandidates <= maxCount;
    }

    enforceCandidateElim(board: Board, cellIndex: CellIndex, value: CellValue) {
        const candidate = board.candidateIndex(cellIndex, value);
        if (!this.initialCandidates[candidate]) {
            return true;
        }

        // This prevents the accidental use of constState beyond this scope.
        let candidatePos;
        {
            const constState = board.getState<CardinalityConstraintState>(this.stateKey);

            // Early exit for pre-encoded / satisfied constraints
            if (constState.candidates.length === 0) {
                return this.allowedCounts.includes(constState.numSatisfiedCandidates);
            }

            candidatePos = constState.candidates.indexOf(candidate);
            if (candidatePos === -1) {
                // Unrelated candidate, ignore
                return true;
            }
        }

        // Remove candidate and don't increment numSatisfiedCandidates
        const mutState = board.getStateMut<CardinalityConstraintState>(this.stateKey);
        mutState.candidates.splice(candidatePos, 1);

        // If there are no candidates left, numSatisfiedCandidates must be in allowedCounts
        if (mutState.candidates.length === 0) {
            return this.allowedCounts.includes(mutState.numSatisfiedCandidates);
        }

        const minCount = this.allowedCounts[0];
        return mutState.numSatisfiedCandidates + mutState.candidates.length >= minCount;
    }

    obviousLogicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        const state = board.getStateMut<CardinalityConstraintState>(this.stateKey);

        if (state.candidates.length === 0) {
            // No candidates means we're either always satisfied or we're always broken. Either way we can delete ourselves.
            if (this.allowedCounts.includes(state.numSatisfiedCandidates)) {
                return [
                    {
                        deleteConstraints: [this],
                    },
                ];
            } else {
                return [
                    {
                        explanation: 'No more possible candidates but required count still not attained',
                        invalid: true,
                    },
                ];
            }
        }

        const minPossible = state.numSatisfiedCandidates;
        const maxAllowedCount = this.allowedCounts[this.allowedCounts.length - 1];

        // If we reached the max *allowed* count, not necessarily max attainable allowed count, then the remaining candidates must be false
        if (minPossible === maxAllowedCount) {
            return [
                {
                    explanation: 'Max allowed count attained, all remaining candidates must be false',
                    eliminations: state.candidates,
                    deleteConstraints: [this],
                },
            ];
            // } else if (maxPossible === minCount) {
            // Leave "hidden singles" for logicalStep
        }

        return [];
    }

    logicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        const state = board.getStateMut<CardinalityConstraintState>(this.stateKey);

        const minPossible = state.numSatisfiedCandidates;
        const maxPossible = state.numSatisfiedCandidates + state.candidates.length;
        const minAllowedCount = this.allowedCounts[0];
        const minAttainableAllowedCount = this.allowedCounts.find(count => count >= minPossible);
        const maxAttainableAllowedCount = this.allowedCounts.findLast(count => count <= maxPossible);

        // Covers "hidden singles", which we left out of obviousLogicalStep.
        if (maxPossible === minAllowedCount) {
            return [
                {
                    explanation: 'Min allowed count only attainable if we set all remaining candidates to true',
                    singles: state.candidates,
                    deleteConstraints: [this],
                },
            ];
        }

        // If we reached the max attainable allowed count, then the remaining candidates must be false
        // This isn't the same as the "obvious" deduction above. For example, allowedCounts could be [0, 5], and started out with 5 candidates.
        // Once a single candidate is eliminated, our minPossible is still 0, but our maxAttainableAllowedCount has decreased from 5 to 0, matching minPossible.
        // Thus all remaining candidates must be false too.
        if (minPossible === maxAttainableAllowedCount) {
            return [
                {
                    explanation: 'Max attainable allowed count attained, all remaining candidates must be false',
                    eliminations: state.candidates,
                    deleteConstraints: [this],
                },
            ];
        }

        // Similar to the above example, if there's a gap in the allowed counts, also finds less obvious cases.
        // Rather than having a single candidate eliminated, consider what would happen if a single candidate was enforced instead.
        // Then our minAttainableAllowedCount would increase from 0 to 5, which is exactly equal to what's possible if everything remaining were true.
        // Thus all remaining candidates must be true too.
        if (maxPossible === minAttainableAllowedCount) {
            return [
                {
                    explanation: 'Min attainable allowed count only attainable if we set all remaining candidates to true',
                    singles: state.candidates,
                    deleteConstraints: [this],
                },
            ];
        }

        // If the next attainable allowed count is higher than where we currently are,
        // we know at least one candidate must be true, and we can thus do clause forcing :)
        if (minPossible < minAttainableAllowedCount) {
            const calcDeductionType = () => {
                const allSameCell = new Set(state.candidates.map(cand => board.candidateToIndexAndValue(cand)[0])).size === 1;
                const allSameDigit = new Set(state.candidates.map(cand => board.candidateToIndexAndValue(cand)[1])).size === 1;
                return allSameCell ? 'Cell forcing' : allSameDigit ? 'Pointing' : 'Clause forcing';
            };

            const eliminations = board.calcElimsForCandidateIndices(state.candidates);
            const singles = board.calcSinglesForCandidateIndices(state.candidates);
            if (eliminations.length > 0 || singles.length > 0) {
                return [
                    {
                        explanation: `${calcDeductionType()} on ${board.describeCandidates(state.candidates)}`,
                        eliminations,
                        singles,
                    },
                ];
            }
        }

        // We currently won't do clause forcing over the negative literals, if we know at least one candidate needs to be false...

        return [];
    }
}
