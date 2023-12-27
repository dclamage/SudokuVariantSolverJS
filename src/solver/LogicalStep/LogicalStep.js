// Reflects what has happened to the board
export const LogicalStepResult = Object.freeze({
    UNCHANGED: 0,
    CHANGED: 1,
    INVALID: 2,
});

export class LogicalStep {
    constructor(board, name) {
        this.name = name;

        // Cache common values
        this.size = board.size;
        this.allValues = board.allValues;
        this.givenBit = board.givenBit;
        this.cellIndex = board.cellIndex;
        this.cellCoords = board.cellCoords;
        this.candidateIndexRC = board.candidateIndexRC;
        this.candidateIndex = board.candidateIndex;
        this.cellIndexFromCandidate = board.cellIndexFromCandidate;
        this.valueFromCandidate = board.valueFromCandidate;
        this.maskStrictlyLower = board.maskStrictlyLower;
        this.maskStrictlyHigher = board.maskStrictlyHigher;
        this.maskLowerOrEqual = board.maskLowerOrEqual;
        this.maskHigherOrEqual = board.maskHigherOrEqual;
        this.maskBetweenInclusive = board.maskBetweenInclusive;
        this.maskBetweenExclusive = board.maskBetweenExclusive;
    }

    // Returns the name of the logical step
    toString() {
        return this.constraintName;
    }

	// eslint-disable-next-line no-unused-vars
	step(board, desc) {
		return LogicalStepResult.UNCHANGED;
	}
}