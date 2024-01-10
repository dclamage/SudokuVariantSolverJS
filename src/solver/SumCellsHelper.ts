import { Board } from './Board';
import { ConstraintResult } from './Constraint/ConstraintV2';
import { CandidateIndex, CellIndex, CellMask, cellsKey, minMaxInclusiveRange, minValue, removeDuplicates, valueBit } from './SolveUtility';
import { SumGroup } from './SumGroup';

type GroupMinMax = { group: SumGroup; groupMin: number; groupMax: number };

export class SumCellsHelper {
    groups: SumGroup[];
    cells: CellIndex[];
    cellsString: string;

    constructor(board: Board, cells: CellIndex[]) {
        this.groups = board.splitIntoGroups(cells).map((group: CellIndex[]) => new SumGroup(board, group));
        this.cells = cells.toSorted((a, b) => a - b);
        this.cellsString = cellsKey('SumCellsHelper', this.cells, board.size);
    }

    init(board: Board, possibleSums: number[]) {
        if (possibleSums.length === 0) {
            return ConstraintResult.INVALID;
        }

        const sums = possibleSums.toSorted((a, b) => a - b);

        let minSum = 0;
        let maxSum = 0;
        const groupMinMax: GroupMinMax[] = [];
        for (const group of this.groups) {
            const [curMin, curMax] = group.minMaxSum(board);
            if (curMin === 0 || curMax === 0) {
                return ConstraintResult.INVALID;
            }

            minSum += curMin;
            maxSum += curMax;

            groupMinMax.push({ group: group, groupMin: curMin, groupMax: curMax });
        }

        const possibleSumMin = sums[0];
        const possibleSumMax = sums[sums.length - 1];
        if (minSum > possibleSumMax || maxSum < possibleSumMin) {
            return ConstraintResult.INVALID;
        }

        // Each group can increase from its min by the minDof
        // and decrease from its max by the maxDof
        let changed = false;
        const minDof = possibleSumMax - minSum;
        const maxDof = maxSum - possibleSumMin;

        for (const { group, groupMin, groupMax } of groupMinMax) {
            if (groupMin === groupMax) {
                continue;
            }

            const newGroupMin = Math.max(groupMin, groupMax - maxDof);
            const newGroupMax = Math.min(groupMax, groupMin + minDof);
            if (newGroupMin > groupMin || newGroupMax < groupMax) {
                const constraintResult = group.restrictMinMaxSum(board, newGroupMin, newGroupMax);
                if (constraintResult === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }

                if (constraintResult === ConstraintResult.CHANGED) {
                    changed = true;
                }
            }
        }
        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    // TODO: Add "obvious" version of this function that restricts based on min/max only,
    //       and does not look at the candidates or weak links on the board.
    getRestrictSumsEliminations(
        board: Board,
        possibleSums: number[]
    ):
        | { result: ConstraintResult.UNCHANGED }
        | { result: ConstraintResult.CHANGED; eliminations?: CandidateIndex[] }
        | { result: ConstraintResult.INVALID; explanation: string } {
        if (possibleSums.length === 0) {
            return { result: ConstraintResult.INVALID, explanation: `No possible sums` };
        }
        // One SumGroup -- just call it directly
        if (this.groups.length === 1) {
            return this.groups[0].getRestrictSumsEliminations(board, possibleSums);
        }

        const sums = removeDuplicates(possibleSums.toSorted((a, b) => a - b));

        let completedSum = 0;
        let numIncompleteGroups = 0;
        let minSum = 0;
        let maxSum = 0;
        const groupMinMax: GroupMinMax[] = [];
        for (const group of this.groups) {
            const [curMin, curMax] = group.minMaxSum(board);
            if (curMin === 0 || curMax === 0) {
                return { result: ConstraintResult.INVALID, explanation: `${board.compactName(group.cells)} has no valid candidate combination.` };
            }

            minSum += curMin;
            maxSum += curMax;

            if (curMin !== curMax) {
                numIncompleteGroups++;
            } else {
                completedSum += curMin;
            }

            groupMinMax.push({ group: group, groupMin: curMin, groupMax: curMax });
        }

        const possibleSumMin = sums[0];
        const possibleSumMax = sums[sums.length - 1];
        if (minSum > possibleSumMax || maxSum < possibleSumMin) {
            return { result: ConstraintResult.INVALID, explanation: `Sum is no longer possible (Between ${minSum} and ${maxSum}).` };
        }

        if (numIncompleteGroups === 0) {
            // All groups are complete
            return { result: ConstraintResult.UNCHANGED };
        }

        if (numIncompleteGroups === 1) {
            // One group left means it must exactly sum to whatever sum is remaining
            const { group, groupMin, groupMax } = groupMinMax.find(g => g.groupMin !== g.groupMax);
            const numCells = group.cells.length;

            // If the logical step description is desired, then track what the cells were before applying the sum range.
            const oldMasks: CellMask[] = new Array(numCells).fill(0);
            for (let i = 0; i < numCells; i++) {
                const cell = group.cells[i];
                oldMasks[i] = board.cells[cell];
            }

            // Restrict the sum to desired values
            const validSums = sums.map(sum => sum - completedSum).filter(sum => sum >= groupMin && sum <= groupMax);
            return group.getRestrictSumsEliminations(board, validSums);
        }

        // Each group can increase from its min by the minDof
        // and decrease from its max by the maxDof
        const minDof = possibleSumMax - minSum;
        const maxDof = maxSum - possibleSumMin;

        const eliminations: CellMask[] = [];
        for (const { group, groupMin, groupMax } of groupMinMax) {
            if (groupMin === groupMax) {
                continue;
            }

            const newGroupMin = Math.max(groupMin, groupMax - maxDof);
            const newGroupMax = Math.min(groupMax, groupMin + minDof);
            if (newGroupMin > groupMin || newGroupMax < groupMax) {
                const numCells = group.cells.length;
                const oldMasks: CellMask[] = new Array(numCells).fill(0);
                for (let i = 0; i < numCells; i++) {
                    const cell = group.cells[i];
                    oldMasks[i] = board.cells[cell];
                }

                const result = group.getRestrictSumsEliminations(board, minMaxInclusiveRange(newGroupMin, newGroupMax));
                if (result.result === ConstraintResult.INVALID) {
                    return result;
                }

                if (result.result === ConstraintResult.CHANGED) {
                    for (const elim of result.eliminations) {
                        eliminations.push(elim);
                    }
                }
            }
        }

        if (eliminations.length > 0) {
            return { result: ConstraintResult.CHANGED, eliminations };
        }

        return { result: ConstraintResult.UNCHANGED };
    }

    logicStep(board: Board, possibleSums: number[], logicalStepDescription: string[]) {
        if (possibleSums.length === 0) {
            return ConstraintResult.INVALID;
        }

        // One SumGroup -- just call it directly
        if (this.groups.length === 1) {
            const result = this.groups[0].restrictSums(board, possibleSums);
            if (result === ConstraintResult.INVALID && logicalStepDescription) {
                logicalStepDescription.push(
                    `Cells ${board.compactName(this.cells)} cannot be restricted to the sum${
                        possibleSums.length === 1 ? '' : 's'
                    } ${possibleSums.join(',')}.`
                );
            }
            return result;
        }

        const sums = possibleSums.toSorted((a, b) => a - b);

        let completedSum = 0;
        let numIncompleteGroups = 0;
        let minSum = 0;
        let maxSum = 0;
        const groupMinMax: GroupMinMax[] = [];
        for (const group of this.groups) {
            const [curMin, curMax] = group.minMaxSum(board);
            if (curMin === 0 || curMax === 0) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`${board.compactName(group.cells)} has no valid candidate combination.`);
                }
                return ConstraintResult.INVALID;
            }

