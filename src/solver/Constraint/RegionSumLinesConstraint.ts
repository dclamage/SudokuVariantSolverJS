import { Board, Region } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, cellIndexFromName, cellName } from '../SolveUtility';
import { EqualSumConstraint } from './EqualSumConstraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('regionsumline', (board: Board, params: FPuzzlesLines) =>
        params.lines.flatMap(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            const segments = [];
            let currentSegment: CellIndex[] = [];
            let currentRegion: Region | null = null;
            for (const cell of cells) {
                const cellRegions = board.getRegionsForCell(cell, 'region');
                if (cellRegions.length === 0) {
                    // Ignore cells that are regionless
                    continue;
                }
                const cellRegion = cellRegions[0];
                if (currentRegion !== cellRegion) {
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment);
                    }
                    currentSegment = [cell];
                    currentRegion = cellRegion;
                } else {
                    currentSegment.push(cell);
                }
            }
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }

            // If there is one or fewer segments, this constraint is useless
            if (segments.length <= 1) {
                return [];
            }

            const specificName = `Region Sum Line at ${cellName(cells[0], board.size)}`;
            return [new EqualSumConstraint('Region Sum Line', specificName, board, { cells: segments })];
        })
    );
}
