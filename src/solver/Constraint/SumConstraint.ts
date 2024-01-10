import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, orthogonalPairsGenerator } from '../SolveUtility';
import { FPuzzlesBoard } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

interface CellsWithValue {
    cells: string[];
    value: number;
}

export function register(constraintBuilder: ConstraintBuilder) {
    // Register an XV/sum positive/negative constraint
    constraintBuilder.registerAggregateConstraint((board: Board, boardData: FPuzzlesBoard) => {
        const xvInstances: CellsWithValue[] = (boardData.xv || [])
            .filter(instance => instance.value === 'x' || instance.value === 'X' || instance.value === 'v' || instance.value === 'V')
            .map(instance => {
                return { cells: instance.cells, value: instance.value === 'x' || instance.value === 'X' ? 10 : 5 };
            });

        const sumInstances: CellsWithValue[] = (boardData.sum || []).map(instance => {
            return { cells: instance.cells, value: parseInt(instance.value) };
        });

        const sumInstanceKeys: (true | undefined)[] = [];
        const xvInstancesByValue = new Map<number, [CandidateIndex, CandidateIndex][]>();
        for (const instance of xvInstances) {
            if (!xvInstancesByValue.has(instance.value)) {
                xvInstancesByValue.set(instance.value, []);
            }
            const index1 = cellIndexFromName(instance.cells[0], board.size);
            const index2 = cellIndexFromName(instance.cells[1], board.size);
            const smallIndex = Math.min(index1, index2);
            const bigIndex = Math.max(index1, index2);
            xvInstancesByValue.get(instance.value).push([smallIndex, bigIndex]);
            sumInstanceKeys[smallIndex * board.size * board.size + bigIndex] = true;
        }

        const sumInstancesByValue = new Map<number, [CandidateIndex, CandidateIndex][]>();
        for (const instance of sumInstances) {
            if (!sumInstancesByValue.has(instance.value)) {
                sumInstancesByValue.set(instance.value, []);
            }
            const index1 = cellIndexFromName(instance.cells[0], board.size);
            const index2 = cellIndexFromName(instance.cells[1], board.size);
            const smallIndex = Math.min(index1, index2);
            const bigIndex = Math.max(index1, index2);
            sumInstancesByValue.get(instance.value).push([smallIndex, bigIndex]);
            sumInstanceKeys[smallIndex * board.size * board.size + bigIndex] = true;
        }

        const hasNegativeXV = Array.isArray(boardData.negative) && boardData.negative.includes('xv');
        const hasNegativeSum = Array.isArray(boardData.negative) && boardData.negative.includes('sum');
        if (hasNegativeXV) {
            if (!xvInstancesByValue.has(5)) {
                xvInstancesByValue.set(5, []);
            }
            if (!xvInstancesByValue.has(10)) {
                xvInstancesByValue.set(10, []);
            }
        }

        const constraints = [];

        // Positive XV weak links
        for (const [value, instances] of xvInstancesByValue) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (const [index1, index2] of instances) {
                for (let value1 = 1; value1 <= board.size; ++value1) {
                    for (let value2 = 1; value2 <= board.size; ++value2) {
                        if (value1 + value2 === value) continue;
                        weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                    }
                }
            }
            if (weakLinks.length > 0) {
                constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'XV', 'XV'));
            }
        }

        // Positive sum weak links
        for (const [value, instances] of sumInstancesByValue) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (const [index1, index2] of instances) {
                for (let value1 = 1; value1 <= board.size; ++value1) {
                    for (let value2 = 1; value2 <= board.size; ++value2) {
                        if (value1 + value2 === value) continue;
                        weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                    }
                }
            }
            if (weakLinks.length > 0) {
                constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Sum', `Sum of ${value}`));
            }
        }

        // Negative XV weak links
        if (hasNegativeXV) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [value, _] of xvInstancesByValue) {
                const weakLinks: [CandidateIndex, CandidateIndex][] = [];
                for (const [index1, index2] of orthogonalPairsGenerator(board)) {
                    if (sumInstanceKeys[index1 * board.size * board.size + index2]) continue;
                    for (let value1 = 1; value1 <= board.size; ++value1) {
                        for (let value2 = 1; value2 <= board.size; ++value2) {
                            if (value1 + value2 !== value) continue;
                            weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                        }
                    }
                }
                if (weakLinks.length > 0) {
                    constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Negative XV', 'Negative XV'));
                }
            }
        }

        if (hasNegativeSum) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [value, _] of sumInstancesByValue) {
                const weakLinks: [CandidateIndex, CandidateIndex][] = [];
                for (const [index1, index2] of orthogonalPairsGenerator(board)) {
                    if (sumInstanceKeys[index1 * board.size * board.size + index2]) continue;
                    for (let value1 = 1; value1 <= board.size; ++value1) {
                        for (let value2 = 1; value2 <= board.size; ++value2) {
                            if (value1 + value2 !== value) continue;
                            weakLinks.push([board.candidateIndex(index1, value1), board.candidateIndex(index2, value2)]);
                        }
                    }
                }
                if (weakLinks.length > 0) {
                    constraints.push(new WeakLinksConstraint(board, { weakLinks }, 'Negative Sum', `Negative Sum of ${value}`));
                }
            }
        }

        return constraints;
    });
}
