import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, WeakLink, cellIndexFromName, cellName, maxValue, minValue } from '../SolveUtility';
import { ConstraintV2, LogicalDeduction } from './ConstraintV2';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { OrConstraint } from './OrConstraint';
import { generateLEWeakLinks } from './WeakLinksConstraint';

// Ends are expected to be in order, so ends[0] < ends[1]
class BetweenLineParams {
    ends: [CandidateIndex, CandidateIndex];
    middle: CandidateIndex[];
}

class BetweenLineConstraint extends ConstraintV2 {
    ends: [CandidateIndex, CandidateIndex];
    middle: CandidateIndex[];

    constructor(board: Board, params: BetweenLineParams) {
        const specificName = `Between Line at ${cellName(params.ends[0], board.size)} - ${cellName(params.ends[1], board.size)}`;
        super('Between Line', specificName);

        this.ends = params.ends;
        this.middle = params.middle.slice();
    }

    obviousLogicalStep(board: Board): LogicalDeduction[] {
        const endMask0 = board.cells[this.ends[0]] & board.allValues;
        const endMask1 = board.cells[this.ends[1]] & board.allValues;
        const minUniqueMiddleValues = Math.max(...board.splitIntoGroups(this.middle).map(group => group.length));
        if (minValue(endMask0) + minUniqueMiddleValues >= maxValue(endMask1)) {
            // Invalid if the ends are in the wrong order or are too close
            return [
                {
                    explanation: 'Ends are in the wrong order or too close together',
                    invalid: true,
                },
            ];
        }

        const eliminations: CandidateIndex[] = [];
        for (const middleCell of this.middle) {
            for (let value = 1; value <= minValue(endMask0); ++value) {
                eliminations.push(board.candidateIndex(middleCell, value));
            }
            for (let value = maxValue(endMask1); value <= board.size; ++value) {
                eliminations.push(board.candidateIndex(middleCell, value));
            }
        }

        const weakLinks: WeakLink[] = [];
        // ends[0] < middle < ends[1]
        for (const middleCell of this.middle) {
            for (const weakLink of generateLEWeakLinks(board.size, this.ends[0], middleCell, -1)) {
                weakLinks.push(weakLink);
            }
            for (const weakLink of generateLEWeakLinks(board.size, middleCell, this.ends[1], -1)) {
                weakLinks.push(weakLink);
            }
        }

        // ends[0] + minUniqueMiddleValues < ends[1]
        for (const weakLink of generateLEWeakLinks(board.size, this.ends[0], this.ends[1], -1 - minUniqueMiddleValues)) {
            weakLinks.push(weakLink);
        }
        return [
            {
                explanation: 'Adding weak links',
                eliminations,
                weakLinks,
                deleteConstraints: [this],
            },
        ];
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('betweenline', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap((line: string[]): ConstraintV2[] => {
            if (line.length <= 2) {
                return [];
            }

            const outer = line.map(cellName => cellIndexFromName(cellName, board.size));
            // Mutates outer so it's actually now the outer cells
            const middle = outer.splice(1, outer.length - 2);

            // outer[0] < middle < outer[1]
            const subboard1 = board.subboardClone();
            subboard1.addConstraint(new BetweenLineConstraint(board, { ends: [outer[0], outer[1]], middle: middle }));

            // outer[0] > middle > outer[1]
            const subboard2 = board.subboardClone();
            subboard2.addConstraint(new BetweenLineConstraint(board, { ends: [outer[1], outer[0]], middle: middle }));
            return [
                new OrConstraint('Between Line', `Between Line at ${line[0]}-${line[line.length - 1]}`, board, { subboards: [subboard1, subboard2] }),
            ];
        })
    );
}
