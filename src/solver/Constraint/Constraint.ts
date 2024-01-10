import { Board, ReadonlyBoard } from '../Board';
import { CandidateIndex, CellCoords, CellIndex, CellValue, Implication, WeakLink } from '../SolveUtility';

// Reflects what has happened to the board
export enum ConstraintResult {
    UNCHANGED,
    CHANGED,
    INVALID,
}

export type ConstraintModification = {
    addConstraints?: Constraint[];
    deleteConstraints?: Constraint[];
    weakLinks?: WeakLink[]; // Redundant, but convenient
    implications?: Implication[];
};

export type InitResult =
    | ConstraintResult
    | (ConstraintModification & {
          result: ConstraintResult;
      });
export type PreprocessingResult = InitResult;

// For constraints that simply wish to de-register themselves because they know no more deductions will ever happen
// (e.g. because they're already satisfied), this allows them to delete themselves without explanation.
export type DeletionOnly = {
    deleteConstraints: Constraint[];

    // Mark the fields as existing so it's not a type error to access them
    explanation?: undefined;
    invalid?: undefined;
    singles?: undefined;
    eliminations?: undefined;
    addConstraints?: undefined;
    weakLinks?: undefined;
    implications?: undefined;
};
export type LogicalDeduction =
    | DeletionOnly
    | ({
          explanation: string;
          invalid?: boolean;
          singles?: CandidateIndex[];
          eliminations?: CandidateIndex[];
      } & ConstraintModification);

// Convenience class that constraint states can inherit from if they only need to be shallow-cloned
export class ConstraintState {
    clone(): ConstraintState {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
}

export class Constraint {
    constraintName: string;
    specificName: string;
    isConstraintV2: true; // Temporary hack that we'll remove once everything is on ConstraintV2

    // The constraintName is a string that is used to identify the constraint
    // The specificName is a string that is specific to this constraint instance
    // board should NOT be modified at this time. Initialization should happen in `init` instead.
    constructor(constraintName: string, specificName: string) {
        this.constraintName = constraintName;
        this.specificName = specificName;
        this.isConstraintV2 = true;
    }

    ///////////////
    // Mandatory //
    ///////////////

    // Implement EITHER or BOTH of:
    //  - enforce
    //  - enforceCandidateElim
    // This is required for conflict detection.
    // Without reporting conflicts at this stage, the brute force solver may accept invalid boards.

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

    //////////////
    // Optional //
    //////////////

    // Deductions and solve tactics
    ///////////////////////////////

    // There are 5 places where you may code deductions for your constraint:
    //
    //  - init: Only add "obvious" deductions that only depend on this constraint and nothing else. Deductions not shown to the user.
    //  - Used during logical solves:
    //    - obviousLogicalStep: "obvious" deductions. Toggleable option whether deductions are shown to the user.
    //    - logicalStep: "non-obvious" deductions. Deductions found here are always shown to the user.
    //  - Used during brute force solves:
    //    - bruteForceStep: deductions that you believe is fast enough and worth running throughout the solve.
    //                      new constraints and weak links may unfortunately not be added here.
    //    - preprocessingStep: any kind of deduction that you believe is worth running at the top of the search tree.
    //
    // By default, `bruteForceStep` and `preprocessingStep` simply call `obviousLogicalStep` and `logicalStep`.
    // If they are particularly slow, this may impact brute force solving performance, so it might be worth overriding
    // `bruteForceStep` and only run a subset of deductions there.
    //
    // All of these are *optional*. Implement the ones that make sense for your constraint!

    // Deductions (eliminations, singles) made here should be directly applied to the board.
    // These deductions should be *obvious* and deducible by simply looking directly at the constraint.
    // For example, a 9 long Thermo on a 9x9 sudoku may set all of its cells to 1-9, and 5s may be eliminated from all cells on a German whisper.
    // Every added constraint is guaranteed to be inited exactly once, whether or not they are removed.
    // Weak links may be added and constraints may be added or removed via the return value (ConstraintModification).
    init(board: Board): InitResult {
        return ConstraintResult.UNCHANGED;
    }

    // Logical solve deductions
    ///////////////////////////

    // "Obvious" logical deductions that may make use of information on the board (givens, current candidates, etc.).
    // Whether "obvious" steps are shown to the user is a toggleable option.
    // These should feel as trivial as striking off obviously conflicting candidates.
    // For example, a 3-cell Thermo whose bulb has been restricted to 789 may restrict the rest of the Thermo to 89 and 9.
    // Weak links may be added and constraints may be added or removed via the return value (ConstraintModification).
    obviousLogicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        return [];
    }

    // Logical deductions that aren't obvious should be implemented here.
    // These deductions are always shown to the user, so if a deduction is particularly trivial, it should be implemented in `obviousLogicalStep`.
    // For example, a 5 cell long Renban on a 9x9 sudoku may add a CardinalityConstraint indicating that there is at least one 5 on the line, here.
    // Weak links may be added and constraints may be added or removed via the return value (ConstraintModification).
    logicalStep(board: ReadonlyBoard): LogicalDeduction[] {
        return [];
    }

