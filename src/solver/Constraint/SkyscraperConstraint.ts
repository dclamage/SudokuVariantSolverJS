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
    removeDuplicates,
    sequenceIntersectionUpdateDefaultCompare,
    sequenceUnionDefaultCompare,
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

type SkyscraperState = number;

export class SkyscraperConstraint extends Constraint {
    clue: number;
    cellStart: CellIndex;
    cells: CellIndex[];
    cellsLookup: Set<CellIndex>;
    memoPrefix: string;

    static prevStateMaskToStates: SkyscraperState[][][];
    static stateMaskToPrevStates: SkyscraperState[][][];
    static stateStateToMask: CellMask[][];

    constructor(board: Board, params: SkyscraperConstraintParams) {
        const firstCellIndex = board.cellIndex(params.directionalCoords.row, params.directionalCoords.col);
        const directionOffset = board.cellIndex(params.directionalCoords.dRow, params.directionalCoords.dCol);
        const specificName = `Skyscraper ${params.clue} at ${cellName(firstCellIndex, board.size)}`;
        super('Skyscraper', specificName);

        this.clue = params.clue;
        this.cellStart = firstCellIndex;

        this.cells = [];
        for (let i = 0; i < board.size; ++i) {
            this.cells.push(this.cellStart + i * directionOffset);
        }
        this.cellsLookup = new Set(this.cells);

        this.memoPrefix = `Skyscraper|${this.clue}|${this.cellStart}`;

        SkyscraperConstraint.computeTransitionTable(this.cells.length);
    }

    init(board: Board): InitResult {
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

    static computeTransitionTable(size: number) {
        if (SkyscraperConstraint.prevStateMaskToStates === undefined) {
            SkyscraperConstraint.prevStateMaskToStates = [];
            SkyscraperConstraint.stateMaskToPrevStates = [];
            SkyscraperConstraint.stateStateToMask = [];
        }
        if (SkyscraperConstraint.prevStateMaskToStates[size] !== undefined) {
            return;
        }

        const numMasks = 1 << size;
        const maxState = (size + 1) * (size + 1) + (size + 1);
        const numStates = maxState + 1;
        SkyscraperConstraint.prevStateMaskToStates[size] = Array.from({ length: numStates * numMasks }, () => []);
        SkyscraperConstraint.stateMaskToPrevStates[size] = Array.from({ length: numStates * numMasks }, () => []);
        SkyscraperConstraint.stateStateToMask[size] = Array.from({ length: numStates * numStates }, () => 0);

        for (let state = 0; state < numStates; state++) {
            const numVisible = state % (size + 1);
            const maxSeen = (state - numVisible) / (size + 1);
            for (let mask = 0; mask < numMasks; mask++) {
                for (const value of valuesList(mask)) {
                    if (value < maxSeen) {
                        SkyscraperConstraint.prevStateMaskToStates[size][state * numMasks + mask].push(state);
                        SkyscraperConstraint.stateMaskToPrevStates[size][state * numMasks + mask].push(state);
                        SkyscraperConstraint.stateStateToMask[size][state * numStates + state] |= valueBit(value);
                    } else if (value > maxSeen) {
                        const newState = value * (size + 1) + numVisible + 1;
                        SkyscraperConstraint.prevStateMaskToStates[size][state * numMasks + mask].push(newState);
                        SkyscraperConstraint.stateMaskToPrevStates[size][newState * numMasks + mask].push(state);
                        SkyscraperConstraint.stateStateToMask[size][state * numStates + newState] |= valueBit(value);
                    }
                }
            }
        }

        for (let i = 0; i < numStates * numMasks; i++) {
            removeDuplicates(SkyscraperConstraint.prevStateMaskToStates[size][i].sort((a, b) => a - b));
            removeDuplicates(SkyscraperConstraint.stateMaskToPrevStates[size][i].sort((a, b) => a - b));
        }
    }

    bruteForceStep(board: Board): ConstraintResult {
        const size = this.cells.length;
        const numMasks = 1 << size;
        const maxState = (size + 1) * (size + 1) + (size + 1);
        const numStates = maxState + 1;

        const reachableStates: SkyscraperState[][] = [[0]];
        for (let i = 0; i < size - 1; i++) {
            reachableStates.push([]);
        }

        // Forward pass
        for (let i = 0; i < size - 1; i++) {
            const cellIndex = this.cells[i];
            const mask = board.cells[cellIndex] & board.allValues;
            for (const prevState of reachableStates[i]) {
                reachableStates[i + 1] = sequenceUnionDefaultCompare(
                    reachableStates[i + 1],
                    SkyscraperConstraint.prevStateMaskToStates[size][prevState * numMasks + mask]
                );
            }
        }

        // Backward pass
        let curStates: SkyscraperState[] = [size * (size + 1) + this.clue];
        let possiblePrevStates: SkyscraperState[] = [];
        let changed = ConstraintResult.UNCHANGED;
        for (let i = size - 1; i >= 0; i--) {
            const cellIndex = this.cells[i];
            const mask = board.cells[cellIndex] & board.allValues;
            const prevStates: SkyscraperState[] = reachableStates[i];
            let newMask: CellMask = 0;

            possiblePrevStates.length = 0;

            for (const curState of curStates) {
                possiblePrevStates = sequenceUnionDefaultCompare(
                    possiblePrevStates,
                    SkyscraperConstraint.stateMaskToPrevStates[size][curState * numMasks + mask]
                );
            }
            sequenceIntersectionUpdateDefaultCompare(possiblePrevStates, prevStates);

            for (const prevState of possiblePrevStates) {
                for (const curState of curStates) {
                    newMask |= SkyscraperConstraint.stateStateToMask[size][prevState * numStates + curState];
                }
            }
            switch (board.keepCellMask(cellIndex, newMask)) {
                case ConstraintResult.INVALID:
                    return ConstraintResult.INVALID;
                case ConstraintResult.CHANGED:
                    changed = ConstraintResult.CHANGED;
            }

            [possiblePrevStates, curStates] = [curStates, possiblePrevStates];
        }

        return changed;
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
