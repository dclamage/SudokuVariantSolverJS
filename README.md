# Sudoku Variant Solver

This project is a Sudoku Variant Solver library written in JavaScript. It's designed to solve various types of Sudoku puzzles, including those with additional constraints beyond the standard Sudoku rules.

The solver is built with a modular architecture, allowing for the addition of new constraint types as needed. The core of the solver is located in the src/solver directory, which includes the Board.js file for representing the Sudoku board and various files in the Constraint subdirectory for handling different types of constraints.

The project uses Babel for transpiling the code, ESLint for linting, and Prettier for code formatting. The configuration files for these tools are located in the root directory of the project.

To get started with the project, follow the installation instructions in the README. After installation, you can use the examples in the Usage section of the README to learn how to use the solver.

Please note that this project is open for contributions. If you're interested in contributing, please follow the guidelines provided in the Contributing section of the README.

This project is licensed under the license specified in the License section of the README.

## Table of Contents

- [Sudoku Variant Solver](#sudoku-variant-solver)
	- [Table of Contents](#table-of-contents)
	- [Installation](#installation)
	- [Usage](#usage)
		- [Data](#data)
		- [Function: `solve`](#function-solve)
		- [Function `countSolutions`](#function-countsolutions)
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

To use the Sudoku Variant Solver in your project, you first need to import the `SudokuVariantSolver` class from the library. Here's an example of how to do this:

```js
import SudokuVariantSolver from 'sudoku-variant-solver';
```

Once you've imported the SudokuVariantSolver class, you can create a new instance of the solver:
```js
const solver = new SudokuVariantSolver();
```

The `SudokuVariantSolver` class has a method various useful entry methods for solving a Sudoku board.

The board format currently is identical to the [f-puzzles](https://f-puzzles.com) format, but in the future an internal format will be used and a builder class will be provided for constructing the board data.

For examples of how the f-puzzles format works, see the descriptor in my [C# Sudoku Variant Solver](https://github.com/dclamage/SudokuSolver/blob/dev/SudokuSolver/PuzzleFormats/FPuzzlesBoard.cs)

### Data

All solver functions take in a `data` object which is of the following form:  
data
 - `board` - The Sudoku board in f-puzzles format.
 - `options` - Options specific to the solving method

### Function: `solve`

The `solve` function is designed to find a single solution. It accepts a `data` object as its argument. Here's how it works:
```js
await solver.solve(data);
```

 - If the `data.options.random` property is set to true, the function will return a different, random solution each time it is called. It's important to note that these random solutions may not be evenly distributed among all possible solutions and may exhibit some bias.
 - Conversely, if `data.options.random` is set to `false` or evaluates to "falsey" (e.g., null or undefined), the function will return the same solution consistently. However, this solution is not considered special in any way, such as being the lexicographically smallest solution.

### Function `countSolutions`

The `countSolutions` function counts the total number of solutions. It accepts a `data` object as its argument. Here's how it works:
```js
await solver.countSolutions(data);
```

- If the `data.options.maxSolutions` is non-0, the solution count is capped 


Please refer to the [src/index.js](src/index.js) file for more details on how to use the SudokuVariantSolver class and its methods.

## Contributing

Guidelines for contributing to the project.

## License

Information about the project's license.
