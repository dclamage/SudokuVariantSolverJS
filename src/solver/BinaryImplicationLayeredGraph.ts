import {
    appendInts,
    minValue,
    maxValue,
    popcount,
    removeDuplicates,
    sequenceFilterOutUpdateDefaultCompare,
    sequenceHasNonemptyIntersectionDefaultCompare,
    valueBit,
} from './SolveUtility';

// Table of contents

// - BinaryImplicationGraph
//   + Stores a bunch of edges in 4 tables, each table mapping variables to lists of variables using offset compression.
//   + Each table is for edges of a a different polarity, e.g. negative -> positive literal implications are stored in negpos.
// - BinaryImplicationLayeredGraph
//   + The real graph that will be used by the user.
//   + Stores graphs in "layers" where each layer corresponds to a subboard inheriting a graph from a parent board.
//   + Planned features: analysis such as SCC, clause forcing.

// Non-negative number
type Variable = number;
// Either a Variable x or its bitwise inversion ~x
type Literal = number;

function toVariable(lit: Literal): Variable {
    return lit ^ -+(lit < 0);
}

type BinaryImplicationTable = Variable[][];
type BooleanArray = Uint8Array;
class BinaryImplicationGraph {
    // a => b
    pospos: BinaryImplicationTable;
    // a => !b
    posneg: BinaryImplicationTable;
    // !a => b
    negpos: BinaryImplicationTable;
    // !a => !b
    negneg: BinaryImplicationTable;
    // In this order: negneg, negpos, posneg, pospos
    implicationsIndex: [BinaryImplicationTable, BinaryImplicationTable, BinaryImplicationTable, BinaryImplicationTable];

    posposunsorted: BooleanArray;
    posnegunsorted: BooleanArray;
    negposunsorted: BooleanArray;
    negnegunsorted: BooleanArray;
    // In this order: negneg, negpos, posneg, pospos
    unsortedIndex: [BooleanArray, BooleanArray, BooleanArray, BooleanArray];

    unsorted: Variable[][];

    constructor(numVariables: number) {
        this.pospos = new Array(numVariables);
        this.posneg = new Array(numVariables);
        this.negpos = new Array(numVariables);
        this.negneg = new Array(numVariables);
        this.implicationsIndex = [this.negneg, this.negpos, this.posneg, this.pospos];
        this.posposunsorted = new Uint8Array(numVariables);
        this.posnegunsorted = new Uint8Array(numVariables);
        this.negposunsorted = new Uint8Array(numVariables);
        this.negnegunsorted = new Uint8Array(numVariables);
        this.unsortedIndex = [this.negnegunsorted, this.negposunsorted, this.posnegunsorted, this.posposunsorted];
        this.unsorted = [];
    }

    allocateVariables(numNewVariables: number) {
        const newposposunsorted = new Uint8Array(this.posposunsorted.length + numNewVariables);
        newposposunsorted.set(this.posposunsorted);
        this.posposunsorted = newposposunsorted;
        const newposnegunsorted = new Uint8Array(this.posnegunsorted.length + numNewVariables);
        newposnegunsorted.set(this.posnegunsorted);
        this.posnegunsorted = newposnegunsorted;
        const newnegposunsorted = new Uint8Array(this.negposunsorted.length + numNewVariables);
        newnegposunsorted.set(this.negposunsorted);
        this.negposunsorted = newnegposunsorted;
        const newnegnegunsorted = new Uint8Array(this.negnegunsorted.length + numNewVariables);
        newnegnegunsorted.set(this.negnegunsorted);
        this.negnegunsorted = newnegnegunsorted;
    }

