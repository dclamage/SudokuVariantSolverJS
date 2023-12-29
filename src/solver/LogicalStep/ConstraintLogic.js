import { LogicalStep, LogicalStepResult } from './LogicalStep';

export class ConstraintLogic extends LogicalStep {
    constructor(board) {
        super(board, 'Constraint Logic');
    }

    step(board, desc) {
        const { constraints } = board;
        for (let constraint of constraints) {
            const proxyDesc = [];
            const result = constraint.logicStep(board, proxyDesc);
            desc.push(...proxyDesc.map(desc => `[${constraint.toSpecificString()}]: ${desc}`));
            if (result !== LogicalStepResult.UNCHANGED) {
                return result;
            }
        }
    }
}
