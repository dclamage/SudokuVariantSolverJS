import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, sequenceIntersection } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { InvalidConstraint } from './InvalidConstraint';
import { WeakLinksConstraint, generateLEWeakLinks } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('nabner', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));

            if (cells.length > (board.size - 1) / 2 + 1) {
                return new InvalidConstraint(board, 'Nabner', `Nabner at ${line[0]}`);
            }

            if (cells.length === (board.size - 1) / 2 + 1) {
                // Special handling for this specific size that only works for odd sized sudokus (5x5, 7x7, 9x9, etc)
                const weakLinks: [CandidateIndex, CandidateIndex][] = [];
                for (let i = 0; i < cells.length; ++i) {
                    for (let digit = 1; digit < board.size; digit += 2) {
                        weakLinks.push([cells[i] * board.size + digit, cells[i] * board.size + digit]);
                    }
                }
                console.log(weakLinks);
                return new WeakLinksConstraint(board, { weakLinks }, 'Nabner', `Nabner at ${line[0]}`);
            }

            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length - 1; ++i) {
                for (let j = i + 1; j < cells.length; ++j) {
                    const compareLinks = (a: [CandidateIndex, CandidateIndex], b: [CandidateIndex, CandidateIndex]) => {
                        return (a[0] - b[0]) * board.size * board.size * board.size + (a[1] - b[1]);
                    };
                    const links1 = [...generateLEWeakLinks(board.size, cells[i], cells[j], -2)].map(x => x.sort((a, b) => a - b)).sort(compareLinks);
                    const links2 = [...generateLEWeakLinks(board.size, cells[j], cells[i], -2)].map(x => x.sort((a, b) => a - b)).sort(compareLinks);
                    weakLinks.push(...sequenceIntersection(links1, links2, compareLinks));
                }
            }

            return new WeakLinksConstraint(
                board,
                {
                    weakLinks,
                },
                'Nabner',
                `Nabner at ${line[0]}`
            );
        })
    );
}
