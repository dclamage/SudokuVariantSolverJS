import * as ArrowSumConstraint from './ArrowSumConstraint';
import * as FixedSumConstraint from './FixedSumConstraint';
import * as GeneralCellPairConstraint from './GeneralCellPairConstraint';
import * as KillerCageConstraint from './KillerCageConstraint';
import * as RegionSumLinesConstraint from './RegionSumLinesConstraint';
import * as OrConstraint from './OrConstraint';
import * as XSumConstraint from './XSumConstraint';

let isRegistered = false;

export function registerAllConstraints(constraintBuilder) {
    if (isRegistered) {
        return;
    }

    ArrowSumConstraint.register(constraintBuilder);
    FixedSumConstraint.register(constraintBuilder);
    GeneralCellPairConstraint.register(constraintBuilder);
    KillerCageConstraint.register(constraintBuilder);
    RegionSumLinesConstraint.register(constraintBuilder);
    OrConstraint.register(constraintBuilder);
    XSumConstraint.register(constraintBuilder);

    isRegistered = true;
}
