import { cellIndexFromName, hasValue, valueBit } from '../SolveUtility';
import { Constraint, ConstraintResult } from './Constraint';

export class GeneralCellPairConstraint extends Constraint {
    constructor(constraintName, specificName, constraintGroup, isPairAllowed, negativePairsGenerator, board, params) {
        const cellPairs = params.cellsPairs.map(cells => cells.map(cellName => cellIndexFromName(cellName, board.size)).sort((a, b) => a - b));
        super(board, constraintName, specificName);

        this.cellPairs = cellPairs;
        this.cellPairKeys = cellPairs.map(cellPair => cellPair[0] * board.size * board.size + cellPair[1]);
        this.cellsSet = new Set(this.cells);
        this.constraintGroup = constraintGroup;
        this.isPairAllowed = isPairAllowed;
        this.negativePairsGenerator = negativePairsGenerator;
    }

    // eslint-disable-next-line no-unused-vars
    init(board, isRepeat) {
        // Positive constraint weak links
        let changed = false;
        for (let cellPair of this.cellPairs) {
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
            for (let negativePair of this.negativePairsGenerator(board)) {
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
}

function* orthogonalPairsGenerator(board) {
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

// eslint-disable-next-line no-unused-vars
function* diagonalPairsGenerator(board) {
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

export function register(constraintBuilder) {
    // Register a difference constraint
    constraintBuilder.registerAggregateConstraint((board, boardData) => {
        const instances = (boardData.difference || []).map(instance => {
            if (instance.value !== undefined) {
                return instance;
            }
            const newInstance = { ...instance };
            newInstance.value = 1;
            return newInstance;
        });

        const instancesByValue = {};
        for (const instance of instances) {
            if (!instancesByValue[instance.value]) {
                instancesByValue[instance.value] = [];
            }
            instancesByValue[instance.value].push(instance);
        }

        const hasNonconsecutive = boardData.nonconsecutive === true;
        const hasDifferentNegative = Array.isArray(boardData.negative) && boardData.negative.includes('difference');

        if (hasNonconsecutive) {
            instancesByValue['1'] = instancesByValue['1'] || [];
        }

        const constraints = [];
        for (const value of Object.keys(instancesByValue)) {
            const instances = instancesByValue[value];
            const numValue = Number(value);
            const isAllowed = (value1, value2) => Math.abs(value1 - value2) === numValue;
            const negativePairsGenerator = (hasNonconsecutive && numValue === 1) || hasDifferentNegative ? orthogonalPairsGenerator : null;
            const params = {
                cellsPairs: instances.map(instance => instance.cells),
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
    constraintBuilder.registerAggregateConstraint((board, boardData) => {
        const instances = (boardData.ratio || []).map(instance => {
            if (instance.value !== undefined) {
                return instance;
            }
            const newInstance = { ...instance };
            newInstance.value = 2;
            return newInstance;
        });

        const instancesByValue = {};
        for (const instance of instances) {
            if (!instancesByValue[instance.value]) {
                instancesByValue[instance.value] = [];
            }
            instancesByValue[instance.value].push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('ratio');
        if (hasNegative) {
            instancesByValue['2'] = instancesByValue['2'] || [];
        }

        const constraints = [];
        for (const value of Object.keys(instancesByValue)) {
            const instances = instancesByValue[value];
            const numValue = Number(value);
            const isAllowed = (value1, value2) => value1 === numValue * value2 || value2 === numValue * value1;
            const negativePairsGenerator = hasNegative ? orthogonalPairsGenerator : null;
            const params = {
                cellsPairs: instances.map(instance => instance.cells),
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
    constraintBuilder.registerAggregateConstraint((board, boardData) => {
        const instances = (boardData.xv || [])
            .filter(instance => instance.value === 'x' || instance.value === 'X' || instance.value === 'v' || instance.value === 'V')
            .map(instance => {
                const newInstance = { ...instance };
                newInstance.value = instance.value === 'x' || instance.value === 'X' ? 10 : 5;
                return newInstance;
            });

        const instancesByValue = {};
        for (const instance of instances) {
            if (!instancesByValue[instance.value]) {
                instancesByValue[instance.value] = [];
            }
            instancesByValue[instance.value].push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('xv');
        if (hasNegative) {
            instancesByValue['5'] = instancesByValue['5'] || [];
            instancesByValue['10'] = instancesByValue['10'] || [];
        }

        const constraints = [];
        for (const value of Object.keys(instancesByValue)) {
            const instances = instancesByValue[value];
            const numValue = Number(value);
            const isAllowed = (value1, value2) => value1 + value2 === numValue;
            const negativePairsGenerator = hasNegative ? orthogonalPairsGenerator : null;
            const params = {
                cellsPairs: instances.map(instance => instance.cells),
            };
            const constraint = new GeneralCellPairConstraint('XV', `XV`, 'sum', isAllowed, negativePairsGenerator, board, params);
            constraints.push(constraint);
        }
        return constraints;
    });

    // Register a sum constraint
    constraintBuilder.registerAggregateConstraint((board, boardData) => {
        const instances = boardData.sum || [];
        const instancesByValue = {};
        for (const instance of instances) {
            instancesByValue[instance.value].push(instance);
        }

        const hasNegative = Array.isArray(boardData.negative) && boardData.negative.includes('sum');

        const constraints = [];
        for (const value of Object.keys(instancesByValue)) {
            const instances = instancesByValue[value];
            const numValue = Number(value);
            const isAllowed = (value1, value2) => value1 + value2 === numValue;
            const negativePairsGenerator = hasNegative ? orthogonalPairsGenerator : null;
            const params = {
                cellsPairs: instances.map(instance => instance.cells),
            };
            const constraint = new GeneralCellPairConstraint('Sum', `Sum of ${value}`, 'sum', isAllowed, negativePairsGenerator, board, params);
            constraints.push(constraint);
        }
        return constraints;
    });
}
