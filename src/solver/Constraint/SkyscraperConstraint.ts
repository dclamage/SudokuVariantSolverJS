import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import {
    CandidateIndex,
    CellIndex,
    CellMask,
    CellValue,
    DirectionalCoords,
    cellName,
    hasValue,
    maskLowerOrEqual,
    minValue,
    parseEdgeClueCoords,
    permutations,
    popcount,
    valueBit,
    valuesList,
} from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult, LogicalDeduction } from './Constraint';
import { FPuzzlesCell } from './FPuzzlesInterfaces';

interface SkyscraperConstraintParams {
    clue: number;
    directionalCoords: DirectionalCoords;
}

interface LogicStepMemo {
    keepMasks: CellMask[] | null;
}

export class SkyscraperConstraint extends Constraint {
    clue: number;
    cellStart: CellIndex;
    cells: CellIndex[];
    cellsLookup: Set<CellIndex>;
    memoPrefix: string;
    bruteForceMemoPrefix: string;

    constructor(board: Board, params: SkyscraperConstraintParams) {
        const firstCellIndex = board.cellIndex(params.directionalCoords.row, params.directionalCoords.col);
        const directionOffset = board.cellIndex(params.directionalCoords.dRow, params.directionalCoords.dCol);
        const specificName = `Skyscraper ${params.clue} at ${cellName(firstCellIndex, board.size)}`;
        const cells = [];
        for (let i = 0; i < board.size; ++i) {
            cells.push(firstCellIndex + i * directionOffset);
        }
        super('Skyscraper', specificName, cells.slice());

        this.clue = params.clue;
        this.cellStart = firstCellIndex;

        this.cells = cells;
        this.cellsLookup = new Set(this.cells);

        this.memoPrefix = `Skyscraper|${this.clue}|${this.cellStart}`;
        this.bruteForceMemoPrefix = `SkyscraperBruteForce|${this.clue}`;
    }

    init(board: Board): InitResult {
        // A clue of 1 means the max value must be in the first cell
        if (this.clue === 1) {
            const keepMask = valueBit(board.size);
            return {
                result: board.applyCellMask(this.cells[0], keepMask),
                deleteConstraints: [this],
            };
        }

        let changed = false;

        // A clue of the max value means that all digits must be in strict order
        if (this.clue === board.size) {
            for (let v = 1; v <= board.size; ++v) {
                const keepMask = valueBit(v);
                const result = board.applyCellMask(this.cells[v - 1], keepMask);
                if (result === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }
                changed = changed || result === ConstraintResult.CHANGED;
            }
            return { result: changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED, deleteConstraints: [this] };
        } else {
            // Restrict high digits
            for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                const cell = this.cells[cellIndex];
                const maxValue = board.size - this.clue + 1 + cellIndex;
                if (maxValue < board.size) {
                    const keepMask = maskLowerOrEqual(maxValue);
                    const result = board.applyCellMask(cell, keepMask);
                    if (result === ConstraintResult.INVALID) {
                        return ConstraintResult.INVALID;
                    }
                    changed = changed || result === ConstraintResult.CHANGED;
                }
            }
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    enforce(board: Board, cellIndex: number, value: number): boolean {
        if (!this.cellsLookup.has(cellIndex)) {
            return true;
        }

        let numSeen = 0;
        let minValueSeen = 0;
        let haveUnset = false;
        for (const cellIndex of this.cells) {
            const cellMask = board.cells[cellIndex];
            if (!board.isGivenMask(cellMask) && popcount(cellMask) > 1) {
                haveUnset = true;
                break;
            } else {
                const curVal = minValue(cellMask);
                if (curVal > minValueSeen) {
                    numSeen++;
                    minValueSeen = curVal;
                }
            }
        }

        return (haveUnset && numSeen <= this.clue) || (!haveUnset && numSeen === this.clue);
    }

    logicalStep(board: Board): LogicalDeduction[] {
        let memoKey = this.memoPrefix;
        const unsetCellIndexes = [];
        const curVals = [];
        let unsetMask = 0;
        for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
            const cell = this.cells[cellIndex];
            const cellMask = board.cells[cell];
            if (!board.isGivenMask(cellMask)) {
                unsetCellIndexes.push(cellIndex);
                unsetMask |= cellMask;
                curVals.push(0);
                memoKey += `|${cellMask.toString(16)}`;
            } else {
                const curVal = minValue(cellMask);
                curVals.push(curVal);
                memoKey += `|s${curVal.toString(10)}`;
            }
        }
        if (unsetCellIndexes.length === 0) {
            return [];
        }

        let keepMasks: CellMask[];
        const memo = board.getMemo(memoKey) as LogicStepMemo;
        if (memo) {
            keepMasks = memo.keepMasks;
            if (keepMasks === null) {
                return [
                    {
                        explanation: `Clue value ${this.clue} is impossible.`,
                        invalid: true,
                    },
                ];
            }
        } else {
            const unsetVals: number[] = valuesList(unsetMask);

            let haveValidPerm = false;
            keepMasks = [];
            const numUnsetCells = unsetCellIndexes.length;
            for (const perm of permutations(unsetVals)) {
                for (let unsetCellIndex = 0; unsetCellIndex < numUnsetCells; ++unsetCellIndex) {
                    const cellIndex = unsetCellIndexes[unsetCellIndex];
                    curVals[cellIndex] = perm[unsetCellIndex];
                }
                if (SkyscraperConstraint.seenCount(curVals) !== this.clue) {
                    continue;
                }

                let needCheck = false;
                for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                    if ((keepMasks[cellIndex] & valueBit(curVals[cellIndex])) === 0) {
                        needCheck = true;
                        break;
                    }
                }
                if (!needCheck) {
                    continue;
                }

                if (!board.canPlaceDigits(this.cells, curVals)) {
                    continue;
                }

                for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                    keepMasks[cellIndex] |= valueBit(curVals[cellIndex]);
                }
                haveValidPerm = true;
            }

