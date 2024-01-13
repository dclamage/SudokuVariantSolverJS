import { CandidateIndex, combinations, popcount, valueBit, valuesList } from '../SolveUtility';
import { LogicResult } from '../Enums/LogicResult';
import { Board } from '../Board';
import { LogicalStep } from './LogicalStep';

export class Fish extends LogicalStep {
    private _enabledFish: number[];

    constructor(enabledFish: number[]) {
        super('Fish');
        this._enabledFish = enabledFish;
    }

    step(board: Board, desc: string[]) {
        const { size, cells } = board;

        // Construct a transformed lookup of which values are in which rows/cols
        const rowcolIndexByValue = Array.from({ length: size }, () => board.cellsPool.get());
        try {
            rowcolIndexByValue[0].array.fill(0);
            rowcolIndexByValue[1].array.fill(0);

            for (let cellIndex = 0; cellIndex < size * size; cellIndex++) {
                const { row, col } = board.cellCoords(cellIndex);
                const cellMask = cells[cellIndex] & board.allValues;
                for (const value of valuesList(cellMask)) {
                    const valueIndex = value - 1;
                    rowcolIndexByValue[0].array[valueIndex * size + col] |= valueBit(row + 1);
                    rowcolIndexByValue[1].array[valueIndex * size + row] |= valueBit(col + 1);
                }
            }

            // Look for standard fishes
            const unsetRowOrCols = [];
            for (const tupleSize of this._enabledFish) {
                if (tupleSize < 2 || tupleSize > size / 2) {
                    continue;
                }

                for (let rowOrCol = 0; rowOrCol < 2; rowOrCol++) {
                    const indexByValue = rowcolIndexByValue[rowOrCol].array;
                    for (let valueIndex = 0; valueIndex < size; valueIndex++) {
                        const value = valueIndex + 1;

                        // Make a list of pairs for the row/col which aren't already filled
                        unsetRowOrCols.length = 0;
                        for (let col = 0; col < size; col++) {
                            const cellMask = indexByValue[valueIndex * size + col];
                            const valueCount = popcount(cellMask);
                            if (valueCount > 1 && valueCount <= tupleSize) {
                                unsetRowOrCols.push(col);
                            }
                        }

                        // If there aren't enough potential cells, then we can't make a tuple of this size
                        if (unsetRowOrCols.length < tupleSize) {
                            continue;
                        }

                        // Look through all combinations of cells that could be a tuple
                        for (const tupleCells of combinations(unsetRowOrCols, tupleSize)) {
                            const tupleMask = tupleCells.reduce((accumulator, col) => accumulator | indexByValue[valueIndex * size + col], 0);
                            if (popcount(tupleMask) !== tupleSize) {
                                continue;
                            }

                            // Find if there are other cells which have the same mask
                            const otherCells = unsetRowOrCols.filter(
                                col => (indexByValue[valueIndex * size + col] & ~tupleMask) === 0 && !tupleCells.some(tupleCol => tupleCol === col)
                            );
                            if (otherCells.length !== 0) {
                                // Board is invalid
                                if (desc) {
                                    const columnOrRow = rowOrCol === 0 ? 'c' : 'r';
                                    const columnOrRowIndices = [...tupleCells, ...otherCells].map(col => col + 1).join('');
                                    desc.push(`${columnOrRow}${columnOrRowIndices} have too few locations for value ${value}.`);
                                }
                                return LogicResult.INVALID;
                            }

                            // Build the list of candidates in this fish
                            const fishCandidates: CandidateIndex[][] = Array.from({ length: tupleSize }, () => []);
                            const allRows = valuesList(tupleMask).map(row => row - 1);
                            for (const col of tupleCells) {
                                const rows = valuesList(indexByValue[valueIndex * size + col]).map(row => row - 1);
                                for (const row of rows) {
                                    const rowIndex = allRows.indexOf(row);
                                    fishCandidates[rowIndex].push(
                                        board.candidateIndexRC(rowOrCol === 0 ? row : col, rowOrCol === 0 ? col : row, value)
                                    );
                                }
                            }

                            // Find the eliminations
                            const elimsSet = new Set<CandidateIndex>();
                            for (const candidates of fishCandidates) {
                                for (const elim of board.calcElimsForCandidateIndices(candidates)) {
                                    elimsSet.add(elim);
                                }
                            }

                            // Perform the eliminations
                            if (elimsSet.size !== 0) {
                                const elims = Array.from(elimsSet);

                                if (desc) {
                                    const techniqueNames = [
                                        'X-Wing',
                                        'Swordfish',
                                        'Jellyfish',
                                        'Squirmbag',
                                        'Whale',
                                        'Leviathan',
                                        'Behemoth',
                                        'Colossus',
                                        'Titan',
                                        'Gargantuan',
                                    ];
                                    const techniqueIndex = tupleSize - 2;
                                    const techniqueName = techniqueIndex < techniqueNames.length ? techniqueNames[techniqueIndex] : 'Fish';
                                    const columnOrRowIndices = tupleCells.map(col => col + 1).join('');
                                    desc.push(
                                        `${techniqueName} (Fish size ${tupleSize}) in ${
                                            rowOrCol === 0 ? 'c' : 'r'
                                        }${columnOrRowIndices} [${board.describeCandidates(fishCandidates.flat())}] => ${board.describeElims(elims)}.`
                                    );
                                }
                                return board.performElims(elims);
                            }
                        }
                    }
                }
            }
        } finally {
            // Release the row/col index by value
            for (const entry of rowcolIndexByValue) {
                board.cellsPool.release(entry);
            }
        }

        return LogicResult.UNCHANGED;
    }
}
