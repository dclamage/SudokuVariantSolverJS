import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { CandidateIndex, CellIndex, CellMask, cellIndexFromName, cellName, maxValue, minValue } from '../SolveUtility';
import { CardinalityConstraint } from './CardinalityConstraint';
import { Constraint, ConstraintResult, InitResult } from './Constraint';
import { FPuzzlesLines } from './FPuzzlesInterfaces';
import { WeakLinksConstraint, generateLEWeakLinks, generateNEqWeakLinks } from './WeakLinksConstraint';

class RenbanConstraint extends Constraint {
    lineName: string;
    cells: CellIndex[];
    alreadyAddedCardinalityConstraints: Uint8Array;

    constructor(board: Board, params: { cells: CellIndex[] }, lineName: string, constraintName: string, specificName: string) {
        super(board, constraintName, specificName);
        this.lineName = lineName;
        this.cells = params.cells.slice();
        // TODO: When cardinality constraints can be added natively to the board, we should be able to deduplicate better
        this.alreadyAddedCardinalityConstraints = new Uint8Array(board.size + 1);
    }

    init(board: Board, isRepeat: boolean): InitResult {
        let changed = ConstraintResult.UNCHANGED;
        const newConstraints: Constraint[] = [];
        if (!isRepeat) {
            const weakLinks: [CandidateIndex, CandidateIndex][] = [];
            for (let i = 0; i < this.cells.length - 1; ++i) {
                for (let j = i + 1; j < this.cells.length; ++j) {
                    weakLinks.push(...generateLEWeakLinks(board.size, this.cells[i], this.cells[j], this.cells.length));
                    weakLinks.push(...generateLEWeakLinks(board.size, this.cells[j], this.cells[i], this.cells.length));
                    // Cells can't be equal either
                    weakLinks.push(...generateNEqWeakLinks(board.size, this.cells[i], this.cells[j]));
                }
            }
            newConstraints.push(
                new WeakLinksConstraint(
                    board,
                    {
                        weakLinks,
                    },
                    this.toString(),
                    this.toSpecificString()
                )
            );
        }

        newConstraints.push(...this.findCardinalityConstraints(board));

        return {
            result: changed,
            addConstraints: newConstraints.length > 0 ? newConstraints : undefined,
        };
    }

    logicStep(board: Board, logicalStepDescription: string[]): ConstraintResult {
        const allCellsMask = this.cells.reduce((acc, cell) => acc | board.cells[cell], 0) & board.allValues;
        const calcMissingDigits = (cellMask: CellMask) => {
            let missingMask = board.allValues & ~cellMask;
            let missingDigits = [];
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
        let changed = ConstraintResult.UNCHANGED;
        const elims: CandidateIndex[] = logicalStepDescription === null ? null : [];
        for (const cell of this.cells) {
            const origMask = board.cells[cell];
            const res = board.keepCellMask(cell, expand);
            if (res === ConstraintResult.CHANGED) {
                changed = ConstraintResult.CHANGED;
                if (logicalStepDescription !== null) {
                    let elimMask = origMask & ~board.cells[cell];
                    while (elimMask > 0) {
                        const value = minValue(elimMask);
                        elimMask &= elimMask - 1;
                        elims.push(board.candidateIndex(cell, value));
                    }
                }
            } else if (res === ConstraintResult.INVALID) {
                if (logicalStepDescription !== null) {
                    logicalStepDescription.push(
                        `Missing ${calcMissingDigits(allCellsMask).join(',')} => eliminated all candidates from ${cellName(
                            cell,
                            board.size
                        )}, contradiction.`
                    );
                }
                return ConstraintResult.INVALID;
            }
        }

        if (logicalStepDescription !== null && changed) {
            const missingDigits = calcMissingDigits(allCellsMask);
            const impossibleDigits = calcMissingDigits(~allCellsMask | expand);
            logicalStepDescription.push(
                `Missing ${missingDigits.join(',')} => ${
                    impossibleDigits.length > 1
                        ? `digits ${impossibleDigits.join(',')} are impossible`
                        : `digit ${impossibleDigits.join(',')} is impossible`
                }: ${board.describeElims(elims)}.`
            );
        }

        return changed;
    }

    findCardinalityConstraints(board: Board) {
        const allCellsMask = this.cells.reduce((acc, cell) => acc | (board.cells[cell] & board.allValues), 0);
        const minRequired = maxValue(allCellsMask) - this.cells.length + 1;
        const maxRequired = minValue(allCellsMask) + this.cells.length - 1;
        const newCardinalityConstraints: Constraint[] = [];
        for (let requiredDigit = minRequired; requiredDigit <= maxRequired; ++requiredDigit) {
            if (!this.alreadyAddedCardinalityConstraints[requiredDigit]) {
                this.alreadyAddedCardinalityConstraints[requiredDigit] = 1;
                newCardinalityConstraints.push(
                    new CardinalityConstraint('Renban', `Renban requires ${requiredDigit} on ${this.lineName}`, board, {
                        candidates: this.cells.map(cell => board.candidateIndex(cell, requiredDigit)),
                        allowedCounts: [1],
                    })
                );
            }
        }
        return newCardinalityConstraints;
    }
}

// TODO: Convert Renban lines to scripted, not all logic can be found using just weak links,
//       namely that eliminating 4 from a 4 cell renban should eliminate 123 as well.
export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('renban', (board: Board, params: FPuzzlesLines) =>
        params.lines.map(line => {
            const cells = line.map(cellName => cellIndexFromName(cellName, board.size));
            return new RenbanConstraint(board, { cells }, `${line[0]}-${line[line.length - 1]}`, 'Renban', `Renban at ${line[0]}`);
        })
    );
}
