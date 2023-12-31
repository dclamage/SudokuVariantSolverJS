import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex } from '../SolveUtility';
import { RegionConstraint } from './RegionConstraint';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerBooleanConstraint('disjointgroups', (board: Board) => {
        const { size } = board;

        const regions = board.getRegionsForType('region').filter(region => region.cells.length === size && region.fromConstraint === null);
        if (regions.length !== size) {
            throw new Error('Disjoint Groups constraint requires the same number of regions as the board size');
        }

        const disjointCells: CellIndex[][] = new Array(size);
        for (let i = 0; i < size; ++i) {
            disjointCells.push([]);
        }

        for (const region of regions) {
            for (let i = 0; i < size; ++i) {
                disjointCells[i].push(region.cells[i]);
            }
        }

        const constraints: RegionConstraint[] = new Array(size);
        for (let i = 0; i < size; ++i) {
            constraints[i] = new RegionConstraint(board, { cells: disjointCells[i] }, `Disjoint Group ${i + 1}`, `Disjoint Group ${i + 1}`);
        }
        return constraints;
    });
}
