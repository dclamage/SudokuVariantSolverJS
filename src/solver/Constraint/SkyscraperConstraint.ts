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
import { Constraint, ConstraintResult, InitResult } from './Constraint';
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

    constructor(board: Board, params: SkyscraperConstraintParams) {
        const firstCellIndex = board.cellIndex(params.directionalCoords.row, params.directionalCoords.col);
        const directionOffset = board.cellIndex(params.directionalCoords.dRow, params.directionalCoords.dCol);
        const specificName = `Skyscraper ${params.clue} at ${cellName(firstCellIndex, board.size)}`;
        super(board, 'Skyscraper', specificName);

        this.clue = params.clue;
        this.cellStart = firstCellIndex;

        this.cells = [];
        for (let i = 0; i < board.size; ++i) {
            this.cells.push(this.cellStart + i * directionOffset);
        }
        this.cellsLookup = new Set(this.cells);

        this.memoPrefix = `Skyscraper|${this.clue}|${this.cellStart}`;
    }

    init(board: Board, isRepeat: boolean): InitResult {
        // A clue of 1 means the max value must be in the first cell
        if (this.clue === 1) {
            const keepMask = valueBit(board.size);
            return {
                result: board.keepCellMask(this.cells[0], keepMask) ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED,
                deleteConstraints: [this],
            };
        }

        let changed = false;

        // A clue of the max value means that all digits must be in strict order
        if (this.clue === board.size) {
            for (let v = 1; v <= board.size; ++v) {
                const keepMask = valueBit(v);
                const result = board.keepCellMask(this.cells[v - 1], keepMask);
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
                    const result = board.keepCellMask(cell, keepMask);
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

    logicStep(board: Board, logicalStepDescription: string[]): ConstraintResult {
        let changed = false;

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
            return ConstraintResult.UNCHANGED;
        }

        let keepMasks: CellMask[];
        const memo = board.getMemo(memoKey) as LogicStepMemo;
        if (memo) {
            keepMasks = memo.keepMasks;
            if (keepMasks === null) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Clue value ${this.clue} is impossible.`);
                }
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

                if (!board.canPlaceDigits(this.cells, curVals)) {
                    continue;
                }

                for (let cellIndex = 0; cellIndex < this.cells.length; ++cellIndex) {
                    keepMasks[cellIndex] |= valueBit(curVals[cellIndex]);
                }
                haveValidPerm = true;
            }

            if (!haveValidPerm) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Clue value ${this.clue} is impossible.`);
                }
                board.storeMemo(memoKey, { keepMasks: null });
                return ConstraintResult.INVALID;
            } else {
                board.storeMemo(memoKey, { keepMasks });
            }
        }

        let elims: CandidateIndex[] | null = null;
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

            const result = board.keepCellMask(cell, keepMasks[cellIndex]);
            if (result === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            if (result === ConstraintResult.CHANGED) {
                if (logicalStepDescription) {
                    if (elims === null) {
                        elims = [];
                    }
                    for (let v = 1; v <= board.size; ++v) {
                        if (hasValue(elimMask, v)) {
                            elims.push(board.candidateIndex(cell, v));
                        }
                    }
                }
                changed = true;
            }
        }

        if (logicalStepDescription && elims !== null) {
            logicalStepDescription.push(`Re-evaluated clue ${this.clue} => ${board.describeElims(elims)}.`);
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
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
