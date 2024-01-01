import { Board } from '../Board';
import { CandidateIndex, CellIndex, valueBit } from '../SolveUtility';
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

// Helper utilities to generate weak links

// cell1 <= cell2 + k
// k == -1 is useful for e.g. thermos
// k == -5 is useful for e.g. german whispers (you need to take the intersection of 2 calls to this helper)
// k == 3 is useful for e.g. length 3 renban (you need to take the union of 2 calls to this helper)
export function* generateLEWeakLinks(
    size: number,
    cellIndex1: CellIndex,
    cellIndex2: CellIndex,
    k: number
): Generator<[CandidateIndex, CandidateIndex]> {
    for (let digit1 = 0; digit1 < size; ++digit1) {
        for (let digit2 = 0; digit2 + k < digit1; ++digit2) {
            yield [cellIndex1 * size + digit1, cellIndex2 * size + digit2];
        }
    }
}
