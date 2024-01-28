import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, parseEdgeClueCoords, valueBit } from '../SolveUtility';
import { ConstraintResult } from './Constraint';
import { FPuzzlesCell } from './FPuzzlesInterfaces';
import { FixedSumConstraint } from './FixedSumConstraint';
import { OrConstraint } from './OrConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('xsum', (board: Board, params: FPuzzlesCell) => {
        const directionalCoords = parseEdgeClueCoords(params.cell, board.size);
        const initialCellIndex = board.cellIndex(directionalCoords.row, directionalCoords.col);
        const directionAsCellIndexOffset = board.cellIndex(directionalCoords.dRow, directionalCoords.dCol);

        const sumCells: CellIndex[] = [];
        const subboards: Board[] = [];
        for (let digit = 1, cellIndex = initialCellIndex; digit <= board.size; ++digit, cellIndex += directionAsCellIndexOffset) {
            sumCells.push(cellIndex);

            const subboard = board.subboardClone();

            // In the ith branch, the first cell of the xsum has value i
            if (subboard.applyCellMask(initialCellIndex, valueBit(digit)) === ConstraintResult.INVALID) {
                subboard.release();
                continue;
            }

            // And the first i cells sum to the given total
            subboard.addConstraint(
                new FixedSumConstraint(`Hypothetical X-Sum`, `Hypothetical X-Sum ${params.value} at ${params.cell} if X = ${digit}`, subboard, {
                    cells: sumCells,
                    sum: parseInt(params.value, 10),
                })
            );

            subboards.push(subboard);
        }

        return new OrConstraint('X-Sum', `X-Sum ${params.value} at ${params.cell}`, board, { subboards: subboards, cells: sumCells.slice() });
    });
}
