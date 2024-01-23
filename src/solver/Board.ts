import {
    allValues,
    combinations,
    minValue,
    maxValue,
    permutations,
    popcount,
    sequenceEqual,
    valueBit,
    valuesMask,
    maskToString,
    randomValue,
    hasValue,
    CellIndex,
    CellMask,
    CellCoords,
    CellValue,
    CandidateIndex,
} from './SolveUtility';
import { NakedSingle } from './LogicalStep/NakedSingle';
import { HiddenSingle } from './LogicalStep/HiddenSingle';
import { ConstraintLogic } from './LogicalStep/ConstraintLogic';
import { CellForcing } from './LogicalStep/CellForcing';
import { NakedTupleAndPointing } from './LogicalStep/NakedTupleAndPointing';
import { LogicResult } from './Enums/LogicResult';
import { LogicalStep } from './LogicalStep/LogicalStep';
import { BinaryImplicationLayeredGraph } from './BinaryImplicationLayeredGraph';
import { TypedArrayPool, TypedArrayEntry } from './Memory/TypedArrayPool';
import { Fish } from './LogicalStep/Fish';
import { Constraint, ConstraintResult, LogicalDeduction } from './Constraint/Constraint';
import { Skyscraper } from './LogicalStep/Skyscraper';
import { SimpleContradiction } from './LogicalStep/SimpleContradiction';

export type RegionType = string;
export type Region = {
    name: string;
    fromConstraint: null | Constraint;
    type: RegionType;
    cells: CellIndex[];
};

export type SolveOptions = {
    random?: boolean;
    allowPreprocessing?: boolean;
    maxSolutions?: number;
    maxSolutionsPerCandidate?: number;
    enableStats?: boolean; // Setting to false / leaving unset doesn't guarantee all stats will be 0, but it does mean they are potentially meaningless.
};

export type SolveResultCancelled = {
    result: 'cancelled';
};
export type SolveResultBoard = {
    result: 'board';
    board: Board;
};
export type SolveResultNoSolution = {
    result: 'no solution';
};
export type SolveResultTrueCandidates = {
    result: 'true candidates';
    candidates: CandidateIndex[];
};
export type SolveResultTrueCandidatesWithCount = {
    result: 'true candidates with per-candidate solution count';
    candidates: CandidateIndex[];
    counts: number[];
};
export type SolveResultCancelledPartialSolutionCount = {
    result: 'cancelled partial count';
    count: number;
};
export type SolveResultSolutionCount = {
    result: 'count';
    count: number;
};
export type SolveResultLogicallyInvalid = {
    result: 'logically invalid';
    desc: string[];
};
export type SolveResultCancelledPartialLogicalSolve = {
    result: 'cancelled partial logical solve';
    desc: string[];
    changed: boolean;
};
export type SolveResultLogicalSolve = {
    result: 'logical solve';
    desc: string[];
    changed: boolean;
};

export interface Cloneable {
    clone(): this;
}

// Stats for brute force solves
export class SolveStats {
    // Before the solve, how many implications of each type there were (each implication is counted twice, as it includes the contrapositive)
    preSolveNegNegImplications: number;
    preSolveNegPosImplications: number;
    preSolvePosNegImplications: number;
    preSolvePosPosImplications: number;
    preSolveTotalImplications: number;
    // After the first preprocessing, how many implications of each type there were (each implication is counted twice, as it includes the contrapositive)
    postInitialPreprocessingNegNegImplications: number;
    postInitialPreprocessingNegPosImplications: number;
    postInitialPreprocessingPosNegImplications: number;
    postInitialPreprocessingPosPosImplications: number;
    postInitialPreprocessingTotalImplications: number;
    // After the solve, how many implications of each type there were (each implication is counted twice, as it includes the contrapositive)
    postSolveNegNegImplications: number;
    postSolveNegPosImplications: number;
    postSolvePosNegImplications: number;
    postSolvePosPosImplications: number;
    postSolveTotalImplications: number;

    // Number of guesses
    guesses: number;
    // How many times applyBruteForceLogic was called, split into whether it was a preprocessing or normal brute force pass
    preprocessingPasses: number;
    bruteForcePasses: number;
    // How many times we called preprocessingStep / bruteForceStep
    preprocessingSteps: number;
    bruteForceSteps: number;
    // How many times enforceNewMask was called (and the new mask was nonempty and actually different from the original mask)
    masksEnforced: number;
    // How many times enforce was called on any constraint
    constraintSinglesEnforced: number;
    // How many times enforceCandidateElim was called on any constraint
    constraintEliminationsEnforced: number;

    // Solve timings
    solveStartTimeMs: number;
    solveEndTimeMs: number;
    solveElapsedTimeMs: number;

    // Create board timings, not added by us but by index.js
    createStartTimeMs: number;
    createEndTimeMs: number;
    createElapsedTimeMs: number;

