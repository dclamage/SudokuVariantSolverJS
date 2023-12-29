import { combinations, maskToString, popcount, valueBit, valuesList } from '../SolveUtility';
import { LogicResult } from '../Enums/LogicResult';
import { LogicalStep } from './LogicalStep';

export class NakedTupleAndPointing extends LogicalStep {
    constructor(board) {
        super(board, 'Naked Tuple and Pointing');
    }

    step(board, desc) {
        const { size, cells } = board;
        for (let tupleSize = 2; tupleSize < size; tupleSize++) {
            for (const region of board.regions) {
                const regionCells = region.cells;
                if (regionCells.length <= tupleSize) {
                    continue;
                }

                // Make a list of cells which aren't already set
                const nonGivenCells = regionCells
                    .map(cellIndex => ({ cellIndex, cellMask: cells[cellIndex] }))
                    .filter(({ cellIndex }) => !board.isGiven(cellIndex));

                // If the non-given cells are the tuple size or smaller, then we just want pointing
                // to handle this case
                if (nonGivenCells.length <= tupleSize) {
                    continue;
                }

                // Make a list of cells which have a small enough mask
                const potentialTupleCells = nonGivenCells.filter(({ cellMask }) => popcount(cellMask) <= tupleSize);

                // If there aren't enough potential cells, then we can't make a tuple
                if (potentialTupleCells.length < tupleSize) {
                    continue;
                }

                // Look through all combinations of cells that could be a tuple
                for (let tupleCells of combinations(potentialTupleCells, tupleSize)) {
                    const tupleMask = tupleCells.reduce((accumulator, cell) => accumulator | cell.cellMask, 0);
                    if (popcount(tupleMask) !== tupleSize) {
                        continue;
                    }

                    // Find if there are other cells which have the same mask
                    const otherCells = nonGivenCells.filter(
                        ({ cellIndex, cellMask }) => (cellMask & ~tupleMask) === 0 && !tupleCells.some(tupleCell => tupleCell.cellIndex === cellIndex)
                    );
                    if (otherCells.length !== 0) {
                        // Board is invalid
                        if (desc) {
                            desc.push(`Too many cells in ${region.name} only have options: ${maskToString(tupleMask, size)}.`);
                        }
                        return LogicResult.INVALID;
                    }

                    // Go through each value individually and build up the eliminations
                    const elimsSet = new Set();
                    for (let value of valuesList(tupleMask)) {
                        // Generate the list of candidate indexes in the tuple
                        const valueMask = valueBit(value);
                        const tupleCandidates = [];
                        for (const { cellIndex, cellMask } of tupleCells) {
                            if ((cellMask & valueMask) !== 0) {
                                tupleCandidates.push(board.candidateIndex(cellIndex, value));
                            }
                        }

                        // Generate the eliminations
                        const curElims = board.calcElimsForCandidateIndices(tupleCandidates);
                        for (const elim of curElims) {
                            elimsSet.add(elim);
                        }
                    }

                    const elims = Array.from(elimsSet);
                    if (elims.length === 0) {
                        continue;
                    }

                    // Describe the eliminations
                    if (desc) {
                        desc.push(`Naked Tuple ${maskToString(tupleMask, size)} in ${region.name} => ${board.describeElims(elims)}.`);
                    }

                    // Perform the eliminations
                    return board.performElims(elims);
                }
            }

            // Look for "pointing" of the same tuple size
            for (const region of board.regions) {
                const regionCells = region.cells;

                // Can only point from regions that must contain all values
                if (regionCells.length !== size) {
                    continue;
                }

                for (let value = 1; value < size; value++) {
                    // Gather which cells have the value
                    const valueMask = valueBit(value);
                    const valueCells = regionCells.filter(cellIndex => (cells[cellIndex] & valueMask) !== 0);
                    if (valueCells.length !== tupleSize) {
                        continue;
                    }

                    // Create a list of candidate indexes for the value
                    const valueCandidates = valueCells.map(cellIndex => board.candidateIndex(cellIndex, value));

                    // Find any eliminations
                    const elims = board.calcElimsForCandidateIndices(valueCandidates);
                    if (elims.length === 0) {
                        continue;
                    }

                    // Describe the eliminations
                    if (desc) {
                        desc.push(`Pointing ${board.compactName(valueCells, valueMask)} in ${region.name} => ${board.describeElims(elims)}.`);
                    }

                    // Perform the eliminations
                    return board.performElims(elims);
                }
            }
        }

        return LogicResult.UNCHANGED;
    }
}
