import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, cellName } from '../SolveUtility';
import { FPuzzlesCell } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    // Odd
    constraintBuilder.registerConstraint('odd', (board: Board, params: FPuzzlesCell) => {
        const weakLinks: [CandidateIndex, CandidateIndex][] = [];

        const cellIndex = cellIndexFromName(params.cell, board.size);
        for (let value = 2; value <= board.size; value += 2) {
            const candidateIndex = board.candidateIndex(cellIndex, value);
            weakLinks.push([candidateIndex, candidateIndex]);
        }

        return new WeakLinksConstraint(board, { weakLinks: weakLinks }, 'Odd', `Odd at ${cellName(cellIndex, board.size)}`);
    });

    // Even
    constraintBuilder.registerConstraint('even', (board: Board, params: FPuzzlesCell) => {
        const weakLinks: [CandidateIndex, CandidateIndex][] = [];

        const cellIndex = cellIndexFromName(params.cell, board.size);
        for (let value = 1; value <= board.size; value += 2) {
            const candidateIndex = board.candidateIndex(cellIndex, value);
            weakLinks.push([candidateIndex, candidateIndex]);
        }

        return new WeakLinksConstraint(board, { weakLinks: weakLinks }, 'Even', `Even at ${cellName(cellIndex, board.size)}`);
    });

    // Minimum
    constraintBuilder.registerMultiConstraint('minimum', (board: Board, params: FPuzzlesCell[]) => {
        const cellIndices = params.map(param => cellIndexFromName(param.cell, board.size));
        return cellIndices.flatMap(cellIndex => {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            const cellCoords = board.cellCoords(cellIndex);
            for (const offset of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbori = cellCoords.row + offset[0];
                const neighborj = cellCoords.col + offset[1];
                if (neighbori < 0 || neighbori >= board.size || neighborj < 0 || neighborj >= board.size) {
                    continue;
                }

                const neighborIndex = board.cellIndex(neighbori, neighborj);
                if (cellIndices.includes(neighborIndex)) {
                    // Skip if the neighbor is also a minimum cell
                    continue;
                }

                for (let cellValue = 1; cellValue <= board.size; ++cellValue) {
                    const candidateIndex = board.candidateIndex(cellIndex, cellValue);
                    for (let neighborValue = cellValue; neighborValue >= 1; --neighborValue) {
                        const neighborCandidateIndex = board.candidateIndex(neighborIndex, neighborValue);
                        weakLinks.push([candidateIndex, neighborCandidateIndex]);
                    }
                }
            }

            return [new WeakLinksConstraint(board, { weakLinks: weakLinks }, 'Minimum', `Minimum at ${cellName(cellIndex, board.size)}`)];
        });
    });

    // Maximum
    constraintBuilder.registerMultiConstraint('maximum', (board: Board, params: FPuzzlesCell[]) => {
        const cellIndices = params.map(param => cellIndexFromName(param.cell, board.size));
        return cellIndices.flatMap(cellIndex => {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];

            const cellCoords = board.cellCoords(cellIndex);
            for (const offset of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbori = cellCoords.row + offset[0];
                const neighborj = cellCoords.col + offset[1];
                if (neighbori < 0 || neighbori >= board.size || neighborj < 0 || neighborj >= board.size) {
                    continue;
                }

                const neighborIndex = board.cellIndex(neighbori, neighborj);
                if (cellIndices.includes(neighborIndex)) {
                    // Skip if the neighbor is also a minimum cell
                    continue;
                }

                for (let cellValue = 1; cellValue <= board.size; ++cellValue) {
                    const candidateIndex = board.candidateIndex(cellIndex, cellValue);
                    for (let neighborValue = cellValue; neighborValue <= board.size; ++neighborValue) {
                        const neighborCandidateIndex = board.candidateIndex(neighborIndex, neighborValue);
                        weakLinks.push([candidateIndex, neighborCandidateIndex]);
                    }
                }
            }

            return [new WeakLinksConstraint(board, { weakLinks: weakLinks }, 'Maximum', `Maximum at ${cellName(cellIndex, board.size)}`)];
        });
    });
}
