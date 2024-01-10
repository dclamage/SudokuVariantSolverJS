import { Board } from './Board';

export type CandidateIndex = number;
export type CellIndex = number;
export type CellMask = number;
export type CellValue = number;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type StateKey<T> = number;

export interface CellCoords {
    row: number;
    col: number;
}

export interface RawCellCoords {
    rawRow: number;
    rawCol: number;
}

export interface DirectionalCoords {
    // First cell at the edge of the board
    row: number;
    col: number;
    // Offset to add to move away from the edge clue
    dRow: number;
    dCol: number;
}

export function popcount(x: CellMask): number {
    x -= (x >> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    x += x >> 8;
    x += x >> 16;
    return x & 0x0000003f;
}

// Count the number of trailing zeros in an integer
export function ctz(x: CellMask): number {
    return popcount((x & -x) - 1);
}

// Computes the bitmask with all values set
export function allValues(size: CellMask): number {
    return (1 << size) - 1;
}

// Computes the bitmask with a specific value set
export function valueBit(value: CellMask): number {
    return 1 << (value - 1);
}

// Get the value of the first set bit
export function minValue(bits: CellMask): number {
    return ctz(bits) + 1;
}

// Get the value of the last set bit
export function maxValue(bits: CellMask): number {
    return 32 - Math.clz32(bits);
}

// Get if a value is set
export function hasValue(bits: CellMask, value: CellValue): boolean {
    return (bits & valueBit(value)) !== 0;
}

// Get the value of a randomly set bit
export function randomValue(bits: CellMask): CellValue {
    if (bits === 0) {
        return 0;
    }

    const numValues = popcount(bits);
    let valueIndex = Math.floor(Math.random() * numValues);
    let curBits = bits;
    while (curBits !== 0) {
        const value = minValue(curBits);
        if (valueIndex === 0) {
            return value;
        }
        curBits ^= valueBit(value);
        valueIndex--;
    }
    return 0;
}

export function valuesMask(values: CellValue[]): CellMask {
    return values.reduce((mask, value) => mask | valueBit(value), 0);
}

export function maskStrictlyLower(value: CellValue): CellMask {
    return (1 << (value - 1)) - 1;
}

export function maskStrictlyHigher(value: CellValue, size: number): CellMask {
    return ~maskStrictlyLower(value) & allValues(size);
}

export function maskLowerOrEqual(value: CellValue): CellMask {
    return (1 << value) - 1;
}

export function maskHigherOrEqual(value: CellValue, size: number): CellMask {
    return ~maskLowerOrEqual(value) & allValues(size);
}

export function valuesList(mask: CellMask): CellValue[] {
    const values: number[] = [];
    while (mask !== 0) {
        const value = minValue(mask);
        values.push(value);
        mask ^= valueBit(value);
    }
    return values;
}

export function taxiCabDistance(cellCoords1: CellCoords, cellCoords2: CellCoords): number {
    return Math.abs(cellCoords1.row - cellCoords2.row) + Math.abs(cellCoords1.col - cellCoords2.col);
}

export function isAdjacent(cellCoords1: CellCoords, cellCoords2: CellCoords): boolean {
    return taxiCabDistance(cellCoords1, cellCoords2) === 1;
}

export function binomialCoefficient(n: number, k: number): number {
    if (k < 0 || k > n) {
        return 0;
    }

    if (k === 0 || k === n) {
        return 1;
    }

    k = Math.min(k, n - k);

    let result = 1;
    for (let i = 0; i < k; i++) {
        result *= n - i;
        result /= i + 1;
    }

    return result;
}

const combinationIndicesCache: number[][][][] = [];

// Precompute indices for combinations
for (let n = 1; n <= 9; n++) {
    combinationIndicesCache[n] = [];
    for (let k = 0; k <= n; k++) {
        combinationIndicesCache[n][k] = [..._generateCombinationIndices(n, k)];
    }
}

function* _generateCombinationIndices(n: number, k: number, start: number = 0, prefix: number[] = []): Generator<number[]> {
    if (prefix.length === k) {
        yield prefix.slice();
    } else {
        for (let i = start; i <= n - k + prefix.length; i++) {
            prefix.push(i);
            yield* _generateCombinationIndices(n, k, i + 1, prefix);
            prefix.pop();
        }
    }
}

export function* combinationIndices(n: number, k: number): Generator<number[], void, undefined> {
    if (n <= 9) {
        yield* combinationIndicesCache[n][k];
    } else {
        yield* _generateCombinationIndices(n, k);
    }
}

export function* combinations<T>(array: T[], size: number): Generator<T[]> {
    if (array.length <= 9) {
        yield* combinationsCached(array, size);
    } else {
        yield* combinationsUncached(array, size);
    }
}

export function* combinationsUncached<T>(array: T[], size: number): Generator<T[]> {
    function* combine(start: number, prefix: T[], depth: number): Generator<T[]> {
        if (depth === size) {
            yield prefix.slice();
        } else {
            for (let i = start; i < array.length; i++) {
                prefix.push(array[i]);
                yield* combine(i + 1, prefix, depth + 1);
                prefix.pop();
            }
        }
    }

    yield* combine(0, [], 0);
}

export function* combinationsCached<T>(array: T[], size: number): Generator<T[]> {
    for (const indices of combinationIndicesCache[array.length][size]) {
        yield indices.map(index => array[index]);
    }
}

export function* permutations<T>(array: T[]): Generator<T[]> {
    const n = array.length;
    const c = new Array(n).fill(0);

    yield array.slice();

    let i = 0;
    while (i < n) {
        if (c[i] < i) {
            const swapIndex = i % 2 === 0 ? 0 : c[i];
            [array[swapIndex], array[i]] = [array[i], array[swapIndex]];
            yield array.slice();
            c[i]++;
            i = 0;
        } else {
            c[i] = 0;
            i++;
        }
    }
}

// Helper for memo keys
export function cellsKey(prefix: string, cells: CellIndex[], size: number): string {
    return prefix + appendCellNames(cells, size);
}

export function appendInts(ints: number[]): string {
    return ints.map(i => '|' + i).join('');
}

export function appendCellNames(cells: CellIndex[], size: number): string {
    return cells.map(cell => '|' + cellName(cell, size)).join('');
}

export function maskToString(mask: CellMask, size: number): string {
    return valuesList(mask).join(size >= 10 ? ',' : '');
}

export function appendCellValueKey(board: Board, cells: CellMask[]): string {
    let builder = '';
    cells.forEach(cellIndex => {
        const mask = board.cells[cellIndex];
        builder += (board.isGivenMask(mask) ? '|s' : '|') + (mask & ~board.givenBit).toString(16);
    });
    return builder;
}

export function cellName(cellIndex: CellIndex, size: number): string {
    const row = Math.floor(cellIndex / size);
    const col = cellIndex % size;
    return `R${row + 1}C${col + 1}`;
}

export function cellIndexFromName(name: string, size: number): CellIndex {
    const regex = /r(\d+)c(\d+)/;
    const match = regex.exec(name.toLowerCase());
    if (!match) {
        throw new Error(`Invalid cell name: ${name}`);
    }

    const row = parseInt(match[1]) - 1;
    const col = parseInt(match[2]) - 1;
    return row * size + col;
}

export function rawCellCoordsFromName(name: string): RawCellCoords {
    name = name.toLowerCase();
    const coordStrs = name.split('c');
    coordStrs[0] = coordStrs[0].slice(1);
    const [rawRow, rawCol] = coordStrs.map(c => parseInt(c, 10));
    return { rawRow, rawCol };
}

export function edgeClueDirectionalCoordsFromRawCellCoords(rawCoords: RawCellCoords, size: number): DirectionalCoords {
    const { rawRow, rawCol } = rawCoords;
    if (rawRow === 0) {
        // Top clue
        return {
            row: rawRow,
            col: rawCol - 1,
            dRow: 1,
            dCol: 0,
        };
    } else if (rawRow === size + 1) {
        // Bottom clue
        return {
            row: size - 1,
            col: rawCol - 1,
            dRow: -1,
            dCol: 0,
        };
    } else if (rawCol === 0) {
        // Left clue
        return {
            row: rawRow - 1,
            col: 0,
            dRow: 0,
            dCol: 1,
        };
    } else if (rawCol === size + 1) {
        // Right clue
        return {
            row: rawRow - 1,
            col: size - 1,
            dRow: 0,
            dCol: -1,
        };
    }
    throw new Error(`Provided RawCellCoords ${JSON.stringify(rawCoords)} does not correspond to an edge clue`);
}

export function parseEdgeClueCoords(name: string, size: number): DirectionalCoords {
    return edgeClueDirectionalCoordsFromRawCellCoords(rawCellCoordsFromName(name), size);
}

export function sequenceEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

// Assumes arr1 and arr2 are sorted
// Compare should return:
//  a < b: a negative number
//  a == b: 0
//  a > b: a positive number
export function sequenceIntersection<T>(arr1: T[], arr2: T[], compare: (a: T, b: T) => number): T[] {
    let i = 0;
    let j = 0;
    const out: T[] = [];

    while (i < arr1.length && j < arr2.length) {
        const result = compare(arr1[i], arr2[j]);
        if (result < 0) {
            ++i;
        } else if (result > 0) {
            ++j;
        } else {
            out.push(arr1[i]);
            ++i;
            ++j;
        }
    }

    return out;
}

// Assumes arr1 and arr2 are sorted according to the default compare
export function sequenceIntersectionDefaultCompare<T>(arr1: T[], arr2: T[]): T[] {
    let i = 0;
    let j = 0;
    const out: T[] = [];

    while (i < arr1.length && j < arr2.length) {
        const arr1val = arr1[i];
        const arr2val = arr2[j];
        if (arr1val < arr2val) {
            ++i;
        } else if (arr1val > arr2val) {
            ++j;
        } else {
            out.push(arr1val);
            ++i;
            ++j;
        }
    }

    return out;
}

// Assumes arr1 and arr2 are sorted according to the default compare
export function sequenceIntersectionUpdateDefaultCompare<T>(arr1Inout: T[], arr2: T[]) {
    let iWrite = 0;
    let j = 0;

    for (let iRead = 0; iRead < arr1Inout.length && j < arr2.length; ++iRead) {
        const arr1val = arr1Inout[iRead];
        while (arr2[j] < arr1val) {
            ++j;
        }
        if (arr2[j] === arr1val) {
            arr1Inout[iWrite] = arr1val;
            ++iWrite;
            ++j;
        }
    }
    arr1Inout.length = iWrite;
}

// Assumes arr1 and arr2 are sorted according to the default compare
export function* sequenceIntersectionDefaultCompareGenerator<T>(arr1: T[], arr2: T[]): Generator<T> {
    let i = 0;
    let j = 0;

    while (i < arr1.length && j < arr2.length) {
        const arr1val = arr1[i];
        const arr2val = arr2[j];
        if (arr1val < arr2val) {
            ++i;
        } else if (arr1val > arr2val) {
            ++j;
        } else {
            yield arr1val;
            ++i;
            ++j;
        }
    }
}

// Assumes arr1 and arr2 are sorted according to the default compare
export function sequenceHasNonemptyIntersectionDefaultCompare<T>(arr1: T[], arr2: T[]): boolean {
    let i = 0;
    let j = 0;

    while (i < arr1.length && j < arr2.length) {
        const arr1val = arr1[i];
        const arr2val = arr2[j];
        if (arr1val < arr2val) {
            ++i;
        } else if (arr1val > arr2val) {
            ++j;
        } else {
            return true;
        }
    }

    return false;
}

// Assumes arr1 and arr2 are sorted according to the default compare
// Moves elements from arr1 to filteredOut if they also occur in arr2
export function sequenceFilterOutUpdateDefaultCompare<T>(arr1Inout: T[], arr2: readonly T[], filteredOut: T[]) {
    let iWrite = 0;
    let iRead = 0;
    let j = 0;

    for (; iRead < arr1Inout.length && j < arr2.length; ++iRead) {
        const arr1val = arr1Inout[iRead];
        while (arr2[j] < arr1val) {
            ++j;
        }
        if (arr2[j] === arr1val) {
            filteredOut.push(arr1val);
            ++j;
        } else {
            arr1Inout[iWrite] = arr1val;
            ++iWrite;
        }
    }
    // Remaining elements are all not filtered out
    for (; iRead < arr1Inout.length; ++iRead) {
        arr1Inout[iWrite] = arr1Inout[iRead];
        ++iWrite;
    }
    arr1Inout.length = iWrite;
}

// Assumes arr is sorted
export function removeDuplicates<T>(arr: T[]): T[] {
    if (!arr.length) {
        return arr;
    }
    let j = 0;
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[j]) {
            j++;
            arr[j] = arr[i];
        }
    }
    arr.length = j + 1;
    return arr;
}

