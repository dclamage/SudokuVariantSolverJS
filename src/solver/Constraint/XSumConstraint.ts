import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellName, valueBit } from '../SolveUtility';
import { FPuzzlesCell } from './FPuzzlesInterfaces';
import { FixedSumConstraint } from './FixedSumConstraint';
import { OrConstraint } from './OrConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('xsum', (board: Board, params: FPuzzlesCell) => {
        let initialCellIndex = 0;
        let directionAsCellIndexOffset = 0;

        const coordStrs = params.cell.split('C');
        coordStrs[0] = coordStrs[0].slice(1);
        const coords = coordStrs.map(c => parseInt(c, 10));
        if (coords[0] === 0) {
            // Top x-sum
            initialCellIndex = coords[1] - 1;
            directionAsCellIndexOffset = board.size;
        } else if (coords[0] === board.size + 1) {
            // Bottom x-sum
            initialCellIndex = (board.size - 1) * board.size + coords[1] - 1;
            directionAsCellIndexOffset = -board.size;
        } else if (coords[1] === 0) {
            // Left x-sum
            initialCellIndex = (coords[0] - 1) * board.size;
            directionAsCellIndexOffset = 1;
        } else if (coords[1] === board.size + 1) {
            // Right x-sum
            initialCellIndex = (coords[0] - 1) * board.size + board.size - 1;
            directionAsCellIndexOffset = -1;
        }

        if (directionAsCellIndexOffset === 0) {
            throw new Error('Invalid X-sum location');
        }

        const sumCells: string[] = [];
        const subboards: Board[] = [];
        for (let digit = 1, cellIndex = initialCellIndex; digit <= board.size; ++digit, cellIndex += directionAsCellIndexOffset) {
            sumCells.push(cellName(cellIndex, board.size));

            const subboard = board.subboardClone();

            // In the ith branch, the first cell of the xsum has value i
            subboard.keepCellMask(initialCellIndex, valueBit(digit));
            // And the first i cells sum to the given total
            subboard.addConstraint(
                new FixedSumConstraint(`Hypothetical X-Sum`, `Hypothetical X-Sum ${params.value} at ${params.cell} if X = ${digit}`, subboard, {
                    cells: sumCells,
                    sum: parseInt(params.value, 10),
                })
            );

            subboards.push(subboard);
        }

        return new OrConstraint('X-Sum', `X-Sum ${params.value} at ${params.cell}`, board, { subboards: subboards });
    });
}
