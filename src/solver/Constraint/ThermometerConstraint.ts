import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint, generateLEWeakLinks } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('thermometer', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < cells.length - 1; ++i) {
                // TODO: Don't add the transitive edges once we have cell forcing.
                //       They make the generated weak links non-local while creating no additional deductions.
                for (let j = i + 1; j < cells.length; ++j) {
                    weakLinks.push(...generateLEWeakLinks(board.size, cells[i], cells[j], i - j));
                }
            }

            return new WeakLinksConstraint(
                board,
                {
                    weakLinks,
                },
                'Thermometer',
                `Thermometer at ${line[0]}`
            );
        })
    );
}
