import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName } from '../SolveUtility';
import { EqualSumConstraint } from './EqualSumConstraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('zipperline', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap(line => {
            let cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const pairs: CellIndex[][] = [];
            while (cells.length > 0) {
                // cells now contains the end cells, newCells contains the removed cells (the middle cells)
                const newCells = cells.splice(1, cells.length - 1);
                // add end cells
                pairs.push(cells);
                // cells = middle cells
                cells = newCells;
            }
            return [
                new EqualSumConstraint('Zipper Line', `Zipper Line at ${line[0]}`, board, {
                    cells: pairs,
                }),
            ];
        })
    );
}
