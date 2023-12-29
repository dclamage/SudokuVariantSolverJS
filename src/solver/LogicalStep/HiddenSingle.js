import { LogicResult } from '../Enums/LogicResult.js';
import { cellName, maskToString, minValue } from '../SolveUtility.js';
import { LogicalStep } from './LogicalStep.js';

export class HiddenSingle extends LogicalStep {
    constructor(board) {
        super(board, 'Hidden Single');
    }

    step(board, desc) {
        const { size, givenBit, cells, allValues } = board;
        for (const region of board.regions) {
            const regionCells = region.cells;
            if (regionCells.length !== size) {
                continue;
            }

            let atLeastOnce = 0;
            let moreThanOnce = 0;
            let givenMask = 0;
            for (const cellIndex of regionCells) {
                const cellMask = cells[cellIndex];
                if (board.isGiven(cellIndex)) {
                    givenMask |= cellMask;
                } else {
                    moreThanOnce |= atLeastOnce & cellMask;
                    atLeastOnce |= cellMask;
                }
            }
            givenMask &= ~givenBit;

            if ((atLeastOnce | givenMask) !== allValues) {
                // Puzzle is invalid: Not all values are present in the region
                if (desc) {
                    const cannotPlaceMask = ~(atLeastOnce | givenMask) & allValues;
                    desc.push(`${region.name} has nowhere to place ${maskToString(cannotPlaceMask, size)}.`);
                }
                return LogicResult.INVALID;
            }

            let exactlyOnce = atLeastOnce & ~moreThanOnce;
            for (const cellIndex of regionCells) {
                const cellMask = cells[cellIndex];
                const newCellMask = cellMask & exactlyOnce;
                if (newCellMask !== 0 && newCellMask != cellMask) {
                    const cellValue = minValue(newCellMask);
                    if (!board.setAsGiven(cellIndex, cellValue)) {
                        desc.push(`Hidden Single in ${region.name}: ${cellName(cellIndex, size)} cannot be set to ${cellValue}.`);
                        return LogicResult.INVALID;
                    }

                    desc.push(`Hidden Single in ${region.name}: ${cellName(cellIndex, size)} = ${cellValue}.`);
                    return LogicResult.CHANGED;
                }
            }
        }

        return LogicResult.UNCHANGED;
    }
}