    implicationsArrFor(lit1: Literal, lit2: Literal) {
        return this.implicationsIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)][toVariable(lit1)];
    }

    unsortedArrFor(lit1: Literal, lit2: Literal) {
        return this.unsortedIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)];
    }

    sortGraph() {
        for (const arr of this.unsorted) {
            arr.sort((a, b) => a - b);
            removeDuplicates(arr);
        }
        this.unsorted.length = 0;
        this.negnegunsorted.fill(0);
        this.negposunsorted.fill(0);
        this.posnegunsorted.fill(0);
        this.posposunsorted.fill(0);
    }

    // Use bitwise invert (~x) to turn a variable into a negative literal.
    // All variables represent their positive literals.
    // Returns true if something was added
    addImplication(lit1: Literal, lit2: Literal): boolean {
        let forward = this.implicationsArrFor(lit1, lit2);
        const var2 = toVariable(lit2);
        if (forward?.includes(var2)) {
            return false;
        }
        if (forward === undefined) {
            forward = this.implicationsIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)][toVariable(lit1)] = [];
        }
        let backward = this.implicationsArrFor(~lit2, ~lit1);
        if (backward === undefined) {
            backward = this.implicationsIndex[+(~lit2 >= 0) * 2 + +(~lit1 >= 0)][toVariable(lit2)] = [];
        }
        const var1 = toVariable(lit1);

        forward.push(var2);
        const forwardUnsorted = this.unsortedArrFor(lit1, lit2);
        if (!forwardUnsorted[lit1]) {
            forwardUnsorted[lit1] = 1;
            this.unsorted.push(forward);
        }

        backward.push(var1);
        const backwardUnsorted = this.unsortedArrFor(~lit2, ~lit1);
        if (!backwardUnsorted[lit1]) {
            backwardUnsorted[lit1] = 1;
            this.unsorted.push(backward);
        }

        return true;
    }

    // Be careful! Only call this if you know it doesn't invalidate the rest of the graph.
    // This could be ok if maybe:
    //  - No preprocessing has been done yet, so removing this implication doesn't invalidate any transitive implications.
    //  - We're transferring an implication to a parent, so the semantics of the graph have not actually changed at all.
    unsafeRemoveImplication(lit1: Literal, lit2: Literal): boolean {
        const forward = this.implicationsArrFor(lit1, lit2);
        const var2 = toVariable(lit2);
        if (!forward?.includes(var2)) {
            return false;
        }
        const var1 = toVariable(lit1);
        const backward = this.implicationsArrFor(~lit2, ~lit1);
        // Preserves sortedness, no need to add to unsortedArr
        sequenceFilterOutUpdateDefaultCompare(forward, [var2], []);
        sequenceFilterOutUpdateDefaultCompare(backward, [var1], []);
        return true;
    }

    hasImplication(lit1: Literal, lit2: Literal): boolean {
        return this.implicationsArrFor(lit1, lit2)?.includes(toVariable(lit2));
    }

    getPosConsequences(lit: Literal, consequentsOutput: Variable[]) {
        const consequents = this.implicationsArrFor(lit, 0);
        if (consequents) {
            for (const consequent of consequents) {
                consequentsOutput.push(consequent);
            }
        }
    }

    getNegConsequences(lit: Literal, consequentsOutput: Variable[]) {
        const consequents = this.implicationsArrFor(lit, ~0);
        if (consequents) {
            for (const consequent of consequents) {
                consequentsOutput.push(consequent);
            }
        }
    }

    filterOutPosConsequences(lit: Literal, consequentsInout: Variable[], filteredOut: Variable[]) {
        const consequents = this.implicationsArrFor(lit, 0);
        if (consequents) {
            sequenceFilterOutUpdateDefaultCompare(consequentsInout, consequents, filteredOut);
        }
    }

    filterOutNegConsequences(lit: Literal, consequentsInout: Variable[], filteredOut: Variable[]) {
        const consequents = this.implicationsArrFor(lit, ~0);
        if (consequents) {
            sequenceFilterOutUpdateDefaultCompare(consequentsInout, consequents, filteredOut);
        }
    }

    hasAnyCommonPosConsequences(lit: Literal, consequents: Variable[]): boolean {
        const litConsequents = this.implicationsArrFor(lit, 0);
        return litConsequents && sequenceHasNonemptyIntersectionDefaultCompare(consequents, litConsequents);
    }

    hasAnyCommonNegConsequences(lit: Literal, consequents: Variable[]): boolean {
        const litConsequents = this.implicationsArrFor(lit, ~0);
        return litConsequents && sequenceHasNonemptyIntersectionDefaultCompare(consequents, litConsequents);
    }
}

