import { valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult } from './Constraint';

class CardinalityConstraintState {
    constructor(candidates) {
        this.numSatisfiedCandidates = 0;
        this.candidates = candidates.slice();
    }

    clone() {
        let clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        clone.candidates = this.candidates.slice();
        return clone;
    }
}

// TODO: CardinalityConstraint can be specialized for a couple cases for better perf:
//       1) All candidates are of the same digit (quadruple)
//       2) The candidates are a cartesian product of a set of cells and a set of digits (global entropy)
//       3) The allowed counts form an interval, e.g. [1, n]
// For now, we only implement the generic case where none of this is taken into account,
// which will also become the fallback case when the special cases do not apply.
export class CardinalityConstraint extends Constraint {
    constructor(constraintName, specificName, board, params) {
        super(board, constraintName, specificName);

        // Check that candidates contains no duplicates
        for (let i = 0; i < params.candidates.length - 1; ++i) {
            for (let j = i + 1; j < params.candidates.length; ++j) {
                if (params.candidates[i] === params.candidates[j]) {
                    throw new Error(`Duplicate candidates not allowed for CardinalityConstraint: ${params.candidates.join(',')}`);
                }
            }
        }

        this.allowedCounts = params.allowedCounts.toSorted().filter(count => count <= params.candidates.length);
        this.stateKey = board.registerState(new CardinalityConstraintState(params.candidates));
    }

