# Sudoku Variant Solver

This project is a Sudoku Variant Solver library written in TypeScript and bundled to JavaScript. It's designed to solve various types of Sudoku puzzles, including those with additional constraints beyond the standard Sudoku rules.

The solver is built with a modular architecture, allowing for the addition of new constraint types as needed. The core of the solver is located in the [src/solver](src/solver) directory, which includes the [Board.js](src/solver/Board.js) file for representing the Sudoku board and various files in the [Constraint](src/solver/Constraint) subdirectory for handling different types of constraints.

The project uses Babel for transpiling the code, ESLint for linting, and Prettier for code formatting. The configuration files for these tools are located in the root directory of the project.

To get started with the project, follow the installation instructions in the README. After installation, you can use the examples in the Usage section of the README to learn how to use the solver.

Please note that this project is open for contributions. If you're interested in contributing, please follow the guidelines provided in the Contributing section of the README.

This project is licensed under the license specified in the License section of the README.

## Table of Contents

- [Sudoku Variant Solver](#sudoku-variant-solver)
	- [Table of Contents](#table-of-contents)
	- [Installation](#installation)
	- [Usage](#usage)
		- [Data Structure](#data-structure)
		- [`solve` Method](#solve-method)
			- [Options](#options)
			- [Result](#result)
		- [`countSolutions` Method](#countsolutions-method)
			- [Options](#options-1)
			- [Result](#result-1)
		- [`trueCandidates` Method](#truecandidates-method)
			- [Options](#options-2)
			- [Result](#result-2)
		- [`step` Method](#step-method)
			- [Options](#options-3)
			- [Result](#result-3)
		- [`logicalSolve` Method](#logicalsolve-method)
			- [Options](#options-4)
			- [Result](#result-4)
		- [Additional Information](#additional-information)
	- [Contributing](#contributing)
	- [License](#license)

## Installation

Follow these steps to install and build the project:

1. Clone the repository to your local machine.
2. Navigate to the project directory in your terminal.
3. Run `npm install` to install the project dependencies.
4. After the installation is complete, run `npm run build` to build the project. This will create a `dist` directory in the project root.

The `dist` directory contains the bundled JavaScript file and source map, which are ready to be used in your projects.

## Usage

To integrate the Sudoku Variant Solver into your project, start by importing the `SudokuVariantSolver` class from the library. For instance:

```js
import SudokuVariantSolver from 'sudoku-variant-solver';
```

After importing the class, instantiate the solver like this:

```js
const solver = new SudokuVariantSolver(message => handleMessage(message));
```

Here is an example file which can be loaded as a Web Worker:

`SudokuVariantSolverWebWorker.js`:

```js
importScripts('./bundle.js');
let solver = new SudokuVariantSolver.default(message => self.postMessage(message));

self.addEventListener(
    'message',
    async function (e) {
        const data = e.data;
        switch (data.cmd) {
            case 'solve':
                await solver.solve(data);
                break;
            case 'count':
                await solver.countSolutions(data);
                break;
            case 'truecandidates':
                await solver.trueCandidates(data);
                break;
            case 'step':
                await solver.step(data);
                break;
            case 'logicalsolve':
                await solver.logicalSolve(data);
                break;
            case 'cancel':
                solver.cancel();
                break;
            default:
                self.postMessage({ result: 'unknown command' });
        }
    },
    false
);
```

In your main application, set up the worker like this:

```js
worker = new Worker('Solver/SolveWorker.js');

...
function findSolution(onResult) {
	worker.onmessage = function (e) {
		if (e.data.result === "solution") {
			onResult({ solution: e.data.solution });
		} else if (e.data.result === 'no solution') {
			onResult({ solution: null });
		} else if (e.data.result === 'cancelled') {
			onResult({ cancelled: true });
        } else {
            console.log('Error: ' + e.data.result);
        }
		setWorkerCompleted();
	};

	const board = exportPuzzleToObject();
	worker.postMessage({
		cmd: "solve",
		board: board,
		options: { random: true },
	});
}
```

The `SudokuVariantSolver` class has various useful entry methods for solving a Sudoku board.

The board format currently is identical to the [f-puzzles](https://f-puzzles.com) format, but in the future an internal format will be used and a builder class will be provided for constructing the board data.

The f-puzzles format is described by the interfaces in [FPuzzlesInterfaces.ts](src/solver/Constraint/FPuzzlesInterfaces.ts).

### Data Structure

All methods accept a `data` object with the following structure:

-   `board`: Sudoku board in f-puzzles format.
-   `options`: Method-specific options.

### `solve` Method

This method finds a single solution:

```js
await solver.solve(data);
```

#### Options

-   Setting `data.options.random` to `true` yields different solutions each call, though not necessarily evenly distributed.
-   If `data.options.random` is `false` or falsy, the same solution is returned consistently.

#### Result

The method communicates via a callback, sending a `message` object object with a `result` attribute. Possible values for `result` include `'invalid'`, `'cancelled'`, `'no solution'`, and `'solution'`.

### `countSolutions` Method

The `countSolutions` method is designed to calculate the total number of possible solutions for a given Sudoku puzzle:

```js
await solver.countSolutions(data);
```

#### Options

Here's how the method behaves based on the `data.options.maxSolutions` parameter:

-   If `data.options.maxSolutions` is set to a non-zero value, the method will halt the solution counting process once it reaches this specified limit.
-   If `data.options.maxSolutions` is set to `0`, or evaluates to a falsey value (such as `null` or `undefined`), the method will continue counting until it determines the exact number of solutions or until a cancellation request is received.

#### Result

Communication with the message callback occurs throughout the counting process, as well as upon its completion. The method sends a `message` object that includes a `result` member, which can be one of the following:

-   `'invalid'`: Indicates that the provided board is invalid. This typically happens when the board's format is incorrect or when the puzzle's constraints make it trivially unsolvable.
-   `'count'`: Signifies that a solution count is available. The `message` object in this case includes:
    -   `message.numSolutions`: Contains the current count of solutions.
    -   `message.complete`: A boolean indicating whether the count is final. It's set to `true` for the final count, even if the process terminated early due to a specified `maxSolutions` limit. For periodic updates and in case of cancellation, it's set to `false`.
    -   `message.cancelled`: A boolean that turns `true` if the counting process is interrupted by a cancellation request. This indicates that the provided count is the final one before the process was halted.

### `trueCandidates` Method

The `trueCandidates` method is designed to calculate the true candidates for a given Sudoku board. True candidates are defined as the union of all possible solutions for the puzzle.

Here’s how you can use the `trueCandidates` method:

```js
await solver.trueCandidates(data);
```

#### Options

`data.options.maxSolutionsPerCandidate` (default = 1): This optional parameter sets the maximum number of solutions to consider for each candidate. If this option is greater than 1, additional information about how many solutions were found for each individual candidate is provided.

The method communicates via a callback, sending a `message` object object with a `result` attribute. Possible values for `result` include `'invalid'`, `'cancelled'`, and `'truecandidates'`.

#### Result

If `result === 'truecandidates'` then the following members are also sent with the message:

-   `candidates`: A structured array where each sub-array represents the viable candidates for the corresponding cell on the Sudoku board. The indexing of cells is done in a left-to-right and top-to-bottom manner.
-   `counts`: This is included if `maxSolutionsPerCandidate` is set to more than 1. It is a flat array, with each entry corresponding to the number of solutions found for each candidate across the board.

### `step` Method

The `step` method performs a single logical step from the current board state. These steps are intended to be human understandable:

```js
await solver.step(data);
```

#### Options

None.

#### Result

The method communicates via a callback, sending a `message` object object with a `result` attribute. Possible values for `result` include `'cancelled'`, and `'step'`.

If `result === 'step'` then the `desc` member contains a human-readable string that describes the logical step taken. Additionally, If the step made progress on the puzzle, then the following members will also exist:

-   `candidates`: The new candidates possible for the board. An array of objects per cell. The indexing of cells is done in a left-to-right and top-to-bottom manner. If the objects contains a `given` member set to `true`, then the cell has only one value, which is stored in the `value` member of the object. If the `given` member is not present (falsey), then the object is actually an array of candidates remaining for the cell.
-   `invalid`: `true` if the logical step has determined that the board has no solutions.
-   `changed`: `true` if the logical step had an effect on the board. This will always be `true` if a step was found. If it's `false` (or falsey) then that means the message is something like 'Board is invalid!', 'Solved!', or 'No logical steps found.'

### `logicalSolve` Method

The `logicalSolve` method performs as many logical steps from the current board state as is possible. These steps are intended to be human understandable:

```js
await solver.logicalSolve(data);
```

#### Options

None.

#### Result

The method communicates via a callback, sending a `message` object object with a `result` attribute. Possible values for `result` include `'cancelled'`, and `'logicalsolve'`.

If `result === 'logicalsolve'` then the `desc` member contains an array of human-readable strings that describe the logical steps taken. Additionally, if the steps made progress on the puzzle, then the following members will also exist:

-   `candidates`: The new candidates possible for the board. An array of objects per cell. The indexing of cells is done in a left-to-right and top-to-bottom manner. If the objects contains a `given` member set to `true`, then the cell has only one value, which is stored in the `value` member of the object. If the `given` member is not present (falsey), then the object is actually an array of candidates remaining for the cell.
-   `invalid`: `true` if the logical step has determined that the board has no solutions.
-   `changed`: `true` if the logical step had an effect on the board. This will always be `true` if a step was found. If it's `false` (or falsey) then that means the message is something like 'Board is invalid!', 'Solved!', or 'No logical steps found.'

### Additional Information

Please refer to the [src/index.js](src/index.js) file for more details on how to use the SudokuVariantSolver class and its methods.

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, improving the documentation, or proposing new features, your help is greatly appreciated. Please note that by contributing to this project, you agree that your contributions will be licensed under its ISC License.

## License

This project is licensed under the ISC License. For more details, please see the [LICENSE](LICENSE) file in the project root.
All contributions to this project are also licensed under this license.