export class BinaryImplicationLayeredGraph {
    // Static data

    numVariables: number;
    // TODO: Improve memoization so it uses literal update timestamping
    memo: Map<BinaryImplicationLayeredGraph, Map<string, readonly Variable[]>>;
    // Clause forcing data
    numTotalVariables: number;
    forcingLutExactlyOneClauses: Literal[][];
    forcingLutExactlyOneClauseIdToStartingPseudovariable: Variable[];

    // Mutable data (at least during preprocessing)

    graph: BinaryImplicationGraph;
    parentGraphs: BinaryImplicationGraph[];
    parentLayer: BinaryImplicationLayeredGraph | undefined;

    // undefined is only for `subboardClone`, users must provide actual values for both arguments.
    constructor(numVariables: number | undefined, exactlyOneClausesForForcingLuts: Literal[][] | undefined) {
        if (numVariables === undefined || exactlyOneClausesForForcingLuts === undefined) {
            // For cloning, assign the members in the same order so the hidden class is the same, but set them all to undefined so we don't create garbage.
            this.numVariables = undefined;
            this.memo = undefined;
            this.numTotalVariables = undefined;
            this.forcingLutExactlyOneClauses = undefined;
            this.forcingLutExactlyOneClauseIdToStartingPseudovariable = undefined;
            this.graph = undefined;
            this.parentGraphs = undefined;
            this.parentLayer = undefined;
        } else {
            this.numVariables = numVariables;
            this.memo = new Map();
            this.memo.set(this, new Map());

            this.numTotalVariables = numVariables;
            this.forcingLutExactlyOneClauses = exactlyOneClausesForForcingLuts.map(clause => clause.slice());
            this.forcingLutExactlyOneClauseIdToStartingPseudovariable = [];
            for (let clauseId = 0; clauseId < exactlyOneClausesForForcingLuts.length; clauseId++) {
                this.forcingLutExactlyOneClauseIdToStartingPseudovariable.push(this.numTotalVariables);
                this.numTotalVariables += 1 << exactlyOneClausesForForcingLuts[clauseId].length;
            }

            this.graph = new BinaryImplicationGraph(this.numVariables);
            this.parentGraphs = [];
            this.parentLayer = undefined;

            // TODO: Add intra-clause links, for now they don't matter since we don't do transitive reduction/closure
            // e.g. if we have a cell clause for r1c1: 1r1c1 + 2r1c1 + 3r1c1 + ... + 9r1c1 = 1
            // then ~1r1c1 = 23456789r1c1
            //      ~12r1c1 (neither 1 nor 2 can be in r1c1) = 3456789r1c1 (either 3 or 4 or 5 ... or 9 is in r1c1)
            //      ~13579r1c1 = 2468r1c1
            // also 1r1c1 -> 12r1c1
            //      12r1c1 -> 123r1c1
            // and finally 1r1c1 (a singleton clause variable) = 1r1c1 (the actual variable)
        }
    }

    // Clones the graph and adds a new layer corresponding to the new subboard.
    subboardClone(): this {
        const clone = Object.assign(new BinaryImplicationLayeredGraph(undefined, undefined), this);

        clone.memo.set(clone, new Map());

        clone.graph = new BinaryImplicationGraph(this.numVariables);

        clone.parentGraphs = this.parentGraphs.slice();
        clone.parentGraphs.push(this.graph);

        clone.parentLayer = this;

        return clone;
    }

