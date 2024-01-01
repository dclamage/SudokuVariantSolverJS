import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellIndexFromName } from '../SolveUtility';
import { EqualSumConstraint } from './EqualSumConstraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('doublearrow', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap(line => {
            if (line.length <= 2) {
                return [];
            }
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            // Also mutates cells so it contains only the ends
            const middle = cells.splice(1, cells.length - 2);
            return [
                new EqualSumConstraint('Double Arrow', `Double Arrow at ${line[0]}`, board, {
                    cells: [cells, middle],
                }),
            ];
        })
    );
}
