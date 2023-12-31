import ConstraintBuilder from '../ConstraintBuilder';
import * as ArrowSumConstraint from './ArrowSumConstraint';
import * as ChessConstraint from './ChessConstraint';
import * as DiagonalConstraint from './DiagonalConstraint';
import * as DisjointGroupsConstraint from './DisjointGroupsConstraint';
import * as GeneralCellPairConstraint from './GeneralCellPairConstraint';
import * as KillerCageConstraint from './KillerCageConstraint';
import * as LittleKillerConstraint from './LittleKillerConstraint';
import * as QuadrupleConstraint from './QuadrupleConstraint';
import * as RegionConstraint from './RegionConstraint';
import * as RegionSumLinesConstraint from './RegionSumLinesConstraint';
import * as SandwichSumConstraint from './SandwichSumConstraint';
import * as SingleCellConstraints from './SingleCellConstraints';
import * as XSumConstraint from './XSumConstraint';

let isRegistered = false;

export function registerAllConstraints(constraintBuilder: ConstraintBuilder) {
    if (isRegistered) {
        return;
    }

    // Keep these (and the import) alphabetical for easier comparison to files
    ArrowSumConstraint.register(constraintBuilder);
    ChessConstraint.register(constraintBuilder);
    DiagonalConstraint.register(constraintBuilder);
    DisjointGroupsConstraint.register(constraintBuilder);
    GeneralCellPairConstraint.register(constraintBuilder);
    KillerCageConstraint.register(constraintBuilder);
    LittleKillerConstraint.register(constraintBuilder);
    QuadrupleConstraint.register(constraintBuilder);
    RegionConstraint.register(constraintBuilder);
    RegionSumLinesConstraint.register(constraintBuilder);
    SandwichSumConstraint.register(constraintBuilder);
    SingleCellConstraints.register(constraintBuilder);
    XSumConstraint.register(constraintBuilder);

    isRegistered = true;
}