    sortGraph() {
        this.graph.sortGraph();
        for (const parentGraph of this.parentGraphs) {
            parentGraph.sortGraph();
        }
    }

    preprocess() {
        for (let clauseId = 0; clauseId < this.forcingLutExactlyOneClauses.length; clauseId++) {
            const startingVariable = this.forcingLutExactlyOneClauseIdToStartingPseudovariable[clauseId];
            const clause = this.forcingLutExactlyOneClauses[clauseId];

            const numMasks = 1 << clause.length;

            // Initialize 1-hot masks
            for (let i = 0; i < clause.length; i++) {
                const mask = 1 << i;
                const lit = clause[i];
                const posImplicants = this.getPosConsequences(lit);
                const negImplicants = this.getNegConsequences(lit);
                if (posImplicants.length > 0) {
                    this.graph.pospos[startingVariable + mask] = posImplicants;
                }
                if (negImplicants.length > 0) {
                    this.graph.posneg[startingVariable + mask] = negImplicants;
                }
            }

            // Clause subsets of size 2 and above
            const masksByPopcount = Array.from({ length: clause.length + 1 }, () => []);
            for (let mask = 1; mask < numMasks; mask++) {
                masksByPopcount[popcount(mask)].push(mask);
            }

            for (const masks of masksByPopcount.slice(2)) {
                let hadNonzeroIntersection = false;
                for (const mask of masks) {
                    const firstMask = mask & -mask;
                    const restMask = mask & (mask - 1);
                    const restPos = this.graph.pospos[startingVariable + restMask];
                    const restNeg = this.graph.posneg[startingVariable + restMask];
                    if (restPos !== undefined) {
                        const firstPos = this.getPosConsequences(startingVariable + firstMask);
                        const intersection: Variable[] = [];
                        sequenceFilterOutUpdateDefaultCompare(firstPos, restPos, intersection);
                        if (intersection.length > 0) {
                            this.graph.pospos[startingVariable + mask] = intersection;
                        }
                    }
                    if (restNeg !== undefined) {
                        const firstNeg = this.getNegConsequences(startingVariable + firstMask);
                        const intersection: Variable[] = [];
                        sequenceFilterOutUpdateDefaultCompare(firstNeg, restNeg, intersection);
                        if (intersection.length > 0) {
                            this.graph.posneg[startingVariable + mask] = intersection;
                        }
                    }
                }

                if (!hadNonzeroIntersection) break;
            }
        }
    }

    clauseIdAndMaskToVariable(clauseId: number, mask: number): Variable {
        return this.forcingLutExactlyOneClauseIdToStartingPseudovariable[clauseId] + mask;
    }

    // Use bitwise invert (~x) to turn a variable into a negative literal.
    // All variables represent their positive literals.
    // Add methods return true if something was added

    addImplication(lit1: Literal, lit2: Literal): boolean {
        // TODO: Improve memoization so it uses literal update timestamping
        for (const bigMemoEntry of this.memo) {
            bigMemoEntry[1].clear();
        }
        if (this.hasParentImplication(lit1, lit2)) {
            return false;
        }
        return this.graph.addImplication(lit1, lit2);
    }

    transferImplicationToParent(lit1: Literal, lit2: Literal): boolean {
        if (this.graph.unsafeRemoveImplication(lit1, lit2)) {
            this.parentLayer!.addImplication(lit1, lit2);
            return true;
        }
        return false;
    }

    hasImplication(lit1: Literal, lit2: Literal): boolean {
        // heuristically check parent subboards first, which have the most links
        if (this.hasParentImplication(lit1, lit2)) {
            return true;
        }
        return this.graph.hasImplication(lit1, lit2);
    }

    getPosConsequences(lit: Literal): Variable[] {
        const posConsequents: Variable[] = [];
        for (const big of this.parentGraphs) {
            big.getPosConsequences(lit, posConsequents);
        }
        this.graph.getPosConsequences(lit, posConsequents);
        return posConsequents;
    }

