import * as lz from 'lz-string';
import { FPuzzlesBoard } from '../src/solver/Constraint/FPuzzlesInterfaces';

export class Puzzle {
    title: string;
    author: string;
    license: string;
    puzzleEncoded: string;
    puzzle: FPuzzlesBoard;
    solution: string;
    categories: string[];
    comments: string;
    constructor(
        title: string,
        author: string,
        license: string,
        puzzleEncoded: string,
        puzzle: FPuzzlesBoard,
        solution: string,
        categories: string[],
        comments: string
    ) {
        this.title = title;
        this.author = author;
        this.license = license;
        this.puzzleEncoded = puzzleEncoded;
        this.puzzle = puzzle;
        this.solution = solution;
        this.categories = categories;
        this.comments = comments;
    }

    serialize(): object {
        return {
            // Necessary fields for re-parsing serialized puzzles
            title: this.title,
            author: this.author,
            license: this.license,
            puzzle: this.puzzleEncoded,
            solution: this.solution,
            ...(this.categories.length > 0 ? { categories: this.categories } : {}),
            comments: this.comments,
            // Generated from puzzle data
            ...(this.puzzle.solution ? { puzzleSolution: this.puzzle.solution.join('') } : {}),
            generatedCategories: this.generateCategories(),
        };
    }

    static nonCategoryKeys: string[] = [
        'size',
        'grid',
        'title',
        'author',
        'ruleset',
        'solution',
        'successMessage',
        'truecandidatesoptions',
        'disabledlogic',
        'line',
        'text',
    ];
    generateCategories(): object {
        const categories = Object.keys(this.puzzle).filter(key => !Puzzle.nonCategoryKeys.includes(key));
        categories.push(`gridsize${this.puzzle.size}x${this.puzzle.size}`);
        categories.push(...this.categories);
        if (this.puzzle.size !== 9) {
            categories.push('non9x9');
        }
        categories.sort();
        return categories;
    }
}

export function parsePuzzlesJson(puzzlesJson: string): Puzzle[] {
    const out: Puzzle[] = [];
    const puzzles: unknown = JSON.parse(puzzlesJson);
    if (!Array.isArray(puzzles)) {
        throw new Error('puzzlesJson is not an array');
    }
    for (let i = 0; i < puzzles.length; ++i) {
        const puzzleElem: unknown = puzzles[i];
        if (typeof puzzleElem !== 'object') {
            throw new Error(`puzzle is not an object: ${JSON.stringify(puzzleElem)}`);
        }
        // Ignore any empty objects, those are just to add a ghetto trailing comma at the end of the file appear.
        if (Object.keys(puzzleElem).length === 0) {
            continue;
        }
        const puzzleObj = puzzleElem as {
            title?: string;
            author?: string;
            license?: string;
            puzzle?: string;
            solution?: string;
            categories?: string[];
            comments?: string;
        };
        if (typeof puzzleObj.title !== 'string') {
            throw new Error(`puzzle.title is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.author !== 'string') {
            throw new Error(`puzzle.author is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.license !== 'string') {
            throw new Error(`puzzle.license is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.puzzle !== 'string') {
            throw new Error(`puzzle.puzzle is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.solution !== 'string') {
            throw new Error(`puzzle.solution is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.comments !== 'string') {
            throw new Error(`puzzle.comments is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        // Ignore extra fields
        const { title, author, license, puzzle: puzzleEncoded, solution, categories = [], comments } = puzzleObj;
        const puzzle = JSON.parse(lz.decompressFromBase64(puzzleEncoded)) as FPuzzlesBoard;
        out.push(new Puzzle(title, author, license, puzzleEncoded, puzzle, solution, categories, comments));
    }
    return out;
}
