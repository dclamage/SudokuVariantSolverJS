import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName, hasValue, valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult, InitResult } from './Constraint';
import { FPuzzlesBoard } from './FPuzzlesInterfaces';

export type IsPairAllowedFn = (value1: number, value2: number) => boolean;
export type NegativePairsGeneratorFn = (board: Board) => Generator<[CellIndex, CellIndex]> | null;

export interface GeneralCellPairConstraintParams {
    cellPairs: [CellIndex, CellIndex][];
}

// TODO: Remove and replace existing uses with weak links
export class GeneralCellPairConstraint extends Constraint {
    cellPairs: [CellIndex, CellIndex][];
    cellPairKeys: number[];
    constraintGroup: string;
    isPairAllowed: IsPairAllowedFn;
    negativePairsGenerator: NegativePairsGeneratorFn | null;

    constructor(
        constraintName: string,
        specificName: string,
        constraintGroup: string,
        isPairAllowed: IsPairAllowedFn,
        negativePairsGenerator: NegativePairsGeneratorFn | null,
        board: Board,
        params: GeneralCellPairConstraintParams
    ) {
        super(board, constraintName, specificName);

        this.cellPairs = params.cellPairs;
        this.cellPairKeys = this.cellPairs.map(cellPair => cellPair[0] * board.size * board.size + cellPair[1]);
        this.constraintGroup = constraintGroup;
        this.isPairAllowed = isPairAllowed;
        this.negativePairsGenerator = negativePairsGenerator;
    }

