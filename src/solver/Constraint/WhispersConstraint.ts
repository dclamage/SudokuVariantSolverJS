import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, sequenceIntersection } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint, generateLEWeakLinks } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('whispers', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const defaultMinDifference = Math.ceil(board.size / 2);
            const minDifference = params.value ? parseInt(params.value, 10) : defaultMinDifference;
            console.log(params, params.value, defaultMinDifference, minDifference);

            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length - 1; ++i) {
                const compareLinks = (a: [CandidateIndex, CandidateIndex], b: [CandidateIndex, CandidateIndex]) => {
                    return (a[0] - b[0]) * board.size * board.size * board.size + (a[1] - b[1]);
                };
                console.log([...generateLEWeakLinks(board.size, cells[i], cells[i + 1], -minDifference)]);
                console.log([...generateLEWeakLinks(board.size, cells[i + 1], cells[i], -minDifference)].map(x => x.sort((a, b) => a - b)));
                const links1 = [...generateLEWeakLinks(board.size, cells[i], cells[i + 1], -minDifference)]
                    .map(x => x.sort((a, b) => a - b))
                    .sort(compareLinks);
                const links2 = [...generateLEWeakLinks(board.size, cells[i + 1], cells[i], -minDifference)]
                    .map(x => x.sort((a, b) => a - b))
                    .sort(compareLinks);
                weakLinks.push(...sequenceIntersection(links1, links2, compareLinks));
                console.log(links1, links2, weakLinks);
            }

            return new WeakLinksConstraint(
                board,
                {
                    weakLinks,
                },
                `Whispers(${minDifference})`,
                `Whispers(${minDifference}) at ${line[0]}`
            );
        })
    );
}
