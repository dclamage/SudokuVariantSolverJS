export interface TypedArrayEntry<T extends Uint8Array | Uint16Array | Uint32Array | BigUint64Array> {
    array: T;
    array64: BigUint64Array;
    byteLength: number;
}

export class TypedArrayPool<T extends Uint8Array | Uint16Array | Uint32Array | BigUint64Array> {
    private _length: number;
    private _elementShift: number;
    private _constructArray: (buffer: ArrayBuffer) => T;
    private _bufferPool: TypedArrayEntry<T>[] = [];

    constructor(length: number, elementSize: number) {
        this._length = length;
        switch (elementSize) {
            case 1:
                this._constructArray = (buffer: ArrayBuffer) => new Uint8Array(buffer, 0, this._length) as T;
                this._elementShift = 0;
                break;
            case 2:
                this._constructArray = (buffer: ArrayBuffer) => new Uint16Array(buffer, 0, this._length) as T;
                this._elementShift = 1;
                break;
            case 4:
                this._constructArray = (buffer: ArrayBuffer) => new Uint32Array(buffer, 0, this._length) as T;
                this._elementShift = 2;
                break;
            case 8:
                this._constructArray = (buffer: ArrayBuffer) => new BigUint64Array(buffer, 0, this._length) as T;
                this._elementShift = 3;
                break;
            default:
                throw new Error(`Invalid element size ${elementSize}`);
        }
    }

    get(): TypedArrayEntry<T> {
        // Get the byte size, rounded up to the nearest multiple of 8
        const byteLength = ((this._length << this._elementShift) + 7) & ~7;

        // Check for a pool of the appropriate size
        if (this._bufferPool.length > 0) {
            const buffer = this._bufferPool.pop()!;
            const zero = BigInt(0);
            buffer.array64.fill(zero);
            return buffer;
        }

        // Allocate an ArrayBuffer of the appropriate size
        const buffer = new ArrayBuffer(byteLength);

        // Create a 64-bit view of the buffer
        const array64 = new BigUint64Array(buffer);

        // Create a view of the appropriate type
        const array = this._constructArray(buffer);

        return {
            array,
            array64,
            byteLength,
        };
    }

    release(buffer: TypedArrayEntry<T>) {
        this._bufferPool.push(buffer);
    }
}
