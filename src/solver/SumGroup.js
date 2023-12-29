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
} from './SolveUtility';
import { ConstraintResult } from './Constraint/Constraint';

export class SumGroup {
    constructor(board, cells, excludeValue = 0) {
        this.boardSize = board.size;
        this.givenBit = board.givenBit;
        this.cells = cells.toSorted((a, b) => a - b);
        if (excludeValue >= 1 && excludeValue <= board.size) {
            this.includeMask = board.allValues ^ board.valueBit(excludeValue);
            this.cellsString = cellsKey(`SumGroupE${excludeValue}`, this.cells, this.boardSize);
        } else {
            this.includeMask = board.allValues;
            this.cellsString = cellsKey('SumGroup', this.cells, this.boardSize);
        }
    }

    minMaxSum(board) {
        // Trivial case of max number of cells
        if (this.cells.length === board.size) {
            const sum = (board.size * (board.size + 1)) / 2;
            return [sum, sum];
        }

        // Check for a memo
        const memoKey = this.cellsString + '|MinMax' + appendCellValueKey(board, this.cells);
        const minMaxMemo = board.getMemo(memoKey);
        if (minMaxMemo) {
            return [minMaxMemo.min, minMaxMemo.max];
        }

        const minMax = this.calcMinMaxSum(board);
        board.storeMemo(memoKey, { min: minMax[0], max: minMax[1] });
        return minMax;
    }

