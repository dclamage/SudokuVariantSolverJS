import { Board } from '../Board';
import { LogicResult } from '../Enums/LogicResult';
import { CandidateIndex, cellName, maskToString, popcount, valuesList } from '../SolveUtility';
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

                const cellCandidates: CandidateIndex[] = valuesList(cellMask).map(value => board.candidateIndex(cellIndex, value));
                const elims: CandidateIndex[] = board.calcElimsForCandidateIndices(cellCandidates);
                if (elims.length === 0) {
                    continue;
                }

                if (desc) {
                    desc.push(`Cell Forcing: ${maskToString(cellMask, size)}${cellName(cellIndex, size)} => ${board.describeElims(elims)}.`);
                }
                return board.applyElims(elims) as number as LogicResult;
            }
        }
    }
}
