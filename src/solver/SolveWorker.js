importScripts(
    '/Solver/SolveUtility.js',
    '/Solver/Board.js',
    '/Solver/SumGroup.js',
    '/Solver/SumCellsHelper.js',
    '/Solver/ConstraintBuilder.js',

    // Constraints
    '/Solver/Constraint/Constraint.js',
    '/Solver/Constraint/ArrowSumConstraint.js',
    '/Solver/Constraint/FixedSumConstraint.js',
    '/Solver/Constraint/GeneralCellPairConstraint.js',
    '/Solver/Constraint/KillerCageConstraint.js',
    '/Solver/Constraint/RegionSumLinesConstraint.js',

    // Logical Steps
    '/Solver/LogicalStep/LogicalStep.js',
    '/Solver/LogicalStep/CellForcing.js',
    '/Solver/LogicalStep/ConstraintLogic.js',
    '/Solver/LogicalStep/HiddenSingle.js',
    '/Solver/LogicalStep/NakedSingle.js',
    '/Solver/LogicalStep/NakedTupleAndPointing.js'
);

let eventCanceled = false;

self.addEventListener(
    'message',
    async function (e) {
        const data = e.data;
        switch (data.cmd) {
            case 'solve':
                eventCanceled = false;
                solve(data);
                break;
            case 'count':
                eventCanceled = false;
                await countSolutions(data);
                break;
            case 'truecandidates':
                eventCanceled = false;
                await trueCandidates(data);
                break;
            case 'step':
                eventCanceled = false;
                await step(data);
                break;
            case 'logicalsolve':
                eventCanceled = false;
                await logicalSolve(data);
                break;
            case 'cancel':
                eventCanceled = true;
                break;
            default:
                self.postMessage({ result: 'unknown command' });
        }
    },
    false
);

self.solve = function(data) {
    const board = createBoard(data.board);
    if (!board) {
        self.postMessage({ result: 'invalid' });
    } else {
        const solution = board.findSolution(data.options || {}, () => eventCanceled);
        if (solution) {
            if (solution.cancelled) {
                self.postMessage({ result: 'cancelled' });
            } else {
                const solutionValues = solution.getValueArray();
                self.postMessage({ result: 'solution', solution: solutionValues });
            }
        } else {
            self.postMessage({ result: 'no solution' });
        }
    }
};

self.countSolutions = async function(data) {
    const board = createBoard(data.board);
    if (!board) {
        self.postMessage({ result: 'invalid' });
    } else {
        const { maxSolutions = 0 } = data.options || {};
        const countResult = await board.countSolutions(
            maxSolutions,
            count => {
                self.postMessage({ result: 'count', count: count, complete: false });
            },
            () => eventCanceled
        );
        if (countResult.isCancelled) {
            self.postMessage({ result: 'count', count: countResult.numSolutions, complete: false, cancelled: true });
        } else {
            self.postMessage({ result: 'count', count: countResult.numSolutions, complete: true });
        }
    }
};

self.expandCandidates = function(candidates, givenBit) {
    if (!givenBit) {
        return candidates?.map(mask => valuesList(mask));
    }

    return candidates?.map(mask => {
        if (mask & givenBit) {
            return { given: true, value: minValue(mask) };
        }
        return valuesList(mask);
    });
}

self.trueCandidates = async function (data) {
    const board = createBoard(data.board);
    if (!board) {
        self.postMessage({ result: 'invalid' });
    } else {
        const { maxSolutionsPerCandidate = 1 } = data.options || {};

        const trueCandidatesResult = await board.calcTrueCandidates(maxSolutionsPerCandidate, () => eventCanceled);
        if (trueCandidatesResult.invalid) {
            self.postMessage({ result: 'invalid' });
        } else if (trueCandidatesResult.cancelled) {
            self.postMessage({ result: 'cancelled' });
        } else {
            const { candidates, counts } = trueCandidatesResult;
            const expandedCandidates = expandCandidates(candidates);
            self.postMessage({ result: 'truecandidates', candidates: expandedCandidates, counts: counts });
        }
    }
};

// Compares the initial candidates in the provided data with the final imported board.
function candidatesDiffer(board, data) {
    const size = board.size;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cellIndex = i * size + j;
            const cellMask = board.cells[cellIndex] & board.allValues;
            const dataCell = data.board.grid[i][j];
            let dataCellMask = board.allValues;
            if (dataCell.value) {
                dataCellMask = valueBit(dataCell.value);
            } else {
                const haveGivenPencilmarks = dataCell.givenPencilMarks?.length > 0;
                const haveCenterPencilmarks = dataCell.centerPencilMarks?.length > 0;
                if (haveGivenPencilmarks && haveCenterPencilmarks) {
                    dataCellMask = valuesMask(dataCell.givenPencilMarks.filter(value => dataCell.centerPencilMarks.includes(value)));
                } else if (haveGivenPencilmarks) {
                    dataCellMask = valuesMask(dataCell.givenPencilMarks);
                } else if (haveCenterPencilmarks) {
                    dataCellMask = valuesMask(dataCell.centerPencilMarks);
                }
            }

            if (cellMask !== dataCellMask) {
                return true;
            }
        }
    }

    return false;
}

