import { Board } from '../Board';
import { CandidateIndex, CellIndex, CellValue, StateKey, valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult } from './Constraint';

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
        super(board, constraintName, specificName);

        // Check that candidates contains no duplicates
        for (let i = 0; i < params.candidates.length - 1; ++i) {
            for (let j = i + 1; j < params.candidates.length; ++j) {
                if (params.candidates[i] === params.candidates[j]) {
                    throw new Error(`Duplicate candidates not allowed for CardinalityConstraint: ${params.candidates.join(',')}`);
                }
            }
        }

        this.allowedCounts = params.allowedCounts.toSorted().filter((count: number) => count <= params.candidates.length);
        this.stateKey = board.registerState(new CardinalityConstraintState(params.candidates));
        this.initialCandidates = new Uint8Array(board.size * board.size * board.size);
        for (const candidate of params.candidates) {
            this.initialCandidates[candidate] = 1;
        }
    }

    init(board: Board, isRepeat: boolean): InitResult {
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

        if (state.candidates.length === 0) {
            // No candidates means we're either always satisfied or we're always broken. Either way we can delete ourselves.
            return {
                result: this.allowedCounts.includes(state.numSatisfiedCandidates) ? ConstraintResult.UNCHANGED : ConstraintResult.INVALID,
                deleteConstraints: [this],
            };
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
                changed = changed || result === ConstraintResult.CHANGED;
            }

            // Fully encoded in board, so we can delete ourselves
            return { result: changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED, deleteConstraints: [this] };
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
                // Fully encoded in board, so we can delete ourselves
                return { result: ConstraintResult.CHANGED, deleteConstraints: [this] };
            }
            return !isRepeat ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
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

    logicStep(board: Board, logicalStepDescription: string[]) {
        const constState = board.getState<CardinalityConstraintState>(this.stateKey);

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
            const mutState = board.getStateMut<CardinalityConstraintState>(this.stateKey);
            mutState.candidates.length = 0;
            return ConstraintResult.CHANGED;
        } else if (maxPossible === minCount) {
            // All remaining candidates are true
            logicalStepDescription === null || logicalStepDescription.push(`${board.describeCandidates(constState.candidates)}.`);
            if (!board.enforceCandidates(constState.candidates)) {
                return ConstraintResult.INVALID;
            }
            // If that worked, we should clear ourselves
            const mutState = board.getStateMut<CardinalityConstraintState>(this.stateKey);
            mutState.numSatisfiedCandidates += mutState.candidates.length;
            mutState.candidates.length = 0;
            return ConstraintResult.CHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }
}
