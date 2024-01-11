import { FPuzzlesBoard } from '../src/solver/Constraint/FPuzzlesInterfaces';
import * as lz from 'lz-string';

export class Puzzle {
    title: string;
    author: string;
    puzzleEncoded: string;
    puzzle: FPuzzlesBoard;
    solution: string;
    comments: string;
    constructor(title: string, author: string, puzzleEncoded: string, puzzle: FPuzzlesBoard, solution: string, comments: string) {
        this.title = title;
        this.author = author;
        this.puzzleEncoded = puzzleEncoded;
        this.puzzle = puzzle;
        this.solution = solution;
        this.comments = comments;
    }

    serialize(): object {
        return {
            title: this.title,
            author: this.author,
            puzzleEncoded: this.puzzleEncoded,
            solution: this.solution,
            comments: this.comments,
        };
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
            title: string | undefined;
            author: string | undefined;
            puzzle: string | undefined;
            solution: string | undefined;
            comments: string | undefined;
        };
        if (typeof puzzleObj.title !== 'string') {
            throw new Error(`puzzle.title is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
        }
        if (typeof puzzleObj.author !== 'string') {
            throw new Error(`puzzle.author is missing or is not a string: ${JSON.stringify(puzzleObj)}`);
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
        const { title, author, puzzle: puzzleEncoded, solution, comments } = puzzleObj;
        const puzzle = JSON.parse(lz.decompressFromBase64(puzzleEncoded)) as FPuzzlesBoard;
        out.push(new Puzzle(title, author, puzzleEncoded, puzzle, solution, comments));
    }
    return out;
}
