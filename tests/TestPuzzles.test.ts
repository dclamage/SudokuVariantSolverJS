import * as fs from 'fs';
import { Puzzle, parsePuzzlesJson } from './ParsePuzzles';
import { CheckFailure, runChecksOnPuzzles, serializeCheckFailure, solveChecks } from './SolveChecks';

describe('Test puzzles', () => {
    // Path relative to project root
    const puzzlesPath = 'puzzles/puzzles.json';
    const puzzles: Puzzle[] = parsePuzzlesJson(fs.readFileSync(puzzlesPath, 'utf-8'));
    let failures: Map<string, CheckFailure[]> = undefined;
    let numPuzzlesFailed: number = undefined;
    let timeouts: Puzzle[] = undefined;
    // Run the tests in a beforeAll and then report the failures as individual cases per check for readability
    beforeAll(async () => {
        [failures, numPuzzlesFailed, timeouts] = await runChecksOnPuzzles(puzzles, 1000);
    }, 600 * 1000); // Jest timeout after 10 minutes
    // TODO: Separate tests by runtime so we can run the quicker puzzles first
    // TODO: Possibly parallelize by puzzle to make use of multiple cores

    // Ignore timeouts
    timeouts;

    it('No puzzles fail', () => {
        expect(numPuzzlesFailed).toEqual(0);
    });

    const disabledChecks: string[] = [];
    for (const check of solveChecks) {
        const checkName = check.constructor.name;
        if (disabledChecks.includes(checkName)) {
            it(`${checkName} disabled`, () => {
                expect(true).toBe(true); // Add an assertion
            });
        } else {
            it(`${checkName}`, () => {
                expect(failures.get(checkName).map(checkFailure => serializeCheckFailure(checkFailure, false))).toEqual([]);
            });
        }
    }
});
