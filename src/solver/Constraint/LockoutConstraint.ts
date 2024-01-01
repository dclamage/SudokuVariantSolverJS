import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, cellIndexFromName, sequenceIntersection } from '../SolveUtility';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { OrConstraint } from './OrConstraint';
import { WeakLinksConstraint, generateLEWeakLinks } from './WeakLinksConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('lockout', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const lockoutDifference = Math.floor(board.size / 2);

            const outer = line.map(cellName => cellIndexFromName(cellName, board.size));
            // Mutates outer so it's actually now the outer cells
            const middle = outer.splice(1, outer.length - 2);

            const minUniqueMiddleValues = Math.max(...board.splitIntoGroups(middle).map(group => group.length));

            const compareLinks = (a: [CandidateIndex, CandidateIndex], b: [CandidateIndex, CandidateIndex]) => {
                return (a[0] - b[0]) * board.size * board.size * board.size + (a[1] - b[1]);
            };

            const subboard1 = board.subboardClone();
            const weakLinks1: [CandidateIndex, CandidateIndex][] = [];
            // outer[0] + lockoutDifference <= outer[1]
            weakLinks1.push(...generateLEWeakLinks(board.size, outer[0], outer[1], -lockoutDifference));
            // Have to bend the rules a bit -- each end of the lockout line indivdiually locks out the digits near it
            // Together they help to cover the entire interval of digits that need to be excluded
            // !(outer[0] <= middle <= outer[0] + lockoutDifference)
            // AND !(outer[1] - lockoutDifference <= middle <= outer[1])
            for (const middleCell of middle) {
                {
                    // !(outer[0] <= middle <= outer[0] + lockoutDifference)
                    // middle < outer[0] OR
                    // outer[0] + lockoutDifference < middle
                    const links1 = [...generateLEWeakLinks(board.size, middleCell, outer[0], -1)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    const links2 = [...generateLEWeakLinks(board.size, outer[0], middleCell, -1 - lockoutDifference)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    weakLinks1.push(...sequenceIntersection(links1, links2, compareLinks));
                }
                {
                    // !(outer[1] - lockoutDifference <= middle <= outer[1])
                    // middle < outer[1] - lockoutDifference OR
                    // outer[1] < middle
                    const links1 = [...generateLEWeakLinks(board.size, middleCell, outer[1], -1 - lockoutDifference)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    const links2 = [...generateLEWeakLinks(board.size, outer[1], middleCell, -1)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    weakLinks1.push(...sequenceIntersection(links1, links2, compareLinks));
                }
            }
            // logic: if the ends of the lockout line are k apart (outer[0] + k = outer[1]),
            //        then the k+1 digits are eliminated from the line.
            //        Thus we have at most minUniqueMiddleValues <= size - (k+1) digits that are unique on the line.
            //        Rearranging the equation, k <= size - minUniqueMiddleValues - 1,
            //        and so outer[1] = outer[0] + k <= outer[0] + size - minUniqueMiddleValues - 1
            weakLinks1.push(...generateLEWeakLinks(board.size, outer[1], outer[0], board.size - minUniqueMiddleValues - 1));
            subboard1.addConstraint(
                new WeakLinksConstraint(
                    board,
                    { weakLinks: weakLinks1 },
                    'Hypothetical Lockout Line',
                    `Hypothetical Lockout Line if ${line[0]} < ${line[line.length - 1]}`
                )
            );

            const subboard2 = board.subboardClone();
            const weakLinks2: [CandidateIndex, CandidateIndex][] = [];
            // outer[1] + lockoutDifference <= outer[0]
            weakLinks2.push(...generateLEWeakLinks(board.size, outer[1], outer[0], -lockoutDifference));
            // Have to bend the rules a bit -- each end of the lockout line indivdiually locks out the digits near it
            // Together they help to cover the entire interval of digits that need to be excluded
            // !(outer[1] <= middle <= outer[1] + lockoutDifference)
            // AND !(outer[0] - lockoutDifference <= middle <= outer[0])
            for (const middleCell of middle) {
                {
                    // !(outer[1] <= middle <= outer[1] + lockoutDifference)
                    // middle < outer[1] OR
                    // outer[1] + lockoutDifference < middle
                    const links1 = [...generateLEWeakLinks(board.size, middleCell, outer[1], -1)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    const links2 = [...generateLEWeakLinks(board.size, outer[1], middleCell, -1 - lockoutDifference)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    weakLinks2.push(...sequenceIntersection(links1, links2, compareLinks));
                }
                {
                    // !(outer[0] - lockoutDifference <= middle <= outer[0])
                    // middle < outer[0] - lockoutDifference OR
                    // outer[0] < middle
                    const links1 = [...generateLEWeakLinks(board.size, middleCell, outer[0], -1 - lockoutDifference)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    const links2 = [...generateLEWeakLinks(board.size, outer[0], middleCell, -1)]
                        .map(x => x.sort((a, b) => a - b))
                        .sort(compareLinks);
                    weakLinks2.push(...sequenceIntersection(links1, links2, compareLinks));
                }
            }
            // logic: if the ends of the lockout line are k apart (outer[1] + k = outer[0]),
            //        then the k+1 digits are eliminated from the line.
            //        Thus we have at most minUniqueMiddleValues <= size - (k+1) digits that are unique on the line.
            //        Rearranging the equation, k <= size - minUniqueMiddleValues - 1,
            //        and so outer[0] = outer[1] + k <= outer[1] + size - minUniqueMiddleValues - 1
            weakLinks2.push(...generateLEWeakLinks(board.size, outer[0], outer[1], board.size - minUniqueMiddleValues - 1));
            subboard2.addConstraint(
                new WeakLinksConstraint(
                    board,
                    { weakLinks: weakLinks2 },
                    'Hypothetical Lockout',
                    `Hypothetical Lockout if ${line[0]} > ${line[line.length - 1]}`
                )
            );

            return new OrConstraint('Lockout', `Lockout at ${line[0]}`, board, { subboards: [subboard1, subboard2] });
        })
    );
}
