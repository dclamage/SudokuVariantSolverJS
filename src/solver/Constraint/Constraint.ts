import { Board } from '../Board';
import { CellCoords, CellIndex, CellValue } from '../SolveUtility';

// Reflects what has happened to the board
export enum ConstraintResult {
    UNCHANGED,
    CHANGED,
    INVALID,
}

export type InitResult = ConstraintResult | { result: ConstraintResult; addConstraints?: Constraint[]; deleteConstraints?: Constraint[] };

// Convenience class that constraint states can inherit from if they only need to be shallow-cloned
export class ConstraintState {
    clone(): ConstraintState {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
}

export class Constraint {
    constraintName: string;
    specificName: string;

    // The constraintName is a string that is used to identify the constraint
    // The specificName is a string that is specific to this constraint instance
    // board should NOT be modified at this time. Initialization should happen in `init` instead.
    constructor(board: Board, constraintName: string, specificName: string) {
        this.constraintName = constraintName;
        this.specificName = specificName;
    }

    // Returns the name of the constraint
    toString(): string {
        return this.constraintName;
    }

    // Returns a string that is specific to this constraint instance
    toSpecificString(): string {
        return this.specificName;
    }

    // Initialize the constraint on the board, which may modify the board
    // Adding weak links should be done here
    // Returns an InitResult, which is either a ConstraintResult or an object of the form:
    //  { result: ConstraintResult;
    //    addConstraints?: Constraint[];
    //    deleteConstraints?: Constraint[];
    //  }
    // init is called repeatedly on every constraint until all constraints return ConstraintResult.UNCHANGED
    //  - This allows constraints to interact with each other
    //  - isRepeat is true if this is not the first time init has been called on this constraint
    // Never call board.setAsGiven from init as not all weak links have been added yet, so they may not be respected.
    //  - Instead, use board.keepCellMask(cell, valueBit(value)) so that it will be a naked single at the appropriate time.
    init(board: Board, isRepeat: boolean): InitResult {
        return ConstraintResult.UNCHANGED;
    }

    // Final initialization of the constraint on the board, which may NOT modify the board
    // finalize is called after all constraints have successfully been inited, so constraints may, for example, assume all weak links have been added.
    // The returned ConstraintResult must not be CHANGED, as it may not modify the board.
    // Constraints may not be added here. However, as an exception, constraints may be deleted here.
    //  { result: ConstraintResult;
    //    deleteConstraints?: Constraint[];
    //  }
    finalize(board: Board): InitResult {
        return ConstraintResult.UNCHANGED;
    }

    // Triggers when a value is set in a cell
    // Return true if the constraint is still satisfiable (false means the constraint is violated).
    // Do not modify the board (it cannot be reported to the user)
    enforce(board: Board, cellIndex: CellIndex, value: CellValue): boolean {
        return true;
    }

    // Triggers when a candidate is eliminated from a cell
    // Return true if the constraint is still satisfiable (false means the constraint is violated).
    // Do not modify the board (it cannot be reported to the user)
    enforceCandidateElim(board: Board, cellIndex: CellIndex, value: CellValue): boolean {
        return true;
    }

    // Perform a logic step on the board, which may modify the board
    // logicalStepDescription is an optional array of strings that will be filled with a description of the logic step
    // This is used to report the logic step to the user
    // Returns a ConstraintResult
    logicStep(board: Board, logicalStepDescription: string[]): ConstraintResult {
        return ConstraintResult.UNCHANGED;
    }

    // Clone the constraint such that it can be backtracked
    // If the constraint is stateless (most are), then you do not need to override this.
    clone(): Constraint {
        return this;
    }

    // Release any resources held by the constraint
    release() {}

    // Utility functions
    getOffset(board: Board, cellIndex1: number, cellIndex2: number): CellCoords {
        const { row: row1, col: col1 } = board.cellCoords(cellIndex1);
        const { row: row2, col: col2 } = board.cellCoords(cellIndex2);
        return { row: row2 - row1, col: col2 - col1 };
    }

    getAbsoluteOffset(board: Board, cellIndex1: CellIndex, cellIndex2: CellIndex) {
        const { row: row1, col: col1 } = board.cellCoords(cellIndex1);
        const { row: row2, col: col2 } = board.cellCoords(cellIndex2);
        return [Math.abs(row2 - row1), Math.abs(col2 - col1)];
    }
}
