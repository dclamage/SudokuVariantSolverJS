import { Board } from '../Board';
import { ConstraintResult } from '../Constraint/Constraint';
import { LogicResult } from '../Enums/LogicResult';
import { combinations, ctz, popcount, valueBit } from '../SolveUtility';
import { LogicalStep } from './LogicalStep';

export class Skyscraper extends LogicalStep {
    constructor() {
        super('Skyscraper');
    }

    step(board: Board, desc: string[] | null = null): LogicResult {
        for (let value = 1; value <= board.size; value++) {
            const valueMask = valueBit(value);

            for (let swapRowCol = 0; swapRowCol < 2; swapRowCol++) {
                const rowMasks: Array<{ row: number; rowMask: number }> = [];
                for (let row = 0; row < board.size; row++) {
                    let rowMask = 0;
                    for (let col = 0; col < board.size; col++) {
                        const cellIndex = swapRowCol === 0 ? board.cellIndex(row, col) : board.cellIndex(col, row);
                        if (board.cells[cellIndex] & valueMask) {
                            rowMask |= 1 << col;
                        }
                    }
                    if (popcount(rowMask) === 2) {
                        rowMasks.push({ row, rowMask });
                    }
                }
                if (rowMasks.length >= 2) {
                    for (const rows of combinations(rowMasks, 2)) {
                        const rowMask0 = rows[0].rowMask;
                        const rowMask1 = rows[1].rowMask;
                        if (popcount(rowMask0 & rowMask1) === 1) {
                            const col0 = ctz(rowMask0 & ~rowMask1);
                            const col1 = ctz(rowMask1 & ~rowMask0);
                            const candidate0 =
                                swapRowCol === 0
                                    ? board.candidateIndexRC(rows[0].row, col0, value)
                                    : board.candidateIndexRC(col0, rows[0].row, value);
                            const candidate1 =
                                swapRowCol === 0
                                    ? board.candidateIndexRC(rows[1].row, col1, value)
                                    : board.candidateIndexRC(col1, rows[1].row, value);
                            const elims = board.calcElimsForCandidateIndices([candidate0, candidate1]);
                            const result = board.applyElims(elims);
                            if (result !== ConstraintResult.UNCHANGED) {
                                if (desc) {
                                    const sharedCol = ctz(rowMask0 & rowMask1);
                                    const sharedCandidate0 =
                                        swapRowCol === 0
                                            ? board.candidateIndexRC(rows[0].row, sharedCol, value)
                                            : board.candidateIndexRC(sharedCol, rows[0].row, value);
                                    const sharedCandidate1 =
                                        swapRowCol === 0
                                            ? board.candidateIndexRC(rows[1].row, sharedCol, value)
                                            : board.candidateIndexRC(sharedCol, rows[1].row, value);
                                    desc.push(
                                        `Skyscraper ${board.describeCandidates([
                                            sharedCandidate0,
                                            sharedCandidate1,
                                            candidate0,
                                            candidate1,
                                        ])} => ${board.describeElims(elims)}`
                                    );
                                }
                                return result as number as LogicResult;
                            }
                        }
                    }
                }
            }
        }

        return LogicResult.UNCHANGED;
    }
}
