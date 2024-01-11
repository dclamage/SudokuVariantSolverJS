// Script that loads puzzles from stdin, solves them, and prints out whether they passed, as well as their timings
import * as fs from 'fs';
import * as process from 'process';
import { parseArgs } from 'node:util';
import { parsePuzzlesJson } from './ParsePuzzles';
import { runChecksOnPuzzles, serializeCheckFailure, solveChecks } from './SolveChecks';

async function main() {
    const args = parseArgs({
        options: {
            printFailed: { type: 'boolean' },
            printTimeout: { type: 'boolean' },
            printNonTimeout: { type: 'boolean' },
            printAll: { type: 'boolean' },
            timeout: { type: 'string', default: '1000' }, // Default to 1 second per puzzle
            verbose: { type: 'boolean', short: 'v' },
            help: { type: 'boolean', short: 'h' },
        },
        allowPositionals: true,
    });

    if (args.values.help) {
        console.log('Example usage:');
        console.log('    npx tsx tests/TestPuzzles.ts < puzzles/puzzles.json');
        console.log();
        console.log('Flags:');
        console.log();
        console.log('    --printFailed      Print JSON for failed puzzles, including their failure reason.');
        console.log('                       --verbose can be passed to include solve output.');
        console.log('    --printTimeout     Print JSON for puzzles that timed out.');
        console.log('    --printNonTimeout  Print JSON for puzzles that did not time out.');
        console.log('    --printAll         Print JSON for all puzzles, do not run any checks.');
        console.log('    --verbose, -v      Print solve output in addition to any failed puzzles.');
        console.log('    --timeout <ms>     Change timeout (default: 1000ms).');
        console.log('    --help             Print help message.');
        console.log();
        console.log('Positional arguments can be used to filter puzzles by which check they failed.');
        console.log();
        console.log();
        console.log('More examples:');
        console.log();
        console.log('- Get summary of # of failed checks and puzzles:');
        console.log('    npx tsx tests/TestPuzzles.ts < puzzles/puzzles.json');
        console.log();
        console.log('- Get puzzles that failed and store them in `failures.json`:');
        console.log('    npx tsx tests/TestPuzzles.ts --printFailed < puzzles/puzzles.json > failures.json');
        console.log();
        console.log('- Check if the puzzles that failed earlier now pass:');
        console.log('    npx tsx tests/TestPuzzles.ts < failures.json');
        console.log();
        console.log('- Get all puzzles that failed specifically because their provided solution did not match the random solution:');
        console.log('    npx tsx tests/TestPuzzles.ts --printFailed ProvidedSolutionCheck < puzzles/puzzles.json');
        console.log();
        console.log('- Get puzzles that took more than 20 seconds to solve:');
        console.log('    npx tsx tests/TestPuzzles.ts --printTimeout --timeout 20000 < puzzles/puzzles.json');
        console.log();
        console.log('- Get puzzles that took less than 1 second to solve:');
        console.log('    npx tsx tests/TestPuzzles.ts --printNonTimeout --timeout 1000 < puzzles/puzzles.json');
        console.log();
        console.log('- Simply print all puzzles, which adds generated categories:');
        console.log('    npx tsx tests/TestPuzzles.ts --printAll < puzzles/puzzles.json');
        console.log();
        console.log('- Test all thermo puzzles:');
        console.log('     npx tsx tests/TestPuzzles.ts --printAll < puzzles/puzzles.json > puzzles/puzzles-with-categories.json');
        console.log('     jq \'map(select(.generatedCategories | index("thermometer")))\' \\');
        console.log('         < puzzles/puzzles-with-categories.json > puzzles/thermo-puzzles.json');
        console.log('     npx tsx tests/TestPuzzles.ts < puzzles/thermo-puzzles.json');
        return 0;
    }

    const verbose = args.values.verbose;
    const printFailed = args.values.printFailed;
    const printChecks = args.positionals;
    const printTimeout = args.values.printTimeout;
    const printNonTimeout = args.values.printNonTimeout;
    const printAll = args.values.printAll;
    const timeoutMs = parseInt(args.values.timeout, 10);

    // Validate args
    if ((printTimeout ? 1 : 0) + (printNonTimeout ? 1 : 0) + (printFailed ? 1 : 0) + (printAll ? 1 : 0) > 1) {
        console.log('At most one of --printTimeout, --printNonTimeout, --printFailed, and --printAll can be used');
        return 1;
    }
    for (const printCheck of printChecks) {
        if (!solveChecks.some(check => check.constructor.name === printCheck)) {
            console.log(`Unknown check name: ${printCheck}`);
            return 1;
        }
    }

    // Read puzzles from stdin
    const puzzles = parsePuzzlesJson(fs.readFileSync(0, 'utf-8'));

    // If simply printing all puzzles, skip checks
    if (printAll) {
        console.log(JSON.stringify(puzzles.map(puzzle => puzzle.serialize()).concat([{}]), undefined, 4));
        return 0;
    }

    // Run checks
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
