import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, CellIndex, cellIndexFromName, orthogonalPairsGenerator } from '../SolveUtility';
import { FPuzzlesBoard } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

interface CellsWithValue {
    cells: string[];
    value: number;
}

export function register(constraintBuilder: ConstraintBuilder) {
    // Register difference/ratio positive/negative constraints (Kropki)
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const differenceInstances: CellsWithValue[] = (boardData.difference || []).map(instance => {
            if (instance.value !== undefined) {
                return { cells: instance.cells, value: parseInt(instance.value) };
            }
            return { cells: instance.cells, value: 1 };
        });
        const ratioInstances: CellsWithValue[] = (boardData.ratio || []).map(instance => {
            if (instance.value !== undefined) {
                return { cells: instance.cells, value: parseInt(instance.value) };
            }
            return { cells: instance.cells, value: 2 };
        });

        const kropkiInstanceKeys: (true | undefined)[] = [];
        const differenceInstancesByValue = new Map<number, [CellIndex, CellIndex][]>();
        for (const instance of differenceInstances) {
            if (!differenceInstancesByValue.get(instance.value)) {
                differenceInstancesByValue.set(instance.value, []);
            }
            const index1 = cellIndexFromName(instance.cells[0], board.size);
            const index2 = cellIndexFromName(instance.cells[1], board.size);
            const smallIndex = Math.min(index1, index2);
            const bigIndex = Math.max(index1, index2);
            differenceInstancesByValue.get(instance.value).push([smallIndex, bigIndex]);
            kropkiInstanceKeys[smallIndex * board.size * board.size + bigIndex] = true;
        }

        const ratioInstancesByValue = new Map<number, [CellIndex, CellIndex][]>();
        for (const instance of ratioInstances) {
            if (!ratioInstancesByValue.get(instance.value)) {
                ratioInstancesByValue.set(instance.value, []);
            }
            const index1 = cellIndexFromName(instance.cells[0], board.size);
            const index2 = cellIndexFromName(instance.cells[1], board.size);
            const smallIndex = Math.min(index1, index2);
            const bigIndex = Math.max(index1, index2);
            ratioInstancesByValue.get(instance.value).push([smallIndex, bigIndex]);
            kropkiInstanceKeys[smallIndex * board.size * board.size + bigIndex] = true;
        }

        const hasNonconsecutive = boardData.nonconsecutive === true;
        const hasDifferenceNegative = Array.isArray(boardData.negative) && boardData.negative.includes('difference');
        const hasRatioNegative = Array.isArray(boardData.negative) && boardData.negative.includes('ratio');

        if (hasNonconsecutive && !differenceInstancesByValue.has(1)) {
            differenceInstancesByValue.set(1, []);
        }

        if (hasRatioNegative && !ratioInstancesByValue.has(2)) {
            ratioInstancesByValue.set(2, []);
        }

        const constraints = [];

        // Difference weak links
        for (const [value, instances] of differenceInstancesByValue) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (const [index1, index2] of instances) {
                for (let value1 = 1; value1 <= board.size; ++value1) {
                    for (let value2 = 1; value2 <= board.size; ++value2) {
                        if (Math.abs(value1 - value2) === value) continue;
                        weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                    }
                }
            }
            if (weakLinks.length > 0) {
                constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Difference', `Difference of ${value}`));
            }
        }

        // Ratio weak links
        for (const [value, instances] of ratioInstancesByValue) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (const [index1, index2] of instances) {
                for (let value1 = 1; value1 <= board.size; ++value1) {
                    for (let value2 = 1; value2 <= board.size; ++value2) {
                        if (value1 * value === value2 || value2 * value === value1) continue;
                        weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                    }
                }
            }
            if (weakLinks.length > 0) {
                constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Ratio', `Ratio of ${value}`));
            }
        }

        // Negative difference weak links
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [value, _] of differenceInstancesByValue) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            if (!((value === 1 && hasNonconsecutive) || hasDifferenceNegative)) continue;
            for (const [index1, index2] of orthogonalPairsGenerator(board)) {
                if (kropkiInstanceKeys[index1 * board.size * board.size + index2]) continue;
                for (let value1 = 1; value1 <= board.size; ++value1) {
                    for (let value2 = 1; value2 <= board.size; ++value2) {
                        if (Math.abs(value1 - value2) !== value) continue;
                        weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                    }
                }
            }
            if (weakLinks.length > 0) {
                if (!hasDifferenceNegative && hasNonconsecutive) {
                    constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Nonconsecutive', 'Nonconsecutive'));
                } else {
                    constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Negative Difference', `Negative Difference of ${value}`));
                }
            }
        }

        // Negative ratio weak links
        if (hasRatioNegative) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [value, _] of ratioInstancesByValue) {
                const weakLinks: [CandidateIndex, CandidateIndex][] = [];
                for (const [index1, index2] of orthogonalPairsGenerator(board)) {
                    if (kropkiInstanceKeys[index1 * board.size * board.size + index2]) continue;
                    for (let value1 = 1; value1 <= board.size; ++value1) {
                        for (let value2 = 1; value2 <= board.size; ++value2) {
                            if (value1 * value !== value2 && value2 * value !== value1) continue;
                            weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                        }
                    }
                }
                if (weakLinks.length > 0) {
                    constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Negative Ratio', `Negative Ratio of ${value}`));
                }
            }
        }

        return constraints;
    });
}
