import { Board } from '../Board';
import { ConstraintResult } from '../Constraint/Constraint';
import { LogicResult } from '../Enums/LogicResult';
import { cellName, minValue } from '../SolveUtility';
import { LogicalStep } from './LogicalStep';

export class NakedSingle extends LogicalStep {
    constructor() {
        super('Naked Single');
    }

    step(board: Board, desc: string[] | null = null): LogicResult {
        const { size } = board;

        // Get the first naked single
        for (let cellIndex = 0; cellIndex < size * size; cellIndex++) {
            const mask = board.cells[cellIndex];
            if (mask & (mask - 1)) continue;
            const value = minValue(mask);
            if (board.applySingle(board.candidateIndex(cellIndex, value)) === ConstraintResult.INVALID) {
                if (desc) {
                    desc.push(`Naked Single: ${cellName(cellIndex, size)} cannot be set to ${value}.`);
                }
                return LogicResult.INVALID;
            }
            if (desc) {
                desc.push(`Naked Single: ${cellName(cellIndex, size)} = ${value}.`);
            }
            return LogicResult.CHANGED;
        }

        return LogicResult.UNCHANGED;
    }
}
