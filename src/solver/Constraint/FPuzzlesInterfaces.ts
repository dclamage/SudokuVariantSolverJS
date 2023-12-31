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
    cells: string[];
    direction: string;
    value: string;
}

export interface FPuzzlesCell {
    cell: string;
    value?: string;
}

export interface FPuzzlesCells {
    cells: string[];
    value?: string;
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

export interface FPuzzlesGridEntry {
    value?: number;
    given?: boolean;
    centerPencilMarks?: number[];
    givenPencilMarks?: number[];
    region?: number;
}

export interface FPuzzlesBoard {
    size: number;
    title?: string;
    author?: string;
    ruleset?: string;
    grid: FPuzzlesGridEntry[][];
    'diagonal+'?: boolean;
    'diagonal-'?: boolean;
    antiknight?: boolean;
    antiking?: boolean;
    disjointgroups?: boolean;
    nonconsecutive?: boolean;
    negative?: string[];
    arrow?: FPuzzlesArrowEntry[];
    killercage?: FPuzzlesKillerCageEntry[];
    cage?: FPuzzlesKillerCageEntry[];
    littlekillersum?: FPuzzlesLittleKillerSumEntry[];
    odd?: FPuzzlesCell[];
    even?: FPuzzlesCell[];
    minimum?: FPuzzlesCell[];
    maximum?: FPuzzlesCell[];
    rowindexer?: FPuzzlesCells[];
    columnindexer?: FPuzzlesCells[];
    boxindexer?: FPuzzlesCells[];
    extraregion?: FPuzzlesCells[];
    thermometer?: FPuzzlesLines[];
    palindrome?: FPuzzlesLines[];
    renban?: FPuzzlesLines[];
    whispers?: FPuzzlesLines[];
    regionsumline?: FPuzzlesLines[];
    difference?: FPuzzlesCells[];
    xv?: FPuzzlesCells[];
    sum?: FPuzzlesCells[];
    ratio?: FPuzzlesCells[];
    clone?: FPuzzlesClone[];
    quadruple?: FPuzzlesQuadruple[];
    betweenline?: FPuzzlesLines[];
    sandwichsum?: FPuzzlesCell[];
    xsum?: FPuzzlesCell[];
    skyscraper?: FPuzzlesCell[];
    entropicline?: FPuzzlesLines[];
    modularline?: FPuzzlesLines[];
    nabner?: FPuzzlesLines[];
    doublearrow?: FPuzzlesLines[];
    zipperline?: FPuzzlesLines[];
    disabledlogic?: string[];
    truecandidatesoptions?: string[];
}
