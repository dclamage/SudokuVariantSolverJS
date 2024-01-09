import { Board } from '../Board';
import { CandidateIndex, CellIndex } from '../SolveUtility';
import { ConstraintV2, ConstraintResult, InitResult } from './ConstraintV2';

export interface WeakLinksConstraintParams {
    weakLinks: [CandidateIndex, CandidateIndex][];
}

export class WeakLinksConstraint extends ConstraintV2 {
    weakLinks: [CandidateIndex, CandidateIndex][];

    constructor(board: Board, params: WeakLinksConstraintParams, name: string, specificName: string) {
        super(name, specificName);
        this.weakLinks = params.weakLinks.slice();
    }

    init(board: Board): InitResult {
        return { result: ConstraintResult.CHANGED, weakLinks: this.weakLinks, deleteConstraints: [this] };
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
        for (let digit2 = 0; digit2 + k < digit1 && digit2 < size; ++digit2) {
            yield [cellIndex1 * size + digit1, cellIndex2 * size + digit2];
        }
    }
}

export function* generateNEqWeakLinks(size: number, cellIndex1: CellIndex, cellIndex2: CellIndex): Generator<[CandidateIndex, CandidateIndex]> {
    for (let digit1 = 0; digit1 < size; ++digit1) {
        yield [cellIndex1 * size + digit1, cellIndex2 * size + digit1];
    }
}

export function* generateEqWeakLinks(size: number, cellIndex1: CellIndex, cellIndex2: CellIndex): Generator<[CandidateIndex, CandidateIndex]> {
    for (let digit1 = 0; digit1 < size; ++digit1) {
        for (let digit2 = 0; digit2 < size; ++digit2) {
            if (digit1 === digit2) continue;
            yield [cellIndex1 * size + digit1, cellIndex2 * size + digit2];
        }
    }
}
