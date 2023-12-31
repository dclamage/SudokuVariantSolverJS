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

type RegionType = string;
type Region = {
    name: string;
    fromConstraint: null | Constraint;
    type: RegionType;
    cells: CellIndex[];
};

type SolveOptions = {
    random?: boolean;
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
    cells: CellMask[];
    nonGivenCount: number;
    nakedSingles: CellIndex[];
    weakLinks: CandidateIndex[][];
    regions: Region[];
    constraints: Constraint[];
    constraintsFinalized: boolean;
    constraintStates: any[];
    constraintStateIsCloned: (undefined | true)[];
    memos: any;
    logicalSteps: LogicalStep[];

    constructor(size: number | undefined = undefined) {
        if (size !== undefined) {
            this.size = size;
            this.allValues = allValues(size);
            this.givenBit = 1 << size;
            this.cells = new Array(size * size).fill(this.allValues);
            this.nonGivenCount = size * size;
            this.nakedSingles = [];
            this.weakLinks = Array.from({ length: size * size * size }, () => []);
            this.regions = [];
            this.constraints = [];
            this.constraintsFinalized = false;
            this.constraintStates = [];
            this.constraintStateIsCloned = [];
            this.memos = {};
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
        clone.cells = [...this.cells]; // Deep copy
        clone.nonGivenCount = this.nonGivenCount;
        clone.nakedSingles = [...this.nakedSingles]; // Deep copy
        clone.weakLinks = this.weakLinks;
        clone.regions = this.regions;
        clone.constraints = this.constraints.map(constraint => constraint.clone()); // Clone constraints that need backtracking state
        clone.constraintsFinalized = this.constraintsFinalized;
        clone.constraintStates = this.constraintStates.map(state => state.clone());
        clone.constraintStateIsCloned = new Array(this.constraintStates.length);
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
        clone.cells = [...this.cells]; // Deep copy
        clone.nonGivenCount = this.nonGivenCount;
        clone.nakedSingles = [...this.nakedSingles]; // Deep copy
        clone.weakLinks = this.weakLinks.map(links => links.slice()); // Deep copy
        clone.regions = [...this.regions]; // Deep copy
        clone.constraints = []; // Don't inherit constraints
        clone.constraintsFinalized = this.constraintsFinalized;
        clone.memos = {}; // Don't inherit memos
        clone.logicalSteps = this.logicalSteps;
        return clone;
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

    candidateToIndexAndValue(candidateIndex: CandidateIndex) {
        return [Math.floor(candidateIndex / this.size), (candidateIndex % this.size) + 1];
    }

    valueFromCandidate(candidateIndex: CandidateIndex) {
        return (candidateIndex % this.size) + 1;
    }

    maskStrictlyLower(v: CellValue) {
        return (1 << (v - 1)) - 1;
    }

    maskStrictlyHigher(v: CellValue) {
        return this.allValues ^ (1 << (v - 1));
    }

    maskLowerOrEqual(v: CellValue) {
        return (1 << v) - 1;
    }

    maskHigherOrEqual(v: CellValue) {
        return this.allValues ^ ((1 << v) - 1);
    }

    maskBetweenInclusive(v1: CellValue, v2: CellValue) {
        return this.maskHigherOrEqual(v1) & this.maskLowerOrEqual(v2);
    }

    maskBetweenExclusive(v1: CellValue, v2: CellValue) {
        return this.maskHigherOrEqual(v1) & this.maskStrictlyLower(v2);
    }

    addWeakLink(index1: CandidateIndex, index2: CandidateIndex) {
        if (index1 != index2 && !this.weakLinks[index1].includes(index2)) {
            this.weakLinks[index1].push(index2);
            this.weakLinks[index2].push(index1);
        }
    }

    isWeakLink(index1: CandidateIndex, index2: CandidateIndex) {
        return this.weakLinks[index1].includes(index2);
    }

    addRegion(name: string, cells: CellIndex[], type: RegionType, fromConstraint: null | Constraint = null, addWeakLinks: boolean = true) {
        // Don't add regions which are too large
        if (cells.length > this.size) {
            return;
        }

        // Do not add duplicate regions
        if (this.regions.some(region => fromConstraint === region.fromConstraint && sequenceEqual(region.cells, cells))) {
            return;
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
    }

    getRegionsForCell(cellIndex: CellIndex, type: RegionType | null = null) {
        return this.regions.filter(region => region.cells.includes(cellIndex) && (type === null || region.type === type));
    }

    addConstraint(constraint: Constraint) {
        this.constraints.push(constraint);
    }

    initConstraints(isRepeat: boolean = false): boolean {
        if (this.constraints.length > 0) {
            let haveChange = false;
            do {
                haveChange = false;

                for (const constraint of this.constraints) {
                    const result = constraint.init(this, isRepeat);
                    if (result === ConstraintResult.INVALID) {
                        return false;
                    }

                    if (result === ConstraintResult.CHANGED) {
                        haveChange = true;
                    }
                }
                isRepeat = true;
            } while (haveChange);
        }

        return true;
    }

    finalizeConstraints() {
        if (!this.initConstraints()) {
            return false;
        }

        for (const constraint of this.constraints) {
            const result = constraint.finalize(this);
            if (result === ConstraintResult.INVALID) {
                return false;
            }
            if (result === ConstraintResult.CHANGED) {
                throw new Error('finalize is not allowed to change the board');
            }
        }

        this.constraintsFinalized = true;
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
        return this.constraintStates[stateKey];
    }

    getStateMut<T extends Cloneable>(stateKey: StateKey<T>): T {
        if (!this.constraintStateIsCloned[stateKey]) {
            this.constraintStateIsCloned[stateKey] = true;
            this.constraintStates[stateKey] = this.constraintStates[stateKey].clone();
        }
        return this.constraintStates[stateKey];
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

    getMemo<T = any>(key: string): T {
        // Simply return the value at the key, or null if it doesn't exist
        return this.memos[key] || null;
    }

    storeMemo<T = any>(key: string, val: T) {
        this.memos[key] = val;
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
                    if (!this.weakLinks[candidate0].includes(candidate1)) {
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
                if (!this.weakLinks[candidate0].includes(candidate1)) {
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
                    if (!this.weakLinks[candidate0].includes(candidate1)) {
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
        for (let c0 = 0; c0 < numCells - 1; c0++) {
            const weakLinks0 = this.weakLinks[candidates[c0]];
            for (let c1 = c0 + 1; c1 < numCells; c1++) {
                if (weakLinks0.includes(candidates[c1])) {
                    return false;
                }
            }
        }

        return true;
    }

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
                if (colsPerRow[j].every((value, index) => value === colsPerRow[i][index])) {
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
    // Returns an array of candidate indexes which are eliminated by the input candidates
    calcElimsForCandidateIndices(candidateIndexes: CandidateIndex[]): CandidateIndex[] {
        if (candidateIndexes.length === 0) {
            return [];
        }

        // Seed the elims with the first candidate
        let elims = this.weakLinks[candidateIndexes[0]].slice();

        // Filter out already-eliminated candidates
        elims = elims.filter(candidateIndex => {
            const [cellIndex, value] = this.candidateToIndexAndValue(candidateIndex);
            return this.cells[cellIndex] & valueBit(value);
        });

        for (let i = 1; i < candidateIndexes.length; i++) {
            const candidateIndex = candidateIndexes[i];
            const weakLinks = this.weakLinks[candidateIndex];

            // Intersect the weak links for this candidate and the previous candidates
            elims = elims.filter(x => weakLinks.includes(x));
        }
        return elims;
    }

    // eslint-disable-next-line no-unused-vars
    evaluateWeakLinks(cells: CellIndex[], logicalStepDesc: string[]) {
        // Only allow eliminations for candidates within the cells
        const candidatesSet = new Set();
        for (const cell of cells) {
            let cellMask = this.cells[cell];
            while (cellMask !== 0) {
                const value = minValue(cellMask);
                candidatesSet.add(this.candidateIndex(cell, value));
                cellMask ^= valueBit(value);
            }
        }

        // Check for "cell forcing" eliminations that originate from the given cells
        for (const cell of cells) {
            let elimSet: Set<CandidateIndex> | null = null;
            const cellMask = this.cells[cell];
            while (cellMask !== 0) {
                const value = minValue(cellMask);
                const candidateIndex = this.candidateIndex(cell, value);
                const weakLinks = this.weakLinks[candidateIndex];
                if (elimSet === null) {
                    elimSet = new Set();
                    for (const elimCandidate of weakLinks) {
                        if (candidatesSet.has(elimCandidate)) {
                            elimSet.add(elimCandidate);
                        }
                    }
                } else {
                    // Interesection of the weak links for this candidate and the previous candidates
                    const toDelete: CandidateIndex[] = [];
                    for (const elimCandidate of elimSet) {
                        if (!weakLinks.includes(elimCandidate)) {
                            toDelete.push(elimCandidate);
                        }
                    }

                    for (const elimCandidate of toDelete) {
                        elimSet.delete(elimCandidate);
                    }
                }

                if (elimSet.size === 0) {
                    break;
                }
            }
        }
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
        if (!this.constraintsFinalized) {
            throw new Error('Constraints must be finalized before calling setAsGiven');
        }

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
        this.enforceNewMask(cellIndex, origMask);
        this.nonGivenCount--;

        // Apply any weak links
        const candidateIndex = this.candidateIndex(cellIndex, value);
        for (const otherCandidateIndex of this.weakLinks[candidateIndex]) {
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

    async findSolution(
        options: SolveOptions | null | undefined,
        isCancelled: (() => boolean) | undefined
    ): Promise<Board | { cancelled: true } | null> {
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
                        return { cancelled: true };
                    }
                    lastCancelCheckTime = Date.now();
                }
            }

            const currentBoard = jobStack.pop();

            const bruteForceResult = currentBoard.applyBruteForceLogic();

            if (bruteForceResult === LogicResult.INVALID) {
                // Puzzle is invalid
                continue;
            }

            if (bruteForceResult === LogicResult.COMPLETE) {
                // Puzzle is complete, return the solution
                return currentBoard;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                // Puzzle is complete, return the solution
                return currentBoard;
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = random ? randomValue(cellMask) : minValue(cellMask);

            // Queue up two versions of the board, one where the cell is set to the chosen value, and one where it's not

            // Push the version where the cell is not set to the chosen value first, so that it's only used if the chosen value doesn't work
            const newCellBits = cellMask & ~valueBit(chosenValue);
            if (newCellBits !== 0) {
                const newBoard = currentBoard.clone();
                newBoard.cells[unassignedIndex] = newCellBits;
                jobStack.push(newBoard);
            }

            // Push the version where the cell is set to the chosen value
            {
                const newBoard = currentBoard.clone();
                if (newBoard.setAsGiven(unassignedIndex, chosenValue)) {
                    jobStack.push(newBoard);
                }
            }
        }

        return null; // No solution found
    }

    async countSolutions(
        maxSolutions: number,
        reportProgress: ((numSolutions: number) => void) | null | undefined,
        isCancelled: (() => boolean) | null | undefined,
        solutionsSeen: Set<string> | null | undefined,
        solutionEvent: ((board: Board) => void) | null | undefined
    ): Promise<{ numSolutions: number; cancelled: boolean }> {
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
                    return { numSolutions, cancelled: true };
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
                            return { numSolutions, cancelled: false };
                        }
                    }
                } else {
                    if (solutionEvent) {
                        solutionEvent(currentBoard);
                    }

                    numSolutions++;
                    if (maxSolutions > 0 && numSolutions === maxSolutions) {
                        return { numSolutions, cancelled: false };
                    }
                }
                continue;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                // Puzzle is complete, return the solution
                numSolutions++;
                if (maxSolutions > 0 && numSolutions === maxSolutions) {
                    return { numSolutions, cancelled: false };
                }
                continue;
            }

            const cellMask = currentBoard.cells[unassignedIndex];
            const chosenValue = minValue(cellMask);

            // Queue up two versions of the board, one where the cell is set to the chosen value, and one where it's not

            // Push the version where the cell is not set to the chosen value first, so that it's only used if the chosen value doesn't work
            const newCellBits = cellMask & ~valueBit(chosenValue);
            if (newCellBits !== 0) {
                const newBoard = currentBoard.clone();
                newBoard.cells[unassignedIndex] = newCellBits;
                jobStack.push(newBoard);
            }

            // Push the version where the cell is set to the chosen value
            {
                const newBoard = currentBoard.clone();
                if (newBoard.setAsGiven(unassignedIndex, chosenValue)) {
                    jobStack.push(newBoard);
                }
            }
        }

        return { numSolutions, cancelled: false };
    }

    async calcTrueCandidates(
        maxSolutionsPerCandidate: number,
        isCancelled: (() => boolean) | null | undefined
    ): Promise<{ cancelled: true } | { invalid: true } | { counts?: number[]; candidates: number[] }> {
        const { size, allValues } = this;
        const totalCells = size * size;
        const totalCandidates = totalCells * size;
        const wantSolutionCounts = maxSolutionsPerCandidate > 1;

        const board = this.clone();
        const bruteForceResult = board.applyBruteForceLogic();
        if (bruteForceResult === LogicResult.INVALID) {
            // Puzzle is invalid
            return { invalid: true };
        }

        if (bruteForceResult === LogicResult.COMPLETE) {
            // Puzzle is unique just from basic logic
            return {
                candidates: board.cells.map(mask => mask & allValues),
                ...(wantSolutionCounts ? { counts: Array.from({ length: totalCandidates }, () => 1) } : {}),
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
                return {
                    candidates: board.cells.map(mask => mask & allValues),
                    ...(wantSolutionCounts ? { counts: candidateCounts } : {}),
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
                        return { cancelled: true };
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
                    continue;
                }

                if (wantSolutionCounts) {
                    // Determine how many solutions we still need to find for this candidate
                    const candidateIndex = board.candidateIndex(cellIndex, chosenValue);
                    const remainingSolutions = maxSolutionsPerCandidate - candidateCounts[candidateIndex];
                    if (remainingSolutions <= 0) {
                        // We've already found enough solutions for this candidate
                        continue;
                    }

                    // Find solutions for the new board
                    const { cancelled } = await newBoard.countSolutions(remainingSolutions, null, isCancelled, solutionsSeen, solutionBoard => {
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

                    if (cancelled) {
                        return { cancelled: true };
                    }

                    if (candidateCounts[candidateIndex] === 0) {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
                    }
                } else {
                    function checkCancelled(solution: any): solution is { cancelled: true } {
                        return solution.cancelled;
                    }

                    // Find any solution
                    const solution = await newBoard.findSolution({}, isCancelled);
                    if (solution === null) {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
                    } else if (checkCancelled(solution)) {
                        return { cancelled: true };
                    } else {
                        // Mark all candidates for this solution as attempted
                        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                            attemptedCandidates[cellIndex] |= solution.cells[cellIndex] & allValues;
                        }
                    }
                }
            }

            if (removedCandidates) {
                // We removed at least one candidate, so we need to re-apply logic
                const bruteForceResult = board.applyBruteForceLogic();
                if (bruteForceResult === LogicResult.INVALID) {
                    // Puzzle is invalid
                    return { invalid: true };
                }

                if (bruteForceResult === LogicResult.COMPLETE) {
                    // Puzzle is now unique just from basic logic
                    return {
                        candidates: board.cells.map(mask => mask & allValues),
                        ...(wantSolutionCounts ? { counts: Array.from({ length: totalCandidates }, () => 1) } : {}),
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

    async logicalSolve(isCancelled: (() => boolean) | null | undefined) {
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
                        return { desc, changed, cancelled: true };
                    }
                    lastCancelCheckTime = Date.now();
                }

                const result = logicalStep.step(this, desc);
                if (result === LogicResult.INVALID) {
                    return { desc, invalid: true };
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

        return { desc, changed };
    }
}