    init(board, isRepeat) {
        if (this.allowedCounts.length === 0) {
            // No allowed counts == broken constraint
            // Handle this case gracefully as encodings may include this in an Or constraint;
            // it's not necessary the case that this is an encoding bug
            return ConstraintResult.INVALID;
        }

        const state = board.getStateMut(this.stateKey);

        // Check if any candidates have already been eliminated or satisfied
        state.candidates = state.candidates.filter(candidate => {
            const [cellIndex, value] = board.candidateToIndexAndValue(candidate);
            if (board.cells[cellIndex] & (valueBit(value) === 0)) {
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

        if (state.candidates.length === 0) {
            // No candidates means we're either always satisfied or we're always broken.
            return this.allowedCounts.includes(state.numSatisfiedCandidates) ? ConstraintResult.UNCHANGED : ConstraintResult.INVALID;
        }

        const minCount = this.allowedCounts[0];
        const maxCount = this.allowedCounts[this.allowedCounts.length - 1];

        // If the max count is 0, this is just saying the candidates are all false
        if (maxCount === 0) {
            let changed = false;
            for (const candidate of state.candidates.slice()) {
                const [cellIndex, value] = board.candidateToIndexAndValue(candidate);
                const result = board.clearCellMask(cellIndex, valueBit(value));
                if (result === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }
                changed |= result === ConstraintResult.CHANGED;
            }

            // Fully encoded in board, so we don't have to do anything anymore
            state.candidates = [];
            state.numSatisfiedCandidates = 0;
            this.allowedCounts = [0];

            return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
        }

        // If the max count is 1, we can add weak links
        if (maxCount === 1) {
            if (!isRepeat) {
                for (const candidate1 of state.candidates) {
                    for (const candidate2 of state.candidates) {
                        if (candidate1 <= candidate2) {
                            continue;
                        }
                        board.addWeakLink(candidate1, candidate2);
                    }
                }
            }

            // If the min count is 0, the weak links are all that's necessary.
            if (minCount === 0) {
                // Fully encoded in board, so we don't have to do anything anymore
                state.candidates = [];
                state.numSatisfiedCandidates = 0;
                this.allowedCounts = [0];

                return ConstraintResult.UNCHANGED;
            }
            return !isRepeat ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }

    enforce(board, cellIndex, value) {
        const constState = board.getState(this.stateKey);

        // Early exit for pre-encoded / satisfied constraints
        if (constState.candidates.length === 0) {
            return this.allowedCounts.includes(constState.numSatisfiedCandidates);
        }

        const candidate = board.candidateIndex(cellIndex, value);
        const candidatePos = constState.candidates.indexOf(candidate);
        if (candidatePos === -1) {
            // Unrelated candidate, ignore
            return true;
        }

        // Remove candidate and increment numSatisfiedCandidates
        const mutState = board.getStateMut(this.stateKey);
        mutState.numSatisfiedCandidates++;
        mutState.candidates.splice(candidatePos, 1);

        // If there are no candidates left, numSatisfiedCandidates must be in allowedCounts
        if (mutState.candidates.length === 0) {
            return this.allowedCounts.includes(mutState.numSatisfiedCandidates);
        }

        const maxCount = this.allowedCounts[this.allowedCounts.length - 1];
        return mutState.numSatisfiedCandidates <= maxCount;
    }

    enforceCandidateElim(board, cellIndex, value) {
        const constState = board.getState(this.stateKey);

        // Early exit for pre-encoded / satisfied constraints
        if (constState.candidates.length === 0) {
            return this.allowedCounts.includes(constState.numSatisfiedCandidates);
        }

        const candidate = board.candidateIndex(cellIndex, value);
        const candidatePos = constState.candidates.indexOf(candidate);
        if (candidatePos === -1) {
            // Unrelated candidate, ignore
            return true;
        }

        // Remove candidate and don't increment numSatisfiedCandidates
        const mutState = board.getStateMut(this.stateKey);
        mutState.candidates.splice(candidatePos, 1);

        // If there are no candidates left, numSatisfiedCandidates must be in allowedCounts
        if (mutState.candidates.length === 0) {
            return this.allowedCounts.includes(mutState.numSatisfiedCandidates);
        }

        const minCount = this.allowedCounts[0];
        return mutState.numSatisfiedCandidates + mutState.candidates.length >= minCount;
    }

    logicStep(board, logicalStepDescription) {
        const constState = board.getState(this.stateKey);

        // Early exit for pre-encoded / satisfied constraints
        if (constState.candidates.length === 0) {
            return ConstraintResult.UNCHANGED;
        }

        // Check for less obvious contradictions that aren't checked in `enforce`, then do propagations

        const minPossible = constState.numSatisfiedCandidates;
        const maxPossible = constState.numSatisfiedCandidates + constState.candidates.length;
        const minCount = this.allowedCounts.find(count => count >= minPossible);
        const maxCount = this.allowedCounts.findLast(count => count <= maxPossible);

        // Check count is feasible
        if (maxPossible < minCount) {
            if (logicalStepDescription !== null) {
                logicalStepDescription.push(
                    `Not possible to achieve required count with ${
                        constState.candidates.length
                    } remaining unresolved candidates: ${board.describeCandidates(
                        constState.candidates
                    )}, but we require a count of at least ${minCount}.`
                );
            }
            return ConstraintResult.INVALID;
        }
        // else, maxPossible >= minCount (and minCount >= minPossible).
        // Meaning there exists a count between min and max possible, thus the sum is feasible.

        // Do propagations
        if (minPossible === maxCount) {
            // All remaining candidates are false
            logicalStepDescription === null || logicalStepDescription.push(`${board.describeElims(constState.candidates)}.`);
            if (!board.clearCandidates(constState.candidates)) {
                return ConstraintResult.INVALID;
            }
            // If that worked, we should clear ourselves
            const mutState = board.getStateMut(this.stateKey);
            mutState.candidates.length = 0;
            return ConstraintResult.CHANGED;
        } else if (maxPossible === minCount) {
            // All remaining candidates are true
            logicalStepDescription === null || logicalStepDescription.push(`${board.describeCandidates(constState.candidates)}.`);
            if (!board.enforceCandidates(constState.candidates)) {
                return ConstraintResult.INVALID;
            }
            // If that worked, we should clear ourselves
            const mutState = board.getStateMut(this.stateKey);
            mutState.numSatisfiedCandidates += mutState.candidates.length;
            mutState.candidates.length = 0;
            return ConstraintResult.CHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }
}
