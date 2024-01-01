import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('modularline', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length; ++i) {
                for (let j = i + 1; j < cells.length; ++j) {
                    if (i % 3 === j % 3) {
                        continue;
                    }
                    for (let digit1 = 0; digit1 < board.size; digit1 += 3) {
                        for (let digit2 = 0; digit2 < board.size; digit2 += 3) {
                            weakLinks.push([cells[i] * board.size + digit1, cells[j] * board.size + digit2]);
                        }
                    }
                    for (let digit1 = 1; digit1 < board.size; digit1 += 3) {
                        for (let digit2 = 1; digit2 < board.size; digit2 += 3) {
                            weakLinks.push([cells[i] * board.size + digit1, cells[j] * board.size + digit2]);
                        }
                    }
                    for (let digit1 = 2; digit1 < board.size; digit1 += 3) {
                        for (let digit2 = 2; digit2 < board.size; digit2 += 3) {
                            weakLinks.push([cells[i] * board.size + digit1, cells[j] * board.size + digit2]);
                        }
                    }
                }
            }

            return new WeakLinksConstraint(
                board,
                {
                    weakLinks,
                },
                'Modular Line',
                `Modular Line at ${line[0]}`
            );
        })
    );
}
