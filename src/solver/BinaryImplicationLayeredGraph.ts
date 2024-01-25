import { Board } from './Board';
import {
    appendInts,
    popcount,
    removeDuplicates,
    sequenceFilterOutUpdateDefaultCompare,
    valueBit,
    hasValue,
    sequenceIntersectionDefaultCompare,
    sequenceDeleteDefaultCompare,
    sequenceExtend,
    sequenceHasNonemptyIntersectionDefaultCompare,
    sequenceInsertDefaultCompare,
    sequenceIntersectionUpdateDefaultCompare,
    sequenceUnionDefaultCompare,
    sequenceRemoveUpdateDefaultCompare,
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

// Used to track when cached results are invalidated
type Timestamp = number;

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

    posposUnsorted: BooleanArray;
    posnegUnsorted: BooleanArray;
    negposUnsorted: BooleanArray;
    negnegUnsorted: BooleanArray;
    // In this order: negneg, negpos, posneg, pospos
    unsortedIndex: [BooleanArray, BooleanArray, BooleanArray, BooleanArray];

    unsorted: Variable[][];

    posposTimestamp: Timestamp[];
    posnegTimestamp: Timestamp[];
    negposTimestamp: Timestamp[];
    negnegTimestamp: Timestamp[];
    timestampIndex: [Timestamp[], Timestamp[], Timestamp[], Timestamp[]];

    nextUpdateTimestamp: [Timestamp];

    constructor(numVariables: number, nextUpdateTimestamp: [Timestamp]) {
        this.pospos = new Array(numVariables);
        this.posneg = new Array(numVariables);
        this.negpos = new Array(numVariables);
        this.negneg = new Array(numVariables);
        this.implicationsIndex = [this.negneg, this.negpos, this.posneg, this.pospos];

        this.posposUnsorted = new Uint8Array(numVariables);
        this.posnegUnsorted = new Uint8Array(numVariables);
        this.negposUnsorted = new Uint8Array(numVariables);
        this.negnegUnsorted = new Uint8Array(numVariables);
        this.unsortedIndex = [this.negnegUnsorted, this.negposUnsorted, this.posnegUnsorted, this.posposUnsorted];
        this.unsorted = [];

        this.posposTimestamp = new Array(numVariables);
        this.posnegTimestamp = new Array(numVariables);
        this.negposTimestamp = new Array(numVariables);
        this.negnegTimestamp = new Array(numVariables);
        this.timestampIndex = [this.negnegTimestamp, this.negposTimestamp, this.posnegTimestamp, this.posposTimestamp];

        this.nextUpdateTimestamp = nextUpdateTimestamp;
    }

    implicationsTableFor(lit1: Literal, lit2: Literal) {
        return this.implicationsIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)];
    }

    implicationsArrFor(lit1: Literal, lit2: Literal) {
        return this.implicationsTableFor(lit1, lit2)[toVariable(lit1)];
    }

    unsortedArrFor(lit1: Literal, lit2: Literal) {
        return this.unsortedIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)];
    }

    timestampArrFor(lit1: Literal, lit2: Literal) {
        return this.timestampIndex[+(lit1 >= 0) * 2 + +(lit2 >= 0)];
    }

    sortGraph() {
        if (this.unsorted.length === 0) return;
        for (const arr of this.unsorted) {
            arr.sort((a, b) => a - b);
            removeDuplicates(arr);
        }
        this.unsorted.length = 0;
        this.negnegUnsorted.fill(0);
        this.negposUnsorted.fill(0);
        this.posnegUnsorted.fill(0);
        this.posposUnsorted.fill(0);
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
            forward = this.implicationsTableFor(lit1, lit2)[toVariable(lit1)] = [];
        }
        let backward = this.implicationsArrFor(~lit2, ~lit1);
        if (backward === undefined) {
            backward = this.implicationsTableFor(~lit2, ~lit1)[toVariable(lit2)] = [];
        }
        const var1 = toVariable(lit1);

        forward.push(var2);
        const forwardUnsorted = this.unsortedArrFor(lit1, lit2);
        if (!forwardUnsorted[toVariable(lit1)]) {
            forwardUnsorted[toVariable(lit1)] = 1;
            this.unsorted.push(forward);
            this.timestampArrFor(lit1, lit2)[toVariable(lit1)] = this.nextUpdateTimestamp[0];
        }

        backward.push(var1);
        const backwardUnsorted = this.unsortedArrFor(~lit2, ~lit1);
        if (!backwardUnsorted[toVariable(lit2)]) {
            backwardUnsorted[toVariable(lit2)] = 1;
            this.unsorted.push(backward);
            this.timestampArrFor(~lit2, ~lit1)[toVariable(lit2)] = this.nextUpdateTimestamp[0];
        }
        this.nextUpdateTimestamp[0]++;

        return true;
    }

    // Undefined behaviour if implications already exist.
    addPosImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1: Literal, vars2: readonly Variable[]) {
        // Add forward implications
        const forward = this.implicationsArrFor(lit1, 0);
        if (forward === undefined) {
            this.implicationsTableFor(lit1, 0)[toVariable(lit1)] = vars2.slice();
        } else {
            this.implicationsTableFor(lit1, 0)[toVariable(lit1)] = sequenceUnionDefaultCompare(forward, vars2);
        }
        this.timestampArrFor(lit1, 0)[toVariable(lit1)] = this.nextUpdateTimestamp[0];

        // For each backwards implication insert lit1 at the correct spot.
        const var1 = toVariable(lit1);
        if (lit1 >= 0) {
            for (const var2 of vars2) {
                this.negnegTimestamp[var2] = this.nextUpdateTimestamp[0];
                const backward = this.negneg[var2];
                if (backward === undefined) {
                    this.negneg[var2] = [var1];
                } else {
                    let i = 0;
                    for (; i < backward.length; ++i) {
                        if (backward[i] > var1) {
                            backward.splice(i, 0, var1);
                            break;
                        }
                    }
                    if (i === backward.length) {
                        backward.push(var1);
                    }
                }
            }
        } else {
            for (const var2 of vars2) {
                this.negposTimestamp[var2] = this.nextUpdateTimestamp[0];
                const backward = this.negpos[var2];
                if (backward === undefined) {
                    this.negpos[var2] = [var1];
                } else {
                    let i = 0;
                    for (; i < backward.length; ++i) {
                        if (backward[i] > var1) {
                            backward.splice(i, 0, var1);
                            break;
                        }
                    }
                    if (i === backward.length) {
                        backward.push(var1);
                    }
                }
            }
        }
        this.nextUpdateTimestamp[0]++;
    }

    // Undefined behaviour if implications already exist.
    addNegImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1: Literal, vars2: readonly Variable[]) {
        // Add forward implications
        const forward = this.implicationsArrFor(lit1, ~0);
        if (forward === undefined) {
            this.implicationsTableFor(lit1, ~0)[toVariable(lit1)] = vars2.slice();
        } else {
            this.implicationsTableFor(lit1, ~0)[toVariable(lit1)] = sequenceUnionDefaultCompare(forward, vars2);
        }
        this.timestampArrFor(lit1, 0)[toVariable(lit1)] = this.nextUpdateTimestamp[0];

        // For each backwards implication insert lit1 at the correct spot.
        const var1 = toVariable(lit1);
        if (lit1 >= 0) {
            for (const var2 of vars2) {
                this.posnegTimestamp[var2] = this.nextUpdateTimestamp[0];
                const backward = this.posneg[var2];
                if (backward === undefined) {
                    this.posneg[var2] = [var1];
                } else {
                    let i = 0;
                    for (; i < backward.length; ++i) {
                        if (backward[i] > var1) {
                            backward.splice(i, 0, var1);
                            break;
                        }
                    }
                    if (i === backward.length) {
                        backward.push(var1);
                    }
                }
            }
        } else {
            for (const var2 of vars2) {
                this.posposTimestamp[var2] = this.nextUpdateTimestamp[0];
                const backward = this.pospos[var2];
                if (backward === undefined) {
                    this.pospos[var2] = [var1];
                } else {
                    let i = 0;
                    for (; i < backward.length; ++i) {
                        if (backward[i] > var1) {
                            backward.splice(i, 0, var1);
                            break;
                        }
                    }
                    if (i === backward.length) {
                        backward.push(var1);
                    }
                }
            }
        }
        this.nextUpdateTimestamp[0]++;
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

    getPosConsequences(lit: Literal): readonly Variable[] {
        return this.implicationsArrFor(lit, 0) ?? [];
    }
    getNegConsequences(lit: Literal): readonly Variable[] {
        return this.implicationsArrFor(lit, ~0) ?? [];
    }

    getPosLastUpdateTimestamp(lit: Literal): Timestamp {
        return this.timestampArrFor(lit, 0)[toVariable(lit)] ?? 0;
    }
    getNegLastUpdateTimestamp(lit: Literal): Timestamp {
        return this.timestampArrFor(lit, ~0)[toVariable(lit)] ?? 0;
    }
}