    getNegConsequences(lit: Literal): Variable[] {
        const negConsequents: Variable[] = [];
        for (const big of this.parentGraphs) {
            big.getNegConsequences(lit, negConsequents);
        }
        this.graph.getNegConsequences(lit, negConsequents);
        return negConsequents;
    }

    getTopLayerPosConsequences(lit: Literal): Variable[] {
        const posConsequents: Variable[] = [];
        this.graph.getPosConsequences(lit, posConsequents);
        return posConsequents;
    }

    getTopLayerNegConsequences(lit: Literal): Variable[] {
        const negConsequents: Variable[] = [];
        this.graph.getNegConsequences(lit, negConsequents);
        return negConsequents;
    }

    getMemo(key: string): readonly Variable[] {
        return this.memo.get(this).get(key);
    }

    storeMemo(key: string, value: readonly Variable[]) {
        this.memo.get(this).set(key, value);
    }

    getCommonPosConsequences(lits: Literal[]): readonly Variable[] {
        lits.sort();
        return this.getCommonPosConsequencesHelper(lits);
    }

    getCommonPosConsequencesHelper(lits: Literal[]): readonly Variable[] {
        // Base case
        if (lits.length === 1) {
            return this.getPosConsequences(lits[0]);
        }
        lits.push(1); // key for "pos consequences"
        const memoKey = appendInts(lits);
        lits.pop();
        const memoResult = this.getMemo(memoKey);
        if (memoResult !== undefined) {
            return memoResult;
        }
        // Inductive case
        const [firstLit, ...restLits] = lits;
        const restConsequents = this.getCommonPosConsequencesHelper(restLits);
        if (restConsequents.length === 0) {
            this.storeMemo(memoKey, restConsequents);
            return restConsequents;
        }
        const firstConsequents = this.getPosConsequences(firstLit);
        const intersection: Variable[] = [];
        sequenceFilterOutUpdateDefaultCompare(firstConsequents, restConsequents, intersection);
        this.storeMemo(memoKey, intersection);
        return intersection;
    }

    getCommonNegConsequences(lits: Literal[]): readonly Variable[] {
        lits.sort();
        return this.getCommonNegConsequencesHelper(lits);
    }

    getCommonNegConsequencesHelper(lits: Literal[]): readonly Variable[] {
        // Base case
        if (lits.length === 1) {
            // TODO: Remove all the removeDuplicate once the BIG is properly deduplicated and sorted
            return this.getNegConsequences(lits[0]);
        }
        lits.push(0); // key for "neg consequences"
        const memoKey = appendInts(lits);
        lits.pop();
        const memoResult = this.getMemo(memoKey);
        if (memoResult !== undefined) {
            return memoResult;
        }
        // Inductive case
        const [firstLit, ...restLits] = lits;
        const restConsequents = this.getCommonNegConsequencesHelper(restLits);
        if (restConsequents.length === 0) {
            this.storeMemo(memoKey, restConsequents);
            return restConsequents;
        }
        const firstConsequents = this.getNegConsequences(firstLit);
        const intersection: Variable[] = [];
        sequenceFilterOutUpdateDefaultCompare(firstConsequents, restConsequents, intersection);
        this.storeMemo(memoKey, intersection);
        return intersection;
    }

    filterOutPosConsequences(lit: Literal, posConsequentsInout: Variable[], filteredOut: Variable[]) {
        for (const big of this.parentGraphs) {
            big.filterOutPosConsequences(lit, posConsequentsInout, filteredOut);
        }
        this.graph.filterOutPosConsequences(lit, posConsequentsInout, filteredOut);
    }

    filterOutNegConsequences(lit: Literal, negConsequentsInout: Variable[], filteredOut: Variable[]) {
        for (const big of this.parentGraphs) {
            big.filterOutNegConsequences(lit, negConsequentsInout, filteredOut);
        }
        this.graph.filterOutNegConsequences(lit, negConsequentsInout, filteredOut);
    }

