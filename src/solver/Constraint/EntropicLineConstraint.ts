import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('entropicline', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const floorDiv3 = Math.floor(board.size / 3);
            const ceilDiv3 = Math.ceil(board.size / 3);
            const lowHighNumDigits = floorDiv3 * 2 + ceilDiv3 === board.size ? floorDiv3 : ceilDiv3;
            const midNumDigits = floorDiv3 * 2 + ceilDiv3 === board.size ? ceilDiv3 : floorDiv3;

            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length; ++i) {
                for (let j = i + 1; j < cells.length; ++j) {
                    if (i % 3 === j % 3) {
                        continue;
                    }
                    for (let digit1 = 0; digit1 < lowHighNumDigits; ++digit1) {
                        for (let digit2 = 0; digit2 < lowHighNumDigits; ++digit2) {
                            weakLinks.push([cells[i] * board.size + digit1, cells[j] * board.size + digit2]);
                        }
                    }
                    for (let digit1 = lowHighNumDigits; digit1 < lowHighNumDigits + midNumDigits; ++digit1) {
                        for (let digit2 = lowHighNumDigits; digit2 < lowHighNumDigits + midNumDigits; ++digit2) {
                            weakLinks.push([cells[i] * board.size + digit1, cells[j] * board.size + digit2]);
                        }
                    }
                    for (let digit1 = lowHighNumDigits + midNumDigits; digit1 < board.size; ++digit1) {
                        for (let digit2 = lowHighNumDigits + midNumDigits; digit2 < board.size; ++digit2) {
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
                'Entropic Line',
                `Entropic Line at ${line[0]}`
            );
        })
    );
}
