import { cellIndexFromName, cellName, minValue, valueBit, valuesList, removeDuplicates } from '../SolveUtility';
import { SumCellsHelper } from '../SumCellsHelper';
import { Constraint, ConstraintResult } from './Constraint';

export class ArrowSumConstraint extends Constraint {
    constructor(board, params) {
        const circleCells = params.circleCells.map(cellName => cellIndexFromName(cellName, board.size));
        const arrowCells = params.arrowCells.map(cellName => cellIndexFromName(cellName, board.size));
        const allCells = [...circleCells, ...arrowCells];

        const specificName = `Arrow at ${cellName(circleCells[0], board.size)}`;
        super(board, 'Arrow', specificName);

        this.circleCells = circleCells;

        this.arrowCells = arrowCells;
        this.arrowCellsSum = new SumCellsHelper(board, arrowCells);

        this.allCells = allCells;
        this.allCellsSet = new Set(allCells);
    }

    init(board, isRepeat) {
        if (this.arrowCells.length === 1 && this.circleCells.length === 1) {
            return this.initClone(board, isRepeat);
        }

        if (this.circleCells.length === 1) {
            return this.initCircle(board, isRepeat);
        }

        return this.initPill(board, isRepeat);
    }

    initClone(board, isRepeat) {
        if (!isRepeat) {
            const circleCell = this.circleCells[0];
            const arrowCell = this.arrowCells[0];
            board.addCloneWeakLinks(circleCell, arrowCell);
        }
        return ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    initCircle(board, isRepeat) {
        const { size } = board;
        const circleCell = this.circleCells[0];
        const circleCellMask = board.cells[circleCell];

        let changed = false;

        // Determine the possible sum ranges for the arrow cells
        const possibleSums = this.arrowCellsSum.possibleSums(board).filter(sum => sum <= size);
        if (possibleSums.length === 0) {
            return ConstraintResult.INVALID;
        }
        const possibleSumsMask = possibleSums.reduce((mask, sum) => mask | valueBit(sum), 0);
        if ((circleCellMask & possibleSumsMask) === 0) {
            return ConstraintResult.INVALID;
        }

        const newCircleCellMask = circleCellMask & possibleSumsMask;
        if (newCircleCellMask !== circleCellMask) {
            const keepResult = board.keepCellMask(circleCell, newCircleCellMask);
            if (keepResult === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            changed = changed || keepResult === ConstraintResult.CHANGED;
        }

        // Go through each possible circle value and add weak links to the arrow cells which
        // Cannot contribute to that sum.
        const newArrowMasks = new Array(this.arrowCells.length).fill(0);
        let circleCellMaskRemaining = newCircleCellMask;
        while (circleCellMaskRemaining !== 0) {
            const circleValue = minValue(circleCellMaskRemaining);
            circleCellMaskRemaining &= ~valueBit(circleValue);

            // Clone the board so as to not modify the original
            const boardClone = board.clone();

            // Remove all constraints from the clone
            boardClone.constraints = [];
            boardClone.constraintsFinalized = true;

            // Set this sum as a given
            if (!boardClone.setAsGiven(circleCell, circleValue)) {
                continue;
            }

            // Run the logical step on the clone as if it was this sum
            const logicStepResult = this.arrowCellsSum.logicStep(boardClone, [circleValue], null);
            if (logicStepResult === ConstraintResult.INVALID) {
                continue;
            }

            // Update the arrow masks
            for (let i = 0; i < this.arrowCells.length; i++) {
                const arrowCell = this.arrowCells[i];
                newArrowMasks[i] |= boardClone.cells[arrowCell] & board.allValues;
            }

            if (logicStepResult !== ConstraintResult.CHANGED) {
                continue;
            }

            // Determine which candidates were eliminated
            const circleCandidate = board.candidateIndex(circleCell, circleValue);
            for (let arrowCell of this.arrowCells) {
                const oldMask = board.cells[arrowCell] & ~board.allValues;
                const newMask = boardClone.cells[arrowCell] & ~board.allValues;
                let eliminatedMask = oldMask & ~newMask;
                while (eliminatedMask !== 0) {
                    const eliminatedValue = minValue(eliminatedMask);
                    eliminatedMask &= ~valueBit(eliminatedValue);

                    // Add a weak link between this arrow cell value and the eliminated value
                    const arrowCandidate = board.candidateIndex(arrowCell, eliminatedValue);
                    board.addWeakLink(arrowCandidate, circleCandidate);
                }
            }
        }

        // Update the arrow cells
        for (let i = 0; i < this.arrowCells.length; i++) {
            const arrowCell = this.arrowCells[i];
            const newArrowMask = newArrowMasks[i];
            if (newArrowMask === 0) {
                return ConstraintResult.INVALID;
            }

            const keepResult = board.keepCellMask(arrowCell, newArrowMask);
            if (keepResult === ConstraintResult.INVALID) {
                return ConstraintResult.INVALID;
            }
            changed = changed || keepResult === ConstraintResult.CHANGED;
        }

        return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    initPill(board, isRepeat) {
        const [sumMin, sumMax] = this.arrowCellsSum.sumRange(board);
        const sumMinLength = sumMin.toString().length;
        const sumMaxLength = sumMax.toString().length;

        // 9x9 and smaller is much easier to work with, because the concatination of values can't make awkward two-digit numbers.
        if (board.size <= 9) {
            const numDigits = this.circleCells.length;
            if (sumMaxLength < numDigits) {
                // The maximum sum is too small to fit in the pill
                return ConstraintResult.INVALID;
            }

            if (sumMinLength > numDigits) {
                // The minimum sum is too large to fit in the pill
                return ConstraintResult.INVALID;
            }

            // The leading digit of the min and max sums limit the digits that can go in the first cell
            const minSumLeadingDigit = Math.max(Math.floor(sumMin / Math.pow(10, numDigits - 1)), 1);
            const maxSumLeadingDigit = Math.min(Math.floor(sumMax / Math.pow(10, numDigits - 1)), board.size);
            if (maxSumLeadingDigit < minSumLeadingDigit) {
                return ConstraintResult.INVALID;
            }

            const firstCircleCell = this.circleCells[0];
            const keepResult = board.keepCellMask(firstCircleCell, board.maskBetweenInclusive(minSumLeadingDigit, maxSumLeadingDigit));
            return keepResult;
        }

        const maxDigitLength = board.size.toString().length;
        const minNumDigits = this.circleCells.length;
        const maxNumDigits = this.circleCells.length * maxDigitLength;
        if (sumMaxLength < minNumDigits) {
            // The maximum sum is too small to fit in the pill
            return ConstraintResult.INVALID;
        }

        if (sumMinLength > maxNumDigits) {
            // The minimum sum is too large to fit in the pill
            return ConstraintResult.INVALID;
        }

        return ConstraintResult.UNCHANGED;
    }

    // eslint-disable-next-line no-unused-vars
    enforce(board, cellIndex, value) {
        // Clones are enforced entirely by weak links
        if (this.arrowCells.length === 1 && this.circleCells.length === 1) {
            return true;
        }

        // Only react if the cell is part of the constraint
        if (!this.allCellsSet.has(cellIndex)) {
            return true;
        }

        // If all cells are given, then check the exact sum
        if (this.allCells.every(cell => board.isGiven(cell))) {
            const circleValue = this.getCircleValue(board);
            const arrowSum = this.getArrowSum(board);
            return circleValue === arrowSum;
        }

        // If the circle value is known, ensure the current arrow sum does not exceed it in a quick and dirty way
        if (this.circleCells.every(cell => board.isGiven(cell))) {
            const circleValue = this.getCircleValue(board);
            const arrowSum = this.getArrowSum(board);
            return arrowSum <= circleValue;
        }

        return true;
    }

    logicStep(board, logicalStepDescription) {
        if (this.arrowCells.length === 1) {
            // Clones are enforced entirely by weak links
            return ConstraintResult.UNCHANGED;
        }

        if (this.circleCells.length === 1) {
            return this.logicStepCircle(board, logicalStepDescription);
        }

        return this.logicStepPill(board, logicalStepDescription);
    }

    logicStepCircle(board, logicalStepDescription) {
        const circleCell = this.circleCells[0];
        const circleCellMask = board.cells[circleCell];

        const circleCellGiven = board.isGiven(circleCell);
        const arrowCellsGiven = this.arrowCells.every(cell => board.isGiven(cell));
        if (circleCellGiven && arrowCellsGiven) {
            // Done: enforce should have already verified the sum.
            return ConstraintResult.UNCHANGED;
        }

        // If the arrow sum is known, then the circle value must be that value
        if (arrowCellsGiven) {
            const arrowSum = this.getArrowSum(board);
            const arrowSumMask = valueBit(arrowSum) & board.allValues;
            const keepResult = board.keepCellMask(circleCell, arrowSumMask);
            if (keepResult === ConstraintResult.INVALID) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Arrow sum of ${arrowSum} cannot be filled into the circle.`);
                }
                return ConstraintResult.INVALID;
            }

            if (keepResult === ConstraintResult.CHANGED) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Arrow sum is known. ${cellName(circleCell, board.size)} = ${arrowSum}.`);
                }
                return ConstraintResult.CHANGED;
            }

            return ConstraintResult.UNCHANGED;
        }

        // Make the arrow sum conform to the possible circle values
        const circleValues = valuesList(circleCellMask & board.allValues);
        const sumStepResult = this.arrowCellsSum.logicStep(board, circleValues, logicalStepDescription);
        if (sumStepResult !== ConstraintResult.UNCHANGED) {
            // logicStep already added a description
            return sumStepResult;
        }

        // Make the circle values conform to the possible arrow sums
        const possibleSums = this.arrowCellsSum.possibleSums(board).filter(sum => sum <= board.size);
        const possibleSumsMask = possibleSums.reduce((mask, sum) => mask | valueBit(sum), 0);
        const newCircleCellMask = circleCellMask & possibleSumsMask;
        if (newCircleCellMask !== circleCellMask) {
            const keepResult = board.keepCellMask(circleCell, newCircleCellMask);
            if (keepResult === ConstraintResult.INVALID) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Arrow sum cannot be filled into the circle.`);
                }
                return ConstraintResult.INVALID;
            }

            if (keepResult === ConstraintResult.CHANGED) {
                if (logicalStepDescription) {
                    const elims = valuesList(circleCellMask & ~newCircleCellMask & board.allValues).map(value =>
                        board.candidateIndex(circleCell, value)
                    );
                    logicalStepDescription.push(`${board.describeElims(elims)}.`);
                }
                return ConstraintResult.CHANGED;
            }
        }

        return ConstraintResult.UNCHANGED;
    }

    logicStepPill(board, logicalStepDescription) {
        const circleCellGiven = board.isGiven(this.circleCell);
        const arrowCellsGiven = this.arrowCells.every(cell => board.isGiven(cell));
        if (circleCellGiven && arrowCellsGiven) {
            // Done: enforce should have already verified the sum.
            return ConstraintResult.UNCHANGED;
        }

        const possiblePillValues = removeDuplicates(
            this.getPillSums(board, 0, '')
                .map(val => parseInt(val, 10))
                .sort((a, b) => a - b)
        );

        // Make the arrow sum conform to the possible pill values
        const sumStepResult = this.arrowCellsSum.logicStep(board, possiblePillValues, logicalStepDescription);
        if (sumStepResult !== ConstraintResult.UNCHANGED) {
            // logicStep already added a description
            return sumStepResult;
        }

        // If the arrow sum is known, then force the pill values to be that value
        if (arrowCellsGiven) {
            const arrowSum = this.getArrowSum(board);

            // Generate all ways to fill the pill
            const possiblePillValues = this.getPillValuesForSum(board, arrowSum.toString());
            if (possiblePillValues.length === 0) {
                if (logicalStepDescription) {
                    logicalStepDescription.push(`Arrow sum of ${arrowSum} cannot be filled into the pill.`);
                }
                return ConstraintResult.INVALID;
            }

            // Keep only the possible pill values
            const possiblePillValuesMask = new Array(this.circleCells.length).fill(0);
            for (let i = 0; i < this.circleCells.length; i++) {
                for (let possiblePillValue of possiblePillValues) {
                    possiblePillValuesMask[i] |= valueBit(possiblePillValue[i]);
                }
            }

            let changed = false;
            const elims = [];
            for (let i = 0; i < this.circleCells.length; i++) {
                const circleCell = this.circleCells[i];
                const originalMask = board.cells[circleCell] & board.allValues;
                const keepMask = possiblePillValuesMask[i] & board.allValues;
                const keepResult = board.keepCellMask(circleCell, keepMask);
                if (keepResult === ConstraintResult.INVALID) {
                    if (logicalStepDescription) {
                        logicalStepDescription.push(`Arrow sum of ${arrowSum} cannot be filled into the pill.`);
                    }
                    return ConstraintResult.INVALID;
                }

                if (keepResult === ConstraintResult.CHANGED) {
                    if (logicalStepDescription) {
                        const elimMask = originalMask & ~keepMask;
                        if (elimMask !== 0) {
                            elims.push(...valuesList(elimMask).map(value => board.candidateIndex(circleCell, value)));
                        }
                    }
                    changed = true;
                }
            }

            if (logicalStepDescription && elims.length > 0) {
                logicalStepDescription.push(`Arrow sum is known. ${board.describeElims(elims)}.`);
            }

            return changed ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
        }

        return ConstraintResult.UNCHANGED;
    }

    getPillSums(board, circleIndex, sumPrefix = '') {
        if (circleIndex >= this.circleCells.length) {
            return [sumPrefix];
        }

        const sums = [];
        const circleCell = this.circleCells[circleIndex];
        let circleCellMask = board.cells[circleCell] & board.allValues;
        while (circleCellMask !== 0) {
            const circleValue = minValue(circleCellMask);
            circleCellMask &= ~valueBit(circleValue);

            const newPrefix = sumPrefix + circleValue.toString();
            const curSums = this.getPillSums(board, circleIndex + 1, newPrefix);
            sums.push(...curSums);
        }

        return sums;
    }

    getPillValuesForSum(board, sumStr, circleIndex = 0, sumValues = []) {
        if (circleIndex >= this.circleCells.length) {
            if (sumStr === sumValues.join('')) {
                return [sumValues];
            }
            return [];
        }

        const sums = [];
        const circleCell = this.circleCells[circleIndex];
        let circleCellMask = board.cells[circleCell] & board.allValues;
        while (circleCellMask !== 0) {
            const circleValue = minValue(circleCellMask);
            circleCellMask &= ~valueBit(circleValue);

            const newSumValues = [...sumValues, circleValue];
            if (sumStr.startsWith(newSumValues.join(''))) {
                const curSums = this.getPillValuesForSum(board, sumStr, circleIndex + 1, newSumValues);
                sums.push(...curSums);
            }
        }

        return sums;
    }

    getCircleValue(board) {
        if (this.circleCells.length === 1) {
            return minValue(board.cells[this.circleCells[0]]);
        }

        const circleValue = this.circleCells.reduce((acc, circleCell) => acc + minValue(board.cells[circleCell]).toString(), '');
        return parseInt(circleValue, 10);
    }

    getArrowSum(board) {
        let arrowSum = 0;
        for (let arrowCell of this.arrowCells) {
            arrowSum += minValue(board.cells[arrowCell]);
        }
        return arrowSum;
    }
}

export function register(constraintBuilder) {
    constraintBuilder.registerConstraint('arrow', (board, params) => {
        const constraints = [];
        for (let line of params.lines) {
            const arrowParams = {
                circleCells: params.cells,
                arrowCells: line.slice(1),
            };
            constraints.push(new ArrowSumConstraint(board, arrowParams));
        }
        return constraints;
    });
}
