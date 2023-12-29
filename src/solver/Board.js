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
    cellName,
} from './SolveUtility.js';
import { NakedSingle } from './LogicalStep/NakedSingle.js';
import { HiddenSingle } from './LogicalStep/HiddenSingle.js';
import { ConstraintLogic } from './LogicalStep/ConstraintLogic.js';
import { CellForcing } from './LogicalStep/CellForcing.js';
import { NakedTupleAndPointing } from './LogicalStep/NakedTupleAndPointing.js';
import { ConstraintResult } from './Constraint/Constraint.js';
import { LogicResult } from './Enums/LogicResult.js';

export class Board {
    constructor(size) {
        this.size = size;
        this.allValues = allValues(size);
        this.givenBit = 1 << size;
        this.cells = new Array(size * size).fill(this.allValues);
        this.nonGivenCount = size * size;
        this.nakedSingles = [];
        this.weakLinks = Array.from({ length: size * size * size }, () => new Set());
        this.regions = [];
        this.constraints = [];
        this.constraintsFinalized = false;
        this.memos = {};
        this.logicalSteps = [
            new NakedSingle(this),
            new HiddenSingle(this),
            new ConstraintLogic(this),
            new CellForcing(this),
            new NakedTupleAndPointing(this),
        ];
    }

    clone() {
        // Shallow copy everything
        const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);

        // Deep copy cells and nakedSingles arrays
        clone.cells = [...this.cells];
        clone.nakedSingles = [...this.nakedSingles];