    constructor() {
        this.preSolveNegNegImplications = 0;
        this.preSolveNegPosImplications = 0;
        this.preSolvePosNegImplications = 0;
        this.preSolvePosPosImplications = 0;
        this.preSolveTotalImplications = 0;
        this.postInitialPreprocessingNegNegImplications = 0;
        this.postInitialPreprocessingNegPosImplications = 0;
        this.postInitialPreprocessingPosNegImplications = 0;
        this.postInitialPreprocessingPosPosImplications = 0;
        this.postInitialPreprocessingTotalImplications = 0;
        this.postSolveNegNegImplications = 0;
        this.postSolveNegPosImplications = 0;
        this.postSolvePosNegImplications = 0;
        this.postSolvePosPosImplications = 0;
        this.postSolveTotalImplications = 0;

        this.guesses = 0;
        this.preprocessingPasses = 0;
        this.bruteForcePasses = 0;
        this.preprocessingSteps = 0;
        this.bruteForceSteps = 0;
        this.masksEnforced = 0;
        this.constraintSinglesEnforced = 0;
        this.constraintEliminationsEnforced = 0;

        this.solveStartTimeMs = 0;
        this.solveEndTimeMs = 0;
        this.solveElapsedTimeMs = 0;

        this.createStartTimeMs = 0;
        this.createEndTimeMs = 0;
        this.createElapsedTimeMs = 0;
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type StateKey<T extends Cloneable> = number;

export enum LoopResult {
    UNCHANGED = 0,
    SCHEDULE_LOOP = 1,
    ABORT_LOOP = 2,
}

export class Board {
    static JUMP_BACK_THRESHOLD: number = 100;
    static JUMP_BACK_THRESHOLD_EXPONENT: number = 1.5;

    size: number;
    allValues: CellMask;
    givenBit: CellMask;
    cellsPool: TypedArrayPool<Uint16Array | Uint32Array>;
    cellsPoolEntry: TypedArrayEntry<Uint16Array | Uint32Array> | null;
    cells: Uint16Array | Uint32Array | null;
    cells64: BigUint64Array | null;
    invalidInit: boolean;
    nonGivenCount: number;
    nakedSingles: CellIndex[];
    binaryImplications: BinaryImplicationLayeredGraph;
    regions: Region[];
    constraints: Constraint[];
    constraintStates: Cloneable[];
    constraintStateIsCloned: (undefined | true)[];
    memos: Map<string, unknown>;
    logicalSteps: LogicalStep[];
    bruteForceExpensiveSteps: LogicalStep[];
    needsExpensiveBruteForceSteps: boolean = false;
    solveStats: SolveStats;

    constructor(size: number | undefined = undefined) {
        if (size !== undefined) {
            this.size = size;
            this.allValues = allValues(size);
            this.givenBit = 1 << size;
            this.cellsPool = new TypedArrayPool(size * size, size < 16 ? 2 : 4);
            this.allocateCells();
            this.cells.fill(this.allValues);
            this.invalidInit = false;
            this.nonGivenCount = size * size;
            this.nakedSingles = [];
            this.binaryImplications = new BinaryImplicationLayeredGraph(size * size * size);
            this.regions = [];
            this.constraints = [];
            this.constraintStates = [];
            this.constraintStateIsCloned = [];
            this.memos = new Map();

            this.bruteForceExpensiveSteps = [
                new ConstraintLogic(),
                new CellForcing(),
                new NakedTupleAndPointing(),
                new Fish([2]),
                new Skyscraper(),
                new Fish([3]),
                new SimpleContradiction(),
            ];

            this.logicalSteps = [
                //
                new NakedSingle(),
                new HiddenSingle(),
                new ConstraintLogic(),
                new CellForcing(),
                new NakedTupleAndPointing(),
            ];

            // Create a separate fish logical step for each size of fish
            for (let fishSize = 2; fishSize <= size / 2; fishSize++) {
                this.logicalSteps.push(new Fish([fishSize]));

                // Add skyscraper after x-wing
                if (fishSize === 2) {
                    this.logicalSteps.push(new Skyscraper());
                }
            }
            this.logicalSteps.push(new SimpleContradiction());

            this.solveStats = new SolveStats();
        }
    }

    // Copy board for backtracking purposes.
    // The "ruleset" is shared with the clone, so new constraints, weak links, etc. may not be introduced.
    clone() {
        const clone = new Board();
        clone.size = this.size;
        clone.allValues = this.allValues;
        clone.givenBit = this.givenBit;
        clone.cellsPool = this.cellsPool;

        // Deep copy cells
        clone.allocateCells();
        clone.cells64.set(this.cells64);

        clone.invalidInit = this.invalidInit;
        clone.nonGivenCount = this.nonGivenCount;
        clone.nakedSingles = this.nakedSingles.slice(); // Deep copy
        clone.binaryImplications = this.binaryImplications;
        clone.regions = this.regions;
        clone.constraints = this.constraints.map(constraint => constraint.clone()); // Clone constraints that need backtracking state
        clone.constraintStates = this.constraintStates.slice();
        clone.constraintStateIsCloned = [];
        // We can't mutate `this` state either as there may be a clone which references it
        this.constraintStateIsCloned = [];
        clone.memos = this.memos;
        clone.logicalSteps = this.logicalSteps;
        clone.bruteForceExpensiveSteps = this.bruteForceExpensiveSteps;
        clone.solveStats = this.solveStats;
        return clone;
    }

    // Copy board for subconstraint purposes.
    // Weak links are deeply copied, constraints and memo tables cleared
    // so that new rulesets (constraints, weak links, etc.) may be introduced.
    // Regions are preserved as they may contain information that constraints need for initialization.
    subboardClone() {
        const clone = new Board();
        clone.size = this.size;
        clone.allValues = this.allValues;
        clone.givenBit = this.givenBit;
        clone.cellsPool = this.cellsPool;

        // Deep copy cells
        clone.allocateCells();
        clone.cells64.set(this.cells64);

        clone.invalidInit = this.invalidInit;
        clone.nonGivenCount = this.nonGivenCount;
        clone.nakedSingles = this.nakedSingles.slice(); // Deep copy
        clone.binaryImplications = this.binaryImplications.subboardClone(); // Deep copy
        clone.regions = this.regions.slice(); // Deep copy
        clone.constraints = []; // Don't inherit constraints
        clone.constraintStates = [];
        clone.memos = new Map(); // Don't inherit memos
        clone.logicalSteps = this.logicalSteps;
        clone.bruteForceExpensiveSteps = this.bruteForceExpensiveSteps;
        clone.solveStats = this.solveStats;
        return clone;
    }

    private allocateCells() {
        this.cellsPoolEntry = this.cellsPool.get();
        this.cells = this.cellsPoolEntry.array;
        this.cells64 = this.cellsPoolEntry.array64;
    }

    release() {
        if (this.cellsPoolEntry === null) {
            throw new Error('Board has already been released');
        }

        // Release constraints
        for (const constraint of this.constraints) {
            constraint.release();
        }

        // Release cells
        this.cellsPool.release(this.cellsPoolEntry!);
        this.cellsPoolEntry = null!;
        this.cells = null!;
        this.cells64 = null!;
    }

    solutionString() {
        return JSON.stringify(this.getValueArray());
    }

    cellIndex(row: number, col: number): CellIndex {
        return row * this.size + col;
    }

    cellCoords(cellIndex: CellIndex): CellCoords {
        return { row: Math.floor(cellIndex / this.size), col: cellIndex % this.size };
    }

    candidateIndexRC(row: number, col: number, value: CellValue): CandidateIndex {
        return row * this.size * this.size + col * this.size + value - 1;
    }

    candidateIndex(cellIndex: CellIndex, value: CellValue): CandidateIndex {
        return cellIndex * this.size + value - 1;
    }

    cellIndexFromCandidate(candidateIndex: CandidateIndex) {
        return Math.floor(candidateIndex / this.size);
    }

    candidateToIndexAndValue(candidateIndex: CandidateIndex): [CellIndex, CellValue] {
        return [Math.floor(candidateIndex / this.size), (candidateIndex % this.size) + 1];
    }

    valueFromCandidate(candidateIndex: CandidateIndex) {
        return (candidateIndex % this.size) + 1;
    }

    maskStrictlyLower(v: CellValue) {
        return (1 << (v - 1)) - 1;
    }

    maskStrictlyHigher(v: CellValue) {
        return this.allValues ^ this.maskLowerOrEqual(v);
    }

    maskLowerOrEqual(v: CellValue) {
        return (1 << v) - 1;
    }

    maskHigherOrEqual(v: CellValue) {
        return this.allValues ^ this.maskStrictlyLower(v);
    }

    maskBetweenInclusive(v1: CellValue, v2: CellValue) {
        return this.maskHigherOrEqual(v1) & this.maskLowerOrEqual(v2);
    }

    maskBetweenExclusive(v1: CellValue, v2: CellValue) {
        return this.maskHigherOrEqual(v1) & this.maskStrictlyLower(v2);
    }

    addWeakLink(index1: CandidateIndex, index2: CandidateIndex): boolean {
        if (index1 === index2) {
            // Special case: If a weak link points at itself, we should eliminate it instead
            const [cellIndex, value] = this.candidateToIndexAndValue(index1);
            const valueMask = valueBit(value);
            const result = this.clearCellMask(cellIndex, valueMask);
            if (result === ConstraintResult.INVALID) {
                this.invalidInit = true;
            }
            return result === ConstraintResult.CHANGED;
        }

        const [cellIndex1, value1] = this.candidateToIndexAndValue(index1);
        const [cellIndex2, value2] = this.candidateToIndexAndValue(index2);

        // We always want to add the weak link as current functions like isGroup rely on it
        if (!this.binaryImplications.addImplication(index1, ~index2)) {
            return false;
        }

        // Enforce weak link now if one of the candidates is already set
        if (this.isGiven(cellIndex1) && (this.cells[cellIndex1] & this.allValues) === valueBit(value1)) {
            if (!this.clearCandidate(index2)) {
                this.invalidInit = true;
            }
        }
        if (this.isGiven(cellIndex2) && (this.cells[cellIndex2] & this.allValues) === valueBit(value2)) {
            if (!this.clearCandidate(index1)) {
                this.invalidInit = true;
            }
        }

        return true;
    }

    transferWeakLinkToParentSubboard(index1: CandidateIndex, index2: CandidateIndex): boolean {
        return this.binaryImplications.transferImplicationToParent(index1, ~index2);
    }

    isWeakLink(index1: CandidateIndex, index2: CandidateIndex) {
        return this.binaryImplications.hasImplication(index1, ~index2);
    }

    hasNoWeakLinkBetween(indices1: CandidateIndex[], indices2: CandidateIndex[]) {
        for (const index1 of indices1) {
            if (this.binaryImplications.hasAnyCommonNegConsequences(index1, indices2)) {
                return false;
            }
        }
        return true;
    }

    addRegion(name: string, cells: CellIndex[], type: RegionType, fromConstraint: null | Constraint = null, addWeakLinks: boolean = true): boolean {
        // Don't add regions which are too large
        if (cells.length > this.size) {
            return false;
        }

        // Do not add duplicate regions
        if (this.regions.some(region => fromConstraint === region.fromConstraint && sequenceEqual(region.cells, cells))) {
            return false;
        }

        const newRegion = {
            name,
            fromConstraint,
            type,
            cells: cells.toSorted((a, b) => a - b),
        };
        this.regions.push(newRegion);

        if (addWeakLinks) {
            for (let i0 = 0; i0 < cells.length - 1; i0++) {
                const cell0 = cells[i0];
                for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                    const cell1 = cells[i1];
                    this.addNonRepeatWeakLinks(cell0, cell1);
                }
            }
        }
        this.binaryImplications.sortGraph();

        return true;
    }

    getRegionsForType(type: RegionType): Region[] {
        return this.regions.filter(region => region.type === type);
    }

    getRegionsForCell(cellIndex: CellIndex, type: RegionType | null = null): Region[] {
        return this.regions.filter(region => region.cells.includes(cellIndex) && (type === null || region.type === type));
    }

    addConstraint(constraint: Constraint) {
        this.constraints.push(constraint);
    }

    // Calls `func` on all constraints in a loop
    // If a constraint is added and deleted in the same loop, `func` may or may not be called on it.
    // If func returns `ConstraintResult.CHANGED`, then another loop is scheduled.
    // If func returns `ConstraintResult.INVALID`, then the function aborts immediately.
    loopConstraints(func: (constraint: Constraint) => LoopResult) {
        let loopAgain = false;
        do {
            loopAgain = false;
            for (const constraint of this.constraints.slice()) {
                const result = func(constraint);
                if (result === LoopResult.ABORT_LOOP) {
                    return;
                }
                if (result === LoopResult.SCHEDULE_LOOP) {
                    loopAgain = true;
                }
            }
        } while (loopAgain);
    }

    applyLogicalDeduction(deduction: LogicalDeduction): ConstraintResult {
        let haveChange = false;
        if (deduction.invalid) {
            return ConstraintResult.INVALID;
        }
        if (deduction.singles && deduction.singles.length > 0) {
            if (!this.enforceCandidates(deduction.singles)) {
                return ConstraintResult.INVALID;
            }
            haveChange = true;
        }
        if (deduction.eliminations && deduction.eliminations.length > 0) {
            if (!this.clearCandidates(deduction.eliminations)) {
                return ConstraintResult.INVALID;
            }
            haveChange = true;
        }
        if (deduction.addConstraints && deduction.addConstraints.length > 0) {
            for (const constraint of deduction.addConstraints) {
                this.addConstraint(constraint);
            }
            haveChange = true;
        }
        if (deduction.deleteConstraints && deduction.deleteConstraints.length > 0) {
            this.constraints = this.constraints.filter(constraint => !deduction.deleteConstraints.includes(constraint));
            haveChange = true;
        }
        if (deduction.weakLinks && deduction.weakLinks.length > 0) {
            for (const link of deduction.weakLinks) {
                this.addWeakLink(link[0], link[1]);
            }
            this.binaryImplications.sortGraph();
            haveChange = true;
        }
        if (deduction.implications && deduction.implications.length > 0) {
            for (const implication of deduction.implications) {
                this.binaryImplications.addImplication(implication[0], implication[1]);
            }
            haveChange = true;
        }
        return haveChange ? ConstraintResult.CHANGED : ConstraintResult.UNCHANGED;
    }

    // Recursively inits this constraint and any constraints it creates
    // If a single constraint fails initialization, returns false
    // Modifies `this.constraints`, so remember to .slice() before iterating if looping over constraints when calling this function.
    initSingleConstraint(initialConstraint: Constraint): boolean {
        const uninitedConstraints: Constraint[] = [initialConstraint];
        while (uninitedConstraints.length > 0) {
            const constraint = uninitedConstraints.pop();
            const result = constraint.init(this);
            const payload = typeof result === 'object' ? result : null;
            const constraintResult = typeof result === 'object' ? result.result : result;

            if (constraintResult === ConstraintResult.INVALID) {
                return false;
            }

            if (payload) {
                if (payload.weakLinks && payload.weakLinks.length > 0) {
                    for (const link of payload.weakLinks) {
                        this.addWeakLink(link[0], link[1]);
                    }
                    this.binaryImplications.sortGraph();
                }
                if (payload.implications && payload.implications.length > 0) {
                    for (const implication of payload.implications) {
                        this.binaryImplications.addImplication(implication[0], implication[1]);
                    }
                    this.binaryImplications.sortGraph();
                }
                if (payload.addConstraints && payload.addConstraints.length > 0) {
                    this.constraints.push(...payload.addConstraints);
                    uninitedConstraints.push(...payload.addConstraints);
                }
                if (payload.deleteConstraints && payload.deleteConstraints.length > 0) {
                    this.constraints = this.constraints.filter(constraint => !payload.deleteConstraints.includes(constraint));
                }
            }
        }
        return true;
    }

    finalizeConstraints() {
        for (const constraint of this.constraints.slice()) {
            if (!this.initSingleConstraint(constraint)) {
                return false;
            }
        }
        return true;
    }

    // Register/use mutable constraint state.
    //
    // Constraints are not cloned during search, so they may not contain mutable state
    // as they may become invalidated during backtracking.
    //
    // Instead, constraints should register any mutable states with the board during init,
    // and use getState/getStateMut to access this state.
    //
    // registerState accepts an initial state object, which must contain a `clone` method,
    // and returns a state key which should be passed to getState/getStateMut
    // to retrieve the corresponding state object.
    //
    // getState should be used if the constraint is unsure if modifications will occur,
    // and must call getStateMut before making any modifications. getStateMut will then
    // lazily perform a clone depending on whether this is the first modification since
    // the previous branch.
    registerState<T extends Cloneable>(initialState: T): StateKey<T> {
        if (typeof initialState.clone !== 'function') {
            throw new Error("All constraint state objects must contain a 'clone' method");
        }
        this.constraintStates.push(initialState);
        this.constraintStateIsCloned.push(true);
        return this.constraintStates.length - 1;
    }

    getState<T extends Cloneable>(stateKey: StateKey<T>): T {
        return this.constraintStates[stateKey] as T;
    }

    getStateMut<T extends Cloneable>(stateKey: StateKey<T>): T {
        if (!this.constraintStateIsCloned[stateKey]) {
            this.constraintStateIsCloned[stateKey] = true;
            this.constraintStates[stateKey] = this.constraintStates[stateKey].clone();
        }
        return this.constraintStates[stateKey] as T;
    }

    addNonRepeatWeakLinks(cellIndex1: CellIndex, cellIndex2: CellIndex) {
        if (cellIndex1 === cellIndex2) {
            return;
        }

        for (let value = 1; value <= this.size; value++) {
            const candidateIndex1 = this.candidateIndex(cellIndex1, value);
            const candidateIndex2 = this.candidateIndex(cellIndex2, value);
            this.addWeakLink(candidateIndex1, candidateIndex2);
        }
        this.binaryImplications.sortGraph();
    }

    addCloneWeakLinks(cellIndex1: CellIndex, cellIndex2: CellIndex) {
        if (cellIndex1 === cellIndex2) {
            return;
        }

        for (let value1 = 1; value1 <= this.size; value1++) {
            const candidateIndex1 = this.candidateIndex(cellIndex1, value1);
            for (let value2 = 1; value2 <= this.size; value2++) {
                if (value1 === value2) {
                    continue;
                }

                const candidateIndex2 = this.candidateIndex(cellIndex2, value2);
                this.addWeakLink(candidateIndex1, candidateIndex2);
            }
        }
        this.binaryImplications.sortGraph();
    }

    getMemo<T>(key: string): T {
        // Simply return the value at the key, or null if it doesn't exist
        return (this.memos.get(key) as T) || null;
    }

    storeMemo<T>(key: string, val: T) {
        this.memos.set(key, val);
    }

    enforceNewMask(cellIndex: CellIndex, origMask: CellMask): boolean {
        const cellMask = this.cells[cellIndex] & this.allValues;
        if (cellMask === 0) {
            return false;
        }

        if (cellMask === origMask) {
            return true;
        }

        this.solveStats.masksEnforced++;

        if (popcount(cellMask) === 1) {
            this.nakedSingles.push(cellIndex);
        }

        // Check for binary implications
        let removedMask = origMask & ~cellMask;
        while (removedMask !== 0) {
            const value = minValue(removedMask);
            removedMask &= ~valueBit(value);

            const candidateIndex = this.candidateIndex(cellIndex, value);
            const negConsequences = this.binaryImplications.getNegConsequences(~candidateIndex);
            for (const negConsequence of negConsequences) {
                const [cellIndex2, value2] = this.candidateToIndexAndValue(negConsequence);
                if (!this.clearValue(cellIndex2, value2)) {
                    return false;
                }
            }
            const posConsequences = this.binaryImplications.getPosConsequences(~candidateIndex);
            for (const posConsequence of posConsequences) {
                const [cellIndex2, value2] = this.candidateToIndexAndValue(posConsequence);
                if (!this.setAsGiven(cellIndex2, value2)) {
                    return false;
                }
            }
        }

        // Check for constraint implications
        removedMask = origMask & ~cellMask;
        while (removedMask !== 0) {
            const value = minValue(removedMask);
            removedMask &= ~valueBit(value);

            for (const constraint of this.constraints) {
                this.solveStats.constraintEliminationsEnforced++;
                if (!constraint.enforceCandidateElim(this, cellIndex, value)) {
                    return false;
                }
            }
        }

        return true;
    }

    setCellMask(cellIndex: CellIndex, cellMask: CellMask) {
        const origMask = this.cells[cellIndex] & this.allValues;
        this.cells[cellIndex] = cellMask;
        return this.enforceNewMask(cellIndex, origMask);
    }

    keepCellMask(cellIndex: CellIndex, cellMask: CellMask) {
        const origMask = this.cells[cellIndex] & this.allValues;
        const newMask = origMask & cellMask;
        if (newMask === origMask) {
            return ConstraintResult.UNCHANGED;
        }

        this.cells[cellIndex] = newMask;
        if (!this.enforceNewMask(cellIndex, origMask)) {
            return ConstraintResult.INVALID;
        }
        return ConstraintResult.CHANGED;
    }

    clearCellMask(cellIndex: CellIndex, cellMask: CellMask) {
        return this.keepCellMask(cellIndex, this.allValues & ~cellMask);
    }

    clearValue(cellIndex: CellIndex, value: CellValue) {
        const origMask = this.cells[cellIndex] & this.allValues;
        this.cells[cellIndex] &= ~valueBit(value);
        return this.enforceNewMask(cellIndex, origMask);
    }

    clearCandidate(candidate: CandidateIndex) {
        const [cellIndex, value] = this.candidateToIndexAndValue(candidate);
        return this.clearValue(cellIndex, value);
    }

    clearCandidates(candidates: CandidateIndex[]) {
        let valid = true;
        for (const candidate of candidates) {
            if (!this.clearCandidate(candidate)) {
                valid = false;
            }
        }
        return valid;
    }

    enforceValue(cellIndex: CellIndex, value: CellValue) {
        const origMask = this.cells[cellIndex] & this.allValues;
        this.cells[cellIndex] &= valueBit(value);
        return this.enforceNewMask(cellIndex, origMask);
    }

    enforceCandidate(candidate: CandidateIndex) {
        const [cellIndex, value] = this.candidateToIndexAndValue(candidate);
        return this.enforceValue(cellIndex, value);
    }

    enforceCandidates(candidates: CandidateIndex[]) {
        let valid = true;
        for (const candidate of candidates) {
            if (!this.enforceCandidate(candidate)) {
                valid = false;
            }
        }
        return valid;
    }

    // TODO: Move this into BIG and possibly cache cliques there
    //       Caching maximal cliques might be useful if I can think of how to do preprocessing passes with them
    isGroup(cells: CellIndex[]) {
        for (let i0 = 0; i0 < cells.length - 1; i0++) {
            const cell0 = cells[i0];
            for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                const cell1 = cells[i1];
                if (cell0 === cell1) {
                    continue;
                }

                for (let value = 1; value <= this.size; value++) {
                    const candidate0 = this.candidateIndex(cell0, value);
                    const candidate1 = this.candidateIndex(cell1, value);
                    if (!this.isWeakLink(candidate0, candidate1)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    isGroupByValue(cells: CellIndex[], value: CellValue) {
        for (let i0 = 0; i0 < cells.length - 1; i0++) {
            const cell0 = cells[i0];
            const candidate0 = this.candidateIndex(cell0, value);
            for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                const cell1 = cells[i1];
                if (cell0 === cell1) {
                    continue;
                }

                const candidate1 = this.candidateIndex(cell1, value);
                if (!this.isWeakLink(candidate0, candidate1)) {
                    return false;
                }
            }
        }
        return true;
    }

    isGroupByValueMask(cells: CellIndex[], valueMask: CellMask) {
        for (let i0 = 0; i0 < cells.length - 1; i0++) {
            const cell0 = cells[i0];
            for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                const cell1 = cells[i1];
                if (cell0 === cell1) {
                    continue;
                }

                while (valueMask !== 0) {
                    const value = minValue(valueMask);
                    const candidate0 = this.candidateIndex(cell0, value);
                    const candidate1 = this.candidateIndex(cell1, value);
                    if (!this.isWeakLink(candidate0, candidate1)) {
                        return false;
                    }
                    valueMask ^= valueBit(value);
                }
            }
        }
        return true;
    }

    splitIntoGroups(cells: CellIndex[]) {
        const groups: CellIndex[][] = [];

        if (cells.length === 0) {
            return groups;
        }
        if (cells.length === 1) {
            groups.push(cells);
            return groups;
        }

        // Find the largest group and remove it from the cells
        const numCells = cells.length;
        for (let groupSize = numCells; groupSize >= 2; groupSize--) {
            for (const subCells of combinations(cells, groupSize)) {
                if (this.isGroup(subCells)) {
                    groups.push(subCells);
                    if (groupSize !== numCells) {
                        const remainingGroups = this.splitIntoGroups(cells.filter(cell => !subCells.includes(cell)));
                        groups.push(...remainingGroups);
                    }
                    return groups;
                }
            }
        }

        // If we get here, then the cells are each in their own group
        for (const cell of cells) {
            groups.push([cell]);
        }
        return groups;
    }

    applyBruteForceLogic(isDepth0: boolean) {
        const doExpensiveSteps = this.needsExpensiveBruteForceSteps;
        this.needsExpensiveBruteForceSteps = false;

        if (isDepth0) {
            this.solveStats.preprocessingPasses++;
        } else {
            this.solveStats.bruteForcePasses++;
        }

        let changed = false;
        let ranDiscoverBinaryImplications = false;
        while (true) {
            // Just in case, check if the board is completed
            if (this.nonGivenCount === 0) {
                return LogicResult.COMPLETE;
            }

            const initialNonGivenCount = this.nonGivenCount;
            let changedThisRound = false;
            let result = this.applyNakedSingles();
            if (result === LogicResult.INVALID || result === LogicResult.COMPLETE) {
                return result;
            }
            if (result === LogicResult.CHANGED) {
                changedThisRound = true;
                changed = true;
                // Continue on to hidden singles because naked singles apply
                // Until there are no more naked singles
            }

            result = this.applyHiddenSingles();
            if (result === LogicResult.INVALID || result === LogicResult.COMPLETE) {
                return result;
            }

            if (result === LogicResult.CHANGED) {
                changedThisRound = true;
                changed = true;
                // Keep looking for logic until there is none
                continue;
            }

            if (doExpensiveSteps) {
                // Look for expensive brute force steps
                for (const step of this.bruteForceExpensiveSteps) {
                    result = step.step(this, null);
                    if (result === LogicResult.INVALID || result === LogicResult.COMPLETE) {
                        return result;
                    }

                    if (result === LogicResult.CHANGED) {
                        changedThisRound = true;
                        changed = true;
                        // Keep looking for logic until there is none
                        continue;
                    }
                }
            } else {
                if (isDepth0) {
                    // Temporary hack: At depth 0, run cell forcing
                    // We need this as more and more constraints are becoming weaklinks based which is super weak without the support encoding.
                    // TODO: When we have LUT based cell forcing, see if this is fast enough to run at all levels of the solve
                    result = new CellForcing().step(this, null);
                    if (result === LogicResult.INVALID || result === LogicResult.COMPLETE) {
                        return result;
                    }

                    if (result === LogicResult.CHANGED) {
                        changedThisRound = true;
                        changed = true;
                        // Keep looking for logic until there is none
                        continue;
                    }
                }

                // If we get here, then there are no more singles to find
                // Allow constraints to apply their logic
                if (!isDepth0) {
                    for (const constraint of this.constraints) {
                        const result = constraint.bruteForceStep(this);
                        this.solveStats.bruteForceSteps++;
                        if (result === ConstraintResult.INVALID) {
                            return LogicResult.INVALID;
                        }
                        if (result === ConstraintResult.CHANGED) {
                            changedThisRound = true;
                            changed = true;
                            break;
                        }
                    }
                } else {
                    for (const constraint of this.constraints.slice()) {
                        const result = constraint.preprocessingStep(this);
                        this.solveStats.preprocessingSteps++;
                        const payload = typeof result === 'object' ? result : null;
                        const constraintResult = typeof result === 'object' ? result.result : result;
                        if (constraintResult === ConstraintResult.INVALID) {
                            return LogicResult.INVALID;
                        }
                        if (constraintResult === ConstraintResult.CHANGED) {
                            changedThisRound = true;
                            changed = true;
                        }
                        if (payload) {
                            if (payload.addConstraints && payload.addConstraints.length > 0) {
                                for (const constraint of payload.addConstraints) {
                                    this.constraints.push(constraint);
                                    this.initSingleConstraint(constraint);
                                }
                                changedThisRound = true;
                                changed = true;
                            }
                            if (payload.deleteConstraints && payload.deleteConstraints.length > 0) {
                                this.constraints = this.constraints.filter(constraint => !payload.deleteConstraints.includes(constraint));
                            }
                            if (payload.weakLinks && payload.weakLinks.length > 0) {
                                for (const [index1, index2] of payload.weakLinks) {
                                    this.addWeakLink(index1, index2);
                                }
                                this.binaryImplications.sortGraph();
                                changedThisRound = true;
                                changed = true;
                            }
                            if (payload.implications && payload.implications.length > 0) {
                                for (const [index1, index2] of payload.implications) {
                                    this.binaryImplications.addImplication(index1, index2);
                                }
                                changedThisRound = true;
                                changed = true;
                            }
                        }
                        if (changedThisRound) {
                            break;
                        }
                    }
                }

                if (changedThisRound || initialNonGivenCount !== this.nonGivenCount || this.nakedSingles.length !== 0) {
                    // Keep looking for logic until there is none
                    continue;
                }
            }

            // Look for pairs (fast brute-force method)
            result = this.applyPairs();
            if (result === LogicResult.INVALID) {
                return result;
            }

            if (result === LogicResult.CHANGED) {
                changedThisRound = true;
                changed = true;
                // Keep looking for logic until there is none
                continue;
            }

            if (!changedThisRound && initialNonGivenCount === this.nonGivenCount && this.nakedSingles.length === 0) {
                if (isDepth0 && !ranDiscoverBinaryImplications) {
                    ranDiscoverBinaryImplications = true;

                    result = this.discoverBinaryImplications();
                    if (result === LogicResult.INVALID) {
                        return result;
                    }

                    if (result === LogicResult.CHANGED) {
                        changedThisRound = true;
                        changed = true;
                        // Keep looking for logic until there is none
                        continue;
                    }
                }

                return changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
            }
        }
    }

    canPlaceDigits(cells: CellIndex[], values: CellValue[]) {
        const numCells = cells.length;
        if (numCells != values.length) {
            throw new Error('cells and values must have the same length');
        }

        // Ensure these values fit into the cell masks at all
        for (let inCellIndex = 0; inCellIndex < numCells; inCellIndex++) {
            const cellIndex = cells[inCellIndex];
            const value = values[inCellIndex];
            if (!hasValue(this.cells[cellIndex], value)) {
                return false;
            }
        }

        // Convert the cell + values to candidate indexes
        const candidates = new Array(numCells);
        for (let inCellIndex = 0; inCellIndex < numCells; inCellIndex++) {
            const cellIndex = cells[inCellIndex];
            const value = values[inCellIndex];
            candidates[inCellIndex] = this.candidateIndex(cellIndex, value);
        }

        // Check if there are any weak links between candidates. If so, this isn't placeable.
        return this.hasNoWeakLinkBetween(candidates, candidates);
    }

    // TODO: I feel like this should loop over the cell masks restricted to values,
    //       so eg if values is 1234 but cell0 can only be 12, we don't have to enumerate half of the permutations with cell0 = 3 or 4 at all
    canPlaceDigitsAnyOrder(cells: CellIndex[], values: CellValue[]) {
        const numCells = cells.length;
        if (numCells != values.length) {
            throw new Error('cells and values must have the same length');
        }

        let combMask = 0;
        for (let i = 0; i < numCells; i++) {
            const cellIndex = cells[i];
            combMask |= this.cells[cellIndex];
        }

        const needMask = valuesMask(values);

        if ((needMask & combMask) != needMask) {
            return false;
        }

        for (const perm of permutations(values)) {
            if (this.canPlaceDigits(cells, perm)) {
                return true;
            }
        }

        return false;
    }

    valueNames(mask: CellMask) {
        return maskToString(mask, this.size);
    }

    compactName(cells: CellIndex[], mask: CellMask = null) {
        let valuesString = '';
        if (mask) {
            valuesString += this.valueNames(mask);
        }

        const cellSep = this.size <= 9 ? '' : ',';
        const groupSep = ',';

        if (cells.length === 0) {
            return valuesString;
        }

        const cellCoords = cells.map(cellIndex => this.cellCoords(cellIndex));

        if (cells.length === 1) {
            // For consistency format this ourselves with lowercase r/c rather than cellName, which uses uppercase
            return `${valuesString}r${cellCoords[0].row + 1}c${cellCoords[0].col + 1}`;
        }

        if (cellCoords.every(coord => coord.row === cellCoords[0].row)) {
            // All cells are in the same row
            return (
                valuesString +
                `r${cellCoords[0].row + 1}c${cellCoords
                    .map(coord => coord.col + 1)
                    .sort((a, b) => a - b)
                    .join(cellSep)}`
            );
        }

        if (cellCoords.every(coord => coord.col === cellCoords[0].col)) {
            // All cells are in the same column
            return (
                valuesString +
                `r${cellCoords
                    .map(coord => coord.row + 1)
                    .sort((a, b) => a - b)
                    .join(cellSep)}c${cellCoords[0].col + 1}`
            );
        }

        const colsPerRow: number[][] = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            colsPerRow[i] = [];
        }
        for (const { row, col } of cellCoords) {
            colsPerRow[row].push(col + 1);
        }
        for (let i = 0; i < this.size; i++) {
            colsPerRow[i].sort((a, b) => a - b);
        }

        const groups: string[] = [];
        for (let i = 0; i < this.size; i++) {
            if (colsPerRow[i].length === 0) {
                continue;
            }

            const rowsInGroup = [i + 1];
            for (let j = i + 1; j < this.size; j++) {
                if (colsPerRow[j].length === colsPerRow[i].length && colsPerRow[j].every((value, index) => value === colsPerRow[i][index])) {
                    rowsInGroup.push(j + 1);
                    colsPerRow[j].length = 0;
                }
            }

            groups.push(`r${rowsInGroup.join(cellSep)}c${colsPerRow[i].join(cellSep)}`);
        }

        return valuesString + groups.join(groupSep);
    }

    // TODO: Is this probably the same thing as clearCandidates
    performElims(elims: CandidateIndex[]) {
        let changed = false;
        for (const elim of elims) {
            const [cellIndex, value] = this.candidateToIndexAndValue(elim);
            if (!this.clearValue(cellIndex, value)) {
                return LogicResult.INVALID;
            }
            changed = true;
        }
        return changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    describeCandidates(candidates: CandidateIndex[], isElim: boolean = false) {
        const minusSign = isElim ? '-' : '';
        // If all candidates are for the same cell, describe it as a single cell
        const cellIndexes: Set<CellIndex> = new Set();
        for (const cand of candidates) {
            cellIndexes.add(this.cellIndexFromCandidate(cand));
        }
        if (cellIndexes.size === 1) {
            const cellIndex: CellIndex = cellIndexes.values().next().value;
            const cellCoords = this.cellCoords(cellIndex);
            let candMask = 0;
            for (const cand of candidates) {
                candMask |= valueBit(this.valueFromCandidate(cand));
            }
            // For consistency format this ourselves with lowercase r/c rather than cellName, which uses uppercase
            return `${minusSign}${this.valueNames(candMask)}r${cellCoords.row + 1}c${cellCoords.col + 1}`;
        }

        const candsByVal: CandidateIndex[][] = Array.from({ length: this.size }, () => []);
        for (const cand of candidates) {
            const [cellIndex, value] = this.candidateToIndexAndValue(cand);
            candsByVal[value - 1].push(cellIndex);
        }

        const candDescs: string[] = [];
        for (let value = 1; value <= this.size; value++) {
            const candCells = candsByVal[value - 1];
            if (candCells.length > 0) {
                candCells.sort((a, b) => a - b);
                candDescs.push(`${minusSign}${value}${this.compactName(candCells)}`);
            }
        }
        return candDescs.join(';');
    }
    describeElims(elims: CandidateIndex[]) {
        return this.describeCandidates(elims, true);
    }

    // Pass in an array of candidate indexes
    // Returns an array of candidate indexes which are eliminated by all of the input candidates
    calcElimsForCandidateIndices(candidateIndexes: CandidateIndex[]): CandidateIndex[] {
        if (candidateIndexes.length === 0) {
            return [];
        }

        const allElims = this.binaryImplications.getCommonNegConsequences(candidateIndexes);
        // Intersect with existing candidates
        const filteredElims = allElims.filter(elim => {
            const [cellIndex, value] = this.candidateToIndexAndValue(elim);
            return this.cells[cellIndex] & valueBit(value);
        });
        return filteredElims;
    }

    // Pass in an array of candidate indexes
    // Returns an array of candidate indexes which are guaranteed to be true by all of the input candidates
    calcSinglesForCandidateIndices(candidateIndexes: CandidateIndex[]): CandidateIndex[] {
        const allSingles = this.binaryImplications.getCommonPosConsequences(candidateIndexes);
        // Intersect with existing candidates
        const filteredSingles = allSingles.filter(single => {
            const [cellIndex, value] = this.candidateToIndexAndValue(single);
            return (this.cells[cellIndex] & this.allValues) !== valueBit(value);
        });
        return filteredSingles;
    }

    private applyNakedSingles() {
        let changed = false;
        while (this.nakedSingles.length > 0) {
            const cellIndex = this.nakedSingles.pop();
            const value = this.getValue(cellIndex);

            if (!this.setAsGiven(cellIndex, value)) {
                return LogicResult.INVALID;
            }
            changed = true;
        }

        return this.nonGivenCount === 0 ? LogicResult.COMPLETE : changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    private applyHiddenSingles() {
        const { size, givenBit, cells, allValues } = this;
        let changed = false;
        for (const region of this.regions) {
            const regionCells = region.cells;
            if (regionCells.length !== size) {
                continue;
            }

            let atLeastOnce = 0;
            let moreThanOnce = 0;
            let givenMask = 0;
            for (const cellIndex of regionCells) {
                const cellMask = cells[cellIndex];
                if (this.isGiven(cellIndex)) {
                    givenMask |= cellMask;
                } else {
                    moreThanOnce |= atLeastOnce & cellMask;
                    atLeastOnce |= cellMask;
                }
            }
            givenMask &= ~givenBit;

            if ((atLeastOnce | givenMask) !== allValues) {
                // Puzzle is invalid: Not all values are present in the region
                return LogicResult.INVALID;
            }

            const exactlyOnce = atLeastOnce & ~moreThanOnce;
            for (const cellIndex of regionCells) {
                const cellMask = cells[cellIndex] & exactlyOnce;
                if (cellMask) {
                    if (!this.setAsGiven(cellIndex, minValue(cellMask))) {
                        return LogicResult.INVALID;
                    }
                    changed = true;
                }
            }
        }

        return this.nonGivenCount === 0 ? LogicResult.COMPLETE : changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    private applyPairs() {
        const maxPairMask = valueBit(this.size) | valueBit(this.size - 1);
        const usedMasks: Array<CellMask> = [];
        const pairCells = new Array(maxPairMask);

        const cellCount = this.size * this.size;
        for (let i = 0; i < cellCount; i++) {
            const cellMask = this.cells[i];
            if (this.isGivenMask(cellMask)) {
                continue;
            }

            const numValues = popcount(cellMask);
            if (numValues === 2) {
                if (pairCells[cellMask] === undefined) {
                    usedMasks.push(cellMask);
                    pairCells[cellMask] = [i];
                } else {
                    pairCells[cellMask].push(i);
                }
            }
        }

        if (usedMasks.length === 0) {
            return LogicResult.UNCHANGED;
        }

        // Go in order for cache locality
        usedMasks.sort((a, b) => a - b);

        let changed = false;
        for (const cellMask of usedMasks) {
            const pairCellIndexes = pairCells[cellMask];
            if (pairCellIndexes.length < 2) {
                continue;
            }

            const pairValue0 = minValue(cellMask);
            const pairValue1 = maxValue(cellMask);

            for (let index0 = 0; index0 < pairCellIndexes.length - 1; index0++) {
                const cellIndex0 = pairCellIndexes[index0];
                const candidate0v0 = this.candidateIndex(cellIndex0, pairValue0);
                const candidate0v1 = this.candidateIndex(cellIndex0, pairValue1);

                for (let index1 = index0 + 1; index1 < pairCellIndexes.length; index1++) {
                    const cellIndex1 = pairCellIndexes[index1];
                    const candidate1v0 = this.candidateIndex(cellIndex1, pairValue0);
                    const candidate1v1 = this.candidateIndex(cellIndex1, pairValue1);

                    if (this.isWeakLink(candidate0v0, candidate1v0) && this.isWeakLink(candidate0v1, candidate1v1)) {
                        const elims1 = this.calcElimsForCandidateIndices([candidate0v0, candidate1v0]);
                        if (elims1.length > 0) {
                            const result = this.performElims(elims1);
                            if (result === LogicResult.INVALID) {
                                return result;
                            }

                            if (result === LogicResult.CHANGED) {
                                changed = true;
                            }
                        }

                        const elims2 = this.calcElimsForCandidateIndices([candidate0v1, candidate1v1]);
                        if (elims2.length > 0) {
                            const result = this.performElims(elims2);
                            if (result === LogicResult.INVALID) {
                                return result;
                            }

                            if (result === LogicResult.CHANGED) {
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        return changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    private discoverBinaryImplications() {
        const { size, cells } = this;
        const totalCells = size * size;

        let addedImplications = false;
        const invalidCandidates: CandidateIndex[] = [];
        const alwaysTrueCandidates: CandidateIndex[] = [];
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cellMask = cells[cellIndex];
            if (this.isGivenMask(cellMask)) {
                continue;
            }

            // Find truth implications
            for (let value = 1; value <= size; value++) {
                if ((cellMask & valueBit(value)) === 0) {
                    continue;
                }
                const candidateIndex = this.candidateIndex(cellIndex, value);

                const newBoard = this.clone();
                if (!newBoard.setAsGiven(cellIndex, value)) {
                    invalidCandidates.push(candidateIndex);
                    continue;
                }

                const bruteForceResult = newBoard.applyBruteForceLogic(false);
                if (bruteForceResult === LogicResult.INVALID) {
                    invalidCandidates.push(candidateIndex);
                    continue;
                }

                if (bruteForceResult !== LogicResult.UNCHANGED) {
                    if (this.addBinaryImplicationsFromTruth(candidateIndex, newBoard)) {
                        this.binaryImplications.sortGraph();
                        addedImplications = true;
                    }
                }
            }

            // Find false implications
            for (let value = 1; value <= size; value++) {
                if ((cellMask & valueBit(value)) === 0) {
                    continue;
                }
                const candidateIndex = this.candidateIndex(cellIndex, value);

                const newBoard = this.clone();
                if (!newBoard.clearValue(cellIndex, value)) {
                    alwaysTrueCandidates.push(candidateIndex);
                    continue;
                }

                const bruteForceResult = newBoard.applyBruteForceLogic(false);
                if (bruteForceResult === LogicResult.INVALID) {
                    alwaysTrueCandidates.push(candidateIndex);
                    continue;
                }

                if (bruteForceResult !== LogicResult.UNCHANGED) {
                    if (this.addBinaryImplicationsFromFalse(candidateIndex, newBoard)) {
                        this.binaryImplications.sortGraph();
                        addedImplications = true;
                    }
                }
            }
        }

        let changed = addedImplications;
        for (const invalidCandidate of invalidCandidates) {
            if (!this.clearCandidate(invalidCandidate)) {
                return LogicResult.INVALID;
            }
            changed = true;
        }

        for (const alwaysTrueCandidate of alwaysTrueCandidates) {
            const [cellIndex, value] = this.candidateToIndexAndValue(alwaysTrueCandidate);
            if (!this.setAsGiven(cellIndex, value)) {
                return LogicResult.INVALID;
            }
            changed = true;
        }

        return changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    private addBinaryImplicationsFromTruth(trueCandidateIndex: CandidateIndex, newBoard: Board) {
        const { size, cells, givenBit } = this;
        const { cells: newCells } = newBoard;
        const totalCells = size * size;

        let changed = false;
        const trueCellIndex = this.cellIndexFromCandidate(trueCandidateIndex);
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            if (cellIndex === trueCellIndex) {
                continue;
            }

            const cellMask0 = cells[cellIndex];
            const cellMask1 = newCells[cellIndex];
            if (cellMask0 === cellMask1) {
                continue;
            }

            // At this point, cellMask0 is guaranteed to not be a given
            // because if it was, then cellMask1 would be the same as cellMask0

            if ((cellMask1 & givenBit) !== 0) {
                // If the new mask is a given, then we can add a positive implication
                const value1 = minValue(cellMask1);
                const candidate1 = this.candidateIndex(cellIndex, value1);
                if (this.binaryImplications.addImplication(trueCandidateIndex, candidate1)) {
                    changed = true;
                }
            } else {
                // Otherwise we check for negative implications
                let eliminatedMask = cellMask0 & ~cellMask1;
                while (eliminatedMask !== 0) {
                    const value = minValue(eliminatedMask);
                    eliminatedMask &= ~valueBit(value);

                    const eliminatedCandidateIndex = this.candidateIndex(cellIndex, value);
                    if (this.binaryImplications.addImplication(trueCandidateIndex, ~eliminatedCandidateIndex)) {
                        changed = true;
                    }
                }
            }
        }
        return changed;
    }

    private addBinaryImplicationsFromFalse(falseCandidateIndex: CandidateIndex, newBoard: Board) {
        const { size, cells, givenBit } = this;
        const { cells: newCells } = newBoard;
        const totalCells = size * size;
        const negatedFalseCandidateIndex = ~falseCandidateIndex;

        let changed = false;
        const falseCellIndex = this.cellIndexFromCandidate(falseCandidateIndex);
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            if (cellIndex === falseCellIndex) {
                continue;
            }

            const cellMask0 = cells[cellIndex];
            const cellMask1 = newCells[cellIndex];
            if (cellMask0 === cellMask1) {
                continue;
            }

            // At this point, cellMask0 is guaranteed to not be a given
            // because if it was, then cellMask1 would be the same as cellMask0

            if ((cellMask1 & givenBit) !== 0) {
                // If the new mask is a given, then we can add a positive implication
                const value1 = minValue(cellMask1);
                const candidate1 = this.candidateIndex(cellIndex, value1);
                if (this.binaryImplications.addImplication(negatedFalseCandidateIndex, candidate1)) {
                    changed = true;
                }
            } else {
                // Otherwise we check for negative implications
                let eliminatedMask = cellMask0 & ~cellMask1;
                while (eliminatedMask !== 0) {
                    const value = minValue(eliminatedMask);
                    eliminatedMask &= ~valueBit(value);

                    const eliminatedCandidateIndex = this.candidateIndex(cellIndex, value);
                    if (this.binaryImplications.addImplication(negatedFalseCandidateIndex, ~eliminatedCandidateIndex)) {
                        changed = true;
                    }
                }
            }
        }

        return changed;
    }

    isGiven(cellIndex: CellIndex): boolean {
        return (this.cells[cellIndex] & this.givenBit) !== 0;
    }

    isGivenMask(cellMask: CellMask): boolean {
        return (cellMask & this.givenBit) !== 0;
    }

    isGivenValue(value: CellValue): boolean {
        return (valueBit(value) & this.givenBit) !== 0;
    }

    getValue(cellIndex: CellIndex): CellValue {
        return minValue(this.cells[cellIndex] & ~this.givenBit);
    }

    getValueArray(): CellValue[] {
        return Array.from({ length: this.size * this.size }, (_, i) => (this.isGiven(i) ? this.getValue(i) : 0));
    }

    setAsGiven(cellIndex: CellIndex, value: CellValue): boolean {
        const valueMask = valueBit(value);
        const { givenBit } = this;
        const cellMask = this.cells[cellIndex];

        if (cellMask & givenBit) {
            return cellMask === (valueMask | givenBit);
        }

        if ((cellMask & valueMask) === 0) {
            return false;
        }

        // Set the given bit and the value bit for the cell
        const origMask = this.cells[cellIndex] & this.allValues;
        this.cells[cellIndex] = valueMask | givenBit;
        if (!this.enforceNewMask(cellIndex, origMask)) {
            return false;
        }
        this.nonGivenCount--;

        // Apply any binary implications
        const candidateIndex = this.candidateIndex(cellIndex, value);
        for (const otherCandidateIndex of this.binaryImplications.getNegConsequences(candidateIndex)) {
            const otherCellIndex = this.cellIndexFromCandidate(otherCandidateIndex);
            if (otherCellIndex === cellIndex) {
                continue;
            }

            if (!this.clearCandidate(otherCandidateIndex)) {
                // Board is invalid
                return false;
            }
        }
        for (const otherCandidateIndex of this.binaryImplications.getPosConsequences(candidateIndex)) {
            const otherCellIndex = this.cellIndexFromCandidate(otherCandidateIndex);
            const otherValue = this.valueFromCandidate(otherCandidateIndex);
            if (!this.setAsGiven(otherCellIndex, otherValue)) {
                // Board is invalid
                return false;
            }
        }

        // Enforce all constraints
        for (const constraint of this.constraints) {
            this.solveStats.constraintSinglesEnforced++;
            if (!constraint.enforce(this, cellIndex, value)) {
                return false;
            }
        }

        return true;
    }

    applyGivenPencilMarks(cellIndex: CellIndex, pencilMarks: CellValue[]): boolean {
        const pencilMarkBits = pencilMarks.reduce((bits, value) => bits | valueBit(value), 0);

        if (this.cells[cellIndex] & this.givenBit || popcount(this.cells[cellIndex]) === 1) {
            return (this.cells[cellIndex] & pencilMarkBits) !== 0;
        }

        const origMask = this.cells[cellIndex] & this.allValues;
        this.cells[cellIndex] &= pencilMarkBits;
        return this.enforceNewMask(cellIndex, origMask);
    }

    findUnassignedLocation(ignoreMasks: CellMask[] | Uint16Array | Uint32Array | null = null): CellIndex {
        const { size, givenBit, cells } = this;
        let minCandidates = size + 1;
        let minCandidateIndex = null;

        const totalCells = size * size;
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cell = cells[cellIndex];
            if (cell & givenBit) {
                continue;
            }

            const allowedMask = ignoreMasks !== null ? cell & ~ignoreMasks[cellIndex] : cell;
            if (allowedMask === 0) {
                continue;
            }

            const numCandidates = popcount(allowedMask);
            if (numCandidates >= 2 && numCandidates < minCandidates) {
                minCandidates = numCandidates;
                minCandidateIndex = cellIndex;

                if (minCandidates === 2) {
                    return minCandidateIndex;
                }
            }
        }

        return minCandidateIndex;
    }

    private static releaseJobStack(jobStack: Board[]) {
        for (const board of jobStack) {
            board.release();
        }
    }

    async findSolution(
        options: SolveOptions | null | undefined,
        isCancelled: (() => boolean) | undefined
    ): Promise<SolveResultCancelled | SolveResultBoard | SolveResultNoSolution> {
        const { random = false, allowPreprocessing = true, enableStats = false } = options || {};
        const jobStack = [this.clone()];
        let lastCancelCheckTime = Date.now();

        let shouldSaveFirstPreprocessingStats = enableStats;
        if (enableStats) {
            this.solveStats.solveStartTimeMs = Date.now();

            [
                this.solveStats.preSolveNegNegImplications,
                this.solveStats.preSolveNegPosImplications,
                this.solveStats.preSolvePosNegImplications,
                this.solveStats.preSolvePosPosImplications,
            ] = this.binaryImplications.countImplicationsByType();
            this.solveStats.preSolveTotalImplications =
                this.solveStats.preSolveNegNegImplications +
                this.solveStats.preSolveNegPosImplications +
                this.solveStats.preSolvePosNegImplications +
                this.solveStats.preSolvePosPosImplications;
        }

        let result: SolveResultCancelled | SolveResultBoard | SolveResultNoSolution = { result: 'no solution' };

        let numGuessesSinceLastJumpBack = 0;
        let jumpBackThresholdMultiplier = 1;
        while (jobStack.length > 0) {
            if (isCancelled) {
                if (Date.now() - lastCancelCheckTime > 100) {
                    // Give the event loop a chance to receive new messages
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Check if the job was cancelled
                    if (isCancelled()) {
                        result = { result: 'cancelled' };
                        break;
                    }
                    lastCancelCheckTime = Date.now();
                }
            }

            if (numGuessesSinceLastJumpBack > Board.JUMP_BACK_THRESHOLD * jumpBackThresholdMultiplier) {
                // Jump out of this branch (but leave it in the job stack)
                // Take the first element and put it at the end
                jobStack.push(jobStack.shift());
                for (const board of jobStack) {
                    board.needsExpensiveBruteForceSteps = true;
                }
                numGuessesSinceLastJumpBack = 0;
                jumpBackThresholdMultiplier *= Board.JUMP_BACK_THRESHOLD_EXPONENT;
            }

            const currentBoard = jobStack.pop();

            if (jobStack.length === 0) {
                numGuessesSinceLastJumpBack = 0;
                jumpBackThresholdMultiplier = 1;
            }

            const bruteForceResult = currentBoard.applyBruteForceLogic(allowPreprocessing && jobStack.length === 0);
            if (shouldSaveFirstPreprocessingStats) {
                shouldSaveFirstPreprocessingStats = false;
                [
                    this.solveStats.postInitialPreprocessingNegNegImplications,
                    this.solveStats.postInitialPreprocessingNegPosImplications,
                    this.solveStats.postInitialPreprocessingPosNegImplications,
                    this.solveStats.postInitialPreprocessingPosPosImplications,
                ] = this.binaryImplications.countImplicationsByType();
                this.solveStats.postInitialPreprocessingTotalImplications =
                    this.solveStats.postInitialPreprocessingNegNegImplications +
                    this.solveStats.postInitialPreprocessingNegPosImplications +
                    this.solveStats.postInitialPreprocessingPosNegImplications +
                    this.solveStats.postInitialPreprocessingPosPosImplications;
            }

            if (bruteForceResult === LogicResult.INVALID) {
                // Puzzle is invalid
                currentBoard.release();
                continue;
            }

            if (bruteForceResult === LogicResult.COMPLETE) {
                // Puzzle is complete, return the solution
                Board.releaseJobStack(jobStack);
                // The caller is responsible for releasing the board
                result = { result: 'board', board: currentBoard };
                break;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                throw new Error('Internal error: no unassigned location');
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = random ? randomValue(cellMask) : minValue(cellMask);
            this.solveStats.guesses++;

            // Queue up two versions of the board, one where the cell is set to the chosen value, and one where it's not

            // Push the version where the cell is not set to the chosen value first, so that it's only used if the chosen value doesn't work
            const newCellBits = cellMask & ~valueBit(chosenValue);
            if (newCellBits !== 0) {
                const newBoard = currentBoard.clone();
                if (newBoard.clearValue(unassignedIndex, chosenValue)) {
                    jobStack.push(newBoard);
                }
            }

            // Push the version where the cell is set to the chosen value
            {
                if (currentBoard.setAsGiven(unassignedIndex, chosenValue)) {
                    jobStack.push(currentBoard);
                } else {
                    currentBoard.release();
                }
            }
        }

        if (enableStats) {
            this.solveStats.solveEndTimeMs = Date.now();
            this.solveStats.solveElapsedTimeMs = this.solveStats.solveEndTimeMs - this.solveStats.solveStartTimeMs;

            [
                this.solveStats.postSolveNegNegImplications,
                this.solveStats.postSolveNegPosImplications,
                this.solveStats.postSolvePosNegImplications,
                this.solveStats.postSolvePosPosImplications,
            ] = this.binaryImplications.countImplicationsByType();
            this.solveStats.postSolveTotalImplications =
                this.solveStats.postSolveNegNegImplications +
                this.solveStats.postSolveNegPosImplications +
                this.solveStats.postSolvePosNegImplications +
                this.solveStats.postSolvePosPosImplications;
        }

        return result;
    }

    async countSolutions(
        maxSolutions: number,
        reportProgress: ((numSolutions: number) => void) | null | undefined,
        isCancelled: (() => boolean) | null | undefined,
        solutionEvent: ((board: Board) => void) | null | undefined = null,
        allowPreprocessing: boolean = true,
        enableStats: boolean = false
    ): Promise<SolveResultCancelledPartialSolutionCount | SolveResultSolutionCount> {
        const jobStack = [this.clone()];
        let numSolutions = 0;
        let lastReportTime = Date.now();
        const wantReportProgress = reportProgress || isCancelled;

        let shouldSaveFirstPreprocessingStats = enableStats;
        if (enableStats) {
            this.solveStats.solveStartTimeMs = Date.now();

            [
                this.solveStats.preSolveNegNegImplications,
                this.solveStats.preSolveNegPosImplications,
                this.solveStats.preSolvePosNegImplications,
                this.solveStats.preSolvePosPosImplications,
            ] = this.binaryImplications.countImplicationsByType();
            this.solveStats.preSolveTotalImplications =
                this.solveStats.preSolveNegNegImplications +
                this.solveStats.preSolveNegPosImplications +
                this.solveStats.preSolvePosNegImplications +
                this.solveStats.preSolvePosPosImplications;
        }

        let result: SolveResultCancelledPartialSolutionCount | SolveResultSolutionCount = undefined;

        let numGuessesSinceLastJumpBack = 0;
        let jumpBackThresholdMultiplier = 1;
        while (jobStack.length > 0) {
            if (wantReportProgress && Date.now() - lastReportTime > 100) {
                // Give the event loop a chance to receive new messages
                await new Promise(resolve => setTimeout(resolve, 0));

                // Check if the job was cancelled
                if (isCancelled && isCancelled()) {
                    Board.releaseJobStack(jobStack);
                    result = { result: 'cancelled partial count', count: numSolutions };
                    break;
                }

                // Report progress
                if (reportProgress) {
                    reportProgress(numSolutions);
                }
                lastReportTime = Date.now();
            }

            if (numGuessesSinceLastJumpBack > Board.JUMP_BACK_THRESHOLD * jumpBackThresholdMultiplier) {
                // Jump out of this branch (but leave it in the job stack)
                // Take the first element and put it at the end
                jobStack.push(jobStack.shift());
                for (const board of jobStack) {
                    board.needsExpensiveBruteForceSteps = true;
                }
                numGuessesSinceLastJumpBack = 0;
                jumpBackThresholdMultiplier *= Board.JUMP_BACK_THRESHOLD_EXPONENT;
            }

            const currentBoard = jobStack.pop();

            if (jobStack.length === 0) {
                numGuessesSinceLastJumpBack = 0;
                jumpBackThresholdMultiplier = 1;
            }

            const bruteForceResult = currentBoard.applyBruteForceLogic(allowPreprocessing && jobStack.length === 0);
            if (shouldSaveFirstPreprocessingStats) {
                shouldSaveFirstPreprocessingStats = false;
                [
                    this.solveStats.postInitialPreprocessingNegNegImplications,
                    this.solveStats.postInitialPreprocessingNegPosImplications,
                    this.solveStats.postInitialPreprocessingPosNegImplications,
                    this.solveStats.postInitialPreprocessingPosPosImplications,
                ] = this.binaryImplications.countImplicationsByType();
                this.solveStats.postInitialPreprocessingTotalImplications =
                    this.solveStats.postInitialPreprocessingNegNegImplications +
                    this.solveStats.postInitialPreprocessingNegPosImplications +
                    this.solveStats.postInitialPreprocessingPosNegImplications +
                    this.solveStats.postInitialPreprocessingPosPosImplications;
            }

            if (bruteForceResult === LogicResult.INVALID) {
                // Puzzle is invalid
                currentBoard.release();
                continue;
            }

            if (bruteForceResult === LogicResult.COMPLETE) {
                // Puzzle is complete, count the solution
                if (solutionEvent) {
                    solutionEvent(currentBoard);
                }

                numSolutions++;
                if (maxSolutions > 0 && numSolutions === maxSolutions) {
                    Board.releaseJobStack(jobStack);
                    currentBoard.release();
                    result = { result: 'count', count: numSolutions };
                    break;
                }
                currentBoard.release();

                numGuessesSinceLastJumpBack = 0;
                jumpBackThresholdMultiplier = Math.max(1, jumpBackThresholdMultiplier / Board.JUMP_BACK_THRESHOLD_EXPONENT);
                continue;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                throw new Error('Internal error: no unassigned location');
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = minValue(cellMask);
            this.solveStats.guesses++;

            // Queue up two versions of the board, one where the cell is set to the chosen value, and one where it's not

            // Push the version where the cell is not set to the chosen value first, so that it's only used if the chosen value doesn't work
            const newCellBits = cellMask & ~valueBit(chosenValue);
            if (newCellBits !== 0) {
                const newBoard = currentBoard.clone();
                if (newBoard.clearValue(unassignedIndex, chosenValue)) {
                    jobStack.push(newBoard);
                }
            }

            // Push the version where the cell is set to the chosen value
            {
                if (currentBoard.setAsGiven(unassignedIndex, chosenValue)) {
                    jobStack.push(currentBoard);
                } else {
                    currentBoard.release();
                }
            }
        }

        result ??= { result: 'count', count: numSolutions };

        if (enableStats) {
            [
                this.solveStats.postSolveNegNegImplications,
                this.solveStats.postSolveNegPosImplications,
                this.solveStats.postSolvePosNegImplications,
                this.solveStats.postSolvePosPosImplications,
            ] = this.binaryImplications.countImplicationsByType();
            this.solveStats.postSolveTotalImplications =
                this.solveStats.postSolveNegNegImplications +
                this.solveStats.postSolveNegPosImplications +
                this.solveStats.postSolvePosNegImplications +
                this.solveStats.postSolvePosPosImplications;

            this.solveStats.solveEndTimeMs = Date.now();
            this.solveStats.solveElapsedTimeMs = this.solveStats.solveEndTimeMs - this.solveStats.solveStartTimeMs;
        }

        return result;
    }

    private static isBranchInteresting(board: Board, uninterestingCandidates: Uint16Array | Uint32Array) {
        const { size, cells, allValues } = board;
        const totalCells = size * size;

        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cellMask = cells[cellIndex] & allValues;
            const interestingMask = ~uninterestingCandidates[cellIndex] & allValues;
            if ((cellMask & interestingMask) !== 0) {
                return true;
            }
        }
        return false;
    }

    private static branchHasInterestingGiven(board: Board, uninterestingCandidates: Uint16Array | Uint32Array) {
        const { size, cells, allValues, givenBit } = board;
        const totalCells = size * size;

        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cellMask = cells[cellIndex];
            if ((cellMask & givenBit) !== 0) {
                const interestingMask = ~uninterestingCandidates[cellIndex] & allValues;
                if ((cellMask & interestingMask) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    private static potentialCandidates(jobStack: Board[]) {
        const potentialCandidatesEntry = jobStack[0].cellsPool.get();
        const potentialCandidates = potentialCandidatesEntry.array64;
        const length64 = potentialCandidates.length;
        for (const board of jobStack) {
            for (let cellIndex = 0; cellIndex < length64; cellIndex++) {
                potentialCandidates[cellIndex] |= board.cells64[cellIndex];
            }
        }
        return potentialCandidatesEntry;
    }

    async calcTrueCandidates(
        maxSolutionsPerCandidate: number,
        isCancelled: (() => boolean) | null | undefined,
        reportProgress: ((definiteCandidates: CellMask[], potentialCandidates: CellMask[]) => void) | null | undefined = null
    ): Promise<SolveResultTrueCandidates | SolveResultTrueCandidatesWithCount | SolveResultNoSolution | SolveResultCancelled> {
        const { size, allValues } = this;
        const totalCells = size * size;
        const totalCandidates = totalCells * size;
        const wantSolutionCounts = maxSolutionsPerCandidate > 1;

        const jobStack = [this.clone()];
        let lastReportTime = Date.now();
        const wantReportProgress = reportProgress || isCancelled;

        const trueCandidatesEntry = this.cellsPool.get();
        const trueCandidates = trueCandidatesEntry.array;
        const trueCandidatesCounts = wantSolutionCounts ? Array.from({ length: totalCandidates }, () => 0) : null;
        const trueCandidatesAtMaxCountEntry = wantSolutionCounts ? this.cellsPool.get() : null;
        const trueCandidatesAtMaxCount = wantSolutionCounts ? trueCandidatesAtMaxCountEntry.array : null;
        const uninterestingCandidates = wantSolutionCounts ? trueCandidatesAtMaxCount : trueCandidates;
        let haveSolution = false;

        let numGuessesSinceLastJumpBack = 0;
        let jumpBackThresholdMultiplier = 1;
        try {
            while (jobStack.length > 0) {
                if (wantReportProgress && Date.now() - lastReportTime > 100) {
                    // Give the event loop a chance to receive new messages
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Check if the job was cancelled
                    if (isCancelled && isCancelled()) {
                        return { result: 'cancelled' };
                    }

                    // Report the current progress
                    if (reportProgress) {
                        const candidates = Array.from(trueCandidates).map(mask => mask & allValues);
                        const potentialCandidatesEntry = Board.potentialCandidates(jobStack);
                        const potentialCandidates = Array.from(potentialCandidatesEntry.array).map(mask => mask & allValues);
                        reportProgress(candidates, potentialCandidates);
                        this.cellsPool.release(potentialCandidatesEntry);
                    }
                    lastReportTime = Date.now();
                }

                if (numGuessesSinceLastJumpBack > Board.JUMP_BACK_THRESHOLD * jumpBackThresholdMultiplier) {
                    // Jump out of this branch (but leave it in the job stack)
                    // Take the first element and put it at the end
                    jobStack.push(jobStack.shift());
                    numGuessesSinceLastJumpBack = 0;
                    jumpBackThresholdMultiplier *= Board.JUMP_BACK_THRESHOLD_EXPONENT;
                }

                const currentBoard = jobStack.pop();
                if (!Board.isBranchInteresting(currentBoard, uninterestingCandidates)) {
                    currentBoard.release();
                    continue;
                }
                if (jobStack.length === 0) {
                    numGuessesSinceLastJumpBack = 0;
                    jumpBackThresholdMultiplier = 1;
                }

                const bruteForceResult = currentBoard.applyBruteForceLogic(jobStack.length === 0);

                if (bruteForceResult === LogicResult.INVALID) {
                    // Puzzle is invalid
                    currentBoard.release();
                    continue;
                }

                if (bruteForceResult === LogicResult.COMPLETE) {
                    // Puzzle is complete, count the solution
                    if (wantSolutionCounts) {
                        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                            let currentBoardMask = currentBoard.cells[cellIndex] & allValues;
                            trueCandidates[cellIndex] |= currentBoardMask;

                            while (currentBoardMask !== 0) {
                                const value = minValue(currentBoardMask);
                                const valueMask = valueBit(value);
                                currentBoardMask &= ~valueMask;

                                const candidateIndex = currentBoard.candidateIndex(cellIndex, value);
                                trueCandidatesCounts[candidateIndex]++;
                                if (trueCandidatesCounts[candidateIndex] === maxSolutionsPerCandidate) {
                                    trueCandidatesAtMaxCount[cellIndex] |= valueMask;
                                }
                            }
                        }
                    } else {
                        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                            trueCandidates[cellIndex] |= currentBoard.cells[cellIndex] & allValues;
                        }
                    }
                    haveSolution = true;
                    numGuessesSinceLastJumpBack = 0;
                    jumpBackThresholdMultiplier = Math.max(1, jumpBackThresholdMultiplier / Board.JUMP_BACK_THRESHOLD_EXPONENT);

                    currentBoard.release();
                    continue;
                }

                // Before guessing, make sure this branch is interesting
                if (!Board.isBranchInteresting(currentBoard, uninterestingCandidates)) {
                    currentBoard.release();
                    continue;
                }

                // If one of the givens is interesting, then we should just shoot for any solution rather than
                // restricting ourselves only to the interesting candidates
                const hasInterestingGiven = Board.branchHasInterestingGiven(currentBoard, uninterestingCandidates);
                let unassignedIndex = !hasInterestingGiven ? currentBoard.findUnassignedLocation(uninterestingCandidates) : null;
                if (unassignedIndex === null) {
                    unassignedIndex = currentBoard.findUnassignedLocation(null);
                }
                if (unassignedIndex === null) {
                    // There should always be an unassigned location
                    throw new Error('Internal error: no unassigned location');
                }

                const cellMask = currentBoard.cells[unassignedIndex];
                const interestingCellMask = cellMask & ~uninterestingCandidates[unassignedIndex];
                const chosenValue = interestingCellMask !== 0 ? minValue(interestingCellMask) : randomValue(cellMask);
                numGuessesSinceLastJumpBack++;

                // Queue up two versions of the board, one where the cell is set to the chosen value, and one where it's not

                // Push the version where the cell is not set to the chosen value first, so that it's only used if the chosen value doesn't work
                const newCellBits = cellMask & ~valueBit(chosenValue);
                if (newCellBits !== 0) {
                    const newBoard = currentBoard.clone();
                    if (newBoard.clearValue(unassignedIndex, chosenValue)) {
                        jobStack.push(newBoard);
                    }
                }

                // Push the version where the cell is set to the chosen value
                {
                    if (currentBoard.setAsGiven(unassignedIndex, chosenValue)) {
                        jobStack.push(currentBoard);
                    } else {
                        currentBoard.release();
                    }
                }
            }

            if (!haveSolution) {
                return { result: 'no solution' };
            }

            const candidates = Array.from(trueCandidates).map(mask => mask & allValues);
            if (wantSolutionCounts) {
                return {
                    result: 'true candidates with per-candidate solution count',
                    candidates: candidates,
                    counts: trueCandidatesCounts,
                };
            }

            return {
                result: 'true candidates',
                candidates: candidates,
            };
        } finally {
            this.cellsPool.release(trueCandidatesEntry);
            if (trueCandidatesAtMaxCountEntry) {
                this.cellsPool.release(trueCandidatesAtMaxCountEntry);
            }
            Board.releaseJobStack(jobStack);
        }
    }

    async logicalStep(isCancelled: (() => boolean) | null | undefined) {
        const desc: string[] = [];
        let lastCancelCheckTime = Date.now();
        for (const logicalStep of this.logicalSteps) {
            if (Date.now() - lastCancelCheckTime > 100) {
                // Give the event loop a chance to receive new messages
                await new Promise(resolve => setTimeout(resolve, 0));

                // Check if the job was cancelled
                if (isCancelled && isCancelled()) {
                    return { cancelled: true };
                }
                lastCancelCheckTime = Date.now();
            }

            const result = logicalStep.step(this, desc);
            if (result === LogicResult.INVALID) {
                return { desc: desc.join('\n  '), invalid: true };
            } else if (result === LogicResult.CHANGED) {
                return { desc: desc.join('\n  '), changed: true };
            }
        }

        return { unchanged: true };
    }

    async logicalSolve(
        isCancelled: (() => boolean) | null | undefined
    ): Promise<SolveResultLogicallyInvalid | SolveResultCancelledPartialLogicalSolve | SolveResultLogicalSolve> {
        const desc: string[] = [];
        let lastCancelCheckTime = Date.now();
        let changed = false;
        while (true) {
            let changedThisLoop = false;
            for (const logicalStep of this.logicalSteps) {
                if (Date.now() - lastCancelCheckTime > 100) {
                    // Give the event loop a chance to receive new messages
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Check if the job was cancelled
                    if (isCancelled()) {
                        return { result: 'cancelled partial logical solve', desc, changed };
                    }
                    lastCancelCheckTime = Date.now();
                }

                const result = logicalStep.step(this, desc);
                if (result === LogicResult.INVALID) {
                    return { result: 'logically invalid', desc };
                } else if (result === LogicResult.CHANGED) {
                    changedThisLoop = true;
                    changed = true;
                    break;
                }
            }

            if (!changedThisLoop) {
                break;
            }
        }

        return { result: 'logical solve', desc, changed };
    }
}

export type ReadonlyBoard = Board; // TODO: Change to proper subset of the Board interface once the API settles more
