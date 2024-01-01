import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { OrConstraint } from './OrConstraint';
import { WeakLinksConstraint, generateLEWeakLinks } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('betweenline', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap(line => {
            if (line.length <= 2) {
                return [];
            }

            const outer = line.map(cellName => cellIndexFromName(cellName, board.size));
            // Mutates outer so it's actually now the outer cells
            const middle = outer.splice(1, outer.length - 2);

            const minUniqueMiddleValues = Math.max(...board.splitIntoGroups(middle).map(group => group.length));

            // outer[0] < middle < outer[1]
            const subboard1 = board.subboardClone();
            const weakLinks1: [CandidateIndex, CandidateIndex][] = [];
            for (const middleCell of middle) {
                weakLinks1.push(...generateLEWeakLinks(board.size, outer[0], middleCell, -1));
                weakLinks1.push(...generateLEWeakLinks(board.size, middleCell, outer[1], -1));
            }
            // outer[0] + minUniqueMiddleValues < outer[1]
            weakLinks1.push(...generateLEWeakLinks(board.size, outer[0], outer[1], -1 - minUniqueMiddleValues));
            subboard1.addConstraint(
                new WeakLinksConstraint(
                    board,
                    { weakLinks: weakLinks1 },
                    'Hypothetical Between Line',
                    `Hypothetical Between Line if ${line[0]} < ${line[line.length - 1]}`
                )
            );

            // outer[0] > middle > outer[1]
            const subboard2 = board.subboardClone();
            const weakLinks2: [CandidateIndex, CandidateIndex][] = [];
            for (const middleCell of middle) {
                weakLinks2.push(...generateLEWeakLinks(board.size, outer[1], middleCell, -1));
                weakLinks2.push(...generateLEWeakLinks(board.size, middleCell, outer[0], -1));
            }
            // outer[0] + minUniqueMiddleValues < outer[1]
            weakLinks1.push(...generateLEWeakLinks(board.size, outer[1], outer[0], -1 - minUniqueMiddleValues));
            subboard2.addConstraint(
                new WeakLinksConstraint(
                    board,
                    { weakLinks: weakLinks2 },
                    'Hypothetical Between Line',
                    `Hypothetical Between Line if ${line[0]} < ${line[line.length - 1]}`
                )
            );

            return [new OrConstraint('Between Line', `Between Line at ${line[0]}`, board, { subboards: [subboard1, subboard2] })];
        })
    );
}
