import {
    appendInts,
    appendCellValueKey,
    cellsKey,
    combinations,
    hasValue,
    permutations,
    popcount,
    minValue,
    maxValue,
    valueBit,
    valuesList,
    CellIndex,
    CellMask,
    removeDuplicates,
    CandidateIndex,
} from './SolveUtility';
import { ConstraintResult } from './Constraint/Constraint';
import { Board } from './Board';

type MinMaxMemo = { min: number; max: number };
type PotentialCombination = { combination: number[]; sum: number };
type RestrictSumMemo = { newUnsetMasks: CellMask[] };
type RestrictSumResult = { constraintResult: ConstraintResult; masks: CellMask[] };
type PossibleSumsMemo = { sums: number[] };
type IsSumPossibleMemo = { isPossible: boolean };

export class SumGroup {
    boardSize: number;
    givenBit: CellMask;
    cells: CellIndex[];
    includeMask: CellMask;
    cellsString: string;

    constructor(board: Board, cells: CellIndex[], excludeValue: number = 0) {
        this.boardSize = board.size;
        this.givenBit = board.givenBit;
        this.cells = cells.toSorted((a, b) => a - b);
        if (excludeValue >= 1 && excludeValue <= board.size) {
            this.includeMask = board.allValues ^ valueBit(excludeValue);
            this.cellsString = cellsKey(`SumGroupE${excludeValue}`, this.cells, this.boardSize);
        } else {
            this.includeMask = board.allValues;
            this.cellsString = cellsKey('SumGroup', this.cells, this.boardSize);
        }
    }

    minMaxSum(board: Board): [number, number] {
        // Trivial case of max number of cells
        if (this.cells.length === board.size) {
            const sum = (board.size * (board.size + 1)) / 2;
            return [sum, sum];
        }

        // Check for a memo
        const memoKey = this.cellsString + '|MinMax' + appendCellValueKey(board, this.cells);
        const minMaxMemo: MinMaxMemo = board.getMemo(memoKey);
        if (minMaxMemo) {
            return [minMaxMemo.min, minMaxMemo.max];
        }

        const minMax = this.calcMinMaxSum(board);
        board.storeMemo(memoKey, { min: minMax[0], max: minMax[1] });
        return minMax;
    }

    calcMinMaxSum(board: Board): [number, number] {
        // Check if the excluded value must be included
        if (this.cells.some(cell => (board.cells[cell] & this.includeMask & ~board.givenBit) === 0)) {
            return [0, 0];
        }

        let unsetCells = this.cells;
        const givenSum = this.givenSum(board);
        if (givenSum > 0) {
            unsetCells = unsetCells.filter(cell => this.getGivenValue(board.cells[cell]) === 0);
        }

        if (unsetCells.length === 0) {
            return [givenSum, givenSum];
        }

        const unsetMask = this.unsetMask(board);
        const numUnsetValues = popcount(unsetMask);

        // Check for not enough values to fill all the cells
        if (numUnsetValues < unsetCells.length) {
            return [0, 0];
        }

        // Exactly the correct number of values in the unset cells so its sum is exact
        if (numUnsetValues === unsetCells.length) {
            let unsetSum = 0;
            let remainingMask = unsetMask;
            while (remainingMask !== 0) {
                const value = minValue(remainingMask);
                unsetSum += value;
                remainingMask ^= valueBit(value);
            }
            return [givenSum + unsetSum, givenSum + unsetSum];
        }

        const unsetMin = minValue(unsetMask);
        const unsetMax = maxValue(unsetMask);

        // Only one unset cell, so use its range
        if (unsetCells.length === 1) {
            return [givenSum + unsetMin, givenSum + unsetMax];
        }

        // Determine all possible placeable sums and return that range
        const possibleVals = valuesList(unsetMask);

        let min = 0;
        for (const combination of combinations(possibleVals, unsetCells.length)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (min === 0 || curSum < min) {
                if (board.canPlaceDigitsAnyOrder(unsetCells, combination)) {
                    min = curSum;
                }
            }
        }
        if (min === 0) {
            return [0, 0];
        }

        let max = min;
        const potentialCombinations: PotentialCombination[] = [];
        for (const combination of combinations(possibleVals, unsetCells.length)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (curSum > max) {
                potentialCombinations.push({ combination: combination, sum: curSum });
            }
        }
        potentialCombinations.sort((a, b) => b.sum - a.sum);
        for (const { combination, sum } of potentialCombinations) {
            if (board.canPlaceDigitsAnyOrder(unsetCells, combination)) {
                max = sum;
                break;
            }
        }

        return [min, max];
    }

