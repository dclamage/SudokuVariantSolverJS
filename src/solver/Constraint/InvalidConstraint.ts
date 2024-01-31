import { Board } from '../Board';
import { Constraint, ConstraintResult } from './Constraint';

export class InvalidConstraint extends Constraint {
    constructor(board: Board, constraintName: string, specificName: string) {
        super(constraintName, specificName, []);
    }

    init(board: Board) {
        return ConstraintResult.INVALID;
    }
}
