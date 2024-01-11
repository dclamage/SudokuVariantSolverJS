import { ExpandedCandidates } from '../src/index';

export function expandedCandidatesContainsMultipleSolutions(candidates: ExpandedCandidates): boolean {
    for (let i = 0; i < candidates.length; ++i) {
        const candidate = candidates[i];
        if (Array.isArray(candidate)) {
            if (new Set(candidate).size > 1) return true;
        }
    }
    return false;
}

export function solutionPartOfExpandedCandidates(solution: number[], candidates: ExpandedCandidates): boolean {
    if (solution.length !== candidates.length) {
        return false;
    }

    for (let i = 0; i < candidates.length; ++i) {
        const solutionValue = solution[i];
        const candidate = candidates[i];
        if (Array.isArray(candidate)) {
            if (!candidate.includes(solutionValue)) return false;
        } else {
            if (candidate.value !== solutionValue) return false;
        }
    }
    return true;
}

export function expandedCandidatesPartOfExpandedCandidates(candidates1: ExpandedCandidates, candidates2: ExpandedCandidates): boolean {
    if (candidates1.length !== candidates2.length) {
        return false;
    }

    for (let i = 0; i < candidates1.length; ++i) {
        const candidate1 = candidates1[i];
        const candidate2 = candidates2[i];
        const set1 = new Set(Array.isArray(candidate1) ? candidate1 : [candidate1.value]);
        const set2 = new Set(Array.isArray(candidate2) ? candidate2 : [candidate2.value]);
        for (const value1 of set1) {
            if (!set2.has(value1)) return false;
        }
    }
    return true;
}

export function expandedCandidatesEqual(candidates1: ExpandedCandidates, candidates2: ExpandedCandidates): boolean {
    if (candidates1.length !== candidates2.length) {
        return false;
    }

    for (let i = 0; i < candidates1.length; ++i) {
        const candidate1 = candidates1[i];
        const candidate2 = candidates2[i];
        const set1 = new Set(Array.isArray(candidate1) ? candidate1 : [candidate1.value]);
        const set2 = new Set(Array.isArray(candidate2) ? candidate2 : [candidate2.value]);
        if (set1.size !== set2.size) return false;
        for (const value1 of set1) {
            if (!set2.has(value1)) return false;
        }
    }
    return true;
}

export function expandedCandidatesToCandidateArray(candidates: ExpandedCandidates, size: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < candidates.length; ++i) {
        const candidate = candidates[i];
        if (Array.isArray(candidate)) {
            for (let digit = 1; digit <= size; ++digit) {
                out.push(candidate.includes(digit) ? digit : 0);
            }
        } else {
            for (let digit = 1; digit <= size; ++digit) {
                out.push(candidate.value === digit ? digit : 0);
            }
        }
    }
    return out;
}
