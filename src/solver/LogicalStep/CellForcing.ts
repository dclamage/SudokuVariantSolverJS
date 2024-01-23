import { Board } from '../Board';
import { LogicResult } from '../Enums/LogicResult';
import { cellName, maskToString, popcount, valueBit } from '../SolveUtility';
import { LogicalStep } from './LogicalStep';

export class CellForcing extends LogicalStep {
    constructor() {
        super('Cell Forcing');
    }

    step(board: Board, desc: string[] | null = null): LogicResult {
        const { size, allValues, cells } = board;
        const numCells = size * size;
        // TODO: There should be preprocessing to restrict cell masks based on weak links,
        // which means it should never be possible to do cell forcing when a cell has
        // the maximum number of candidates. So we should implement this preprocessing,
        // and this <= should be changed to <.
        for (let numCandidates = 2; numCandidates <= size; numCandidates++) {
            for (let cellIndex = 0; cellIndex < numCells; cellIndex++) {
                const cellMask = cells[cellIndex] & allValues;
                if (popcount(cellMask) !== numCandidates) {
                    continue;
                }

                const allElims = board.binaryImplications.getNegConsequences(board.binaryImplications.clauseIdAndMaskToVariable(cellIndex, cellMask));
                const elims = allElims.filter(elim => {
                    const [cellIndex, value] = board.candidateToIndexAndValue(elim);
                    return board.cells[cellIndex] & valueBit(value);
                });
                if (elims.length === 0) {
                    continue;
                }

                if (desc) {
                    desc.push(`Cell Forcing: ${maskToString(cellMask, size)}${cellName(cellIndex, size)} => ${board.describeElims(elims)}.`);
                }
                return board.performElims(elims);
            }
        }
    }
}
