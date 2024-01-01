import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, cellName } from '../SolveUtility';
import { FPuzzlesClone } from './FPuzzlesInterfaces';
import { WeakLinksConstraint } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('clone', (board: Board, params: FPuzzlesClone) => {
        const cells0 = params.cells.map(cell => cellIndexFromName(cell, board.size));
        const cells1 = params.cloneCells.map(cell => cellIndexFromName(cell, board.size));
        if (cells0.length !== cells1.length) {
            throw new Error(`Clone cells must be the same length`);
        }

        const weakLinks: [CandidateIndex, CandidateIndex][] = [];
        const cellCount = cells0.length;
        for (let i = 0; i < cellCount; ++i) {
            if (cells0[i] === cells1[i]) {
                continue;
            }

            const cell0 = cells0[i];
            const cell1 = cells1[i];
            for (let value0 = 1; value0 <= board.size; value0++) {
                const candidate0 = board.candidateIndex(cell0, value0);
                const candidate1 = board.candidateIndex(cell1, 1);
                for (let value1 = 1; value1 <= board.size; value1++) {
                    if (value0 !== value1) {
                        weakLinks.push([candidate0, candidate1 + value1 - 1]);
                    }
                }
            }
        }

        return new WeakLinksConstraint(
            board,
            { weakLinks: weakLinks },
            'Clone',
            `Cone at ${cellName(cells0[0], board.size)} - ${cellName(cells1[0], board.size)}`
        );
    });
}