    // Deductions suitable for brute forcing should be implemented here, and applied directly to the board.
    // Whether these deductions are humanable does not matter.
    // e.g. fully enumerating all possible sum combinations across 3 different constraints and eliminating impossible candidates is fair game.
    // The more important factor is that these deductions should be fast and worth doing during a solve.
    bruteForceStep(board: Board): ConstraintResult {
        // DEFAULT IMPLEMENTATION
        // ----------------------
        // Run obviousLogicalStep and logicalStep once each and apply whatever is found.
        // As this triggers all the explanation formatting code and potentially runs some expensive deductions,
        // this may be slower than a handwritten bruteForceStep implementation.

        let changed = ConstraintResult.UNCHANGED;
        const deductions = Constraint.flattenDeductions(this.obviousLogicalStep(board).concat(this.logicalStep(board)));
        if (deductions.invalid) {
            return ConstraintResult.INVALID;
        }
        if (deductions.singles && deductions.singles.length > 0) {
            if (!board.enforceCandidates(deductions.singles)) {
                return ConstraintResult.INVALID;
            }
            changed = ConstraintResult.CHANGED;
        }
        if (deductions.eliminations && deductions.eliminations.length > 0) {
            if (!board.clearCandidates(deductions.eliminations)) {
                return ConstraintResult.INVALID;
            }
            changed = ConstraintResult.CHANGED;
        }
        // Don't apply any weak links or constraint modifications in bruteForceStep since that's not allowed here

        return changed;
    }

    // Deductions suitable for preprocessing before brute forcing runs should be implemented here, and singles/eliminations applied directly to the board.
    // Whether these deductions are humanable does not matter.
    // e.g. fully enumerating all possible sum combinations across 3 different constraints and eliminating impossible candidates.
    // As this function is only called at the top level of a solve, it is more acceptable to look for deductions that may take a little time,
    // if the speedup to the subsequent brute force solve justifies the cost.
    //
    // Note that this function may be called several times per solve, as preprocessing runs until all constraints are unable to preprocess any further.
    // Preprocessing itself may also happen multiple times, as it is rerun whenever the solver backtracks to the top level.
    // Weak links may be added and constraints may be added or removed via the return value (ConstraintModification).
    preprocessingStep(board: Board): PreprocessingResult {
        // DEFAULT IMPLEMENTATION
        // ----------------------
        // Run obviousLogicalStep and logicalStep once each and apply whatever is found.
        // As this triggers all the explanation formatting code and potentially runs some expensive deductions,
        // this may be slower than a handwritten bruteForceStep implementation.

        let changed = ConstraintResult.UNCHANGED;
        const deductions = Constraint.flattenDeductions(this.obviousLogicalStep(board).concat(this.logicalStep(board)));
        if (deductions.invalid) {
            return ConstraintResult.INVALID;
        }
        if (deductions.singles && deductions.singles.length > 0) {
            if (!board.enforceCandidates(deductions.singles)) {
                return ConstraintResult.INVALID;
            }
            changed = ConstraintResult.CHANGED;
        }
        if (deductions.eliminations && deductions.eliminations.length > 0) {
            if (!board.clearCandidates(deductions.eliminations)) {
                return ConstraintResult.INVALID;
            }
            changed = ConstraintResult.CHANGED;
        }

        return {
            result: changed,
            addConstraints: deductions.addConstraints,
            deleteConstraints: deductions.deleteConstraints,
            weakLinks: deductions.weakLinks,
            implications: deductions.implications,
        };
    }

    // Clone the constraint such that it can be backtracked
    // If the constraint is stateless (most are), then you do not need to override this.
    clone(): Constraint {
        return this;
    }

    // Release any resources held by the constraint
    release() {}

    ////////////////////
    // Helper methods //
    ////////////////////

    // Returns the name of the constraint
    toString(): string {
        return this.constraintName;
    }

    // Returns a string that is specific to this constraint instance
    toSpecificString(): string {
        return this.specificName;
    }

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

    // Flatten an array of LogicalDeduction into a single LogicalDeduction, but with no explanation
    static flattenDeductions(deductions: LogicalDeduction[]): LogicalDeduction {
        if (deductions.length === 0) {
            return { explanation: '' };
        }
        const invalid = deductions.some(deduction => deduction.invalid);
        const singles = deductions.reduce((acc, deduction) => (deduction.singles ? acc.concat(deduction.singles) : acc), []);
        const eliminations = deductions.reduce((acc, deduction) => (deduction.eliminations ? acc.concat(deduction.eliminations) : acc), []);
        const addConstraints = deductions.reduce((acc, deduction) => (deduction.addConstraints ? acc.concat(deduction.addConstraints) : acc), []);
        const deleteConstraints = deductions.reduce(
            (acc, deduction) => (deduction.deleteConstraints ? acc.concat(deduction.deleteConstraints) : acc),
            []
        );
        const weakLinks = deductions.reduce((acc, deduction) => (deduction.weakLinks ? acc.concat(deduction.weakLinks) : acc), []);
        const implications = deductions.reduce((acc, deduction) => (deduction.implications ? acc.concat(deduction.implications) : acc), []);
        return {
            explanation: '',
            invalid,
            singles,
            eliminations,
            addConstraints,
            deleteConstraints,
            weakLinks,
            implications,
        };
    }
}
