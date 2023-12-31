import { Board } from '../Board';
import ConstraintBuilder from '../ConstraintBuilder';
import { cellIndexFromName } from '../SolveUtility';
import { CardinalityConstraint } from './CardinalityConstraint';
import { FPuzzlesQuadruple } from './FPuzzlesInterfaces';

export function register(constraintBuilder: ConstraintBuilder) {
    constraintBuilder.registerConstraint('quadruple', (board: Board, params: FPuzzlesQuadruple) => {
        const constraints = [];
        const explicitDigitsOccurrences = new Map(params.values.map(x => [x, params.values.filter(y => x == y).length]));
        const constraintName = `Quadruple ${params.values.toSorted().join('')} at ${params.cells[0]}`;
        const specificName = `Quadruple ${params.values.toSorted().join('')} at ${params.cells[0]}`;
        const implicitDigits = Array.from({ length: board.size }, (_, i) => i + 1).filter(digit => !explicitDigitsOccurrences.has(digit));
        const implicitCount = 4 - params.values.length;

        // Handle explicit digits
        // Each explicit digit must occur between [count, count + implicitCount] times
        for (const [explicitDigit, numOccurrences] of explicitDigitsOccurrences.entries()) {
            constraints.push(
                new CardinalityConstraint(constraintName, specificName + ` ${explicitDigit} x ${numOccurrences}`, board, {
                    candidates: params.cells.map(cellName => board.candidateIndex(cellIndexFromName(cellName, board.size), explicitDigit)),
                    allowedCounts: Array.from({ length: 1 + implicitCount }, (_, i) => i + numOccurrences),
                })
            );
        }

        // Handle implicit digits
        // Each implicit digit must occur between [0, implicitCount] times
        constraints.push(
            new CardinalityConstraint(constraintName, specificName + ` rest x ${implicitCount}`, board, {
                candidates: params.cells.flatMap(cellName =>
                    implicitDigits.map(digit => board.candidateIndex(cellIndexFromName(cellName, board.size), digit))
                ),
                allowedCounts: Array.from({ length: 1 + implicitCount }, (_, i) => i),
            })
        );

        return constraints;
    });
}
