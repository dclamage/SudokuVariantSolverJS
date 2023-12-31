import { Board } from '../Board';
import { CandidateIndex, valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult } from './Constraint';

export interface WeakLinksConstraintParams {
    weakLinks: [CandidateIndex, CandidateIndex][];
}

export class WeakLinksConstraint extends Constraint {
    weakLinks: [CandidateIndex, CandidateIndex][];

    constructor(board: Board, params: WeakLinksConstraintParams, name: string, specificName: string) {
        super(board, name, specificName);

        this.weakLinks = params.weakLinks.slice();
    }

    init(board: Board, isRepeat: boolean): ConstraintResult {
        if (isRepeat) {
            return ConstraintResult.UNCHANGED;
        }

        let changed = false;
        for (const [candidate1, candidate2] of this.weakLinks) {
            if (candidate1 === candidate2) {
                const [cellIndex, cellValue] = board.candidateToIndexAndValue(candidate1);
                const valueMask = valueBit(cellValue);
                const result = board.clearCellMask(cellIndex, valueMask);
                if (result === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }
                changed = changed || result === ConstraintResult.CHANGED;
            } else {
                const added = board.addWeakLink(candidate1, candidate2);
                changed = changed || added;
            }
        }
        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }
}
