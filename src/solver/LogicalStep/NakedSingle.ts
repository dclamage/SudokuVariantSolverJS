import { Board } from '../Board';
import { LogicResult } from '../Enums/LogicResult';
import { cellName, minValue } from '../SolveUtility';
import { LogicalStep } from './LogicalStep';

export class NakedSingle extends LogicalStep {
    constructor(board: Board) {
        super(board, 'Naked Single');
    }

    step(board: Board, desc: string[]): LogicResult {
        if (board.nakedSingles.length === 0) {
            return LogicResult.UNCHANGED;
        }

        const { size } = board;

        // Get the first naked single
        board.nakedSingles.sort((a, b) => a - b);
        const cellIndex = board.nakedSingles[0];
        board.nakedSingles.shift();

        // Get the value
        const cellMask = board.cells[cellIndex];

        // If this cell is already given then don't report it
        if (cellMask & board.givenBit) {
            return this.step(board, desc);
        }

        const cellValue = minValue(cellMask);

        // Set the cell to the value
        if (!board.setAsGiven(cellIndex, cellValue)) {
            if (desc) {
                desc.push(`Naked Single: ${cellName(cellIndex, size)} cannot be set to ${cellValue}.`);
            }
            return LogicResult.INVALID;
        }

        if (desc) {
            desc.push(`Naked Single: ${cellName(cellIndex, size)} = ${cellValue}.`);
        }
        return LogicResult.CHANGED;
    }
}
