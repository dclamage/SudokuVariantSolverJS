import { LogicalStep, LogicalStepResult } from './LogicalStep.js';

export class ConstraintLogic extends LogicalStep {
    constructor(board) {
        super(board, 'Constraint Logic');
    }

	step(board, desc) {
		const { constraints } = board;
		for (let constraint of constraints) {
            const result = constraint.logicStep(board, desc);
            if (result !== LogicalStepResult.UNCHANGED) {
				return result;
			}
        }
	}
}