    restrictSumToArray(board: Board, sum: number): RestrictSumResult {
        return this.restrictSumsToArray(board, [sum]);
    }

    restrictSumsToArray(board: Board, sums: number[]): RestrictSumResult {
        const sumsSet = new Set(sums);
        const sortedSums = Array.from(sumsSet).sort((a, b) => a - b);
        return this.restrictSumHelper(board, sortedSums);
    }

    restrictMinMaxSum(board: Board, minSum: number, maxSum: number): ConstraintResult {
        const sortedSums: number[] = [];
        for (let sum = minSum; sum <= maxSum; sum++) {
            sortedSums.push(sum);
        }
        return this.restrictSums(board, sortedSums);
    }

    restrictSum(board: Board, sum: number): ConstraintResult {
        return this.restrictSums(board, [sum]);
    }

    restrictSums(board: Board, sums: number[]): ConstraintResult {
        const sortedSums = removeDuplicates(sums.toSorted((a, b) => a - b));

        const result = this.restrictSumHelper(board, sortedSums);
        if (result.constraintResult !== ConstraintResult.UNCHANGED) {
            if (!this.applySumResult(board, result.masks)) {
                return ConstraintResult.INVALID;
            }
        }
        return result.constraintResult;
    }

    getRestrictSumsEliminations(
        board: Board,
        sums: number[]
    ):
        | { result: ConstraintResult.UNCHANGED }
        | { result: ConstraintResult.CHANGED; eliminations?: CandidateIndex[] }
        | { result: ConstraintResult.INVALID; explanation: string } {
        const sortedSums = removeDuplicates(sums.toSorted((a, b) => a - b));

        const result = this.restrictSumHelper(board, sortedSums);
        if (result.constraintResult === ConstraintResult.UNCHANGED) {
            return { result: ConstraintResult.UNCHANGED };
        }

        if (result.constraintResult === ConstraintResult.INVALID) {
            return {
                result: ConstraintResult.INVALID,
                explanation: `Cells ${board.compactName(this.cells)} could not be restricted to the sum${sums.length === 1 ? '' : 's'} ${sums.join(
                    ','
                )}.`,
            };
        }

        const eliminations = [];
        for (let i = 0; i < this.cells.length; ++i) {
            const cell = this.cells[i];
            const cellMask = board.cells[cell];
            const elimMask = cellMask & ~result.masks[i];
            if (elimMask === 0) {
                continue;
            }
            for (let value = 1; value <= this.boardSize; ++value) {
                if (hasValue(elimMask, value)) {
                    eliminations.push(board.candidateIndex(cell, value));
                }
            }
        }

        return { result: ConstraintResult.CHANGED, eliminations };
    }

    restrictSumHelper(board: Board, sums: number[]): RestrictSumResult {
        const resultMasks: CellMask[] = new Array(this.cells.length);
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const mask: CellMask = board.cells[cell];
            resultMasks[i] = mask & board.allValues;
        }

        // Check if the excluded value must be included
        if (this.cells.some(cell => (board.cells[cell] & this.includeMask & ~board.givenBit) === 0)) {
            return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
        }

        if (sums.length === 0) {
            return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
        }

        const maxSum = sums[sums.length - 1];

        let unsetCells = this.cells;
        const givenSum = this.givenSum(board);
        if (givenSum > maxSum) {
            return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
        }

