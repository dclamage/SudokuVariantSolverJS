import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, parseEdgeClueCoords, valueBit } from '../SolveUtility';
import { ConstraintResult } from './Constraint';
import { FPuzzlesCell } from './FPuzzlesInterfaces';
import { FixedSumConstraint } from './FixedSumConstraint';
import { OrConstraint } from './OrConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('sandwichsum', (board: Board, params: FPuzzlesCell) => {
        const directionalCoords = parseEdgeClueCoords(params.cell, board.size);
        const initialCellIndex = board.cellIndex(directionalCoords.row, directionalCoords.col);
        const directionAsCellIndexOffset = board.cellIndex(directionalCoords.dRow, directionalCoords.dCol);

        const allCells: CellIndex[] = Array.from({ length: board.size }, (_, i) => initialCellIndex + i * directionAsCellIndexOffset);
        const subboards: Board[] = [];

        const crustsMask = valueBit(1) | valueBit(board.size);
        const nonCrustsMask = board.allValues & ~crustsMask;

        for (let firstPos = 0; firstPos < board.size - 1; ++firstPos) {
            for (let secondPos = firstPos + 1; secondPos < board.size; ++secondPos) {
                const subboard = board.subboardClone();

                // in the (i,j) branch, cells i and j can only be 1 and size, and 2-(size-1) otherwise
                // we are helping out the subboard by doing naked pair logic for them because tactics aren't run on subboards by default
                // so it will not see this without our help. doing the naked pair logic lets subboards be pruned during a solve.
                if (
                    subboard.applyCellMasks(
                        allCells,
                        allCells.map((_, i) => (i === firstPos || i === secondPos ? crustsMask : nonCrustsMask))
                    ) === ConstraintResult.INVALID
                ) {
                    subboard.release();
                    continue;
                }

                // cells in between the crusts must sum to the given total
                const cells = allCells.slice(firstPos + 1, secondPos);
                subboard.addConstraint(
                    new FixedSumConstraint(
                        `Hypothetical Sandwich Sum`,
                        `Hypothetical Sandwich Sum ${params.value} at ${params.cell} if 1/9 were at positions ${firstPos + 1} and ${secondPos + 1}`,
                        subboard,
                        {
                            cells,
                            sum: parseInt(params.value, 10),
                        }
                    )
                );
                subboards.push(subboard);
            }
        }

        return new OrConstraint('Sandwich Sum', `Sandwich Sum ${params.value} at ${params.cell}`, board, {
            subboards: subboards,
            cells: allCells.slice(),
        });
    });
}
