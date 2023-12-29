import { Constraint } from './Constraint/Constraint';

// Constraint files export a register function which registers them to a provided ConstraintBuilder.
// The build function takes a board and parameter object and returns a constraint instance or an array of constraint instances.
// Example:
// constraintBuilder.registerConstraint("killercage", (board, params) => new KillerCageConstraint(board, params));

class ConstraintBuilder {
    constraintBuilder = {};
    aggregateConstraintBuilders = [];
    constraintNames = [];

    constructor() {
        this.constraintBuilder = {};
        this.aggregateConstraintBuilders = [];
        this.constraintNames = [];
    }

    buildConstraints(boardData, board) {
        for (const builder of this.aggregateConstraintBuilders) {
            const newConstraints = builder(board, boardData);
            if (Array.isArray(newConstraints)) {
                for (const constraint of newConstraints) {
                    if (!(constraint instanceof Constraint)) {
                        throw new Error(`Aggregate constraint builder returned an array containing a non-constraint instance.`);
                    }
                    board.addConstraint(constraint);
                }
            } else if (newConstraints instanceof Constraint) {
                board.addConstraint(newConstraints);
            } else {
                throw new Error(`Aggregate constraint builder did not return an array or constraint instance.`);
            }
        }

        for (const constraintName of this.constraintNames) {
            const constraintData = boardData[constraintName];
            if (!constraintData || !Array.isArray(constraintData) || constraintData.length === 0) {
                continue;
            }

            const builder = this.constraintBuilder[constraintName];
            if (builder) {
                for (const instance of constraintData) {
                    const newConstraint = builder(board, instance);
                    if (Array.isArray(newConstraint)) {
                        for (const constraint of newConstraint) {
                            if (!(constraint instanceof Constraint)) {
                                throw new Error(`Constraint builder for ${constraintName} returned an array containing a non-constraint instance.`);
                            }
                            board.addConstraint(constraint);
                        }
                    } else if (newConstraint instanceof Constraint) {
                        board.addConstraint(newConstraint);
                    } else {
                        throw new Error(`Constraint builder for ${constraintName} did not return an array or constraint instance.`);
                    }
                }
            }
        }

        return board.finalizeConstraints();
    }

    // Assumes the data is an array of constraint instances and sends one instance at a time
    registerConstraint(constraintName, builder) {
        this.constraintBuilder[constraintName] = builder;
        this.constraintNames.push(constraintName);
    }

    // Always called, and sends the entire board data
    registerAggregateConstraint(builder) {
        this.aggregateConstraintBuilders.push(builder);
    }
}

export default ConstraintBuilder;
