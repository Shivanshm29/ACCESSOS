/**
 * ACCESSOS Deterministic Rule Catalog Registry
 * Exports the complete suite of deterministic accessibility rules.
 */
import type { AccessibilityRule } from '../types';
import { FormMissingLabelRule } from './missing-label';
import { ImageMissingAltRule } from './missing-alt';
import { ButtonMissingNameRule, LinkMissingNameRule } from './accessible-name';
import { HeadingHierarchyRule } from './heading-hierarchy';
import { MainLandmarkRule } from './landmark';
import { InvalidFormControlRule } from './form-validation';
import { ErrorAssociationRule } from './error-association';
import { DuplicateIdRule } from './duplicate-id';
import { EmptyInteractiveRule } from './empty-interactive';
import { FileInstructionAssociationRule } from './file-instructions';
import { RequiredFieldIndicationRule } from './required-indicator';

export const RULE_CATALOG: ReadonlyArray<AccessibilityRule> = [
  FormMissingLabelRule,
  ImageMissingAltRule,
  ButtonMissingNameRule,
  LinkMissingNameRule,
  HeadingHierarchyRule,
  MainLandmarkRule,
  InvalidFormControlRule,
  ErrorAssociationRule,
  DuplicateIdRule,
  EmptyInteractiveRule,
  FileInstructionAssociationRule,
  RequiredFieldIndicationRule,
];

export {
  FormMissingLabelRule,
  ImageMissingAltRule,
  ButtonMissingNameRule,
  LinkMissingNameRule,
  HeadingHierarchyRule,
  MainLandmarkRule,
  InvalidFormControlRule,
  ErrorAssociationRule,
  DuplicateIdRule,
  EmptyInteractiveRule,
  FileInstructionAssociationRule,
  RequiredFieldIndicationRule,
};