// Only generates pairs once, every pair will satisfy output[0] <= output[1].
export function* orthogonalPairsGenerator(board: Board): Generator<[CellIndex, CellIndex]> {
    const { size } = board;
    for (let r1 = 0; r1 < size; r1++) {
        for (let c1 = 0; c1 < size; c1++) {
            const cell1 = board.cellIndex(r1, c1);
            if (r1 + 1 < size) {
                const cell2 = board.cellIndex(r1 + 1, c1);
                yield [cell1, cell2];
            }
            if (c1 + 1 < size) {
                const cell2 = board.cellIndex(r1, c1 + 1);
                yield [cell1, cell2];
            }
        }
    }
}

// This will get used when diagonally adjacent constraints are added.
// Only generates pairs once, every pair will satisfy output[0] <= output[1].
export function* diagonalPairsGenerator(board: Board): Generator<[CellIndex, CellIndex]> {
    const { size } = board;
    for (let r1 = 0; r1 < size; r1++) {
        for (let c1 = 0; c1 < size; c1++) {
            const cell1 = board.cellIndex(r1, c1);

            if (r1 + 1 < size && c1 + 1 < size) {
                const cell2 = board.cellIndex(r1 + 1, c1 + 1);
                yield [cell1, cell2];
            }
            if (r1 + 1 < size && c1 - 1 >= 0) {
                const cell2 = board.cellIndex(r1 + 1, c1 - 1);
                yield [cell1, cell2];
            }
        }
    }
}
