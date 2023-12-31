export interface FPuzzlesArrowEntry {
    lines: string[][];
    cells: string[];
}

export interface FPuzzlesKillerCageEntry {
    cells: string[];
    value: string;
}

export interface FPuzzlesLittleKillerSumEntry {
    cell: string;
    direction: string;
    value: string;
}

export interface FPuzzlesCell {
    cell: string;
    value: string;
}

export interface FPuzzlesCells {
    cells: string[];
    value: string;
}

export interface FPuzzlesLines {
    lines: string[][];
    value: string;
}

export interface FPuzzlesClone {
    cells: string[];
    cloneCells: string[];
}

export interface FPuzzlesQuadruple {
    cells: string[];
    values: number[];
}
