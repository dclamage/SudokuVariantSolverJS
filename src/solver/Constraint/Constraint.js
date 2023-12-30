/* eslint-disable no-unused-vars */

// Reflects what has happened to the board
export const ConstraintResult = Object.freeze({
    UNCHANGED: 0,
    CHANGED: 1,
    INVALID: 2,
});

// Convenience class that constraint states can inherit from if they only need to be shallow-cloned
export class ConstraintState {
    clone() {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
}

export class Constraint {
    // The constraintName is a string that is used to identify the constraint
    // The specificName is a string that is specific to this constraint instance
    // board should NOT be modified at this time. Initialization should happen in `init` instead.
    constructor(board, constraintName, specificName) {
        this.constraintName = constraintName;
        this.specificName = specificName;
    }

    // Returns the name of the constraint
    toString() {
        return this.constraintName;
    }

    // Returns a string that is specific to this constraint instance
    toSpecificString() {
        return this.specificName;
    }

    // Initialize the constraint on the board, which may modify the board
    // Adding weak links should be done here
    // Returns a ConstraintResult
    // init is called repeatedly on every constraint until all constraints return ConstraintResult.UNCHANGED
    //  - This allows constraints to interact with each other
    //  - isRepeat is true if this is not the first time init has been called on this constraint
    // Never call board.setAsGiven from init as not all weak links have been added yet, so they may not be respected.
    //  - Instead, use board.keepCellMask(cell, valueBit(value)) so that it will be a naked single at the appropriate time.
    init(board, isRepeat) {
        return ConstraintResult.UNCHANGED;
    }

    // Final initialization of the constraint on the board, which may NOT modify the board
    // finalize is called after all constraints have successfully been inited, so constraints may, for example, assume all weak links have been added.
    // Returns either ConstraintResult.UNCHANGED or ConstraintResult.INVALID
    finalize(board) {
        return ConstraintResult.UNCHANGED;
    }

    // Triggers when a value is set in a cell
    // Return true if the constraint is still satisfiable (false means the constraint is violated).
    // Do not modify the board (it cannot be reported to the user)
    enforce(board, cellIndex, value) {
        return true;
    }

    // Triggers when a candidate is eliminated from a cell
    // Return true if the constraint is still satisfiable (false means the constraint is violated).
    // Do not modify the board (it cannot be reported to the user)
    enforceCandidateElim(board, cellIndex, value) {
        return true;
    }

    // Perform a logic step on the board, which may modify the board
    // logicalStepDescription is an optional array of strings that will be filled with a description of the logic step
    // This is used to report the logic step to the user
    // Returns a ConstraintResult
    logicStep(board, logicalStepDescription) {
        return ConstraintResult.UNCHANGED;
    }

    // Clone the constraint such that it can be backtracked
    // If the constraint is stateless (most are), then you do not need to override this.
    clone() {
        return this;
    }

    // Utility functions
    taxiCabDistance(cellCoords1, cellCoords2) {
        const [row1, col1] = cellCoords1;
        const [row2, col2] = cellCoords2;
        return Math.abs(row1 - row2) + Math.abs(col1 - col2);
    }

    isAdjacent(cellCoords1, cellCoords2) {
        return this.taxiCabDistance(cellCoords1, cellCoords2) === 1;
    }

    isDiagonal(cellCoords1, cellCoords2) {
        return this.taxiCabDistance(cellCoords1, cellCoords2) === 2;
    }

    getOffset(cellIndex1, cellIndex2) {
        const [row1, col1] = this.cellCoords(cellIndex1);
        const [row2, col2] = this.cellCoords(cellIndex2);
        return [row2 - row1, col2 - col1];
    }

    getAbsoluteOffset(cellIndex1, cellIndex2) {
        const [row1, col1] = this.cellCoords(cellIndex1);
        const [row2, col2] = this.cellCoords(cellIndex2);
        return [Math.abs(row2 - row1), Math.abs(col2 - col1)];
    }
}