        return clone;
    }

    solutionString() {
        return JSON.stringify(this.getValueArray());
    }

    cellIndex(row, col) {
        return row * this.size + col;
    }

    cellCoords(cellIndex) {
        return [Math.floor(cellIndex / this.size), cellIndex % this.size];
    }

    candidateIndexRC(row, col, value) {
        return row * this.size * this.size + col * this.size + value - 1;
    }

    candidateIndex(cellIndex, value) {
        return cellIndex * this.size + value - 1;
    }

    cellIndexFromCandidate(candidateIndex) {
        return Math.floor(candidateIndex / this.size);
    }

    candidateToIndexAndValue(candidateIndex) {
        return [Math.floor(candidateIndex / this.size), (candidateIndex % this.size) + 1];
    }

    valueFromCandidate(candidateIndex) {
        return (candidateIndex % this.size) + 1;
    }

    maskStrictlyLower(v) {
        return (1 << (v - 1)) - 1;
    }

    maskStrictlyHigher(v) {
        return this.allValues ^ (1 << (v - 1));
    }

    maskLowerOrEqual(v) {
        return (1 << v) - 1;
    }

    maskHigherOrEqual(v) {
        return this.allValues ^ ((1 << v) - 1);
    }

    maskBetweenInclusive(v1, v2) {
        return this.maskHigherOrEqual(v1) & this.maskLowerOrEqual(v2);
    }

    maskBetweenExclusive(v1, v2) {
        return this.maskHigherOrEqual(v1) & this.maskStrictlyLower(v2);
    }

    addWeakLink(index1, index2) {
        if (index1 != index2) {
            this.weakLinks[index1].add(index2);
            this.weakLinks[index2].add(index1);
        }
    }

    removeWeakLink(index1, index2) {
        if (index1 != index2) {
            this.weakLinks[index1].delete(index2);
            this.weakLinks[index2].delete(index1);
        }
    }

    isWeakLink(index1, index2) {
        return this.weakLinks[index1].has(index2);
    }

    addRegion(name, cells, type, fromConstraint = null) {
        // Don't add regions which are too large
        if (cells.length > this.size) {
            return;
        }

        // Do not add duplicate regions
        if (this.regions.some(region => fromConstraint === region.fromConstraint && sequenceEqual(region, cells))) {
            return;
        }

        const newRegion = {
            name,
            fromConstraint,
            type,
            cells: cells.toSorted((a, b) => a - b),
        };
        this.regions.push(newRegion);

        for (let i0 = 0; i0 < cells.length - 1; i0++) {
            const cell0 = cells[i0];
            for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                const cell1 = cells[i1];
                this.addNonRepeatWeakLinks(cell0, cell1);
            }
        }
    }

    getRegionsForCell(cellIndex, type = null) {
        return this.regions.filter(region => region.cells.includes(cellIndex) && (type === null || region.type === type));
    }

    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    finalizeConstraints() {
        if (this.constraints.length > 0) {
            let haveChange = false;
            let firstLoop = true;
            do {
                haveChange = false;

                for (let constraint of this.constraints) {
                    const result = constraint.init(this, !firstLoop);
                    if (result === ConstraintResult.INVALID) {
                        return false;
                    }

                    if (result === ConstraintResult.CHANGED) {
                        haveChange = true;
                    }
                }
                firstLoop = false;
            } while (haveChange);
        }

        this.constraintsFinalized = true;
        return true;
    }

    addNonRepeatWeakLinks(cellIndex1, cellIndex2) {
        if (cellIndex1 === cellIndex2) {
            return;
        }

        for (let value = 1; value <= this.size; value++) {
            const candidateIndex1 = this.candidateIndex(cellIndex1, value);
            const candidateIndex2 = this.candidateIndex(cellIndex2, value);
            this.addWeakLink(candidateIndex1, candidateIndex2);
        }
    }

    addCloneWeakLinks(cellIndex1, cellIndex2) {
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

    getMemo(key) {
        // Simply return the value at the key, or null if it doesn't exist
        return this.memos[key] || null;
    }

    storeMemo(key, val) {
        this.memos[key] = val;
    }

    setCellMask(cellIndex, cellMask) {
        if ((this.cells[cellIndex] & this.allValues) === cellMask) {
            return;
        }

        this.cells[cellIndex] = cellMask;
        if (popcount(cellMask) === 1) {
            this.nakedSingles.push(cellIndex);
        }
    }

    keepCellMask(cellIndex, cellMask) {
        const origMask = this.cells[cellIndex] & this.allValues;
        const newMask = origMask & cellMask;
        if (newMask === origMask) {
            return ConstraintResult.UNCHANGED;
        }

        this.cells[cellIndex] = newMask;
        if (popcount(newMask) === 1) {
            this.nakedSingles.push(cellIndex);
        }
        return newMask !== 0 ? ConstraintResult.CHANGED : ConstraintResult.INVALID;
    }

    clearCellMask(cellIndex, cellMask) {
        return this.keepCellMask(cellIndex, this.allValues & ~cellMask);
    }

    clearValue(cellIndex, value) {
        this.cells[cellIndex] &= ~valueBit(value);
        if ((this.cells[cellIndex] & this.allValues) === 0) {
            return false;
        }
        if (popcount(this.cells[cellIndex]) === 1) {
            this.nakedSingles.push(cellIndex);
        }
        return true;
    }

    clearCandidate(candidate) {
        const [cellIndex, value] = this.candidateToIndexAndValue(candidate);
        return this.clearValue(cellIndex, value);
    }

    clearCandidates(candidates) {
        let valid = true;
        for (let candidate of candidates) {
            if (!this.clearCandidate(candidate)) {
                valid = false;
            }
        }
        return valid;
    }

    isGroup(cells) {
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
                    if (!this.weakLinks[candidate0].has(candidate1)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    isGroupByValue(cells, value) {
        for (let i0 = 0; i0 < cells.length - 1; i0++) {
            const cell0 = cells[i0];
            const candidate0 = this.candidateIndex(cell0, value);
            for (let i1 = i0 + 1; i1 < cells.length; i1++) {
                const cell1 = cells[i1];
                if (cell0 === cell1) {
                    continue;
                }

                const candidate1 = this.candidateIndex(cell1, value);
                if (!this.weakLinks[candidate0].has(candidate1)) {
                    return false;
                }
            }
        }
        return true;
    }

    isGroupByValueMask(cells, valueMask) {
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
                    if (!this.weakLinks[candidate0].has(candidate1)) {
                        return false;
                    }
                    valueMask ^= valueBit(value);
                }
            }
        }
        return true;
    }

    splitIntoGroups(cells) {
        const groups = [];

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
            for (let subCells of combinations(cells, groupSize)) {
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
        for (let cell of cells) {
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

            let initialNonGivenCount = this.nonGivenCount;
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
            for (let constraint of this.constraints) {
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

    canPlaceDigits(cells, values) {
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
            let weakLinks0 = this.weakLinks[candidates[c0]];
            for (let c1 = c0 + 1; c1 < numCells; c1++) {
                if (weakLinks0.has(candidates[c1])) {
                    return false;
                }
            }
        }

        return true;
    }

    canPlaceDigitsAnyOrder(cells, values) {
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

        for (let perm of permutations(values)) {
            if (this.canPlaceDigits(cells, perm)) {
                return true;
            }
        }

        return false;
    }

    valueNames(mask) {
        return maskToString(mask, this.size);
    }

    compactName(cells, mask = null) {
        let valuesString = '';
        if (mask) {
            valuesString += this.valueNames(mask);
        }

        const cellSep = this.size <= 9 ? '' : ',';
        const groupSep = ',';

        if (cells.length === 0) {
            return valuesString;
        }

        if (cells.length === 1) {
            return valuesString + cellName(cells[0], this.size);
        }

        const cellCoords = cells.map(cellIndex => this.cellCoords(cellIndex));
        if (cellCoords.every(coord => coord[0] === cellCoords[0][0])) {
            // All cells are in the same row
            return (
                valuesString +
                `r${cellCoords[0][0] + 1}c${cellCoords
                    .map(coord => coord[1] + 1)
                    .sort((a, b) => a - b)
                    .join(cellSep)}`
            );
        }

        if (cellCoords.every(coord => coord[1] === cellCoords[0][1])) {
            // All cells are in the same column
            return (
                valuesString +
                `r${cellCoords
                    .map(coord => coord[0] + 1)
                    .sort((a, b) => a - b)
                    .join(cellSep)}c${cellCoords[0][1] + 1}`
            );
        }

        const colsPerRow = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            colsPerRow[i] = [];
        }
        for (let [row, col] of cellCoords) {
            colsPerRow[row].push(col + 1);
        }
        for (let i = 0; i < this.size; i++) {
            colsPerRow[i].sort((a, b) => a - b);
        }

        let groups = [];
        for (let i = 0; i < this.size; i++) {
            if (colsPerRow[i].length === 0) {
                continue;
            }

            let rowsInGroup = [i + 1];
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

    performElims(elims) {
        let changed = false;
        for (let elim of elims) {
            const [cellIndex, value] = this.candidateToIndexAndValue(elim);
            if (!this.clearValue(cellIndex, value)) {
                return LogicResult.INVALID;
            }
            changed = true;
        }
        return changed ? LogicResult.CHANGED : LogicResult.UNCHANGED;
    }

    describeElims(elims) {
        // If all elims are for the same cell, describe it as a single cell
        const cellIndexes = new Set();
        for (let elim of elims) {
            cellIndexes.add(this.cellIndexFromCandidate(elim));
        }
        if (cellIndexes.size === 1) {
            const cellIndex = cellIndexes.values().next().value;
            var elimMask = 0;
            for (let elim of elims) {
                elimMask |= valueBit(this.valueFromCandidate(elim));
            }
            return `-${this.valueNames(elimMask)}${cellName(cellIndex, this.size)}`;
        }

        const elimsByVal = Array.from({ length: this.size }, () => []);
        for (let elim of elims) {
            const [cellIndex, value] = this.candidateToIndexAndValue(elim);
            elimsByVal[value - 1].push(cellIndex);
        }

        let elimDescs = [];
        for (let value = 1; value <= this.size; value++) {
            const elimCells = elimsByVal[value - 1];
            if (elimCells.length > 0) {
                elimCells.sort((a, b) => a - b);
                elimDescs.push(`-${value}${this.compactName(elimCells)}`);
            }
        }
        return elimDescs.join(';');
    }

    // Pass in an array of candidate indexes
    // Returns an array of candidate indexes which are eliminated by the input candidates
    calcElimsForCandidateIndices(candidateIndexes) {
        if (candidateIndexes.length === 0) {
            return [];
        }

        // Seed the elims with the first candidate
        let elims = Array.from(this.weakLinks[candidateIndexes[0]]);

        // Filter out already-eliminated candidates
        elims = elims.filter(candidateIndex => {
            const [cellIndex, value] = this.candidateToIndexAndValue(candidateIndex);
            return this.cells[cellIndex] & valueBit(value);
        });

        for (let i = 1; i < candidateIndexes.length; i++) {
            const candidateIndex = candidateIndexes[i];
            const weakLinks = this.weakLinks[candidateIndex];

            // Intersect the weak links for this candidate and the previous candidates
            elims = elims.filter(x => weakLinks.has(x));
        }
        return elims;
    }

    // eslint-disable-next-line no-unused-vars
    evaluateWeakLinks(cells, logicalStepDesc) {
        // Only allow eliminations for candidates within the cells
        const candidatesSet = new Set();
        for (let cell of cells) {
            let cellMask = this.cells[cell];
            while (cellMask !== 0) {
                const value = minValue(cellMask);
                candidatesSet.add(this.candidateIndex(cell, value));
                cellMask ^= valueBit(value);
            }
        }

        // Check for "cell forcing" eliminations that originate from the given cells
        for (let cell of cells) {
            let elimSet = null;
            let cellMask = this.cells[cell];
            while (cellMask !== 0) {
                const value = minValue(cellMask);
                const candidateIndex = this.candidateIndex(cell, value);
                const weakLinks = this.weakLinks[candidateIndex];
                if (elimSet === null) {
                    elimSet = new Set();
                    for (let elimCandidate of weakLinks) {
                        if (candidatesSet.has(elimCandidate)) {
                            elimSet.add(elimCandidate);
                        }
                    }
                } else {
                    // Interesection of the weak links for this candidate and the previous candidates
                    const toDelete = [];
                    for (let elimCandidate of elimSet) {
                        if (!weakLinks.has(elimCandidate)) {
                            toDelete.push(elimCandidate);
                        }
                    }

                    for (let elimCandidate of toDelete) {
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

            let exactlyOnce = atLeastOnce & ~moreThanOnce;
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

    isGiven(cellIndex) {
        return this.cells[cellIndex] & this.givenBit;
    }

    isGivenMask(cellMask) {
        return cellMask & this.givenBit;
    }

    isGivenValue(value) {
        return valueBit(value) & this.givenBit;
    }

    getValue(cellIndex) {
        return minValue(this.cells[cellIndex] & ~this.givenBit);
    }

    getValueArray() {
        return Array.from({ length: this.size * this.size }, (_, i) => (this.isGiven(i) ? this.getValue(i) : 0));
    }

    setAsGiven(cellIndex, value) {
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
        this.cells[cellIndex] = valueMask | givenBit;
        this.nonGivenCount--;

        // Apply any weak links
        const candidateIndex = this.candidateIndex(cellIndex, value);
        for (const otherCandidateIndex of this.weakLinks[candidateIndex]) {
            const otherCellIndex = this.cellIndexFromCandidate(otherCandidateIndex);
            if (otherCellIndex === cellIndex) {
                continue;
            }

            const otherValue = this.valueFromCandidate(otherCandidateIndex);
            const otherValueMask = valueBit(otherValue);
            this.cells[otherCellIndex] &= ~otherValueMask;
            if ((this.cells[otherCellIndex] & ~givenBit) === 0) {
                // No candidates left, board is invalid
                return false;
            } else if (popcount(this.cells[otherCellIndex]) === 1) {
                // The popcount will be 2 for cells that already have the given bit set
                // So it's safe to assume that if the popcount is 1, then the cell is a naked single
                this.nakedSingles.push(otherCellIndex);
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

    applyGivenPencilMarks(cellIndex, pencilMarks) {
        const pencilMarkBits = pencilMarks.reduce((bits, value) => bits | valueBit(value), 0);

        if (this.cells[cellIndex] & this.givenBit || popcount(this.cells[cellIndex]) === 1) {
            return (this.cells[cellIndex] & pencilMarkBits) !== 0;
        }

        this.cells[cellIndex] &= pencilMarkBits;
        if ((this.cells[cellIndex] & this.allValues) === 0) {
            return false;
        }

        const numCandidates = popcount(this.cells[cellIndex]);
        if (numCandidates === 1) {
            this.nakedSingles.push(cellIndex);
        }

        return true;
    }

    findUnassignedLocation(ignoreMasks = null) {
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

    findSolution(options, isCancelled) {
        const { random = false } = options || {};
        const jobStack = [this.clone()];
        let lastCancelCheckTime = Date.now();

        while (jobStack.length > 0) {
            if (isCancelled) {
                if (Date.now() - lastCancelCheckTime > 100) {
                    // Give the event loop a chance to receive new messages
                    setTimeout(() => {}, 0);

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

    async countSolutions(maxSolutions, reportProgress, isCancelled, solutionsSeen, solutionEvent) {
        const jobStack = [this.clone()];
        let numSolutions = 0;
        let lastReportTime = Date.now();
        const wantReportProgress = reportProgress || isCancelled;

        while (jobStack.length > 0) {
            if (wantReportProgress && Date.now() - lastReportTime > 100) {
                // Give the event loop a chance to receive new messages
                await new Promise(resolve => setTimeout(resolve, 0));

                // Check if the job was cancelled
                if (isCancelled()) {
                    return { numSolutions, isCancelled: true };
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
                            return { numSolutions, isCancelled: false };
                        }
                    }
                } else {
                    if (solutionEvent) {
                        solutionEvent(currentBoard);
                    }

                    numSolutions++;
                    if (maxSolutions > 0 && numSolutions === maxSolutions) {
                        return { numSolutions, isCancelled: false };
                    }
                }
                continue;
            }

            const unassignedIndex = currentBoard.findUnassignedLocation();
            if (unassignedIndex === null) {
                // Puzzle is complete, return the solution
                numSolutions++;
                if (maxSolutions > 0 && numSolutions === maxSolutions) {
                    return { numSolutions, isCancelled: false };
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

        return { numSolutions, isCancelled: false };
    }

    async calcTrueCandidates(maxSolutionsPerCandidate, isCancelled) {
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
        const solutionsSeen = wantSolutionCounts ? new Set() : null;

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
                    if (isCancelled()) {
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
                    const { isCancelled } = await newBoard.countSolutions(remainingSolutions, null, isCancelled, solutionsSeen, solutionBoard => {
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

                    if (isCancelled) {
                        return { isCancelled: true };
                    }

                    if (candidateCounts[candidateIndex] === 0) {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
                    }
                } else {
                    // Find any solution
                    const solution = newBoard.findSolution({}, isCancelled);
                    if (solution === null) {
                        // This candidate is impossible
                        board.clearCellMask(cellIndex, chosenValueMask);
                        removedCandidates = true;
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

    async logicalStep(isCancelled) {
        const desc = [];
        let lastCancelCheckTime = Date.now();
        for (const logicalStep of this.logicalSteps) {
            if (Date.now() - lastCancelCheckTime > 100) {
                // Give the event loop a chance to receive new messages
                await new Promise(resolve => setTimeout(resolve, 0));

                // Check if the job was cancelled
                if (isCancelled()) {
                    return { cancelled: true };
                }
                lastCancelCheckTime = Date.now();
            }

            const result = logicalStep.step(this, desc);
            if (result === LogicResult.INVALID) {
                return { desc: desc[0], invalid: true };
            } else if (result === LogicResult.CHANGED) {
                return { desc: desc[0], changed: true };
            }
        }

        return { unchanged: true };
    }

    async logicalSolve(isCancelled) {
        const desc = [];
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