    calcMinMaxSum(board) {
        // Check if the excluded value must be included
        if (this.cells.some(cell => (board.cells[cell] & this.includeMask & ~board.givenBit) === 0)) {
            return [0, 0];
        }

        let unsetCells = this.cells;
        let givenSum = this.givenSum(board);
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
        for (let combination of combinations(possibleVals, unsetCells.length)) {
            let curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
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
        let potentialCombinations = [];
        for (let combination of combinations(possibleVals, unsetCells.length)) {
            let curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (curSum > max) {
                potentialCombinations.push({ combination: combination, sum: curSum });
            }
        }
        potentialCombinations.sort((a, b) => b.sum - a.sum);
        for (let { combination, sum } of potentialCombinations) {
            if (board.canPlaceDigitsAnyOrder(unsetCells, combination)) {
                max = sum;
                break;
            }
        }

        return [min, max];
    }

    restrictSumToArray(board, sum) {
        return this.restrictSumsToArray(board, [sum]);
    }

    restrictSumsToArray(board, sums) {
        const sumsSet = new Set(sums);
        const sortedSums = Array.from(sumsSet).sort((a, b) => a - b);
        return this.restrictSumHelper(board, sortedSums);
    }

    restrictMinMaxSum(board, minSum, maxSum) {
        let sortedSums = [];
        for (let sum = minSum; sum <= maxSum; sum++) {
            sortedSums.push(sum);
        }
        return this.restrictSums(board, sortedSums);
    }

    restrictSum(board, sum) {
        return this.restrictSums(board, [sum]);
    }

    restrictSums(board, sums) {
        const sumsSet = new Set(sums);
        const sortedSums = Array.from(sumsSet).sort((a, b) => a - b);

        const result = this.restrictSumHelper(board, sortedSums);
        if (result.constraintResult !== ConstraintResult.UNCHANGED) {
            this.applySumResult(board, result.masks);
        }
        return result.constraintResult;
    }

    restrictSumHelper(board, sums) {
        const resultMasks = new Array(this.cells.length);
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const mask = board.cells[cell];
            resultMasks[i] = mask;
        }

        // Check if the excluded value must be included
        if (this.cells.some(cell => (board.cells[cell] & this.includeMask & ~board.givenBit) === 0)) {
            return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
        }

        if (sums.length === 0) {
            return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
        }

        let maxSum = sums[sums.length - 1];

        let unsetCells = this.cells;
        let givenSum = this.givenSum(board);
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
            for (let sum of sums) {
                const value = sum - givenSum;
                if (value >= 1 && value <= this.boardSize) {
                    newMask |= valueBit(value);
                } else if (value > this.boardSize) {
                    break;
                }
            }
            newMask &= curMask;

            let constraintResult = ConstraintResult.UNCHANGED;
            if (curMask != newMask) {
                for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
                    if (this.cells[cellIndex] === unsetCell) {
                        resultMasks[cellIndex] = newMask;
                    }
                }
                constraintResult = newMask !== 0 ? ConstraintResult.CHANGED : ConstraintResult.INVALID;
            }
            return { constraintResult: constraintResult, masks: resultMasks };
        }

        let newMasks = [];

        // Check for a memo
        const memoKey = this.cellsString + '|RestrictSum|S' + appendInts(sums) + '|M' + appendCellValueKey(board, this.cells);
        const memo = board.getMemo(memoKey);
        if (memo) {
            newMasks = memo.newUnsetMasks;
        } else {
            let unsetMask = this.unsetMask(board);

            // Check for not enough values to fill all the cells
            if (popcount(unsetMask) < numUnsetCells) {
                return { constraintResult: ConstraintResult.INVALID, masks: resultMasks };
            }

            const possibleVals = valuesList(unsetMask);

            newMasks = new Array(numUnsetCells);
            for (let combination of combinations(possibleVals, numUnsetCells)) {
                let curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
                if (sums.includes(curSum)) {
                    for (let perm of permutations(combination)) {
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

    applySumResult(board, resultMasks) {
        for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
            const cell = this.cells[cellIndex];
            board.setCellMask(cell, resultMasks[cellIndex]);
        }
    }

    possibleSums(board) {
        let unsetCells = this.cells;
        let givenSum = this.givenSum(board);
        if (givenSum > 0) {
            unsetCells = unsetCells.filter(cell => this.getGivenValue(board.cells[cell]) === 0);
        }

        const numUnsetCells = unsetCells.length;
        if (numUnsetCells === 0) {
            return [givenSum];
        }

        // With one unset cell remaining, it just contributes its own sum
        if (numUnsetCells === 1) {
            const sums = [];
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
        const memo = board.getMemo(memoKey);
        if (memo) {
            return [...memo.sums];
        }

        const unsetMask = this.unsetMask(board);
        if (popcount(unsetMask) < numUnsetCells) {
            return [];
        }

        const possibleVals = valuesList(unsetMask);

        let sumsSet = new Set();
        for (let combination of combinations(possibleVals, numUnsetCells)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (!sumsSet.has(curSum)) {
                // Find if any permutation fits into the cells
                for (let perm of permutations(combination)) {
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

    isSumPossible(board, sum) {
        let unsetCells = this.cells;
        let givenSum = this.givenSum(board);
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
        const memo = board.getMemo(memoKey);
        if (memo) {
            return memo.isPossible;
        }

        const unsetMask = this.unsetMask(board);
        if (popcount(unsetMask) < numUnsetCells) {
            return false;
        }

        const possibleVals = valuesList(unsetMask);
        for (let combination of combinations(possibleVals, numUnsetCells)) {
            const curSum = givenSum + combination.reduce((sum, value) => sum + value, 0);
            if (curSum === sum) {
                for (let perm of permutations(combination)) {
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
    unsetMask(board) {
        let combMask = 0;
        for (let i = 0; i < this.cells.length; i++) {
            const mask = board.cells[this.cells[i]];
            if (this.getGivenValue(mask) === 0) {
                combMask |= mask;
            }
        }
        return combMask & this.includeMask;
    }

    givenSum(board) {
        let sum = 0;
        for (let i = 0; i < this.cells.length; i++) {
            sum += this.getGivenValue(board.cells[this.cells[i]]);
        }
        return sum;
    }

    getGivenValue(mask) {
        if ((mask & this.givenBit) !== 0 || popcount(mask) === 1) {
            return minValue(mask);
        }
        if (popcount(mask & this.includeMask) === 1) {
            return minValue(mask & this.includeMask);
        }
        return 0;
    }
}
