import { Board } from '../Board';
import { CandidateIndex, CellCoords, CellIndex, CellMask, CellValue } from '../SolveUtility';

// Reflects what has happened to the board
export enum LogicalStepResult {
    UNCHANGED,
    CHANGED,
    INVALID,
}

export class LogicalStep {
    name: string;
    size: number;
    allValues: CellMask;
    givenBit: CellMask;
    cellIndex: (row: number, col: number) => CellIndex;
    cellCoords: (cellIndex: CellIndex) => CellCoords;
    candidateIndexRC: (row: number, col: number, value: CellValue) => CandidateIndex;
    candidateIndex: (cellIndex: CellIndex, value: CellValue) => CandidateIndex;
    cellIndexFromCandidate: (candidateIndex: CandidateIndex) => CellIndex;
    valueFromCandidate: (candidateIndex: CandidateIndex) => CellValue;
    maskStrictlyLower: (v: CellValue) => CellMask;
    maskStrictlyHigher: (v: CellValue) => CellMask;
    maskLowerOrEqual: (v: CellValue) => CellMask;
    maskHigherOrEqual: (v: CellValue) => CellMask;
    maskBetweenInclusive: (v1: CellValue, v2: CellValue) => CellMask;
    maskBetweenExclusive: (v1: CellValue, v2: CellValue) => CellMask;

    constructor(board: Board, name: string) {
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
        return this.name;
    }

    // TODO: Update return type when converting to enum
    step(board: Board, desc: string[]): 0 | 1 | 2 {
        return LogicalStepResult.UNCHANGED;
    }
}
