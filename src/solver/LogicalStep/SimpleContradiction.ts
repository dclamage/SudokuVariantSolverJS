import { minValue, valueBit } from '../SolveUtility';
import { LogicResult } from '../Enums/LogicResult';
import { Board } from '../Board';
import { LogicalStep } from './LogicalStep';
import { NakedSingle } from './NakedSingle';
import { HiddenSingle } from './HiddenSingle';
import { ConstraintLogic } from './ConstraintLogic';
import { CellForcing } from './CellForcing';
import { NakedTupleAndPointing } from './NakedTupleAndPointing';

export class SimpleContradiction extends LogicalStep {
    constructor() {
        super('Simple Contradiction');
    }

    private constradictionSteps: LogicalStep[] = [
        new NakedSingle(),
        new HiddenSingle(),
        new ConstraintLogic(),
        new CellForcing(),
        new NakedTupleAndPointing(),
    ];
    step(board: Board, desc: string[] | null = null) {
        const { size, cells, givenBit } = board;
        const numCells = size * size;
        for (let cellIndex = 0; cellIndex < numCells; cellIndex++) {
            let cellMask = cells[cellIndex];
            if ((cellMask & givenBit) !== 0) {
                continue;
            }

            while (cellMask !== 0) {
                const value = minValue(cellMask);
                const valueMask = valueBit(value);
                cellMask &= ~valueMask;

                const candidateIndex = board.candidateIndex(cellIndex, value);

                // Check if this value is a contradiction
                const newBoard = board.clone();
                if (!newBoard.setAsGiven(cellIndex, value)) {
                    if (desc) {
                        desc.push(`Simple Contradiction: ${board.describeCandidates([candidateIndex])} causes a trivial contradiction.`);
                    }
                    if (!board.clearValue(cellIndex, value)) {
                        return LogicResult.INVALID;
                    }
                    return LogicResult.CHANGED;
                }

                const subDesc: string[] | null = desc ? [] : null;
                while (true) {
                    let changed = false;
                    for (const step of this.constradictionSteps) {
                        const result = step.step(newBoard, subDesc);
                        if (result === LogicResult.INVALID) {
                            if (desc) {
                                desc.push(
                                    `Simple Contradiction: ${board.describeCandidates([
                                        candidateIndex,
                                    ])} causes the following contradiction:\n • ${subDesc!.join('\n • ')}`
                                );
                            }
                            if (!board.clearValue(cellIndex, value)) {
                                return LogicResult.INVALID;
                            }
                            return LogicResult.CHANGED;
                        }

                        if (result === LogicResult.CHANGED) {
                            changed = true;
                        }
                    }

                    if (!changed) {
                        break;
                    }
                }
            }
        }
        return LogicResult.UNCHANGED;
    }
}
