import { default as SudokuVariantSolver, ExpandedCandidates, SolverResult } from '../src/index';
import { SolveStats } from '../src/solver/Board';
import { FPuzzlesBoard } from '../src/solver/Constraint/FPuzzlesInterfaces';
import { Puzzle } from './ParsePuzzles';
import { expandedCandidatesToCandidateArray } from './TestUtility';

export class SolveOutput {
    // test countSolutions
    solutionCount: number;
    // test solve
    randomSolution: number[];
    randomSolutionInvalid: boolean;
    // test trueCandidates
    trueCandidates: ExpandedCandidates;
    trueCandidatesInvalid: boolean;
    // test logicalSolve
    logicalSolve: ExpandedCandidates;
    logicalSolveExplanation: string[];
    logicalSolveInvalid: boolean;
    logicalSolveChanged: boolean;
    // test step
    repeatedStepping: ExpandedCandidates;
    repeatedSteppingExplanation: string[];
    repeatedSteppingInvalid: boolean;
    repeatedSteppingChanged: boolean;
    // used for timeouts
    cancelled: boolean;

    constructor() {
        this.solutionCount = undefined;
        this.randomSolution = undefined;
        this.randomSolutionInvalid = false;
        this.trueCandidates = undefined;
        this.trueCandidatesInvalid = false;
        this.logicalSolve = undefined;
        this.logicalSolveExplanation = undefined;
        this.logicalSolveInvalid = false;
        this.logicalSolveChanged = undefined;
        this.repeatedStepping = undefined;
        this.repeatedSteppingExplanation = [];
        this.repeatedSteppingInvalid = false;
        this.repeatedSteppingChanged = undefined;
        this.cancelled = false;
    }

    handleMessage(result: SolverResult) {
        switch (result.result) {
            case 'invalid':
                this.trueCandidatesInvalid = true;
                break;
            case 'cancelled':
                this.cancelled = true;
                break;
            case 'solution':
                this.randomSolution = result.solution;
                break;
            case 'no solution':
                this.randomSolutionInvalid = true;
                break;
            case 'truecandidates':
                this.trueCandidates = result.candidates;
                break;
            case 'count':
                // This may be set repeatedly, we'll take the last one
                this.solutionCount = result.count;
                this.cancelled = result.cancelled || this.cancelled;
                break;
            case 'step':
                // This may be set repeatedly, we'll take the last one
                if (result.candidates) this.repeatedStepping = result.candidates;
                this.repeatedSteppingExplanation.push(result.desc);
                this.repeatedSteppingInvalid = result.invalid;
                this.repeatedSteppingChanged = result.changed;
                break;
            case 'logicalsolve':
                this.logicalSolve = result.candidates;
                this.logicalSolveExplanation = result.desc;
                this.logicalSolveInvalid = result.invalid;
                this.logicalSolveChanged = result.changed;
                break;
        }
    }

    serialize(size: number) {
        return {
            solutionCount: this.solutionCount,
            randomSolution: this.randomSolution ? this.randomSolution.join('') : '',
            trueCandidates: this.trueCandidates ? expandedCandidatesToCandidateArray(this.trueCandidates, size).join('') : '',
            // test logicalSolve
            logicalSolve: this.logicalSolve ? expandedCandidatesToCandidateArray(this.logicalSolve, size).join('') : '',
            logicalSolveExplanation: this.logicalSolveExplanation.join('\n'),
            logicalSolveInvalid: this.logicalSolveInvalid,
            logicalSolveChanged: this.logicalSolveChanged,
            // test step
            repeatedStepping: this.repeatedStepping ? expandedCandidatesToCandidateArray(this.repeatedStepping, size).join('') : '',
            repeatedSteppingExplanation: this.repeatedSteppingExplanation.join('\n'),
            repeatedSteppingInvalid: this.repeatedSteppingInvalid,
            repeatedSteppingChanged: this.repeatedSteppingChanged,
        };
    }
}

export class WrappedSolver {
    solver: SudokuVariantSolver;
    solveOutput: SolveOutput;
    solveCounter: number;

    constructor() {
        this.solver = new SudokuVariantSolver(result => this.solveOutput.handleMessage(result));
        this.solveOutput = new SolveOutput();
        this.solveCounter = 0;
    }

    returnSolveOutput() {
        const oldSolverOutput = this.solveOutput;
        this.solveOutput = new SolveOutput();

        return oldSolverOutput;
    }

    // A timeoutMs of 0 indicates no timeout
    async solvePuzzle(puzzle: Puzzle, timeoutMs: number): Promise<SolveOutput> {
        let thisSolver = this.solver;

        setTimeout(() => thisSolver?.cancel(), timeoutMs);

        await this.solver.countSolutions({ board: puzzle.puzzle });
        if (this.solveOutput.cancelled) return this.returnSolveOutput();

        // Only worry about timing out on count solutions
        // trueCandidates / solve should not take too much longer compared to countSolutions
        // logical solves can be slow -- accept fate
        thisSolver = undefined;

        await this.solver.solve({ board: puzzle.puzzle });
        await this.solver.trueCandidates({ board: puzzle.puzzle });
        await this.solver.logicalSolve({ board: puzzle.puzzle });
        const stepPuzzle: FPuzzlesBoard = JSON.parse(JSON.stringify(puzzle.puzzle));
        while (true) {
            await this.solver.step({ board: stepPuzzle });

            if (!this.solveOutput.repeatedSteppingChanged || this.solveOutput.repeatedSteppingInvalid) {
                break;
            }

            // Update the puzzle's pencil marks / givens
            for (let row = 0; row < stepPuzzle.size; ++row) {
                for (let col = 0; col < stepPuzzle.size; ++col) {
                    const stepMarks = this.solveOutput.repeatedStepping[row * stepPuzzle.size + col];
                    if (stepMarks instanceof Array) {
                        stepPuzzle.grid[row][col].centerPencilMarks = stepMarks;
                    } else {
                        stepPuzzle.grid[row][col].given = stepMarks.given;
                        stepPuzzle.grid[row][col].value = stepMarks.value;
                    }
                }
            }
        }

        return this.returnSolveOutput();
    }

    // A timeoutMs of 0 indicates no timeout
    async solvePuzzleForStats(puzzle: Puzzle, timeoutMs: number): Promise<{ solveStats: SolveStats; timeout: boolean }> {
        let thisSolver = this.solver;
        setTimeout(() => thisSolver?.cancel(), timeoutMs);
        await this.solver.countSolutions({ board: puzzle.puzzle, options: { enableStats: true } });
        const solveStats = this.solver.solveStats;
        const timeout = this.solveOutput.cancelled;
        this.solveOutput = new SolveOutput();
        return { solveStats, timeout };
    }
}
