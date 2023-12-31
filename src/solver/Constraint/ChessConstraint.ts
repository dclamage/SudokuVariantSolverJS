import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, CellIndex, CellValue } from '../SolveUtility';
import { WeakLinksConstraint } from './WeakLinksConstraint';

function generateChessCells(board: Board, srcCellIndex: CellIndex, offset: [number, number]): CellIndex[] {
    const cells: CellIndex[] = [];
    const { size } = board;
    const { row: srcRow, col: srcCol } = board.cellCoords(srcCellIndex);
    const numOffsets = offset[0] === offset[1] ? 4 : 8;
    for (let i = 0; i < numOffsets; ++i) {
        const rowDir = (i & 1) !== 0 ? 1 : -1;
        const colDir = (i & 2) !== 0 ? 1 : -1;
        const swap = (i & 4) !== 0 ? 1 : 0;
        const curRowDist = swap ? offset[0] : offset[1];
        const curColDist = swap ? offset[1] : offset[0];
        const dstRow = srcRow + curRowDist * rowDir;
        const dstCol = srcCol + curColDist * colDir;
        if (dstRow >= 0 && dstRow < size && dstCol >= 0 && dstCol < size) {
            const dstCellIndex = board.cellIndex(dstRow, dstCol);
            if (!cells.includes(dstCellIndex)) {
                cells.push(dstCellIndex);
            }
        }
    }
    return cells;
}

function createChessConstraint(board: Board, name: string, offset: [number, number]) {
    const { size } = board;
    const numCells = size * size;
    const weakLinks: [CandidateIndex, CandidateIndex][] = [];
    for (let srcCellIndex: CellIndex = 0; srcCellIndex < numCells; ++srcCellIndex) {
        const dstCells = generateChessCells(board, srcCellIndex, offset);
        for (const dstCellIndex of dstCells) {
            for (let value: CellValue = 1; value <= size; ++value) {
                const srcCandidateIndex = board.candidateIndex(srcCellIndex, value);
                const dstCandidateIndex = board.candidateIndex(dstCellIndex, value);
                weakLinks.push([srcCandidateIndex, dstCandidateIndex]);
            }
        }
    }
    return new WeakLinksConstraint(board, { weakLinks: weakLinks }, name, name);
}

export function register(constraintBuilder: ConstraintBuilder) {
    // Anti-Knight
    constraintBuilder.registerBooleanConstraint('antiknight', (board: Board) => {
        return createChessConstraint(board, 'Anti-Knight', [2, 1]);
    });

    // Anti-King
    constraintBuilder.registerBooleanConstraint('antiking', (board: Board) => {
        return createChessConstraint(board, 'Anti-King', [1, 1]);
    });
}
