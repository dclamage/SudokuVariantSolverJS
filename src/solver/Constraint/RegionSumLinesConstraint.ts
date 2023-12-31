import { Board, Region } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CellIndex, CellValue, cellIndexFromName, cellName, minValue, valueBit } from '../SolveUtility';
import { SumGroup } from '../SumGroup';
import { Constraint, ConstraintResult } from './Constraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';

export class RegionSumLinesConstraint extends Constraint {
    cells: CellIndex[];
    cellsSet: Set<CellIndex>;
    segments: CellIndex[][];
    sumGroups?: SumGroup[];

    constructor(board: Board, params: { cells: CellIndex[] }) {
        const cells = params.cells.slice();
        const specificName = `Region Sum Line at ${cellName(cells[0], board.size)}`;
        super(board, 'Region Sum Line', specificName);

        this.cells = cells;
        this.cellsSet = new Set(this.cells);
        this.segments = [];
        this.sumGroups = undefined;
    }

    init(board: Board, isRepeat: boolean) {
        if (!isRepeat) {
            // Split cells into segments
            this.segments.length = 0;
            let currentSegment: CellIndex[] = [];
            let currentRegion: Region | null = null;
            for (const cell of this.cells) {
                const cellRegions = board.getRegionsForCell(cell, 'region');
                if (cellRegions.length === 0) {
                    // Ignore cells that are regionless
                    continue;
                }
                const cellRegion = cellRegions[0];
                if (currentRegion !== cellRegion) {
                    if (currentSegment.length > 0) {
                        this.segments.push(currentSegment);
                    }
                    currentSegment = [cell];
                    currentRegion = cellRegion;
                } else {
                    currentSegment.push(cell);
                }
            }
            if (currentSegment.length > 0) {
                this.segments.push(currentSegment);
            }

            // If there is one or fewer segments, this constraint is useless
            if (this.segments.length <= 1) {
                return ConstraintResult.UNCHANGED;
            }

            // Create a sum helper for each segment
            this.sumGroups = [];
            for (const segment of this.segments) {
                const sumGroup = new SumGroup(board, segment);
                this.sumGroups.push(sumGroup);
            }
        }

        // Get all possible sums
        const possibleSums = RegionSumLinesConstraint.possibleSums(this.sumGroups!, board);
        if (possibleSums.length === 0) {
            return ConstraintResult.INVALID;
        }

        // Restrict all segements to the possible sums
        let changed = false;
        for (const sumHelper of this.sumGroups!) {
            const restrictResult = sumHelper.restrictSums(board, possibleSums);
            if (restrictResult === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            if (restrictResult === ConstraintResult.CHANGED) {
                changed = true;
            }
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board: Board, cellIndex: CellIndex, value: CellValue) {
        if (!this.cellsSet.has(cellIndex)) {
            return true;
        }

        if (!this.sumGroups) {
            return true;
        }

        const possibleSums = RegionSumLinesConstraint.possibleSums(this.sumGroups, board);
        if (possibleSums.length === 0) {
            return false;
        }

        return true;
    }

    logicStep(board: Board, logicalStepDescription: string[]) {
        if (!this.sumGroups) {
            return ConstraintResult.UNCHANGED;
        }

        const possibleSums = RegionSumLinesConstraint.possibleSums(this.sumGroups, board);
        if (possibleSums.length === 0) {
            if (logicalStepDescription) {
                logicalStepDescription.push('No possible sum works for all segments.');
            }
            return ConstraintResult.INVALID;
        }

        let origMasks = null;
        if (logicalStepDescription) {
            origMasks = this.cells.map(cell => board.cells[cell]);
        }

        let changed = false;
        for (const sumGroup of this.sumGroups) {
            const restrictResult = sumGroup.restrictSums(board, possibleSums);
            if (restrictResult === ConstraintResult.INVALID) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(
                        `Cells ${board.compactName(sumGroup.cells)} cannot be restricted to the sum${
                            possibleSums.length === 1 ? '' : 's'
                        } ${possibleSums.join(',')}.`
                    );
                }
                return ConstraintResult.INVALID;
            }
            if (restrictResult === ConstraintResult.CHANGED) {
                changed = true;
            }
        }

        if (changed && logicalStepDescription) {
            const elims = [];
            for (let i = 0; i < this.cells.length; i++) {
                const cell = this.cells[i];
                const origMask = origMasks[i];
                const newMask = board.cells[cell];
                let removedMask = origMask & ~newMask;
                while (removedMask !== 0) {
                    const value = minValue(removedMask);
                    removedMask &= ~valueBit(value);

                    const candidate = board.candidateIndex(cell, value);
                    elims.push(candidate);
                }
            }

            logicalStepDescription.push(
                `Restricted to sum${possibleSums.length === 1 ? '' : 's'} ${possibleSums.join(',')} => ${board.describeElims(elims)}.`
            );
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    static possibleSums(sumGroups: SumGroup[], board: Board) {
        let sums: Set<number> | null = null;
        for (const sumGroup of sumGroups) {
            const possibleSums = sumGroup.possibleSums(board);
            if (possibleSums.length === 0) {
                return [];
            }

            if (sums === null) {
                sums = new Set(possibleSums);
            } else {
                sums = new Set(possibleSums.filter(x => sums!.has(x)));
            }
        }

        if (sums === null) {
            return [];
        }
        return Array.from(sums).sort((a, b) => a - b);
    }
}

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('regionsumline', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => new RegionSumLinesConstraint(board, { cells: line.map(cellName => cellIndexFromName(cellName, board.size)) }))
    );
}