export class BinaryImplicationLayeredGraph {
    // Static data

    private numVariables: number;
    private newMemo: Map<string, { lastUpdateTimestamp: Timestamp; variables: readonly Variable[] }>;
    // Clause forcing data
    private numTotalVariables: number;
    private forcingLutExactlyOneClauses: Literal[][];
    private forcingLutExactlyOneClauseIdToStartingPseudovariable: Variable[];

    // Mutable data (at least during preprocessing)

    private nextUpdateTimestamp: [Timestamp]; // Store in a list since we want this to be shared by all graphs
    private lastUpdateTimestampForClauseForcing: Timestamp;
    private lastUpdateTimestampForScc: Timestamp;
    private lastSortTimestamp: Timestamp;
    private graph: BinaryImplicationGraph;
    private reducedGraph: BinaryImplicationGraph;
    private closureGraph: BinaryImplicationGraph;
    private parentGraphs: BinaryImplicationGraph[];
    private parentLayer: BinaryImplicationLayeredGraph | undefined;
    private prunedLiterals: Set<Literal>;

    // undefined is only for `subboardClone`, users must provide actual values for both arguments.
    constructor(numVariables: number | undefined, exactlyOneClausesForForcingLuts: Literal[][] | undefined) {
        if (numVariables === undefined || exactlyOneClausesForForcingLuts === undefined) {
            // For cloning, assign the members in the same order so the hidden class is the same, but set them all to undefined so we don't create garbage.
            this.numVariables = undefined;
            this.newMemo = undefined;
            this.numTotalVariables = undefined;
            this.forcingLutExactlyOneClauses = undefined;
            this.forcingLutExactlyOneClauseIdToStartingPseudovariable = undefined;
            this.nextUpdateTimestamp = undefined;
            this.lastUpdateTimestampForClauseForcing = undefined;
            this.lastUpdateTimestampForScc = undefined;
            this.graph = undefined;
            this.reducedGraph = undefined;
            this.closureGraph = undefined;
            this.parentGraphs = undefined;
            this.parentLayer = undefined;
            this.prunedLiterals = undefined;
        } else {
            this.numVariables = numVariables;
            this.newMemo = new Map();

            this.numTotalVariables = numVariables;
            this.forcingLutExactlyOneClauses = exactlyOneClausesForForcingLuts.map(clause => clause.slice());
            this.forcingLutExactlyOneClauseIdToStartingPseudovariable = [];
            for (let clauseId = 0; clauseId < exactlyOneClausesForForcingLuts.length; clauseId++) {
                this.forcingLutExactlyOneClauseIdToStartingPseudovariable.push(this.numTotalVariables);
                this.numTotalVariables += 1 << exactlyOneClausesForForcingLuts[clauseId].length;
            }

            this.nextUpdateTimestamp = [1];
            this.lastUpdateTimestampForClauseForcing = 0;
            this.lastUpdateTimestampForScc = 0;
            this.graph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);
            this.reducedGraph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);
            this.closureGraph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);
            this.parentGraphs = [];
            this.parentLayer = undefined;
            this.prunedLiterals = new Set();

            for (let clauseId = 0; clauseId < exactlyOneClausesForForcingLuts.length; clauseId++) {
                const startingVariable = this.forcingLutExactlyOneClauseIdToStartingPseudovariable[clauseId];
                const clause = this.forcingLutExactlyOneClauses[clauseId];
                const numMasks = 1 << clause.length;
                for (let mask = 1; mask < numMasks; mask++) {
                    // abc -> ~def
                    // this.addImplication(startingVariable + mask, ~(startingVariable + ((numMasks - 1) ^ ~mask)));
                    // let reducedMask = mask & (mask - 1);
                    // if (reducedMask > 0) {
                    //     // ab -> abc
                    //     this.addImplication(startingVariable + reducedMask, startingVariable + mask);
                    // }
                }
                for (let i = 0; i < clause.length; i++) {
                    this.addImplication(startingVariable + (1 << i), clause[i]);
                    this.addImplication(clause[i], startingVariable + (1 << i));
                }
            }
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
    subboardClone(): BinaryImplicationLayeredGraph {
        const clone: BinaryImplicationLayeredGraph = Object.assign(new BinaryImplicationLayeredGraph(undefined, undefined), this);

        clone.graph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);
        clone.reducedGraph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);
        clone.closureGraph = new BinaryImplicationGraph(this.numVariables, this.nextUpdateTimestamp);

        clone.parentGraphs = this.parentGraphs.slice();
        clone.parentGraphs.push(this.graph);

        clone.parentLayer = this;

        return clone;
    }

    sortGraph() {
        if (this.lastSortTimestamp === this.nextUpdateTimestamp[0]) return;
        this.lastSortTimestamp = this.nextUpdateTimestamp[0];
        this.graph.sortGraph();
        for (const parentGraph of this.parentGraphs) {
            parentGraph.sortGraph();
        }
    }

    finalize(board: Board) {
        this.sortGraph();

        if (this.parentLayer === undefined) {
            this.pruneImpossibleCandidates(board);
        }

        this.recomputeClauseForcingLUTs();
    }

    preprocess(board: Board) {
        this.sortGraph();

        if (this.parentLayer === undefined) {
            this.pruneImpossibleCandidates(board);
        }

        this.recomputeScc();

        this.recomputeClauseForcingLUTs();
    }

    private pruneImpossibleCandidates(board: Board) {
        for (let cellIndex = 0; cellIndex < board.size * board.size; cellIndex++) {
            for (let value = 1; value <= board.size; value++) {
                const candidate = board.candidateIndex(cellIndex, value);
                if (!this.prunedLiterals.has(candidate) && !hasValue(board.cells[cellIndex], value)) {
                    this.prunedLiterals.add(candidate);
                    for (const implicant of this.getPosConsequences(candidate)) {
                        this.graph.unsafeRemoveImplication(candidate, implicant);
                    }
                    for (const implicant of this.getNegConsequences(candidate)) {
                        this.graph.unsafeRemoveImplication(candidate, ~implicant);
                    }
                }
                if (!this.prunedLiterals.has(~candidate) && board.cells[cellIndex] === (valueBit(value) | board.givenBit)) {
                    this.prunedLiterals.add(~candidate);
                    for (const implicant of this.getPosConsequences(~candidate)) {
                        this.graph.unsafeRemoveImplication(~candidate, implicant);
                    }
                    for (const implicant of this.getNegConsequences(~candidate)) {
                        this.graph.unsafeRemoveImplication(~candidate, ~implicant);
                    }
                }
            }
        }
    }

    private recomputeScc() {
        const latestUpdate = this.nextUpdateTimestamp[0] - 1;
        if (this.lastUpdateTimestampForScc === latestUpdate) return;

        if (this.parentLayer !== undefined) {
            this.parentLayer.recomputeScc();
        }

        if (this.lastUpdateTimestampForScc === 0) {
            this.lastUpdateTimestampForScc = latestUpdate;
            this.initialComputeScc();
        } else {
            this.lastUpdateTimestampForScc = latestUpdate;
            this.incrementalComputeScc();
        }
    }

    private initialComputeScc() {
        let time = 0;
        const discoverTime = new Uint32Array(this.numTotalVariables * 2);
        const lowlinkTime = new Uint32Array(this.numTotalVariables * 2);
        const done = new Uint8Array(this.numTotalVariables * 2);
        const sccStack: Literal[] = [];
        const currentScc: Literal[] = [];
        // const posClosure: Set<Variable> = new Set();
        // const negClosure: Set<Variable> = new Set();

        const visit = (lit: Literal) => {
            // console.log('visiting lit', lit);
            time++;
            discoverTime[lit + this.numTotalVariables] = lowlinkTime[lit + this.numTotalVariables] = time;
            for (const pos of this.getPosConsequencesFull(lit)) {
                if (discoverTime[pos + this.numTotalVariables] === 0) {
                    visit(pos);
                    lowlinkTime[lit + this.numTotalVariables] = Math.min(
                        lowlinkTime[lit + this.numTotalVariables],
                        lowlinkTime[pos + this.numTotalVariables]
                    );
                } else if (done[pos + this.numTotalVariables] === 0) {
                    lowlinkTime[lit + this.numTotalVariables] = Math.min(
                        lowlinkTime[lit + this.numTotalVariables],
                        discoverTime[pos + this.numTotalVariables]
                    );
                }
            }
            for (const neg of this.getNegConsequencesFull(lit)) {
                if (discoverTime[~neg + this.numTotalVariables] === 0) {
                    visit(~neg);
                    lowlinkTime[lit + this.numTotalVariables] = Math.min(
                        lowlinkTime[lit + this.numTotalVariables],
                        lowlinkTime[~neg + this.numTotalVariables]
                    );
                } else if (done[~neg + this.numTotalVariables] === 0) {
                    lowlinkTime[lit + this.numTotalVariables] = Math.min(
                        lowlinkTime[lit + this.numTotalVariables],
                        discoverTime[~neg + this.numTotalVariables]
                    );
                }
            }

            if (lowlinkTime[lit + this.numTotalVariables] != discoverTime[lit + this.numTotalVariables]) {
                // console.log('exiting lit, it was not an scc root', lit);
                sccStack.push(lit);
            } else {
                // console.log("exiting lit, it's an scc root", lit);
                done[lit + this.numTotalVariables] = 1;
                currentScc.push(lit);
                while (sccStack.length > 0) {
                    const lit2 = sccStack[sccStack.length - 1];
                    if (discoverTime[lit2 + this.numTotalVariables] > discoverTime[lit + this.numTotalVariables]) {
                        done[lit2 + this.numTotalVariables] = 1;
                        currentScc.push(lit2);
                        sccStack.pop();
                    } else {
                        break;
                    }
                }
                let posClosureArr: Variable[] = [];
                let negClosureArr: Variable[] = [];
                currentScc.sort((a, b) => a - b);
                for (const lit of currentScc) {
                    const posConsequents = this.getPosConsequencesFullSorted(lit);
                    const negConsequents = this.getNegConsequencesFullSorted(lit);
                    for (const pos of posConsequents) {
                        if (posClosureArr.includes(pos)) continue;
                        posClosureArr = sequenceUnionDefaultCompare(posClosureArr, this.closureGraph.getPosConsequences(pos));
                        negClosureArr = sequenceUnionDefaultCompare(negClosureArr, this.closureGraph.getNegConsequences(pos));
                    }
                    for (const neg of negConsequents) {
                        if (negClosureArr.includes(neg)) continue;
                        posClosureArr = sequenceUnionDefaultCompare(posClosureArr, this.closureGraph.getPosConsequences(~neg));
                        negClosureArr = sequenceUnionDefaultCompare(negClosureArr, this.closureGraph.getNegConsequences(~neg));
                    }
                    posClosureArr = sequenceUnionDefaultCompare(posClosureArr, posConsequents);
                    negClosureArr = sequenceUnionDefaultCompare(negClosureArr, negConsequents);
                }
                for (const lit of currentScc) {
                    if (lit >= 0) {
                        this.closureGraph.pospos[lit] = posClosureArr.slice();
                        this.closureGraph.posneg[lit] = negClosureArr.slice();
                    } else {
                        this.closureGraph.negpos[~lit] = posClosureArr.slice();
                        this.closureGraph.negneg[~lit] = negClosureArr.slice();
                    }
                }
                // console.log('scc', currentScc.slice());
                // console.log('pos', posClosureArr.slice());
                // console.log('neg', negClosureArr.slice());
                // let posToReduce: Variable[] = [];
                // let negToReduce: Variable[] = [];
                // for (const lit of currentScc) {
                //     posToReduce = sequenceUnionDefaultCompare(posToReduce, this.getPosConsequencesFullSorted(lit));
                //     negToReduce = sequenceUnionDefaultCompare(negToReduce, this.getNegConsequencesFullSorted(lit));
                // }
                // sequenceRemoveUpdateDefaultCompare(posToReduce, currentScc);
                // sequenceRemoveUpdateDefaultCompare(negToReduce, currentScc.map(x => ~x).reverse());
                // while (posToReduce.length > 0) {
                //     const pos = posToReduce.pop();
                //     // console.log('removing due to', pos, this.closureGraph.getPosConsequences(pos));
                //     // console.log('removing due to', pos, this.closureGraph.getNegConsequences(pos));
                //     sequenceRemoveUpdateDefaultCompare(posClosureArr, this.closureGraph.getPosConsequences(pos));
                //     sequenceRemoveUpdateDefaultCompare(negClosureArr, this.closureGraph.getNegConsequences(pos));
                //     sequenceRemoveUpdateDefaultCompare(posToReduce, this.closureGraph.getPosConsequences(pos));
                //     sequenceRemoveUpdateDefaultCompare(negToReduce, this.closureGraph.getNegConsequences(pos));
                // }
                // while (negToReduce.length > 0) {
                //     const neg = negToReduce.pop();
                //     // console.log('removing due to', ~neg, this.closureGraph.getPosConsequences(neg));
                //     // console.log('removing due to', ~neg, this.closureGraph.getNegConsequences(neg));
                //     sequenceRemoveUpdateDefaultCompare(posClosureArr, this.closureGraph.getPosConsequences(~neg));
                //     sequenceRemoveUpdateDefaultCompare(negClosureArr, this.closureGraph.getNegConsequences(~neg));
                //     sequenceRemoveUpdateDefaultCompare(posToReduce, this.closureGraph.getPosConsequences(~neg));
                //     sequenceRemoveUpdateDefaultCompare(negToReduce, this.closureGraph.getNegConsequences(~neg));
                // }
                // // console.log('pos reduced', posClosureArr.slice());
                // // console.log('neg reduced', negClosureArr.slice());
                // if (currentScc.length === 1) {
                //     if (posClosureArr.length > 0) {
                //         if (lit >= 0) {
                //             this.reducedGraph.pospos[lit] = posClosureArr.slice();
                //         } else {
                //             this.reducedGraph.negpos[~lit] = posClosureArr.slice();
                //         }
                //     }
                //     if (negClosureArr.length > 0) {
                //         if (lit >= 0) {
                //             this.reducedGraph.posneg[lit] = negClosureArr.slice();
                //         } else {
                //             this.reducedGraph.negneg[~lit] = negClosureArr.slice();
                //         }
                //     }
                // } else {
                //     for (const lit of currentScc) {
                //         if (lit >= 0) {
                //             this.reducedGraph.pospos[lit] = posClosureArr.slice();
                //             this.reducedGraph.posneg[lit] = negClosureArr.slice();
                //         } else {
                //             this.reducedGraph.negpos[~lit] = posClosureArr.slice();
                //             this.reducedGraph.negneg[~lit] = negClosureArr.slice();
                //         }
                //     }
                //     for (let i = 0; i < currentScc.length; i++) {
                //         const lit = currentScc[i];
                //         const nextLit = currentScc[i === currentScc.length - 1 ? 0 : i + 1];
                //         this.reducedGraph.implicationsArrFor(lit, nextLit).push(toVariable(nextLit));
                //     }
                // }
                posClosureArr.length = 0;
                negClosureArr.length = 0;
                currentScc.length = 0;
            }
        };

        for (let variable: Variable = 0; variable < this.numVariables; variable++) {
            // console.log('visiting variable root', variable);
            if (discoverTime[variable + this.numTotalVariables] === 0) visit(variable);
            // debugger;
            if (discoverTime[~variable + this.numTotalVariables] === 0) visit(~variable);
        }

        // Now closure is computed, do transitive reduction
        // doesn't work
        // this.transitiveReduction();
    }

    // doesn't work
    private transitiveReduction() {
        if (this.parentLayer !== undefined) {
            return;
        }
        this.counter = this.counter ?? 0;
        const maxCounter = 1120;
        for (let variable: Variable = 0; variable < this.numVariables; variable++) {
            const pospos = this.graph.pospos[variable];
            const posneg = this.graph.posneg[variable];
            if (pospos !== undefined) {
                for (let i = 0; i < pospos.length; i++) {
                    if (this.counter > maxCounter) debugger;
                    const pos = pospos[i];
                    if (pos >= this.numVariables) break;
                    // if they're in the same SCC, we can't remove it
                    if (this.graph.pospos[pos]?.includes(variable)) continue;
                    // variable -> x -> pos
                    // if ~pos -> ~x and variable -> x
                    if (
                        this.graph.negneg[pos] !== undefined &&
                        sequenceIntersectionDefaultCompare(this.graph.negneg[pos], pospos).filter(v => v < this.numVariables).length > 0
                    ) {
                        console.log(variable, pos, 'because pos', this.graph.negneg[pos].slice(), pospos.slice());
                        pospos.splice(i, 1);
                        sequenceDeleteDefaultCompare(this.graph.negneg[pos], variable);
                        i--;
                        this.counter++;
                        continue;
                    }
                    // variable -> ~x -> pos
                    // if ~pos -> x and variable -> ~x
                    if (
                        this.graph.negpos[pos] !== undefined &&
                        posneg !== undefined &&
                        sequenceIntersectionDefaultCompare(this.graph.negpos[pos], posneg).filter(v => v < this.numVariables).length > 0
                    ) {
                        console.log(variable, pos, 'because neg', this.graph.negpos[pos].slice(), posneg.slice());
                        pospos.splice(i, 1);
                        sequenceDeleteDefaultCompare(this.graph.negneg[pos], variable);
                        i--;
                        this.counter++;
                        continue;
                    }
                }
            }
            if (posneg !== undefined) {
                for (let i = 0; i < posneg.length; i++) {
                    if (this.counter > maxCounter) debugger;
                    const neg = posneg[i];
                    if (neg >= this.numVariables) break;
                    // if they're in the same SCC, we can't remove it
                    if (this.graph.negpos[neg]?.includes(variable)) continue;
                    // variable -> x -> neg
                    // if ~neg -> ~x and variable -> x
                    if (
                        this.graph.posneg[neg] !== undefined &&
                        pospos !== undefined &&
                        sequenceIntersectionDefaultCompare(this.graph.posneg[neg], pospos).filter(v => v < this.numVariables).length > 0
                    ) {
                        console.log(variable, ~neg, 'because pos', this.graph.posneg[neg].slice(), pospos.slice());
                        posneg.splice(i, 1);
                        sequenceDeleteDefaultCompare(this.graph.posneg[neg], variable);
                        i--;
                        this.counter++;
                        continue;
                    }
                    // variable -> ~x -> neg
                    // if ~neg -> x and variable -> ~x
                    if (
                        this.graph.pospos[neg] !== undefined &&
                        sequenceIntersectionDefaultCompare(this.graph.pospos[neg], posneg).filter(v => v < this.numVariables).length > 0
                    ) {
                        console.log(variable, ~neg, 'because neg', this.graph.pospos[neg].slice(), posneg.slice());
                        posneg.splice(i, 1);
                        sequenceDeleteDefaultCompare(this.graph.posneg[neg], variable);
                        i--;
                        this.counter++;
                        continue;
                    }
                }
            }
        }
    }

    private incrementalComputeScc() {
        // TODO
        this.initialComputeScc();
    }

    private recomputeClauseForcingLUTs() {
        const latestUpdate = this.nextUpdateTimestamp[0] - 1;
        if (this.lastUpdateTimestampForClauseForcing === latestUpdate) return;

        if (this.parentLayer !== undefined) {
            this.parentLayer.recomputeClauseForcingLUTs();
        }

        this.lastUpdateTimestampForClauseForcing = latestUpdate;

        for (let clauseId = 0; clauseId < this.forcingLutExactlyOneClauses.length; clauseId++) {
            const startingVariable = this.forcingLutExactlyOneClauseIdToStartingPseudovariable[clauseId];
            const clause = this.forcingLutExactlyOneClauses[clauseId];

            const numMasks = 1 << clause.length;

            // Only recompute clauses which have some implications at our layer
            // If at top layer, we skip this check because we basically always have implications
            if (this.parentLayer !== undefined) {
                let haveImplications = false;
                for (const lit of clause) {
                    if (this.getTopLayerPosConsequences(lit).length > 0) {
                        haveImplications = true;
                        break;
                    }
                    if (this.getTopLayerNegConsequences(lit).length > 0) {
                        haveImplications = true;
                        break;
                    }
                }
                if (!haveImplications) continue;
            }

            // Only recompute clauses that include a changed literal
            const lastClauseUpdateTimestamp = this.graph.posposTimestamp[startingVariable + numMasks - 1] ?? 0;

            let posposUpdatedMask = 0;
            let posnegUpdatedMask = 0;
            let prunedMask = 0;
            for (let i = 0; i < clause.length; i++) {
                if (lastClauseUpdateTimestamp < this.getPosLastUpdateTimestamp(clause[i])) {
                    posposUpdatedMask |= 1 << i;
                }
                if (lastClauseUpdateTimestamp < this.getNegLastUpdateTimestamp(clause[i])) {
                    posnegUpdatedMask |= 1 << i;
                }
                if (this.prunedLiterals.has(clause[i])) {
                    prunedMask |= 1 << i;
                }
            }
            const unprunedMask = (numMasks - 1) ^ prunedMask;

            if (posposUpdatedMask === 0 && posnegUpdatedMask === 0) {
                continue;
            }

            this.graph.posposTimestamp[startingVariable + numMasks - 1] = latestUpdate;

            const posposMasksByPopcount = Array.from({ length: clause.length + 1 }, () => []);
            const posnegMasksByPopcount = Array.from({ length: clause.length + 1 }, () => []);
            for (let mask = 1; mask < numMasks; mask++) {
                if ((mask & prunedMask) !== 0) continue;
                if ((mask & posposUpdatedMask) !== 0) {
                    posposMasksByPopcount[popcount(mask)].push(mask);
                }
                if ((mask & posnegUpdatedMask) !== 0) {
                    posnegMasksByPopcount[popcount(mask)].push(mask);
                }
            }

            // Initialize 1-hot masks
            for (let i = 0; i < clause.length; i++) {
                const mask = 1 << i;
                const lit = clause[i];
                const posImplicants = this.getTopLayerPosConsequences(lit).slice();
                const negImplicants = this.getTopLayerNegConsequences(lit).slice();
                if (posImplicants.length > 0) {
                    this.graph.pospos[startingVariable + mask] = posImplicants;
                }
                if (negImplicants.length > 0) {
                    this.graph.posneg[startingVariable + mask] = negImplicants;
                }
            }

            // Clause subsets of size 2 and above
            // Use simpler algorithm when at root layer
            if (this.parentLayer === undefined) {
                for (const masks of posposMasksByPopcount.slice(2)) {
                    let hadNonzeroIntersection = false;
                    for (const mask of masks) {
                        const firstMask = mask & -mask;
                        const restMask = mask & (mask - 1);
                        // Set type to readonly since we don't want to accidentally mutate this
                        const firstPos: readonly number[] =
                            this.closureGraph.pospos[startingVariable + firstMask] ?? this.graph.pospos[startingVariable + firstMask];
                        const restPos: readonly number[] =
                            this.closureGraph.pospos[startingVariable + restMask] ?? this.graph.pospos[startingVariable + restMask];
                        if (firstPos !== undefined && restPos !== undefined) {
                            const intersection = sequenceIntersectionDefaultCompare(firstPos, restPos);
                            if (intersection.length > 0) {
                                this.graph.pospos[startingVariable + mask] = intersection;
                                hadNonzeroIntersection = true;
                            }
                        }
                    }

                    if (!hadNonzeroIntersection) break;
                }
                for (const masks of posnegMasksByPopcount.slice(2)) {
                    let hadNonzeroIntersection = false;
                    for (const mask of masks) {
                        const firstMask = mask & -mask;
                        const restMask = mask & (mask - 1);
                        // Set type to readonly since we don't want to accidentally mutate this
                        const firstNeg: readonly number[] =
                            this.closureGraph.posneg[startingVariable + firstMask] ?? this.graph.posneg[startingVariable + firstMask];
                        const restNeg: readonly number[] =
                            this.closureGraph.posneg[startingVariable + restMask] ?? this.graph.posneg[startingVariable + restMask];
                        if (firstNeg !== undefined && restNeg !== undefined) {
                            const intersection = sequenceIntersectionDefaultCompare(firstNeg, restNeg);
                            if (intersection.length > 0) {
                                this.graph.posneg[startingVariable + mask] = intersection;
                                hadNonzeroIntersection = true;
                            }
                        }
                    }

                    if (!hadNonzeroIntersection) break;
                }
                for (let mask = 1; mask < numMasks; mask++) {
                    if ((mask & prunedMask) !== 0) continue;
                    let negatedMask = unprunedMask ^ mask;
                    if (
                        (this.graph.pospos[startingVariable + mask]?.length > 0 || this.graph.posneg[startingVariable + mask]?.length > 0) &&
                        (this.graph.pospos[startingVariable + negatedMask]?.length > 0 ||
                            this.graph.posneg[startingVariable + negatedMask]?.length > 0)
                    ) {
                        if (this.graph.posneg[startingVariable + mask] === undefined) {
                            this.graph.posneg[startingVariable + mask] = [startingVariable + negatedMask];
                        } else {
                            sequenceInsertDefaultCompare(this.graph.posneg[startingVariable + mask], startingVariable + negatedMask);
                        }
                    }
                }
            } else {
                // We have a parent layer, make sure we handle edges in parent layers as well
                for (const masks of posposMasksByPopcount.slice(2)) {
                    let hadNonzeroIntersection = false;
                    for (const mask of masks) {
                        const firstMask = mask & -mask;
                        const restMask = mask & (mask - 1);
                        // Set type to readonly since we don't want to accidentally mutate this
                        const firstPos: readonly number[] = this.graph.pospos[startingVariable + firstMask];
                        const restPos: readonly number[] = this.graph.pospos[startingVariable + restMask];
                        const parentFirstPos: readonly number[] = this.parentLayer.getPosConsequences(startingVariable + firstMask);
                        const parentRestPos: readonly number[] = this.parentLayer.getPosConsequences(startingVariable + restMask);
                        if (
                            (firstPos !== undefined && restPos !== undefined) ||
                            (firstPos !== undefined && parentRestPos !== undefined) ||
                            (restPos !== undefined && parentFirstPos !== undefined)
                        ) {
                            // We'll denote | as union, & as intersection, and - as subtraction.
                            // We need to compute:
                            //
                            // ((firstPos | parentFirstPos) & (restPos | parentRestPos)) - parentPos
                            const parentPos: readonly number[] = this.parentLayer.getPosConsequences(startingVariable + mask);
                            const combinedFirstPos =
                                firstPos !== undefined && parentFirstPos !== undefined
                                    ? sequenceUnionDefaultCompare(firstPos, parentFirstPos)
                                    : firstPos !== undefined
                                      ? firstPos
                                      : parentFirstPos !== undefined
                                        ? parentFirstPos
                                        : undefined;
                            const combinedRestPos =
                                restPos !== undefined && parentRestPos !== undefined
                                    ? sequenceUnionDefaultCompare(restPos, parentRestPos)
                                    : restPos !== undefined
                                      ? restPos
                                      : parentRestPos !== undefined
                                        ? parentRestPos
                                        : undefined;
                            const intersection = sequenceIntersectionDefaultCompare(combinedFirstPos, combinedRestPos);
                            parentPos === undefined || sequenceRemoveUpdateDefaultCompare(intersection, parentPos);
                            if (intersection.length > 0) {
                                this.graph.pospos[startingVariable + mask] = intersection;
                                hadNonzeroIntersection = true;
                            }
                        }
                    }

                    if (!hadNonzeroIntersection) break;
                }
                for (const masks of posnegMasksByPopcount.slice(2)) {
                    let hadNonzeroIntersection = false;
                    for (const mask of masks) {
                        const firstMask = mask & -mask;
                        const restMask = mask & (mask - 1);
                        // Set type to readonly since we don't want to accidentally mutate this
                        const firstNeg: readonly number[] = this.graph.posneg[startingVariable + firstMask];
                        const restNeg: readonly number[] = this.graph.posneg[startingVariable + restMask];
                        const parentFirstNeg: readonly number[] = this.parentLayer.getNegConsequences(startingVariable + firstMask);
                        const parentRestNeg: readonly number[] = this.parentLayer.getNegConsequences(startingVariable + restMask);

                        if (
                            (firstNeg !== undefined && restNeg !== undefined) ||
                            (firstNeg !== undefined && parentRestNeg !== undefined) ||
                            (restNeg !== undefined && parentFirstNeg !== undefined)
                        ) {
                            // We'll denote | as union, & as intersection, and - as subtraction.
                            // We need to compute:
                            //
                            // ((firstNeg | parentFirstNeg) & (restNeg | parentRestNeg)) - parentNeg
                            const parentNeg: readonly number[] = this.parentLayer.getNegConsequences(startingVariable + mask);
                            const combinedFirstNeg =
                                firstNeg !== undefined && parentFirstNeg !== undefined
                                    ? sequenceUnionDefaultCompare(firstNeg, parentFirstNeg)
                                    : firstNeg !== undefined
                                      ? firstNeg
                                      : parentFirstNeg !== undefined
                                        ? parentFirstNeg
                                        : undefined;
                            const combinedRestNeg =
                                firstNeg !== undefined && parentRestNeg !== undefined
                                    ? sequenceUnionDefaultCompare(firstNeg, parentRestNeg)
                                    : firstNeg !== undefined
                                      ? firstNeg
                                      : parentRestNeg !== undefined
                                        ? parentRestNeg
                                        : undefined;
                            const intersection = sequenceIntersectionDefaultCompare(combinedFirstNeg, combinedRestNeg);
                            parentNeg === undefined || sequenceRemoveUpdateDefaultCompare(intersection, parentNeg);
                            if (intersection.length > 0) {
                                this.graph.posneg[startingVariable + mask] = intersection;
                                hadNonzeroIntersection = true;
                            }
                        }
                    }

                    if (!hadNonzeroIntersection) break;
                }
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
        if (this.hasParentImplication(lit1, lit2)) {
            return false;
        }
        return this.graph.addImplication(lit1, lit2);
    }

    // Undefined behaviour if implications already exist.
    addPosImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1: Literal, vars2: readonly Variable[]) {
        return this.graph.addPosImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1, vars2);
    }
    // Undefined behaviour if implications already exist.
    addNegImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1: Literal, vars2: readonly Variable[]) {
        return this.graph.addNegImplicationsBatchedGuaranteeUniquenessPreserveSortedness(lit1, vars2);
    }

    transferImplicationToParent(lit1: Literal, lit2: Literal): boolean {
        this.sortGraph();
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
        return this.closureGraph.hasImplication(lit1, lit2) || this.graph.hasImplication(lit1, lit2);
    }

    getPosConsequencesFull(lit: Literal): Variable[] {
        this.sortGraph();
        const posConsequents = this.graph.getPosConsequences(lit).slice();
        for (const big of this.parentGraphs) {
            sequenceExtend(posConsequents, big.getPosConsequences(lit));
        }
        return posConsequents;
    }

    getNegConsequencesFull(lit: Literal): Variable[] {
        this.sortGraph();
        const negConsequents = this.graph.getNegConsequences(lit).slice();
        for (const big of this.parentGraphs) {
            sequenceExtend(negConsequents, big.getNegConsequences(lit));
        }
        return negConsequents;
    }

    getPosConsequencesFullSorted(lit: Literal): Variable[] {
        this.sortGraph();
        const posConsequents = this.graph.getPosConsequences(lit).slice();
        const oldLength = posConsequents.length;
        for (const big of this.parentGraphs) {
            sequenceExtend(posConsequents, big.getPosConsequences(lit));
        }
        if (oldLength !== posConsequents.length) removeDuplicates(posConsequents.sort((a, b) => a - b));
        return posConsequents;
    }

    getNegConsequencesFullSorted(lit: Literal): Variable[] {
        this.sortGraph();
        const negConsequents = this.graph.getNegConsequences(lit).slice();
        const oldLength = negConsequents.length;
        for (const big of this.parentGraphs) {
            sequenceExtend(negConsequents, big.getNegConsequences(lit));
        }
        if (oldLength !== negConsequents.length) removeDuplicates(negConsequents.sort((a, b) => a - b));
        return negConsequents;
    }

    getPosConsequences(lit: Literal): Variable[] {
        return this.getPosConsequencesFull(lit).filter(variable => variable < this.numVariables);
    }

    getNegConsequences(lit: Literal): Variable[] {
        return this.getNegConsequencesFull(lit).filter(variable => variable < this.numVariables);
    }

    getPosConsequencesSorted(lit: Literal): Variable[] {
        return this.getPosConsequencesFullSorted(lit).filter(variable => variable < this.numVariables);
    }

    getNegConsequencesSorted(lit: Literal): Variable[] {
        return this.getNegConsequencesFullSorted(lit).filter(variable => variable < this.numVariables);
    }

    getTopLayerPosConsequences(lit: Literal): readonly Variable[] {
        return this.graph.getPosConsequences(lit).filter(variable => variable < this.numVariables);
    }

    getTopLayerNegConsequences(lit: Literal): readonly Variable[] {
        return this.graph.getNegConsequences(lit).filter(variable => variable < this.numVariables);
    }

    getPosLastUpdateTimestamp(lit: Literal): Timestamp {
        let timestamp = this.graph.getPosLastUpdateTimestamp(lit);
        for (const big of this.parentGraphs) {
            const otherTimestamp = big.getPosLastUpdateTimestamp(lit);
            timestamp = timestamp < otherTimestamp ? otherTimestamp : timestamp;
        }
        return timestamp;
    }

    getNegLastUpdateTimestamp(lit: Literal): Timestamp {
        let timestamp = this.graph.getNegLastUpdateTimestamp(lit);
        for (const big of this.parentGraphs) {
            const otherTimestamp = big.getNegLastUpdateTimestamp(lit);
            timestamp = timestamp < otherTimestamp ? otherTimestamp : timestamp;
        }
        return timestamp;
    }

    getCommonPosConsequences(lits: Literal[]): readonly Variable[] {
        this.sortGraph();
        lits.sort((a, b) => a - b);
        return this.getCommonPosConsequencesHelper(lits);
    }

    private getCommonPosConsequencesHelper(lits: Literal[]): readonly Variable[] {
        // Base case
        if (lits.length === 1) {
            return this.getPosConsequencesSorted(lits[0]);
        }
        lits.push(1); // key for "pos consequences"
        const memoKey = appendInts(lits);
        lits.pop();
        let lastUpdateTimestamp = 0;
        for (const lit of lits) {
            const litTimestamp = this.getPosLastUpdateTimestamp(lit);
            lastUpdateTimestamp = lastUpdateTimestamp < litTimestamp ? litTimestamp : lastUpdateTimestamp;
        }
        const memoResult = this.newMemo.get(memoKey);
        if (memoResult !== undefined && memoResult.lastUpdateTimestamp === lastUpdateTimestamp) {
            return memoResult.variables;
        }
        // Inductive case
        const [firstLit, ...restLits] = lits;
        const restConsequents = this.getCommonPosConsequencesHelper(restLits);
        if (restConsequents.length === 0) {
            this.newMemo.set(memoKey, { lastUpdateTimestamp: lastUpdateTimestamp, variables: restConsequents });
            return restConsequents;
        }
        const firstConsequents = this.getPosConsequencesSorted(firstLit);
        sequenceIntersectionUpdateDefaultCompare(firstConsequents, restConsequents);
        this.newMemo.set(memoKey, { lastUpdateTimestamp: lastUpdateTimestamp, variables: firstConsequents });
        return firstConsequents;
    }

    getCommonNegConsequences(lits: Literal[]): readonly Variable[] {
        this.sortGraph();
        lits.sort((a, b) => a - b);
        return this.getCommonNegConsequencesHelper(lits);
    }

    private getCommonNegConsequencesHelper(lits: Literal[]): readonly Variable[] {
        // Base case
        if (lits.length === 1) {
            return this.getNegConsequencesSorted(lits[0]);
        }
        lits.push(0); // key for "neg consequences"
        const memoKey = appendInts(lits);
        lits.pop();
        let lastUpdateTimestamp = 0;
        for (const lit of lits) {
            const litTimestamp = this.getPosLastUpdateTimestamp(lit);
            lastUpdateTimestamp = lastUpdateTimestamp < litTimestamp ? litTimestamp : lastUpdateTimestamp;
        }
        const memoResult = this.newMemo.get(memoKey);
        if (memoResult !== undefined && memoResult.lastUpdateTimestamp === lastUpdateTimestamp) {
            return memoResult.variables;
        }
        // Inductive case
        const [firstLit, ...restLits] = lits;
        const restConsequents = this.getCommonNegConsequencesHelper(restLits);
        if (restConsequents.length === 0) {
            this.newMemo.set(memoKey, { lastUpdateTimestamp: lastUpdateTimestamp, variables: restConsequents });
            return restConsequents;
        }
        const firstConsequents = this.getNegConsequencesSorted(firstLit);
        sequenceIntersectionUpdateDefaultCompare(firstConsequents, restConsequents);
        this.newMemo.set(memoKey, { lastUpdateTimestamp: lastUpdateTimestamp, variables: firstConsequents });
        return firstConsequents;
    }

    filterOutPosConsequences(lit: Literal, posConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.sortGraph();
        for (const big of this.parentGraphs) {
            sequenceFilterOutUpdateDefaultCompare(posConsequentsInout, big.getPosConsequences(lit), filteredOut);
        }
        sequenceFilterOutUpdateDefaultCompare(posConsequentsInout, this.graph.getPosConsequences(lit), filteredOut);
    }

    filterOutNegConsequences(lit: Literal, negConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.sortGraph();
        for (const big of this.parentGraphs) {
            sequenceFilterOutUpdateDefaultCompare(negConsequentsInout, big.getNegConsequences(lit), filteredOut);
        }
        sequenceFilterOutUpdateDefaultCompare(negConsequentsInout, this.graph.getNegConsequences(lit), filteredOut);
    }

    filterOutTopLayerPosConsequences(lit: Literal, posConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.sortGraph();
        sequenceFilterOutUpdateDefaultCompare(posConsequentsInout, this.graph.getPosConsequences(lit), filteredOut);
    }

    filterOutTopLayerNegConsequences(lit: Literal, negConsequentsInout: Variable[], filteredOut: Variable[]) {
        this.sortGraph();
        sequenceFilterOutUpdateDefaultCompare(negConsequentsInout, this.graph.getNegConsequences(lit), filteredOut);
    }

    hasAnyCommonPosConsequences(lit: Literal, posConsequents: readonly Variable[]): boolean {
        this.sortGraph();
        for (const big of this.parentGraphs) {
            if (sequenceHasNonemptyIntersectionDefaultCompare(big.getPosConsequences(lit), posConsequents)) {
                return true;
            }
        }
        return sequenceHasNonemptyIntersectionDefaultCompare(this.graph.getPosConsequences(lit), posConsequents);
    }

    hasAnyCommonNegConsequences(lit: Literal, negConsequents: readonly Variable[]): boolean {
        this.sortGraph();
        for (const big of this.parentGraphs) {
            if (sequenceHasNonemptyIntersectionDefaultCompare(big.getNegConsequences(lit), negConsequents)) {
                return true;
            }
        }
        return sequenceHasNonemptyIntersectionDefaultCompare(this.graph.getNegConsequences(lit), negConsequents);
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
            big.sortGraph();
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