self.step = async function(data) {
    const board = createBoard(data.board, true);
    if (!board) {
        self.postMessage({ result: 'step', desc: 'Board is invalid!', invalid: true, changed: false });
        return;
    }

    if (candidatesDiffer(board, data)) {
        const expandedCandidates = expandCandidates(board.cells, board.givenBit);
        self.postMessage({ result: 'step', desc: 'Initial Candidates', candidates: expandedCandidates, invalid: false, changed: true });
        return;
    }

    // Perform a single step
    const stepResult = await board.logicalStep(() => eventCanceled);
    if (stepResult.cancelled) {
        self.postMessage({ result: 'cancelled' });
        return;
    }

    if (stepResult.unchanged) {
        if (board.nonGivenCount === 0) {
            self.postMessage({ result: 'step', desc: 'Solved!' });
        } else {
            self.postMessage({ result: 'step', desc: 'No logical steps found.' });
        }
        return;
    }

    const expandedCandidates = expandCandidates(board.cells, board.givenBit);
    self.postMessage({ result: 'step', desc: stepResult.desc, candidates: expandedCandidates, invalid: stepResult.invalid, changed: stepResult.changed });
}

self.logicalSolve = async function (data) {
    const board = createBoard(data.board, true);
    if (!board) {
        self.postMessage({ result: 'logicalsolve', desc: ['Board is invalid!'], invalid: true, changed: false });
        return;
    }

    const solveResult = await board.logicalSolve(() => eventCanceled);
    if (solveResult.cancelled) {
        self.postMessage({ result: 'cancelled' });
        return;
    }

    let desc = solveResult.desc;
    if (board.nonGivenCount === 0) {
        desc.push('Solved!');
    } else if (solveResult.invalid) {
        desc.push('Board is invalid!');
    } else {
        desc.push('No logical steps found.');
    }

    const expandedCandidates = expandCandidates(board.cells, board.givenBit);
    self.postMessage({ result: 'logicalsolve', desc, candidates: expandedCandidates, invalid: solveResult.invalid, changed: solveResult.changed });
};

self.createBoard = function (boardData, keepPencilMarks = false) {
    const size = boardData.size;
    const board = new Board(size);

    // Apply default regions
    applyDefaultRegions(boardData);

    // Add regions

    // Rows
    for (let row = 0; row < size; row++) {
        const rowCells = Array.from({ length: size }, (_, i) => board.cellIndex(row, i));
        board.addRegion(`Row ${row + 1}`, rowCells, 'row');
    }

    // Columns
    for (let col = 0; col < size; col++) {
        const colCells = Array.from({ length: size }, (_, i) => board.cellIndex(i, col));
        board.addRegion(`Col ${col + 1}`, colCells, 'col');
    }

    // Regions
    const uniqueRegions = new Map();
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const region = boardData.grid[row][col].region;
            if (region >= 0) {
                const regionKey = (region + 1).toString();
                if (!uniqueRegions.has(regionKey)) {
                    uniqueRegions.set(regionKey, []);
                }
                uniqueRegions.get(regionKey).push(board.cellIndex(row, col));
            }
        }
    }
    for (const regionKey of uniqueRegions.keys()) {
        const region = uniqueRegions.get(regionKey);
        if (region.length == size) {
            board.addRegion(`Region ${regionKey}`, region, 'region');
        }
    }

    // Add a weak link between all candidates within the same cell
    for (let cell = 0; cell < size * size; cell++) {
        for (let value1 = 1; value1 < size; value1++) {
            const cell1Candidate = board.candidateIndex(cell, value1);
            for (let value2 = value1 + 1; value2 <= size; value2++) {
                const cell2Candidate = board.candidateIndex(cell, value2);
                board.addWeakLink(cell1Candidate, cell2Candidate);
            }
        }
    }

    // Add constraints
    if (!buildConstraints(boardData, board)) {
        return null;
    }

    // At this point, all weak links should be added

    // Set the givens
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const srcCell = boardData.grid[i][j];
            const haveGivenPencilmarks = srcCell.givenPencilMarks?.length > 0;
            const haveCenterPencilmarks = srcCell.centerPencilMarks?.length > 0;
            const cellIndex = board.cellIndex(i, j);
            if (keepPencilMarks) {
                if (srcCell.value) {
                    if (!board.setAsGiven(cellIndex, srcCell.value)) {
                        return null;
                    }
                } else if (haveGivenPencilmarks && haveCenterPencilmarks) {
                    const pencilMarks = srcCell.givenPencilMarks.filter(value => srcCell.centerPencilMarks.includes(value));
                    if (!board.applyGivenPencilMarks(cellIndex, pencilMarks)) {
                        return null;
                    }
                } else if (haveGivenPencilmarks) {
                    if (!board.applyGivenPencilMarks(cellIndex, srcCell.givenPencilMarks)) {
                        return null;
                    }
                } else if (haveCenterPencilmarks) {
                    if (!board.applyGivenPencilMarks(cellIndex, srcCell.centerPencilMarks)) {
                        return null;
                    }
                }
            } else {
                 if (srcCell.given) {
                     if (!board.setAsGiven(cellIndex, srcCell.value)) {
                         return null;
                     }
                 } else if (haveGivenPencilmarks) {
                     if (!board.applyGivenPencilMarks(cellIndex, srcCell.givenPencilMarks)) {
                         return null;
                     }
                 }
            }
        }
    }

    // Clean up any naked singles which are alreay set as given
    const newNakedSingles = [];
    for (const cellIndex of board.nakedSingles) {
        if (!board.isGiven(cellIndex)) {
            newNakedSingles.push(cellIndex);
        }
    }
    board.nakedSingles = newNakedSingles;

    return board;
};

self.applyDefaultRegions = function (boardData) {
    const size = boardData.size;

    const regionSizes = {};
    for (let h = 1; h * h <= size; h++) {
        if (size % h === 0) {
            regionSizes.w = size / h;
            regionSizes.h = h;
        }
    }

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
			const cell = boardData.grid[row][col];
			if (cell.region === undefined) {
				cell.region = Math.floor(row / regionSizes.h) * regionSizes.h + Math.floor(col / regionSizes.w);
			}
		}
    }
};