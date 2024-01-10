import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellIndexFromName, cellName } from '../SolveUtility';
import { FPuzzlesKillerCageEntry } from './FPuzzlesInterfaces';
import { FixedSumConstraint } from './FixedSumConstraint';
import { RegionConstraint } from './RegionConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('killercage', (board: Board, params: FPuzzlesKillerCageEntry) => {
        const cells = params.cells.map(cellName => cellIndexFromName(cellName, board.size));
        const sum = parseInt(params.value, 10);
        const constraintName = 'Killer Cage';
        const specificName =
            sum > 0 ? `Killer Cage ${params.value} at ${cellName(cells[0], board.size)}` : `Killer Cage at ${cellName(cells[0], board.size)}`;
        if (sum > 0) {
            return [
                new RegionConstraint(board, { cells }, constraintName, specificName),
                new FixedSumConstraint(constraintName, specificName, board, { cells, sum }),
            ];
        } else {
            return [new RegionConstraint(board, { cells }, constraintName, specificName)];
        }
    });
}
