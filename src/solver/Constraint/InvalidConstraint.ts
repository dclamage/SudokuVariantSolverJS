import { Board } from '../Board';
import { ConstraintV2, ConstraintResult } from './ConstraintV2';

export class InvalidConstraint extends ConstraintV2 {
    constructor(board: Board, constraintName: string, specificName: string) {
        super(constraintName, specificName);
    }

    init(board: Board) {
        return ConstraintResult.INVALID;
    }
}
