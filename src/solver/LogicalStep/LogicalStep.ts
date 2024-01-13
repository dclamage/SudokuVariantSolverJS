import { Board } from '../Board';
import { LogicResult } from '../Enums/LogicResult';

export class LogicalStep {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    // TODO: Consider adding `logicalStepDescription` here if we ever want to start logging logical steps taken during init
    init(board: Board) {}

    // Returns the name of the logical step
    toString() {
        return this.name;
    }

    step(board: Board, desc: string[]): LogicResult {
        return LogicResult.UNCHANGED;
    }
}