            minSum += curMin;
            maxSum += curMax;

            if (curMin !== curMax) {
                numIncompleteGroups++;
            } else {
                completedSum += curMin;
            }

            groupMinMax.push({ group: group, groupMin: curMin, groupMax: curMax });
        }

        const possibleSumMin = sums[0];
        const possibleSumMax = sums[sums.length - 1];
        if (minSum > possibleSumMax || maxSum < possibleSumMin) {
            if (logicalStepDescription) {
                logicalStepDescription.push(`Sum is no longer possible (Between ${minSum} and ${maxSum}).`);
            }
            return ConstraintResult.INVALID;
        }

        if (numIncompleteGroups === 0) {
            // All groups are complete
            return ConstraintResult.UNCHANGED;
        }

        if (numIncompleteGroups === 1) {
            // One group left means it must exactly sum to whatever sum is remaining
            const { group, groupMin, groupMax } = groupMinMax.find(g => g.groupMin !== g.groupMax);
            const numCells = group.cells.length;

            // If the logical step description is desired, then track what the cells were before applying the sum range.
            const oldMasks: CellMask[] = new Array(numCells).fill(0);
            for (let i = 0; i < numCells; i++) {
                const cell = group.cells[i];
                oldMasks[i] = board.cells[cell];
            }

            // Restrict the sum to desired values
            const validSums = sums.map(sum => sum - completedSum).filter(sum => sum >= groupMin && sum <= groupMax);
            const constraintResult = group.restrictSums(board, validSums);
            if (constraintResult === ConstraintResult.INVALID) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`${board.compactName(group.cells)} cannot sum to the desired value${sums.length !== 1 ? 's' : ''}.`);
                }
                return ConstraintResult.INVALID;
            }

            if (constraintResult === ConstraintResult.CHANGED) {
                const elims: CellMask[] = [];
                for (let i = 0; i < numCells; i++) {
                    const cell = group.cells[i];
                    let removedMask = oldMasks[i] & ~board.cells[cell];
                    while (removedMask !== 0) {
                        const value = minValue(removedMask);
                        removedMask ^= valueBit(value);
                        elims.push(board.candidateIndex(cell, value));
                    }
                }

                if (logicalStepDescription) {
                    logicalStepDescription.push(`${board.describeElims(elims)}.`);
                }
                return ConstraintResult.CHANGED;
            }

            return ConstraintResult.UNCHANGED;
        }

        // Each group can increase from its min by the minDof
        // and decrease from its max by the maxDof
        const minDof = possibleSumMax - minSum;
        const maxDof = maxSum - possibleSumMin;

        const elims: CellMask[] = [];
        for (const { group, groupMin, groupMax } of groupMinMax) {
            if (groupMin === groupMax) {
                continue;
            }

            const newGroupMin = Math.max(groupMin, groupMax - maxDof);
            const newGroupMax = Math.min(groupMax, groupMin + minDof);
            if (newGroupMin > groupMin || newGroupMax < groupMax) {
                const numCells = group.cells.length;
                const oldMasks: CellMask[] = new Array(numCells).fill(0);
                for (let i = 0; i < numCells; i++) {
                    const cell = group.cells[i];
                    oldMasks[i] = board.cells[cell];
                }

                const constraintResult = group.restrictMinMaxSum(board, newGroupMin, newGroupMax);
                if (constraintResult === ConstraintResult.INVALID) {
                    if (logicalStepDescription) {
                        logicalStepDescription.push(
                            `${board.compactName(group.cells)} cannot be restricted between ${newGroupMin} and ${newGroupMax}.`
                        );
                    }
                    return ConstraintResult.INVALID;
                }

                if (constraintResult === ConstraintResult.CHANGED) {
                    for (let i = 0; i < numCells; i++) {
                        const cell = group.cells[i];
                        let removedMask = oldMasks[i] & ~board.cells[cell];
                        while (removedMask !== 0) {
                            const value = minValue(removedMask);
                            removedMask ^= valueBit(value);
                            elims.push(board.candidateIndex(cell, value));
                        }
                    }
                }
            }
        }

        if (elims.length > 0) {
            if (logicalStepDescription) {
                logicalStepDescription.push(`${board.describeElims(elims)}.`);
            }
            return ConstraintResult.CHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }

    sumRange(board: Board): [number, number] {
        let minSum = 0;
        let maxSum = 0;
        for (const group of this.groups) {
            const [groupMin, groupMax] = group.minMaxSum(board);
            minSum += groupMin;
            maxSum += groupMax;
        }
        return [minSum, maxSum];
    }

    possibleSums(board: Board): number[] {
        // One SumGroup -- just call it directly
        if (this.groups.length === 1) {
            return this.groups[0].possibleSums(board);
        }

        let completedSum = 0;
        const incompleteGroupsSums: number[][] = [];
        for (const group of this.groups) {
            const possibleSums = group.possibleSums(board);
            if (possibleSums.length === 0) {
                return [];
            }

            if (possibleSums.length > 1) {
                incompleteGroupsSums.push(possibleSums);
            } else {
                completedSum += possibleSums[0];
            }
        }

        if (incompleteGroupsSums.length === 0) {
            return [completedSum];
        }

        // Limit exact results to 5 incomplete groups
        if (incompleteGroupsSums.length <= 5) {
            const sums: Set<number> = new Set();
            for (const sum of SumCellsHelper.enumerateSums(incompleteGroupsSums)) {
                sums.add(sum + completedSum);
            }
            return Array.from(sums).sort((a, b) => a - b);
        }

        // Quick and dirty approximation
        let min = completedSum;
        let max = completedSum;
        for (const group of this.groups) {
            const [groupMin, groupMax] = group.minMaxSum(board);
            min += groupMin;
            max += groupMax;
        }
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    // Note the '*' after 'function', which makes this a generator function
    static *enumerateSums(groups: number[][], groupIndex: number = 0): Generator<number> {
        if (groupIndex === groups.length) {
            yield 0;
        } else {
            const group = groups[groupIndex];
            for (let i = 0; i < group.length; i++) {
                const sum = group[i];
                const subSums = SumCellsHelper.enumerateSums(groups, groupIndex + 1);
                for (const subSum of subSums) {
                    yield sum + subSum;
                }
            }
        }
    }
}