    // eslint-disable-next-line no-unused-vars
    init(board: Board, isRepeat: boolean) {
        // Positive constraint weak links
        let changed = false;
        for (const cellPair of this.cellPairs) {
            const [cell1, cell2] = cellPair;
            const valueUsed1 = Array.from({ length: board.size + 1 }, () => false);
            const valueUsed2 = Array.from({ length: board.size + 1 }, () => false);
            for (let value1 = 1; value1 <= board.size; value1++) {
                if (!hasValue(board.cells[cell1], value1)) {
                    continue;
                }
                const cell1Candidate = board.candidateIndex(cell1, value1);

                for (let value2 = 1; value2 <= board.size; value2++) {
                    if (!hasValue(board.cells[cell2], value2)) {
                        continue;
                    }

                    // Check for a weak link between these candidates
                    const cell2Candidate = board.candidateIndex(cell2, value2);
                    if (board.isWeakLink(cell1Candidate, cell2Candidate)) {
                        continue;
                    }

                    if (!this.isPairAllowed(value1, value2)) {
                        board.addWeakLink(cell1Candidate, cell2Candidate);
                    } else {
                        valueUsed1[value1] = true;
                        valueUsed2[value2] = true;
                    }
                }
            }

            // Only keep candidates used in valid pairs
            const valueUsedMask1 = valueUsed1.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
            const valueUsedMask2 = valueUsed2.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
            const result1 = board.keepCellMask(cell1, valueUsedMask1);
            const result2 = board.keepCellMask(cell2, valueUsedMask2);

            if (result1 === ConstraintResult.INVALID || result2 === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }

            if (result1 === ConstraintResult.CHANGED || result2 === ConstraintResult.CHANGED) {
                changed = true;
            }
        }

        // Negative constraint weak links
        if (this.negativePairsGenerator) {
            // Gather all cell pairs for this constraint and any in the same group
            const totalCells = board.size * board.size;
            const allCellPairs = new Set(this.cellPairKeys);
            for (const constraint of board.constraints) {
                if (constraint !== this && constraint instanceof GeneralCellPairConstraint && constraint.constraintGroup === this.constraintGroup) {
                    for (const cellPair of constraint.cellPairKeys) {
                        allCellPairs.add(cellPair);
                    }
                }
            }

            // Go through all cell pairs that aren't present in a constraint and
            // add weak links for any pairs that are not allowed
            for (const negativePair of this.negativePairsGenerator(board)) {
                const cell1 = negativePair[0] < negativePair[1] ? negativePair[0] : negativePair[1];
                const cell2 = negativePair[0] < negativePair[1] ? negativePair[1] : negativePair[0];
                const negativePairKey = cell1 * totalCells + cell2;
                if (allCellPairs.has(negativePairKey)) {
                    continue;
                }

                const valueUsed1 = Array.from({ length: board.size + 1 }, () => false);
                const valueUsed2 = Array.from({ length: board.size + 1 }, () => false);
                for (let value1 = 1; value1 <= board.size; value1++) {
                    if (!hasValue(board.cells[cell1], value1)) {
                        continue;
                    }
                    const cell1Candidate = board.candidateIndex(cell1, value1);

                    for (let value2 = 1; value2 <= board.size; value2++) {
                        if (!hasValue(board.cells[cell2], value2)) {
                            continue;
                        }
                        const cell2Candidate = board.candidateIndex(cell2, value2);

                        if (board.isWeakLink(cell1Candidate, cell2Candidate)) {
                            continue;
                        }

                        if (this.isPairAllowed(value1, value2)) {
                            board.addWeakLink(cell1Candidate, cell2Candidate);
                        } else {
                            valueUsed1[value1] = true;
                            valueUsed2[value2] = true;
                        }
                    }
                }

                // Only keep candidates used in valid pairs
                const valueUsedMask1 = valueUsed1.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
                const valueUsedMask2 = valueUsed2.reduce((mask, used, value) => (used ? mask | valueBit(value) : mask), 0);
                const result1 = board.keepCellMask(cell1, valueUsedMask1);
                const result2 = board.keepCellMask(cell2, valueUsedMask2);

                if (result1 === ConstraintResult.INVALID || result2 === ConstraintResult.INVALID) {
                    return ConstraintResult.INVALID;
                }

                if (result1 === ConstraintResult.CHANGED || result2 === ConstraintResult.CHANGED) {
                    changed = true;
                }
            }
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    finalize(board: Board): InitResult {
        return { result: ConstraintResult.UNCHANGED, deleteConstraints: [this] };
    }
}

function* orthogonalPairsGenerator(board: Board): Generator<[CellIndex, CellIndex]> {
    const { size } = board;
    for (let r1 = 0; r1 < size; r1++) {
        for (let c1 = 0; c1 < size; c1++) {
            const cell1 = board.cellIndex(r1, c1);

            if (r1 - 1 >= 0) {
                const cell2 = board.cellIndex(r1 - 1, c1);
                yield [cell1, cell2];
            }
            if (r1 + 1 < size) {
                const cell2 = board.cellIndex(r1 + 1, c1);
                yield [cell1, cell2];
            }
            if (c1 - 1 >= 0) {
                const cell2 = board.cellIndex(r1, c1 - 1);
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function* diagonalPairsGenerator(board: Board): Generator<[CellIndex, CellIndex]> {
    const { size } = board;
    for (let r1 = 0; r1 < size; r1++) {
        for (let c1 = 0; c1 < size; c1++) {
            const cell1 = board.cellIndex(r1, c1);

            if (r1 - 1 >= 0 && c1 - 1 >= 0) {
                const cell2 = board.cellIndex(r1 - 1, c1 - 1);
                yield [cell1, cell2];
            }
            if (r1 + 1 < size && c1 + 1 < size) {
                const cell2 = board.cellIndex(r1 + 1, c1 + 1);
                yield [cell1, cell2];
            }
            if (r1 - 1 >= 0 && c1 + 1 < size) {
                const cell2 = board.cellIndex(r1 - 1, c1 + 1);
                yield [cell1, cell2];
            }
            if (r1 + 1 < size && c1 - 1 >= 0) {
                const cell2 = board.cellIndex(r1 + 1, c1 - 1);
                yield [cell1, cell2];
            }
        }
    }
}

interface CellsWithValue {
    cells: string[];
    value: number;
}

export function register(constraintBuilder: ConstraintBuilder) {
    // Register a difference constraint
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const instances: CellsWithValue[] = (boardData.difference || []).map(instance => {
            if (instance.value !== undefined) {
                return { cells: instance.cells, value: parseInt(instance.value) };
            }
            return { cells: instance.cells, value: 1 };
        });

        const instancesByValue = new Map<number, CellsWithValue[]>();
        for (const instance of instances) {
            if (!instancesByValue.get(instance.value)) {
                instancesByValue.set(instance.value, []);
            }
            instancesByValue.get(instance.value).push(instance);
        }

        const hasNonconsecutive = boardData.nonconsecutive === true;
        const hasDifferentNegative = Array.isArray(boardData.negative) && boardData.negative.includes('difference');

        if (hasNonconsecutive && !instancesByValue.has(1)) {
            instancesByValue.set(1, []);
        }

        const constraints = [];
        for (const value of instancesByValue.keys()) {
            const instances = instancesByValue.get(value);
            const numValue = Number(value);
            const isAllowed: IsPairAllowedFn = (value1, value2) => Math.abs(value1 - value2) === numValue;
            const negativePairsGenerator: NegativePairsGeneratorFn | null =
                (hasNonconsecutive && numValue === 1) || hasDifferentNegative ? orthogonalPairsGenerator : null;
            const cellPairs: [CellIndex, CellIndex][] = instances
                .map(instance => instance.cells)
                .map(cells => cells.map(cellName => cellIndexFromName(cellName, board.size)).sort((a, b) => a - b))
                .map(cells => [cells[0], cells[1]]);
            const params = {
                cellPairs,
            };
            const constraint = new GeneralCellPairConstraint(
                'Difference',
                `Difference of ${value}`,
                'kropki',
                isAllowed,
                negativePairsGenerator,
                board,
                params
            );
            constraints.push(constraint);
        }
        return constraints;
    });

    // Register a ratio constraint
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const instances: CellsWithValue[] = (boardData.ratio || []).map(instance => {
            if (instance.value !== undefined) {
                return { cells: instance.cells, value: parseInt(instance.value) };
            }
            return { cells: instance.cells, value: 2 };
        });

        const instancesByValue = new Map<number, CellsWithValue[]>();
        for (const instance of instances) {
            if (!instancesByValue.get(instance.value)) {
                instancesByValue.set(instance.value, []);
            }
            instancesByValue.get(instance.value).push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('ratio');
        if (hasNegative && !instancesByValue.has(2)) {
            instancesByValue.set(2, []);
        }

        const constraints = [];
        for (const value of instancesByValue.keys()) {
            const instances = instancesByValue.get(value);
            const numValue = Number(value);
            const isAllowed: IsPairAllowedFn = (value1, value2) => value1 === numValue * value2 || value2 === numValue * value1;
            const negativePairsGenerator: NegativePairsGeneratorFn = hasNegative ? orthogonalPairsGenerator : null;
            const cellPairs: [CellIndex, CellIndex][] = instances
                .map(instance => instance.cells)
                .map(cells => cells.map(cellName => cellIndexFromName(cellName, board.size)).sort((a, b) => a - b))
                .map(cells => [cells[0], cells[1]]);
            const params = {
                cellPairs,
            };
            const constraint = new GeneralCellPairConstraint(
                'Ratio',
                `Ratio of ${value}`,
                'kropki',
                isAllowed,
                negativePairsGenerator,
                board,
                params
            );
            constraints.push(constraint);
        }
        return constraints;
    });

    // Register an XV constraint
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const instances: CellsWithValue[] = (boardData.xv || [])
            .filter(instance => instance.value === 'x' || instance.value === 'X' || instance.value === 'v' || instance.value === 'V')
            .map(instance => {
                return { cells: instance.cells, value: instance.value === 'x' || instance.value === 'X' ? 10 : 5 };
            });

        const instancesByValue = new Map<number, CellsWithValue[]>();
        for (const instance of instances) {
            if (!instancesByValue.has(instance.value)) {
                instancesByValue.set(instance.value, []);
            }
            instancesByValue.get(instance.value).push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('xv');
        if (hasNegative) {
            if (!instancesByValue.has(5)) {
                instancesByValue.set(5, []);
            }
            if (!instancesByValue.has(10)) {
                instancesByValue.set(10, []);
            }
        }

        const constraints = [];
        for (const value of instancesByValue.keys()) {
            const instances = instancesByValue.get(value);
            const numValue = Number(value);
            const isAllowed: IsPairAllowedFn = (value1, value2) => value1 + value2 === numValue;
            const negativePairsGenerator: NegativePairsGeneratorFn = hasNegative ? orthogonalPairsGenerator : null;
            const cellPairs: [CellIndex, CellIndex][] = instances
                .map(instance => instance.cells)
                .map(cells => cells.map(cellName => cellIndexFromName(cellName, board.size)).sort((a, b) => a - b))
                .map(cells => [cells[0], cells[1]]);
            const params = {
                cellPairs,
            };
            const constraint = new GeneralCellPairConstraint('XV', `XV`, 'sum', isAllowed, negativePairsGenerator, board, params);
            constraints.push(constraint);
        }
        return constraints;
    });

    // Register a sum constraint
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const instances: CellsWithValue[] = (boardData.sum || []).map(instance => {
            return { cells: instance.cells, value: parseInt(instance.value) };
        });

        const instancesByValue = new Map<number, CellsWithValue[]>();
        for (const instance of instances) {
            if (!instancesByValue.has(instance.value)) {
                instancesByValue.set(instance.value, []);
            }
            instancesByValue.get(instance.value).push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('sum');

        const constraints = [];
        for (const value of instancesByValue.keys()) {
            const instances = instancesByValue.get(value);
            const numValue = Number(value);
            const isAllowed: IsPairAllowedFn = (value1, value2) => value1 + value2 === numValue;
            const negativePairsGenerator: NegativePairsGeneratorFn = hasNegative ? orthogonalPairsGenerator : null;
            const cellPairs: [CellIndex, CellIndex][] = instances
                .map(instance => instance.cells)
                .map(cells => cells.map(cellName => cellIndexFromName(cellName, board.size)).sort((a, b) => a - b))
                .map(cells => [cells[0], cells[1]]);
            const params = {
                cellPairs,
            };
            const constraint = new GeneralCellPairConstraint('Sum', `Sum of ${value}`, 'sum', isAllowed, negativePairsGenerator, board, params);
            constraints.push(constraint);
        }
        return constraints;
    });
}
