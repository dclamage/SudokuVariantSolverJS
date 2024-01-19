import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName } from '../SolveUtility';
import { EqualSumConstraint } from './EqualSumConstraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('zipperline', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const halfLength = Math.floor(cells.length / 2);
            const pairs: CellIndex[][] = [];
            for (let i = 0; i < halfLength; i++) {
                pairs.push([cells[i], cells[cells.length - i - 1]]);
            }
            if (cells.length % 2 === 1) {
                pairs.push([cells[halfLength]]);
            }
            return [
                new EqualSumConstraint('Zipper Line', `Zipper Line at ${line[0]}`, board, {
                    cells: pairs,
                }),
            ];
        })
    );
}