            if (!haveValidPerm) {
                board.storeMemo(memoKey, { keepMasks: null });
                return [
                    {
                        explanation: `Clue value ${this.clue} is impossible.`,
                        invalid: true,
                    },
                ];
            } else {
                board.storeMemo(memoKey, { keepMasks });
            }
        }

        const eliminations: CandidateIndex[] = [];
        for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
            const cell = this.cells[cellIndex];
            const cellMask = board.cells[cell];
            if (board.isGivenMask(cellMask)) {
                continue;
            }

            const elimMask = cellMask & ~keepMasks[cellIndex];
            if (elimMask === 0) {
                continue;
            }

            for (let v = 1; v <= board.size; ++v) {
                if (hasValue(elimMask, v)) {
                    eliminations.push(board.candidateIndex(cell, v));
                }
            }
        }

        if (eliminations.length > 0) {
            return [
                {
                    explanation: '',
                    eliminations,
                },
            ];
        }

        return [];
    }

    preprocessingStep(board: Board): ConstraintResult {
        return this.bruteForceStep(board);
    }

    bruteForceStep(board: Board): ConstraintResult {
        let memoKey = this.bruteForceMemoPrefix;
        const unsetCellIndexes: number[] = [];
        const curVals: CellMask[] = [];
        let unsetMask = board.allValues;
        for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
            const cell = this.cells[cellIndex];
            const cellMask = board.cells[cell];
            memoKey += '|';
            if (board.isGivenMask(cellMask)) {
                memoKey += cellMask.toString(16);
                unsetMask &= ~cellMask;
                curVals.push(minValue(cellMask));
            } else {
                unsetCellIndexes.push(cellIndex);
                curVals.push(0);
            }
        }
        if (unsetCellIndexes.length === 0) {
            return ConstraintResult.UNCHANGED;
        }

        let keepMasks: CellMask[];
        const memo = board.getMemo(memoKey) as LogicStepMemo;
        if (memo) {
            keepMasks = memo.keepMasks;
            if (keepMasks === null) {
                return ConstraintResult.INVALID;
            }
        } else {
            const unsetVals: number[] = valuesList(unsetMask);

            let haveValidPerm = false;
            keepMasks = [];
            const numUnsetCells = unsetCellIndexes.length;
            for (const perm of permutations(unsetVals)) {
                for (let unsetCellIndex = 0; unsetCellIndex < numUnsetCells; ++unsetCellIndex) {
                    const cellIndex = unsetCellIndexes[unsetCellIndex];
                    curVals[cellIndex] = perm[unsetCellIndex];
                }
                if (SkyscraperConstraint.seenCount(curVals) !== this.clue) {
                    continue;
                }

                let needCheck = false;
                for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                    if ((keepMasks[cellIndex] & valueBit(curVals[cellIndex])) === 0) {
                        needCheck = true;
                        break;
                    }
                }
                if (!needCheck) {
                    continue;
                }

                for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                    keepMasks[cellIndex] |= valueBit(curVals[cellIndex]);
                }
                haveValidPerm = true;
            }

            if (!haveValidPerm) {
                board.storeMemo(memoKey, { keepMasks: null });
                return ConstraintResult.INVALID;
            } else {
                board.storeMemo(memoKey, { keepMasks });
            }
        }

        return board.applyCellMasks(this.cells, keepMasks);
    }

    static seenCount(values: CellValue[]): number {
        let count = 0;
        let maxValueSeen = 0;
        for (const value of values) {
            if (value > maxValueSeen) {
                maxValueSeen = value;
                count++;
            }
        }
        return count;
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('skyscraper', (board: Board, params: FPuzzlesCell) => {
        const directionalCoords = parseEdgeClueCoords(params.cell, board.size);
        const clue = parseInt(params.value, 10);
        return new SkyscraperConstraint(board, { clue, directionalCoords });
    });
}
