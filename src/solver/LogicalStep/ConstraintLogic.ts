import { Board } from '../Board';
import { ConstraintResult } from '../Constraint/Constraint';
import { LogicResult } from '../Enums/LogicResult';
import { LogicalStep } from './LogicalStep';

export class ConstraintLogic extends LogicalStep {
    constructor(board: Board) {
        super(board, 'Constraint Logic');
    }

    step(board: Board, desc: string[]): LogicResult {
        const { constraints } = board;
        for (const constraint of constraints) {
            const proxyDesc: string[] = [];
            const result: ConstraintResult = constraint.logicStep(board, proxyDesc);
            desc.push(...proxyDesc.map(desc => `[${constraint.toSpecificString()}]: ${desc}`));
            if (result !== ConstraintResult.UNCHANGED) {
                return result === ConstraintResult.CHANGED ? LogicResult.CHANGED : LogicResult.INVALID;
            }
        }

        return LogicResult.UNCHANGED;
    }
}
