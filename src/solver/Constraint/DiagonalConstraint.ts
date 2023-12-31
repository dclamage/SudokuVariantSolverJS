import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex } from '../SolveUtility';
import { RegionConstraint } from './RegionConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    // Positive diagonal which goes from bottom left to top right
    constraintBuilder.registerBooleanConstraint('diagonal+', (board: Board) => {
        const { size } = board;
        const cells: CellIndex[] = [];
        // Add bottom left to top right diagonal
        for (let i = 0; i < size; ++i) {
            const row = size - 1 - i;
            const col = i;
            cells.push(board.cellIndex(row, col));
        }

        return new RegionConstraint(board, { cells: cells }, 'Diagonal+', 'Diagonal+');
    });

    // Negative diagonal which goes from top left to bottom right
    constraintBuilder.registerBooleanConstraint('diagonal-', (board: Board) => {
        const { size } = board;
        const cells: CellIndex[] = [];
        // Add top left to bottom right diagonal
        for (let i = 0; i < size; ++i) {
            const row = i;
            const col = i;
            cells.push(board.cellIndex(row, col));
        }

        return new RegionConstraint(board, { cells: cells }, 'Diagonal-', 'Diagonal-');
    });
}
