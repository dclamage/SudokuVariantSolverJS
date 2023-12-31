import { Board } from './Board';

export function popcount(x: number): number {
    x -= (x >> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    x += x >> 8;
    x += x >> 16;
    return x & 0x0000003f;
}

// Count the number of trailing zeros in an integer
export function ctz(x: number): number {
    return popcount((x & -x) - 1);
}

// Computes the bitmask with all values set
export function allValues(size: number): number {
    return (1 << size) - 1;
}

// Computes the bitmask with a specific value set
export function valueBit(value: number): number {
    return 1 << (value - 1);
}

// Get the value of the first set bit
export function minValue(bits: number): number {
    return ctz(bits) + 1;
}

// Get the value of the last set bit
export function maxValue(bits: number): number {
    return 32 - Math.clz32(bits);
}

// Get if a value is set
export function hasValue(bits: number, value: number): boolean {
    return (bits & valueBit(value)) !== 0;
}

// Get the value of a randomly set bit
export function randomValue(bits: number): number {
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

export function valuesMask(values: number[]): number {
    return values.reduce((mask, value) => mask | valueBit(value), 0);
}

export function valuesList(mask: number): number[] {
    const values: number[] = [];
    while (mask !== 0) {
        const value = minValue(mask);
        values.push(value);
        mask ^= valueBit(value);
    }
    return values;
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
    function* combine(start: number, prefix: T[], depth: number) {
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
export function cellsKey(prefix: string, cells: number[], size: number): string {
    return prefix + appendCellNames(cells, size);
}

export function appendInts(ints: number[]): string {
    return ints.map(i => '|' + i).join('');
}

export function appendCellNames(cells: number[], size: number): string {
    return cells.map(cell => '|' + cellName(cell, size)).join('');
}

export function maskToString(mask: number, size: number): string {
    return valuesList(mask).join(size >= 10 ? ',' : '');
}

export function appendCellValueKey(board: Board, cells: number[]): string {
    let builder = '';
    cells.forEach(cellIndex => {
        const mask = board.cells[cellIndex];
        builder += (board.isGivenMask(mask) ? '|s' : '|') + (mask & ~board.givenBit).toString(16);
    });
    return builder;
}

export function cellName(cellIndex: number, size: number): string {
    const row = Math.floor(cellIndex / size);
    const col = cellIndex % size;
    return `R${row + 1}C${col + 1}`;
}

export function cellIndexFromName(name: string, size: number): number {
    const regex = /r(\d+)c(\d+)/;
    const match = regex.exec(name.toLowerCase());
    if (!match) {
        throw new Error(`Invalid cell name: ${name}`);
    }

    const row = parseInt(match[1]) - 1;
    const col = parseInt(match[2]) - 1;
    return row * size + col;
}

export function sequenceEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
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
    return arr.slice(0, j + 1);
}
