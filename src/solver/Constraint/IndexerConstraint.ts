import { Board, Region } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, CellIndex, cellIndexFromName, valuesList } from '../SolveUtility';
import { FPuzzlesCells } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

type TargetCandidateFn = (board: Board, candidate: CandidateIndex) => CandidateIndex;

function generateIndexerWeakLinks(board: Board, cells: CellIndex[], targetCandidateFn: TargetCandidateFn): [CandidateIndex, CandidateIndex][] {
    const cellsLookup = new Set(cells);
    const weakLinks: [CandidateIndex, CandidateIndex][] = [];
    for (const cellIndex of cells) {
        const mask = board.cells[cellIndex];
        if (board.isGivenMask(mask)) {
            continue;
        }

        for (const value of valuesList(mask)) {
            const cand0 = board.candidateIndex(cellIndex, value);
            if (cellsLookup.has(cellIndex)) {
                const cand1 = targetCandidateFn(board, cand0);
                if (cand0 !== cand1 && cand1 !== -1) {
                    const [cell1, val1] = board.candidateToIndexAndValue(cand1);
                    for (let otherVal1 = 1; otherVal1 <= board.size; ++otherVal1) {
                        if (otherVal1 !== val1) {
                            const otherCand1 = board.candidateIndex(cell1, otherVal1);
                            weakLinks.push([cand0, otherCand1]);
                        }
                    }
                }
            }
        }
    }
    return weakLinks;
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('rowindexer', (board: Board, params: FPuzzlesCells) => {
        const cells = params.cells.map(cell => cellIndexFromName(cell, board.size));
        const targetCellFn = (board: Board, candidate: CandidateIndex) => {
            const [cell, val] = board.candidateToIndexAndValue(candidate);
            const { row, col } = board.cellCoords(cell);
            const targetRow = val - 1;
            const targetCol = col;
            const targetVal = row + 1;
            const targetCell = board.cellIndex(targetRow, targetCol);
            return board.candidateIndex(targetCell, targetVal);
        };
        const weakLinks = generateIndexerWeakLinks(board, cells, targetCellFn);
        return new WeakLinksConstraint(board, { weakLinks }, 'RowIndexer', 'RowIndexer');
    });

    constraintBuilder.registerConstraint('columnindexer', (board: Board, params: FPuzzlesCells) => {
        const cells = params.cells.map(cell => cellIndexFromName(cell, board.size));
        const targetCellFn = (board: Board, candidate: CandidateIndex) => {
            const [cell, val] = board.candidateToIndexAndValue(candidate);
            const { row, col } = board.cellCoords(cell);
            const targetRow = row;
            const targetCol = val - 1;
            const targetVal = col + 1;
            const targetCell = board.cellIndex(targetRow, targetCol);
            return board.candidateIndex(targetCell, targetVal);
        };
        const weakLinks = generateIndexerWeakLinks(board, cells, targetCellFn);
        return new WeakLinksConstraint(board, { weakLinks }, 'ColIndexer', 'ColIndexer');
    });

    constraintBuilder.registerConstraint('boxindexer', (board: Board, params: FPuzzlesCells) => {
        const regionMap: Map<CellIndex, Region> = new Map();
        const regionIndex: Map<CellIndex, number> = new Map();
        for (let cellIndex = 0; cellIndex < board.cells.length; ++cellIndex) {
            const region = board.getRegionsForCell(cellIndex, 'region')[0];
            regionMap.set(cellIndex, region);
            regionIndex.set(cellIndex, region.cells.indexOf(cellIndex));
        }

        const cells = params.cells.map(cell => cellIndexFromName(cell, board.size));
        const targetCellFn = (board: Board, candidate: CandidateIndex) => {
            const [cell, val] = board.candidateToIndexAndValue(candidate);
            const region = regionMap.get(cell);
            if (!region) {
                return -1;
            }

            const targetCell = region.cells[val - 1];
            return board.candidateIndex(targetCell, regionIndex.get(cell) + 1);
        };
        const weakLinks = generateIndexerWeakLinks(board, cells, targetCellFn);
        return new WeakLinksConstraint(board, { weakLinks }, 'BoxIndexer', 'BoxIndexer');
    });
}
