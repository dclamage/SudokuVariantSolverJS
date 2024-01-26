import { Board, ReadonlyBoard } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, CellIndex, CellMask, cellIndexFromName, maxValue, minValue } from '../SolveUtility';
import { CardinalityConstraint } from './CardinalityConstraint';
import { Constraint, ConstraintResult, InitResult, LogicalDeduction } from './Constraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint, generateLEWeakLinks, generateNEqWeakLinks } from './WeakLinksConstraint';

class RenbanConstraint extends Constraint {
    cells: CellIndex[];
    alreadyAddedCardinalityConstraints: Uint8Array;

    constructor(board: Board, params: { cells: CellIndex[] }, constraintName: string, specificName: string) {
        super(constraintName, specificName);
        this.cells = params.cells.slice();
        // TODO: When cardinality constraints can be added natively to the board, we should be able to deduplicate better
        this.alreadyAddedCardinalityConstraints = new Uint8Array(board.size + 1);
    }

    init(board: Board): InitResult {
        const weakLinks: [CandidateIndex, CandidateIndex][] = [];
        for (let i = 0; i < this.cells.length - 1; ++i) {
            for (let j = i + 1; j < this.cells.length; ++j) {
                weakLinks.push(...generateLEWeakLinks(board.size, this.cells[i], this.cells[j], this.cells.length - 1));
                weakLinks.push(...generateLEWeakLinks(board.size, this.cells[j], this.cells[i], this.cells.length - 1));
                // Cells can't be equal either
                weakLinks.push(...generateNEqWeakLinks(board.size, this.cells[i], this.cells[j]));
            }
        }
        const weakLinksConstraint = new WeakLinksConstraint(
            board,
            {
                weakLinks,
            },
            this.toString(),
            this.toSpecificString()
        );

        return {
            result: ConstraintResult.UNCHANGED,
            addConstraints: [weakLinksConstraint],
        };
    }

    // Nothing is obvious, don't implement obviousLogicalStep

    logicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        const deductions: LogicalDeduction[] = [];

        const allCellsMask = this.cells.reduce((acc, cell) => acc | board.cells[cell], 0) & board.allValues;
        const calcMissingDigits = (cellMask: CellMask) => {
            let missingMask = board.allValues & ~cellMask;
            const missingDigits = [];
            while (missingMask > 0) {
                missingDigits.push(minValue(missingMask));
                missingMask &= missingMask - 1;
            }
            return missingDigits;
        };

        let squish = allCellsMask;
        for (let i = 0; i < this.cells.length - 1; ++i) {
            squish &= squish << 1;
        }
        let expand = squish;
        for (let i = 0; i < this.cells.length - 1; ++i) {
            expand |= expand >> 1;
        }

        const elims: CandidateIndex[] = [];
        for (const cell of this.cells) {
            let elimMask = board.cells[cell] & board.allValues & ~expand;
            while (elimMask > 0) {
                const value = minValue(elimMask);
                elimMask &= elimMask - 1;
                elims.push(board.candidateIndex(cell, value));
            }
        }

        if (elims.length > 0) {
            const missingDigits = calcMissingDigits(allCellsMask);
            const impossibleDigits = calcMissingDigits(~allCellsMask | expand);
            deductions.push({
                explanation: `Missing ${missingDigits.join(',')} implies ${
                    impossibleDigits.length > 1
                        ? `digits ${impossibleDigits.join(',')} are impossible`
                        : `digit ${impossibleDigits.join(',')} is impossible`
                }`,
                eliminations: elims,
            });
        }

        const minRequired = maxValue(allCellsMask) - this.cells.length + 1;
        const maxRequired = minValue(allCellsMask) + this.cells.length - 1;
        for (let requiredDigit = minRequired; requiredDigit <= maxRequired; ++requiredDigit) {
            if (!this.alreadyAddedCardinalityConstraints[requiredDigit]) {
                this.alreadyAddedCardinalityConstraints[requiredDigit] = 1;
                deductions.push({
                    explanation: `${this.cells.length}-long renban with digits restricted between ${minRequired} and ${maxRequired} requires a ${requiredDigit} on it`,
                    addConstraints: [
                        new CardinalityConstraint('Renban', `${this.toSpecificString()} requires a ${requiredDigit}`, board, {
                            candidates: this.cells.map(cell => board.candidateIndex(cell, requiredDigit)),
                            allowedCounts: [1],
                        }),
                    ],
                });
            }
        }

        return deductions;
    }

    bruteForceStep(board: ReadonlyBoard): ConstraintResult {
        const allCellsMask = this.cells.reduce((acc, cell) => acc | board.cells[cell], 0) & board.allValues;

        let squish = allCellsMask;
        for (let i = 0; i < this.cells.length - 1; ++i) {
            squish &= squish << 1;
        }
        let expand = squish;
        for (let i = 0; i < this.cells.length - 1; ++i) {
            expand |= expand >> 1;
        }

        let changed = ConstraintResult.UNCHANGED;
        const result = board.newApplyCellMasks(
            this.cells,
            Array.from({ length: this.cells.length }, () => expand)
        );
        if (result === ConstraintResult.INVALID) return ConstraintResult.INVALID;
        if (result === ConstraintResult.CHANGED) changed = ConstraintResult.CHANGED;
        return changed;
    }
}

// TODO: Convert Renban lines to scripted, not all logic can be found using just weak links,
//       namely that eliminating 4 from a 4 cell renban should eliminate 123 as well.
export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('renban', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            return new RenbanConstraint(board, { cells }, 'Renban', `Renban at ${line[0]}`);
        })
    );
}
