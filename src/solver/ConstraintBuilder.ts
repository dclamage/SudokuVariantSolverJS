import { Board } from './Board';
import { Constraint } from './Constraint/Constraint';
import { FPuzzlesBoard } from './Constraint/FPuzzlesInterfaces';

// Constraint files export a register function which registers them to a provided ConstraintBuilder.
// The build function takes a board and parameter object and returns a constraint instance or an array of constraint instances.
// Example:
// constraintBuilder.registerConstraint("killercage", (board, params) => new KillerCageConstraint(board, params));

export type ConstraintBuilderFunction = (board: Board, params: unknown) => Constraint | Constraint[];
export type MultiConstraintBuilderFunction = (board: Board, params: unknown[]) => Constraint | Constraint[];
export type BooleanConstraintBuilderFunction = (board: Board) => Constraint | Constraint[];
export type AggregateConstraintBuilderFunction = (board: Board, boardData: FPuzzlesBoard) => Constraint | Constraint[];

class ConstraintBuilder {
    constraintBuilder: Map<string, ConstraintBuilderFunction> = new Map();
    multiConstraintBuilder: Map<string, MultiConstraintBuilderFunction> = new Map();
    constraintNames: string[] = [];

    booleanConstraintBuilder: Map<string, BooleanConstraintBuilderFunction> = new Map();
    booleanConstraintNames: string[] = [];

    aggregateConstraintBuilders: AggregateConstraintBuilderFunction[] = [];

    constructor() {}

    buildConstraints(boardData: FPuzzlesBoard, board: Board, finalize: boolean = true) {
        for (const constraintName of this.booleanConstraintNames) {
            if (!(constraintName in boardData)) {
                continue;
            }

            const constraintKey = constraintName as keyof FPuzzlesBoard;
            const constraintData = boardData[constraintKey];
            if (typeof constraintData !== 'boolean' || constraintData !== true) {
                continue;
            }

            const builder = this.booleanConstraintBuilder.get(constraintName);
            if (builder && constraintData === true) {
                const newConstraint = builder(board);
                this.addConstraintToBoard(board, newConstraint);
            }
        }

        for (const builder of this.aggregateConstraintBuilders) {
            const newConstraints = builder(board, boardData);
            this.addConstraintToBoard(board, newConstraints);
        }

        for (const constraintName of this.constraintNames) {
            if (!(constraintName in boardData)) {
                continue;
            }

            const constraintKey = constraintName as keyof FPuzzlesBoard;
            const constraintData = boardData[constraintKey];
            if (!constraintData || !Array.isArray(constraintData) || constraintData.length === 0) {
                continue;
            }

            if (this.constraintBuilder.has(constraintName)) {
                const builder = this.constraintBuilder.get(constraintName);
                if (builder) {
                    for (const instance of constraintData) {
                        const newConstraint = builder(board, instance);
                        this.addConstraintToBoard(board, newConstraint);
                    }
                }
            } else if (this.multiConstraintBuilder.has(constraintName)) {
                const builder = this.multiConstraintBuilder.get(constraintName);
                if (builder) {
                    const newConstraints = builder(board, constraintData);
                    this.addConstraintToBoard(board, newConstraints);
                }
            }
        }

        return !finalize || board.finalizeConstraints();
    }

    addConstraintToBoard(board: Board, constraint: Constraint | Constraint[]) {
        if (Array.isArray(constraint)) {
            for (const c of constraint) {
                if (!(c instanceof Constraint)) {
                    throw new Error('ConstraintBuilder.addConstraintToBoard called with an array containing a non-constraint instance.');
                }
                board.addConstraint(c);
            }
        } else {
            if (!(constraint instanceof Constraint)) {
                throw new Error('ConstraintBuilder.addConstraintToBoard called with a non-constraint instance.');
            }

            board.addConstraint(constraint);
        }
    }

    // Assumes the data is an array of constraint instances and sends one instance at a time
    registerConstraint(constraintName: string, builder: ConstraintBuilderFunction) {
        this.constraintBuilder.set(constraintName, builder);
        this.constraintNames.push(constraintName);
    }

    // Assumes the data is an array of constraint instances and sends the entire array
    registerMultiConstraint(constraintName: string, builder: MultiConstraintBuilderFunction) {
        this.multiConstraintBuilder.set(constraintName, builder);
        this.constraintNames.push(constraintName);
    }

    // Assumes the data is a boolean and invokes the builder if the data is true
    registerBooleanConstraint(constraintName: string, builder: BooleanConstraintBuilderFunction) {
        this.booleanConstraintBuilder.set(constraintName, builder);
        this.booleanConstraintNames.push(constraintName);
    }

    // Always called, and sends the entire board data
    registerAggregateConstraint(builder: AggregateConstraintBuilderFunction) {
        this.aggregateConstraintBuilders.push(builder);
    }
}

export default ConstraintBuilder;
