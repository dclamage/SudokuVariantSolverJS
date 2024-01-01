import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint, generateLEWeakLinks, generateNEqWeakLinks } from './WeakLinksConstraint';

// TODO: Convert Renban lines to scripted, not all logic can be found using just weak links,
//       namely that eliminating 4 from a 4 cell renban should eliminate 123 as well.
export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('renban', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length - 1; ++i) {
                for (let j = i + 1; j < cells.length; ++j) {
                    weakLinks.push(...generateLEWeakLinks(board.size, cells[i], cells[j], cells.length));
                    weakLinks.push(...generateLEWeakLinks(board.size, cells[j], cells[i], cells.length));
                    // Cells can't be equal either
                    weakLinks.push(...generateNEqWeakLinks(board.size, cells[i], cells[j]));
                }
            }

            return new WeakLinksConstraint(
                board,
                {
                    weakLinks,
                },
                'Renban',
                `Renban at ${line[0]}`
            );
        })
    );
}
