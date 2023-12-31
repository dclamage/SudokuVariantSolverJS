import { Board } from '../Board';
import { LogicalStep, LogicalStepResult } from './LogicalStep';

export class ConstraintLogic extends LogicalStep {
    constructor(board: Board) {
        super(board, 'Constraint Logic');
    }

    // TODO: Update to enum
    step(board: Board, desc: string[]): 0 | 1 | 2 {
        const { constraints } = board;
        for (let constraint of constraints) {
            const proxyDesc: string[] = [];
            // TODO: Update to enum
            const result: 0 | 1 | 2 = constraint.logicStep(board, proxyDesc);
            desc.push(...proxyDesc.map(desc => `[${constraint.toSpecificString()}]: ${desc}`));
            if (result !== LogicalStepResult.UNCHANGED) {
                return result;
            }
        }
    }
}
