import {
    allValues,
    combinations,
    minValue,
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
import { Constraint, ConstraintResult } from './Constraint/Constraint';
import { LogicResult } from './Enums/LogicResult';
import { LogicalStep } from './LogicalStep/LogicalStep';
import { BinaryImplicationLayeredGraph } from './BinaryImplicationLayeredGraph';
import { TypedArrayPool, TypedArrayEntry } from './Memory/TypedArrayPool';

export type RegionType = string;
export type Region = {
    name: string;
    fromConstraint: null | Constraint;
    type: RegionType;
    cells: CellIndex[];
};

export type SolveOptions = {
    random?: boolean;
    maxSolutions?: number;
    maxSolutionsPerCandidate?: number;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type StateKey<T extends Cloneable> = number;

export class Board {
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
    constraintsFinalized: boolean;
    constraintStates: Cloneable[];
    constraintStateIsCloned: (undefined | true)[];
    memos: Map<string, unknown>;
    logicalSteps: LogicalStep[];

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
            this.constraintsFinalized = false;
            this.constraintStates = [];
            this.constraintStateIsCloned = [];
            this.memos = new Map();
            this.logicalSteps = [
                new NakedSingle(this),
                new HiddenSingle(this),
                new ConstraintLogic(this),
                new CellForcing(this),
                new NakedTupleAndPointing(this),
            ];
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
        clone.constraintsFinalized = this.constraintsFinalized;
        clone.constraintStates = this.constraintStates.slice();
        clone.constraintStateIsCloned = [];
        // We can't mutate `this` state either as there may be a clone which references it
        this.constraintStateIsCloned = [];
        clone.memos = this.memos;
        clone.logicalSteps = this.logicalSteps;
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
        clone.constraintsFinalized = this.constraintsFinalized;
        clone.memos = new Map(); // Don't inherit memos
        clone.logicalSteps = this.logicalSteps;
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
        const [cellIndex1, value1] = this.candidateToIndexAndValue(index1);
        const [cellIndex2, value2] = this.candidateToIndexAndValue(index2);

        // We always want to add the weak link as current functions like isGroup rely on it
        if (!this.binaryImplications.addImplication(index1, ~index2)) {
            return false;
        }

        // Enforce weak link now if one of the candidates is already set
        if ((this.cells[cellIndex1] & this.allValues) === valueBit(value1)) {
            if (!this.clearCandidate(index2)) {
                this.invalidInit = true;
            }
        }
        if ((this.cells[cellIndex2] & this.allValues) === valueBit(value2)) {
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

    initConstraints(isRepeat: boolean = false): boolean {
        if (this.constraints.length > 0) {
            let haveChange = false;
            const initedConstraints: Map<Constraint, boolean> = new Map();
            do {
                haveChange = false;

                let constraintsToAdd: Constraint[] = null;
                let constraintsToDelete: Constraint[] = null;

                for (const constraint of this.constraints) {
                    const result = constraint.init(this, isRepeat || initedConstraints.get(constraint) === true);
                    initedConstraints.set(constraint, true);

                    const constraintResult = typeof result === 'object' ? result.result : result;
                    const payload = typeof result === 'object' ? result : null;
                    if (constraintResult === ConstraintResult.INVALID) {
                        return false;
                    }

                    if (constraintResult === ConstraintResult.CHANGED) {
                        haveChange = true;
                    }

                    if (payload) {
                        if (payload.addConstraints) {
                            constraintsToAdd = payload.addConstraints;
                        }
                        if (payload.deleteConstraints) {
                            constraintsToDelete = payload.deleteConstraints;
                        }
                    }

                    if (constraintsToAdd || constraintsToDelete) {
                        haveChange = true;
                        break;
                    }
                }

                if (constraintsToDelete) {
                    this.constraints = this.constraints.filter(constraint => !constraintsToDelete.includes(constraint));
                }
                if (constraintsToAdd) {
                    for (const constraint of constraintsToAdd) {
                        this.constraints.push(constraint);
                    }
                }
            } while (haveChange);
        }

        return !this.invalidInit;
    }

    finalizeConstraints() {
        if (!this.initConstraints()) {
            return false;
        }
        return this.finalizeConstraintsNoInit();
    }

    finalizeConstraintsNoInit() {
        const constraintsToDelete: Constraint[] = [];
        for (const constraint of this.constraints) {
            const result = constraint.finalize(this);
            const constraintResult = typeof result === 'object' ? result.result : result;
            const payload = typeof result === 'object' ? result : null;

            if (constraintResult === ConstraintResult.INVALID) {
                return false;
            }
            if (constraintResult === ConstraintResult.CHANGED) {
                throw new Error('finalize is not allowed to change the board');
            }
            if (payload) {
                if (payload.addConstraints) {
                    throw new Error('finalize may not add constraints!');
                }
                if (payload.deleteConstraints) {
                    constraintsToDelete.push(...payload.deleteConstraints);
                }
            }
        }
        this.constraints = this.constraints.filter(constraint => !constraintsToDelete.includes(constraint));

        this.constraintsFinalized = true;
        return !this.invalidInit;
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

        if (popcount(cellMask) === 1) {
            this.nakedSingles.push(cellIndex);
        }

        let removedMask = origMask & ~cellMask;
        while (removedMask !== 0) {
            const value = minValue(removedMask);
            removedMask &= ~valueBit(value);

            for (const constraint of this.constraints) {
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

    applyBruteForceLogic() {
        let changed = false;
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
                // Keep looking for singles until there are none
                continue;
            }

            // If we get here, then there are no more singles to find
            // Allow constraints to apply their logic
            for (const constraint of this.constraints) {
                const result = constraint.logicStep(this, null);
                if (result === ConstraintResult.INVALID) {
                    return LogicResult.INVALID;
                }
                if (result === ConstraintResult.CHANGED) {
                    changedThisRound = true;
                    changed = true;
                    break;
                }
            }

            if (!changedThisRound && initialNonGivenCount === this.nonGivenCount && this.nakedSingles.length === 0) {
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
        const allElims = this.binaryImplications.getCommonNegConsequences(candidateIndexes);
        // Intersect with existing candidates
        const filteredElims = allElims.filter(elim => {
            const [cellIndex, value] = this.candidateToIndexAndValue(elim);
            return this.cells[cellIndex] & valueBit(value);
        });
        return filteredElims;
    }

    applyNakedSingles() {
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

    applyHiddenSingles() {
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

        // Apply any weak links
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

        // Enforce all constraints
        for (const constraint of this.constraints) {
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

    findUnassignedLocation(ignoreMasks: CellMask[] | null = null): CellIndex {
        const { size, givenBit, cells } = this;
        let minCandidates = size + 1;
        let minCandidateIndex = null;

        const totalCells = size * size;
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cell = cells[cellIndex];
            if (cell & givenBit) {
                continue;
            }
            if (ignoreMasks !== null && (cell & ~ignoreMasks[cellIndex]) === 0) {
                continue;
            }

            const numCandidates = popcount(cell);
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
        const { random = false } = options || {};
        const jobStack = [this.clone()];
        let lastCancelCheckTime = Date.now();

        while (jobStack.length > 0) {
            if (isCancelled) {
                if (Date.now() - lastCancelCheckTime > 100) {
                    // Give the event loop a chance to receive new messages
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Check if the job was cancelled
                    if (isCancelled()) {
                        return { result: 'cancelled' };
                    }
                    lastCancelCheckTime = Date.now();
                }
            }

            const currentBoard = jobStack.pop();

            const bruteForceResult = currentBoard.applyBruteForceLogic();

            if (bruteForceResult === LogicResult.INVALID) {
                // Puzzle is invalid
                currentBoard.release();
                continue;
            }

            if (bruteForceResult === LogicResult.COMPLETE) {
                // Puzzle is complete, return the solution
                Board.releaseJobStack(jobStack);
                // The caller is responsible for releasing the board
                return { result: 'board', board: currentBoard };
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                // Puzzle is complete, return the solution
                Board.releaseJobStack(jobStack);
                // The caller is responsible for releasing the board
                return { result: 'board', board: currentBoard };
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = random ? randomValue(cellMask) : minValue(cellMask);

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

        return { result: 'no solution' }; // No solution found
    }

    async countSolutions(
        maxSolutions: number,
        reportProgress: ((numSolutions: number) => void) | null | undefined,
        isCancelled: (() => boolean) | null | undefined,
        solutionsSeen: Set<string> | null | undefined = null,
        solutionEvent: ((board: Board) => void) | null | undefined = null
    ): Promise<SolveResultCancelledPartialSolutionCount | SolveResultSolutionCount> {
        const jobStack = [this.clone()];
        let numSolutions = 0;
        let lastReportTime = Date.now();
        const wantReportProgress = reportProgress || isCancelled;

        while (jobStack.length > 0) {
            if (wantReportProgress && Date.now() - lastReportTime > 100) {
                // Give the event loop a chance to receive new messages
                await new Promise(resolve => setTimeout(resolve, 0));

                // Check if the job was cancelled
                if (isCancelled && isCancelled()) {
                    Board.releaseJobStack(jobStack);
                    return { result: 'cancelled partial count', count: numSolutions };
                }

                // Report progress
                if (reportProgress) {
                    reportProgress(numSolutions);
                }
                lastReportTime = Date.now();
            }

            const currentBoard = jobStack.pop();

            const bruteForceResult = currentBoard.applyBruteForceLogic();

            if (bruteForceResult === LogicResult.INVALID) {
                // Puzzle is invalid
                currentBoard.release();
                continue;
            }

            if (bruteForceResult === LogicResult.COMPLETE) {
                // Puzzle is complete, count the solution
                if (solutionsSeen) {
                    const solution = currentBoard.solutionString();
                    if (!solutionsSeen.has(solution)) {
                        solutionsSeen.add(solution);

                        if (solutionEvent) {
                            solutionEvent(currentBoard);
                        }

                        numSolutions++;
                        if (maxSolutions > 0 && numSolutions === maxSolutions) {
                            Board.releaseJobStack(jobStack);
                            currentBoard.release();
                            return { result: 'count', count: numSolutions };
                        }
                    }
                } else {
                    if (solutionEvent) {
                        solutionEvent(currentBoard);
                    }

                    numSolutions++;
                    if (maxSolutions > 0 && numSolutions === maxSolutions) {
                        Board.releaseJobStack(jobStack);
                        currentBoard.release();
                        return { result: 'count', count: numSolutions };
                    }
                }
                currentBoard.release();
                continue;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                // Puzzle is complete, return the solution
                numSolutions++;
                if (maxSolutions > 0 && numSolutions === maxSolutions) {
                    Board.releaseJobStack(jobStack);
                    currentBoard.release();
                    return { result: 'count', count: numSolutions };
                }
                currentBoard.release();
                continue;
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = minValue(cellMask);

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

        return { result: 'count', count: numSolutions };
    }

    async calcTrueCandidates(
        maxSolutionsPerCandidate: number,
        isCancelled: (() => boolean) | null | undefined
    ): Promise<SolveResultTrueCandidates | SolveResultTrueCandidatesWithCount | SolveResultNoSolution | SolveResultCancelled> {
        const { size, allValues } = this;
        const totalCells = size * size;
        const totalCandidates = totalCells * size;
        const wantSolutionCounts = maxSolutionsPerCandidate > 1;

        const board = this.clone();
        const bruteForceResult = board.applyBruteForceLogic();
        if (bruteForceResult === LogicResult.INVALID) {
            // Puzzle is invalid
            board.release();
            return { result: 'no solution' };
        }

        if (bruteForceResult === LogicResult.COMPLETE) {
            // Puzzle is unique just from basic logic
            const candidates = Array.from(board.cells).map(mask => mask & allValues);
            board.release();

            if (wantSolutionCounts) {
                return {
                    result: 'true candidates with per-candidate solution count',
                    candidates: candidates,
                    counts: Array.from({ length: totalCandidates }, () => 1),
                };
            }

            return {
                result: 'true candidates',
                candidates: candidates,
            };
        }

        const attemptedCandidates = Array.from({ length: size * size }, () => 0);
        const candidateCounts = wantSolutionCounts ? Array.from({ length: totalCandidates }, () => 0) : null;
        const solutionsSeen: Set<string> | null = wantSolutionCounts ? new Set() : null;

        // Loop until we've found all true candidates
        let lastReportTime = Date.now();
        while (true) {
            // Choose a cell to try
            const cellIndex = board.findUnassignedLocation(attemptedCandidates);
            if (cellIndex === null) {
                // All candidates have been attempted
                const candidates = Array.from(board.cells).map(mask => mask & allValues);
                board.release();

                if (wantSolutionCounts) {
                    return {
                        result: 'true candidates with per-candidate solution count',
                        candidates: candidates,
                        counts: candidateCounts,
                    };
                }

                return {
                    result: 'true candidates',
                    candidates: candidates,
                };
            }

            const cellMask = board.cells[cellIndex];
            let chooseMask = cellMask & ~attemptedCandidates[cellIndex];
            let removedCandidates = false;
            while (chooseMask !== 0) {
                if (Date.now() - lastReportTime > 100) {
                    // Give the event loop a chance to receive new messages
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Check if the job was cancelled
                    if (isCancelled && isCancelled()) {
                        return { result: 'cancelled' };
                    }

                    lastReportTime = Date.now();
                }

                const chosenValue = minValue(chooseMask);
                const chosenValueMask = valueBit(chosenValue);
                chooseMask ^= chosenValueMask;

                // Mark this candidate as attempted
                attemptedCandidates[cellIndex] |= chosenValueMask;

                // Create a new board with this candidate set
                const newBoard = board.clone();
                if (!newBoard.setAsGiven(cellIndex, chosenValue)) {
                    // Puzzle is invalid with this candidate
                    board.clearCellMask(cellIndex, chosenValueMask);
                    removedCandidates = true;

                    newBoard.release();
                    continue;
                }

                if (wantSolutionCounts) {
                    // Determine how many solutions we still need to find for this candidate
                    const candidateIndex = board.candidateIndex(cellIndex, chosenValue);
                    const remainingSolutions = maxSolutionsPerCandidate - candidateCounts[candidateIndex];
                    if (remainingSolutions <= 0) {
                        // We've already found enough solutions for this candidate
                        newBoard.release();
                        continue;
                    }

                    // Find solutions for the new board
                    const { result } = await newBoard.countSolutions(remainingSolutions, null, isCancelled, solutionsSeen, solutionBoard => {
                        // Update all candidate counts for this solution
                        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                            const cellMask = solutionBoard.cells[cellIndex] & allValues;
                            const cellValue = minValue(cellMask);
                            const cellCandidateIndex = solutionBoard.candidateIndex(cellIndex, cellValue);
                            candidateCounts[cellCandidateIndex]++;

                            if (candidateCounts[cellCandidateIndex] >= maxSolutionsPerCandidate) {
                                // We've found enough solutions for this candidate, so mark it as attempted
                                attemptedCandidates[cellIndex] |= cellMask;
                            }
                        }
                    });

                    if (result === 'cancelled partial count') {
                        newBoard.release();
                        return { result: 'cancelled' };
                    }

                    if (candidateCounts[candidateIndex] === 0) {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
                    }
                } else {
                    // Find any solution
                    const solutionResult = await newBoard.findSolution({}, isCancelled);
                    newBoard.release();

                    if (solutionResult.result === 'no solution') {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
                    } else if (solutionResult.result === 'cancelled') {
                        return { result: 'cancelled' };
                    } else {
                        // Mark all candidates for this solution as attempted
                        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                            attemptedCandidates[cellIndex] |= solutionResult.board.cells[cellIndex] & allValues;
                        }
                        solutionResult.board.release();
                    }
                }
            }

            if (removedCandidates) {
                // We removed at least one candidate, so we need to re-apply logic
                const bruteForceResult = board.applyBruteForceLogic();
                if (bruteForceResult === LogicResult.INVALID) {
                    // Puzzle is invalid
                    board.release();
                    return { result: 'no solution' };
                }

                if (bruteForceResult === LogicResult.COMPLETE) {
                    const candidates = Array.from(board.cells).map(mask => mask & allValues);
                    board.release();

                    // Puzzle is now unique just from basic logic
                    if (wantSolutionCounts) {
                        return {
                            result: 'true candidates with per-candidate solution count',
                            candidates: candidates,
                            counts: Array.from({ length: totalCandidates }, () => 1),
                        };
                    }

                    return {
                        result: 'true candidates',
                        candidates: candidates,
                    };
                }
            }
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
