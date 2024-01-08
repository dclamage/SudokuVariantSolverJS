import { Board, LoopResult } from '../Board';
import { Constraint, ConstraintResult } from '../Constraint/Constraint';
import { ConstraintV2, InitResult, LogicalDeduction, isConstraintV2 } from '../Constraint/ConstraintV2';
import { LogicResult } from '../Enums/LogicResult';
import { LogicalStep } from './LogicalStep';

export class ConstraintLogic extends LogicalStep {
    constructor(board: Board) {
        super(board, 'Constraint Logic');
    }

    step(board: Board, desc: string[]): LogicResult {
        let invalid = false;
        const applyObvious = (constraint: Constraint): LoopResult => {
            if (!isConstraintV2(constraint)) {
                return LoopResult.UNCHANGED;
            }
            const deductions = ConstraintV2.flattenDeductions(constraint.obviousLogicalStep(board));
            const result = board.applyLogicalDeduction(deductions);
            if (result === ConstraintResult.INVALID) {
                invalid = true;
                return LoopResult.ABORT_LOOP;
            }
            return result === ConstraintResult.CHANGED ? LoopResult.SCHEDULE_LOOP : LoopResult.UNCHANGED;
        };

        // Apply all obvious steps first
        board.loopConstraints(applyObvious);
        if (invalid) {
            return LogicResult.INVALID;
        }
        let changed = false;
        // Now find one non-obvious deduction
        board.loopConstraints((constraint: Constraint): LoopResult => {
            if (isConstraintV2(constraint)) {
                const deductions = constraint.logicalStep(board);
                for (const deduction of deductions) {
                    const result = board.applyLogicalDeduction(deduction);

                    if (result === ConstraintResult.INVALID) {
                        invalid = true;
                        return LoopResult.ABORT_LOOP;
                    }

                    if (result === ConstraintResult.CHANGED) {
                        const explanationBase = deduction.explanation ? `[${constraint.toSpecificString()}]: ${deduction.explanation}` : '';
                        const singlesDescribed = deduction.singles && deduction.singles.length > 0 ? board.describeCandidates(deduction.singles) : '';
                        const elimsDescribed =
                            deduction.eliminations && deduction.eliminations.length > 0 ? board.describeElims(deduction.eliminations) : '';
                        const deductionsDescribed =
                            singlesDescribed.length > 0 && elimsDescribed.length > 0
                                ? `${explanationBase} => ${singlesDescribed};${elimsDescribed}`
                                : singlesDescribed.length > 0
                                  ? `${explanationBase} => ${singlesDescribed}`
                                  : elimsDescribed.length > 0
                                    ? `${explanationBase} => ${elimsDescribed}`
                                    : '';
                        if (deductionsDescribed.length > 0) {
                            desc.push(deductionsDescribed);
                            changed = true;
                            return LoopResult.ABORT_LOOP;
                        }
                        // There was a change but it wasn't visible on the board, look for another deduction
                        continue;
                    }
                }
                // None of the deductions in this constraints did anything visible, look for another constraint
                return LoopResult.UNCHANGED;
            } else {
                const proxyDesc: string[] = [];
                const result: ConstraintResult = constraint.logicStep(board, proxyDesc);
                desc.push(...proxyDesc.map(desc => `[${constraint.toSpecificString()}]: ${desc}`));
                if (result === ConstraintResult.INVALID) {
                    invalid = true;
                    return LoopResult.ABORT_LOOP;
                }
                if (result === ConstraintResult.CHANGED) {
                    changed = true;
                    return LoopResult.ABORT_LOOP;
                }
                return LoopResult.UNCHANGED;
            }
        });
        if (invalid) {
            return LogicResult.INVALID;
        }

        if (changed) {
            // Apply all obvious steps then exit
            board.loopConstraints(applyObvious);
            if (invalid) {
                return LogicResult.INVALID;
            }
            return LogicResult.CHANGED;
        }
        return LogicResult.UNCHANGED;
    }
}
