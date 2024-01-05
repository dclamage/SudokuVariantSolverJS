import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName, cellName } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult } from './Constraint';
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

    init(board: Board, isRepeat: boolean): InitResult {
        return {
            result: board.addRegion(this.specificName, this.cells, this.constraintName) ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED,
            deleteConstraints: [this],
        };
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('extraregion', (board: Board, params: FPuzzlesCells) => {
        const cells = params.cells.map((cellName: string) => cellIndexFromName(cellName, board.size));
        return new RegionConstraint(board, { cells: cells }, 'Extra Region', `Extra Region at ${cellName(cells[0], board.size)}`);
    });
}