        if (givenSum > 0) {
            unsetCells = unsetCells.filter(cell => this.getGivenValue(board.cells[cell]) === 0);
        }

        const numUnsetCells = unsetCells.length;
        if (numUnsetCells === 0) {
            const constraintResult = sums.includes(givenSum) ? ConstraintResult.UNCHANGED : ConstraintResult.INVALID;
            return { constraintResult: constraintResult, masks: resultMasks };
        }

        // With one unset cell remaining, its value just needs to conform to the desired sums
        if (numUnsetCells === 1) {
            const unsetCell = unsetCells[0];
            const curMask = board.cells[unsetCell] & this.includeMask;

            let newMask = 0;
            for (const sum of sums) {
                const value = sum - givenSum;
                if (value >= 1 && value <= this.boardSize) {
                    newMask |= valueBit(value);
                } else if (value > this.boardSize) {
                    break;
                }
            }
            newMask &= curMask;

            let constraintResult: number = ConstraintResult.UNCHANGED;
            if (curMask !== newMask) {
                for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
                    if (this.cells[cellIndex] === unsetCell) {
                        resultMasks[cellIndex] = newMask;
                    }
                }
                constraintResult = newMask !== 0 ? ConstraintResult.CHANGED : ConstraintResult.INVALID;
            }
            return { constraintResult: constraintResult, masks: resultMasks };
        }

        let newMasks: CellMask[] = [];

        // Check for a memo
        const memoKey = this.cellsString + '|RestrictSum|S' + appendInts(sums) + '|M' + appendCellValueKey(board, this.cells);
        const memo: RestrictSumMemo = board.getMemo(memoKey);
        if (memo) {
            newMasks = memo.newUnsetMasks;
        } else {
            const unsetMask = this.unsetMask(board);

            // Check for not enough values to fill all the cells
            if (popcount(unsetMask) < numUnsetCells) {
                return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
            }

            const possibleVals = valuesList(unsetMask);

            newMasks = new Array(numUnsetCells);
            for (const combination of combinations(possibleVals, numUnsetCells)) {
                const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
                if (sums.includes(curSum)) {
                    for (const perm of permutations(combination)) {
                        let needCheck = false;
                        for (let i = 0; i < numUnsetCells; i++) {
                            const valueMask = valueBit(perm[i]);
                            if ((newMasks[i] & valueMask) === 0) {
                                needCheck = true;
                                break;
                            }
                        }

                        if (needCheck && board.canPlaceDigits(unsetCells, perm)) {
                            for (let i = 0; i < numUnsetCells; i++) {
                                newMasks[i] |= valueBit(perm[i]);
                            }
                        }
                    }
                }
            }

            // Store the memo
            board.storeMemo(memoKey, { newUnsetMasks: newMasks });
        }

        let changed = false;
        let invalid = false;
        let unsetIndex = 0;
        for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
            const cell = this.cells[cellIndex];
            const curMask = board.cells[cell] & this.includeMask;
            if (this.getGivenValue(curMask) === 0) {
                const newMask = newMasks[unsetIndex++];
                if (resultMasks[cellIndex] !== newMask) {
                    resultMasks[cellIndex] = newMask;
                    changed = true;

                    if (newMask === 0) {
                        invalid = true;
                    }
                }
            }
        }
        const constraintResult = invalid ? ConstraintResult.INVALID : changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
        return { constraintResult: constraintResult, masks: resultMasks };
    }

    applySumResult(board: Board, resultMasks: CellMask[]): boolean {
        return board.newApplyCellMasks(this.cells, resultMasks) !== ConstraintResult.INVALID;
    }

    possibleSums(board: Board): number[] {
        let unsetCells = this.cells;
        const givenSum = this.givenSum(board);
        if (givenSum > 0) {
            unsetCells = unsetCells.filter(cell => this.getGivenValue(board.cells[cell]) === 0);
        }

        const numUnsetCells = unsetCells.length;
        if (numUnsetCells === 0) {
            return [givenSum];
        }

        // With one unset cell remaining, it just contributes its own sum
        if (numUnsetCells === 1) {
            const sums: number[] = [];
            const unsetCell = unsetCells[0];
            let curMask = board.cells[unsetCell] & this.includeMask;
            while (curMask !== 0) {
                const value = minValue(curMask);
                sums.push(givenSum + value);
                curMask ^= valueBit(value);
            }
            return sums;
        }

        // Check for a memo
        const memoKey = this.cellsString + '|PossibleSums' + appendCellValueKey(board, this.cells);
        const memo: PossibleSumsMemo = board.getMemo(memoKey);
        if (memo) {
            return memo.sums.slice();
        }

        const unsetMask = this.unsetMask(board);
        if (popcount(unsetMask) < numUnsetCells) {
            return [];
        }

        const possibleVals = valuesList(unsetMask);

        const sumsSet: Set<number> = new Set();
        for (const combination of combinations(possibleVals, numUnsetCells)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (!sumsSet.has(curSum)) {
                // Find if any permutation fits into the cells
                for (const perm of permutations(combination)) {
                    if (board.canPlaceDigits(unsetCells, perm)) {
                        sumsSet.add(curSum);
                        break;
                    }
                }
            }
        }

        const sortedSums = Array.from(sumsSet).sort((a, b) => a - b);

        // Store a copy of the sums in the memo
        board.storeMemo(memoKey, { sums: sortedSums });

        return sortedSums;
    }

    isSumPossible(board: Board, sum: number): boolean {
        let unsetCells = this.cells;
        const givenSum = this.givenSum(board);
        if (givenSum > sum) {
            return false;
        }

        if (givenSum > 0) {
            unsetCells = unsetCells.filter(cell => this.getGivenValue(board.cells[cell]) === 0);
        }

        const numUnsetCells = unsetCells.length;
        if (numUnsetCells === 0) {
            return givenSum === sum;
        }

        // With one unset cell remaining, it just contributes its own sum
        if (numUnsetCells === 1) {
            const unsetCell = unsetCells[0];
            const curMask = board.cells[unsetCell] & this.includeMask;
            const valueNeeded = sum - givenSum;
            return valueNeeded >= 1 && valueNeeded <= this.boardSize && hasValue(curMask, valueNeeded);
        }

        // Check for a memo
        const memoKey = this.cellsString + '|IsSumPossible|S' + sum + '|M' + appendCellValueKey(board, this.cells);
        const memo: IsSumPossibleMemo = board.getMemo(memoKey);
        if (memo) {
            return memo.isPossible;
        }

        const unsetMask = this.unsetMask(board);
        if (popcount(unsetMask) < numUnsetCells) {
            return false;
        }

        const possibleVals = valuesList(unsetMask);
        for (const combination of combinations(possibleVals, numUnsetCells)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (curSum === sum) {
                for (const perm of permutations(combination)) {
                    if (board.canPlaceDigits(unsetCells, perm)) {
                        board.storeMemo(memoKey, { isPossible: true });
                        return true;
                    }
                }
            }
        }

        board.storeMemo(memoKey, { isPossible: false });
        return false;
    }

    // Utility functions
    unsetMask(board: Board): CellMask {
        let combMask = 0;
        for (let i = 0; i < this.cells.length; i++) {
            const mask: CellMask = board.cells[this.cells[i]];
            if (this.getGivenValue(mask) === 0) {
                combMask |= mask;
            }
        }
        return combMask & this.includeMask;
    }

    givenSum(board: Board): number {
        let sum = 0;
        for (let i = 0; i < this.cells.length; i++) {
            sum += this.getGivenValue(board.cells[this.cells[i]]);
        }
        return sum;
    }

    getGivenValue(mask: CellMask): number {
        if ((mask & this.givenBit) !== 0 || popcount(mask) === 1) {
            return minValue(mask);
        }
        if (popcount(mask & this.includeMask) === 1) {
            return minValue(mask & this.includeMask);
        }
        return 0;
    }
}