    filterOutTopLayerPosConsequences(lit: Literal, posConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.graph.filterOutPosConsequences(lit, posConsequentsInout, filteredOut);
    }

    filterOutTopLayerNegConsequences(lit: Literal, negConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.graph.filterOutNegConsequences(lit, negConsequentsInout, filteredOut);
    }

    hasAnyCommonPosConsequences(lit: Literal, posConsequentsInout: Variable[]): boolean {
        for (const big of this.parentGraphs) {
            if (big.hasAnyCommonPosConsequences(lit, posConsequentsInout)) {
                return true;
            }
        }
        return this.graph.hasAnyCommonPosConsequences(lit, posConsequentsInout);
    }

    hasAnyCommonNegConsequences(lit: Literal, negConsequentsInout: Variable[]): boolean {
        for (const big of this.parentGraphs) {
            if (big.hasAnyCommonNegConsequences(lit, negConsequentsInout)) {
                return true;
            }
        }
        return this.graph.hasAnyCommonNegConsequences(lit, negConsequentsInout);
    }

    // In this order: negneg, negpos, posneg, pospos
    countImplicationsByType(): [number, number, number, number] {
        const allVariables = Array.from({ length: this.numVariables }, (_, i) => i);
        const negneg = allVariables.reduce((acc, v) => acc + this.getNegConsequences(~v).length, 0);
        const negpos = allVariables.reduce((acc, v) => acc + this.getPosConsequences(~v).length, 0);
        const posneg = allVariables.reduce((acc, v) => acc + this.getNegConsequences(v).length, 0);
        const pospos = allVariables.reduce((acc, v) => acc + this.getPosConsequences(v).length, 0);
        return [negneg, negpos, posneg, pospos];
    }

    private hasParentImplication(lit1: Literal, lit2: Literal): boolean {
        for (const big of this.parentGraphs) {
            if (big.hasImplication(lit1, lit2)) {
                return true;
            }
        }
        return false;
    }
}

// TODO FOR BinaryImplicationLayeredGraph:

// - Implement cell forcing
//   + Put weak links in the graph
//   + Add some way for the user to register a clause to be forced over, and BIG will compute the "clause forcing links"
//   + A clause forcing link is an implication of the form (restricted clause) -> literal
//     where a restricted clause is any subset of the clause to be forced over
//   + The user should be able to look up a clause + its restriction (in the form of a bitmask) and obtain the links for that restriction.
//   + Importantly, this should have low overhead for the vast majority of cases where the restriction does not actually have any links.
//     - This is the case for all cell clauses in classic Sudoku, or any non-pointing house clauses.

// - Implement SCCs
//   + Transitive Reduction (for looking up which links have to be applied)
//   + Transitive Closure (when taking the intersection of links, we should ensure we intersect all implications)
//   + Both algorithms should be possible in one pass of Tarjan's SCC algorithm.
//   + https://en.wikipedia.org/wiki/Tarjan's_strongly_connected_components_algorithm
//   + Need a mapping for equivalent literals and a list of failed literals, and we can remove the weak links for equivalent/failed/entailed literals
//   + May need to take care that removing such links doesn't ruin compression.

// - BinSatSCC
//   + We'll never implement this.
//   + Just putting it here it's cool.
//     - Simplifying Binary Propositional Theories into Connected Components Twice as Fast
//     - Alvaro del Val
//     - November 2001
//   + Essentially while running SCC you can detect failed/entailed literals, and use that to prune the graph as you go.
//     - The idea of pruning comes from BinSat, whereas SCC came from many other places. This paper combined them.
//   + From the abstract:
//     - We show empirically that the algorithms are onsiderably faster than other SCC-based algorithms,
//     - and have greater simplifying power, as they combine detection of entailed literals with identifation of SCCs,
//     - i.e. sets of equivalent literals.
