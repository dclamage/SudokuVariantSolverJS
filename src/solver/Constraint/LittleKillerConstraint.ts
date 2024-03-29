import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellIndexFromName } from '../SolveUtility';
import { Constraint } from './Constraint';
import { FPuzzlesLittleKillerSumEntry } from './FPuzzlesInterfaces';
import { FixedSumConstraint, FixedSumConstraintParams } from './FixedSumConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('littlekillersum', (board: Board, params: FPuzzlesLittleKillerSumEntry): Constraint | Constraint[] => {
        if (!params.value) {
            return [];
        }

        const cells = params.cells.map((cellName: string) => cellIndexFromName(cellName, board.size));
        const clueCell = params.cell;
        const lkParams: FixedSumConstraintParams = {
            cells,
            sum: parseInt(params.value, 10),
        };
        const constraintName = 'Little Killer';
        const specificName = `Little Killer ${params.value} at ${clueCell}`;
        return new FixedSumConstraint(constraintName, specificName, board, lkParams);
    });
}
