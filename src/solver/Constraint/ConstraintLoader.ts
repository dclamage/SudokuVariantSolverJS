import ConstraintBuilder from '../ConstraintBuilder';
import * as ArrowSumConstraint from './ArrowSumConstraint';
import * as BetweenLineConstraint from './BetweenLineConstraint';
import * as ChessConstraint from './ChessConstraint';
import * as CloneConstraint from './CloneConstraint';
import * as DiagonalConstraint from './DiagonalConstraint';
import * as DisjointGroupsConstraint from './DisjointGroupsConstraint';
import * as DoubleArrowConstraint from './DoubleArrowConstraint';
import * as EntropicLineConstraint from './EntropicLineConstraint';
import * as GeneralCellPairConstraint from './GeneralCellPairConstraint';
import * as IndexerConstraint from './IndexerConstraint';
import * as KillerCageConstraint from './KillerCageConstraint';
import * as LittleKillerConstraint from './LittleKillerConstraint';
import * as LockoutConstraint from './LockoutConstraint';
import * as ModularLineConstraint from './ModularLineConstraint';
import * as NabnerConstraint from './NabnerConstraint';
import * as QuadrupleConstraint from './QuadrupleConstraint';
import * as RegionConstraint from './RegionConstraint';
import * as RegionSumLinesConstraint from './RegionSumLinesConstraint';
import * as RenbanConstraint from './RenbanConstraint';
import * as SandwichSumConstraint from './SandwichSumConstraint';
import * as SingleCellConstraints from './SingleCellConstraints';
import * as SkyscraperConstraint from './SkyscraperConstraint';
import * as ThermometerConstraint from './ThermometerConstraint';
import * as WhispersConstraint from './WhispersConstraint';
import * as XSumConstraint from './XSumConstraint';
import * as ZipperLineConstraint from './ZipperLineConstraint';

let isRegistered = false;

export function registerAllConstraints(constraintBuilder: ConstraintBuilder) {
    if (isRegistered) {
        return;
    }

    // Keep these (and the import) alphabetical for easier comparison to files
    ArrowSumConstraint.register(constraintBuilder);
    BetweenLineConstraint.register(constraintBuilder);
    ChessConstraint.register(constraintBuilder);
    CloneConstraint.register(constraintBuilder);
    DiagonalConstraint.register(constraintBuilder);
    DisjointGroupsConstraint.register(constraintBuilder);
    DoubleArrowConstraint.register(constraintBuilder);
    EntropicLineConstraint.register(constraintBuilder);
    GeneralCellPairConstraint.register(constraintBuilder);
    IndexerConstraint.register(constraintBuilder);
    KillerCageConstraint.register(constraintBuilder);
    LittleKillerConstraint.register(constraintBuilder);
    LockoutConstraint.register(constraintBuilder);
    ModularLineConstraint.register(constraintBuilder);
    NabnerConstraint.register(constraintBuilder);
    QuadrupleConstraint.register(constraintBuilder);
    RegionConstraint.register(constraintBuilder);
    RegionSumLinesConstraint.register(constraintBuilder);
    RenbanConstraint.register(constraintBuilder);
    SandwichSumConstraint.register(constraintBuilder);
    SingleCellConstraints.register(constraintBuilder);
    SkyscraperConstraint.register(constraintBuilder);
    ThermometerConstraint.register(constraintBuilder);
    WhispersConstraint.register(constraintBuilder);
    XSumConstraint.register(constraintBuilder);
    ZipperLineConstraint.register(constraintBuilder);

    isRegistered = true;
}
