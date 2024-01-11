import { sequenceEqual } from '../src/solver/SolveUtility';
import { Puzzle } from './ParsePuzzles';
import { SolveOutput, WrappedSolver } from './RunSolver';
import {
    expandedCandidatesContainsMultipleSolutions,
    expandedCandidatesEqual,
    expandedCandidatesPartOfExpandedCandidates,
    solutionPartOfExpandedCandidates,
} from './TestUtility';

export interface SolveCheck {
    // Returns a explanation string if a failure occurred, undefined otherwise
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined;
}

export const solveChecks: SolveCheck[] = [];

export class SolutionValidityCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (
            !(
                (solveOutput.solutionCount === 0) === solveOutput.randomSolutionInvalid && // solutionCount matches randomSolution
                (solveOutput.solutionCount === 0) === solveOutput.trueCandidatesInvalid && // solutionCount matches trueCandidates
                (!solveOutput.logicalSolveInvalid || solveOutput.solutionCount === 0) && // if contradiction detected by logical solve then solutionCount is 0
                (!solveOutput.repeatedSteppingInvalid || solveOutput.solutionCount === 0) && // if contradiction detected by stepping then solutionCount is 0
                true
            )
        ) {
            return `Inconsistent solution count / validity according to the various methods:
    countSolutions: ${solveOutput.solutionCount}
    solve: ${solveOutput.randomSolutionInvalid ? 'invalid' : 'solution exists'}
    trueCandidates: ${solveOutput.trueCandidatesInvalid ? 'invalid' : 'solution exists'}
    logicalSolve: ${solveOutput.logicalSolveInvalid ? 'invalid' : 'no contradiction visible'}
    step: ${solveOutput.repeatedSteppingInvalid ? 'invalid' : 'no contradiction visible'}`;
        }
    }
}
solveChecks.push(new SolutionValidityCheck());

export class SolutionCountCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (solveOutput.solutionCount > 1 && !expandedCandidatesContainsMultipleSolutions(solveOutput.trueCandidates)) {
            return 'Multiple solutions according to solutionCount, but only one solution according to trueCandidates.';
        }
    }
}
solveChecks.push(new SolutionCountCheck());

export class TrueCandidatesRandomSolveCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (!solutionPartOfExpandedCandidates(solveOutput.randomSolution, solveOutput.trueCandidates)) {
            return 'Random solution not part of true candidates.';
        }
    }
}
solveChecks.push(new TrueCandidatesRandomSolveCheck());

export class TrueCandidatesLogicalSolveCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (!expandedCandidatesPartOfExpandedCandidates(solveOutput.trueCandidates, solveOutput.logicalSolve)) {
            return 'True candidates not part of logical solve.';
        }
    }
}
solveChecks.push(new TrueCandidatesLogicalSolveCheck());

export class ProvidedSolutionCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (puzzle.solution.length > 0) {
            if (!solveOutput.randomSolution || solveOutput.randomSolution.join('') !== puzzle.solution) {
                return `Provided solution does not match random solution.
    Provided solution: ${puzzle.solution}
    Random solution: ${solveOutput.randomSolution.join('')}`;
            }
        }
    }
}
solveChecks.push(new ProvidedSolutionCheck());

export class LogicalSolveStepCandidatesCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (
            solveOutput.logicalSolve &&
            solveOutput.repeatedStepping &&
            !expandedCandidatesEqual(solveOutput.logicalSolve, solveOutput.repeatedStepping)
        ) {
            return 'Logical solve does not produce same candidates as repeated stepping.';
        }
    }
}
solveChecks.push(new LogicalSolveStepCandidatesCheck());

export class LogicalSolveStepExplanationCheck {
    check(puzzle: Puzzle, solveOutput: SolveOutput): string | undefined {
        if (
            !sequenceEqual(
                solveOutput.logicalSolveExplanation,
                solveOutput.repeatedSteppingExplanation.length > 0 && solveOutput.repeatedSteppingExplanation[0] === 'Initial Candidates'
                    ? solveOutput.repeatedSteppingExplanation.slice(1)
                    : solveOutput.repeatedSteppingExplanation
            )
        ) {
            return 'Logical solve explanation does not match repeated stepping explanation.';
        }
    }
}
solveChecks.push(new LogicalSolveStepExplanationCheck());

export type CheckFailure = { puzzle: Puzzle; output: SolveOutput; failureReason: string };

// Returns failure results (grouped by solve check name), how many puzzles failed, and the list of puzzles that timed out
export async function runChecksOnPuzzles(puzzles: Puzzle[], timeoutMs: number): Promise<[Map<string, CheckFailure[]>, number, Puzzle[]]> {
    const solver = new WrappedSolver();

    let numPuzzlesFailed = 0;
    const failures: Map<string, CheckFailure[]> = new Map();
    for (const check of solveChecks) {
        failures.set(check.constructor.name, []);
    }
    const timeouts: Puzzle[] = [];

    for (const puzzle of puzzles) {
        const output = await solver.solvePuzzle(puzzle, timeoutMs);

        if (output.cancelled) {
            timeouts.push(puzzle);
            continue;
        }

        // Consistency checks
        let failed = false;
        for (const check of solveChecks) {
            const result = check.check(puzzle, output);
            if (result !== undefined) {
                failed = true;
                failures.get(check.constructor.name).push({
                    puzzle,
                    output,
                    failureReason: result,
                });
            }
        }
        if (failed) {
            numPuzzlesFailed++;
        }
    }

    return [failures, numPuzzlesFailed, timeouts];
}

export function serializeCheckFailure(checkFailure: CheckFailure, verbose: boolean): object {
    return {
        ...checkFailure.puzzle.serialize(),
        failureReason: checkFailure.failureReason,
        ...(verbose ? checkFailure.output.serialize(checkFailure.puzzle.puzzle.size) : {}),
    };
}
