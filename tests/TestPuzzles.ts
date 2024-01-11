// Script that loads puzzles from stdin, solves them, and prints out whether they passed, as well as their timings
import * as fs from 'fs';
import * as process from 'process';
import { parseArgs } from 'node:util';
import { parsePuzzlesJson } from './ParsePuzzles';
import { runChecksOnPuzzles, serializeCheckFailure, solveChecks } from './SolveChecks';

async function main() {
    const args = parseArgs({
        options: {
            verbose: { type: 'boolean', short: 'v' },
            printFailed: { type: 'boolean', short: 'p' },
            printTimeout: { type: 'boolean' },
            printNonTimeout: { type: 'boolean' },
            timeout: { type: 'string', default: '1000' }, // Default to 1 second per puzzle
        },
        allowPositionals: true,
    });
    const verbose = args.values.verbose;
    const printFailed = args.values.printFailed;
    const printChecks = args.positionals;
    const printTimeout = args.values.printTimeout;
    const printNonTimeout = args.values.printNonTimeout;
    const timeoutMs = parseInt(args.values.timeout, 10);

    // Validate args
    if ((printTimeout ? 1 : 0) + (printNonTimeout ? 1 : 0) + (printFailed ? 1 : 0) > 1) {
        console.log('At most one of --printTimeout, --printNonTimeout, and --printFailed can be used');
        return 1;
    }
    for (const printCheck of printChecks) {
        if (!solveChecks.some(check => check.constructor.name === printCheck)) {
            console.log(`Unknown check name: ${printCheck}`);
            return 1;
        }
    }

    // Run checks
    const puzzles = parsePuzzlesJson(fs.readFileSync(0, 'utf-8'));
    const [failures, numPuzzlesFailed, timeouts] = await runChecksOnPuzzles(puzzles, timeoutMs);

    if (printTimeout) {
        console.log(JSON.stringify(timeouts.map(puzzle => puzzle.serialize()).concat([{}]), undefined, 4));
    } else if (printNonTimeout) {
        console.log(
            JSON.stringify(
                puzzles
                    .filter(puzzle => !timeouts.includes(puzzle))
                    .map(puzzle => puzzle.serialize())
                    .concat([{}]),
                undefined,
                4
            )
        );
    } else if (!printFailed) {
        // Just print a summary of how many failures there were for each check
        let numChecksFailed = 0;
        for (const check of solveChecks) {
            numChecksFailed += failures.get(check.constructor.name).length > 0 ? 1 : 0;
            console.log(`${check.constructor.name}:`, failures.get(check.constructor.name).length, 'failed');
        }
        console.log();
        // Don't use format strings so we get coloured numbers on the console
        console.log('Checks:', numChecksFailed, 'failed', solveChecks.length - numChecksFailed, 'passed', solveChecks.length, 'total');
        console.log(
            'Puzzles:',
            numPuzzlesFailed,
            'failed',
            puzzles.length - numPuzzlesFailed - timeouts.length,
            'passed',
            timeouts.length,
            'timed out',
            puzzles.length,
            'total'
        );
    } else {
        // Utility to serialize the failure depending on verbosity
        let collectedFailures: object[] = [];

        if (printChecks.length === 0) {
            // Print all checks
            // eslint-ignore-next-line @typescript-eslint/no-unused-vars
            for (const [checkName, checkFailures] of failures) {
                collectedFailures = collectedFailures.concat(checkFailures.map(checkFailure => serializeCheckFailure(checkFailure, verbose)));
            }
        } else {
            // Print selected checks
            for (const checkName of printChecks) {
                collectedFailures = collectedFailures.concat(
                    failures.get(checkName).map(checkFailure => serializeCheckFailure(checkFailure, verbose))
                );
            }
        }

        // Add an empty object so we get a ghetto trailing comma
        collectedFailures.push({});

        console.log(JSON.stringify(collectedFailures, undefined, 4));
    }

    return numPuzzlesFailed;
}

main().then(code => process.exit(code));
