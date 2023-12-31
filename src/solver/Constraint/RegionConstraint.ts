import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName, cellName } from '../SolveUtility';
import { Constraint, ConstraintResult } from './Constraint';
import { FPuzzlesCells } from './FPuzzlesInterfaces';

export interface RegionConstraintParams {
    cells: CellIndex[];
}

export class RegionConstraint extends Constraint {
    cells: CellIndex[];

    constructor(board: Board, params: RegionConstraintParams, name: string, specificName: string) {
        super(board, name, specificName);

        this.cells = params.cells.slice();
    }

    init(board: Board, isRepeat: boolean): ConstraintResult {
        if (isRepeat) {
            return ConstraintResult.UNCHANGED;
        }

        if (board.addRegion(this.specificName, this.cells, this.constraintName)) {
            return ConstraintResult.CHANGED;
        }
        return ConstraintResult.UNCHANGED;
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('extraregion', (board: Board, params: FPuzzlesCells) => {
        const cells = params.cells.map((cellName: string) => cellIndexFromName(cellName, board.size));
        return new RegionConstraint(board, { cells: cells }, 'Extra Region', `Extra Region at ${cellName(cells[0], board.size)}`);
    });
}
