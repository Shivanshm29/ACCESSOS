/**
 * ACCESSOS Popup Controller
 * Manages active-tab discovery, content-script messaging, and Phase 4 accessibility baseline display.
 */
import type { PageMetadata, PageRepresentation, PopupState } from '../core/types/index';
import {
  MessageType,
  createMessage,
  isPageAnalysisResultMessage,
} from '../core/messaging/index';
import {
  evaluateCompletion,
  type CompletionResult,
  type CompletionRequirement,
} from '../completion/index';
import {
  analyzeAccessibility,
  type AccessibilityReport,
} from '../accessibility/index';
import {
  buildAIAnalysisRequest,
  requestAIPageAnalysis,
  type AIPageAnalysisResponse,
  type AIBarrierFinding,
} from '../ai/index';
import {
  buildGuidedModeRequest,
  requestGuidedModeStart,
  type GuidedModeResponse,
} from '../guided/index';
import {
  requestExplanation,
  type ExplanationMode,
  type ExplainAnythingResponse,
} from '../explain/index';
import { InteractionConfirmationDialog } from '../interaction/confirmation';
import type { InteractionIntent, InteractionResult } from '../interaction/types';
import type { GuidedStep } from '../guided/types';
import type { SelectionContextPayload } from '../core/messaging/index';
import {
  DocumentClient,
  extractPageRequirements,
  redactSensitiveValue,
  type DocumentAnalysisResponse,
} from '../document/index';
import {
  PreferencesStorage,
  DEFAULT_PREFERENCES,
  applyVisualPreferences,
  applyLocalization,
  type UserPreferences,
  type ExplanationComplexity,
} from '../preferences/index';
import {
  analyticsService,
  AnalyticsEventType,
  type AnalyticsAggregates,
} from '../analytics/index';
import { demoResetManager } from '../demo/reset';

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'chrome-untrusted://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
  ];
  return restrictedProtocols.some((protocol) => url.startsWith(protocol));
}

export function formatDisplayUrl(metadata: PageMetadata): string {
  if (metadata.hostname) {
    const path = metadata.pathname || '/';
    return `${metadata.hostname}${path}`;
  }
  return metadata.url || '-';
}

export class PopupController {
  private analyzeBtn: HTMLButtonElement | null = null;
  private statusMessage: HTMLElement | null = null;
  private resultCard: HTMLElement | null = null;
  private resultTitle: HTMLElement | null = null;
  private resultUrl: HTMLElement | null = null;
  private resultPageType: HTMLElement | null = null;
  private resultElements: HTMLElement | null = null;
  private unsupportedCard: HTMLElement | null = null;
  private errorCard: HTMLElement | null = null;
  private errorMessage: HTMLElement | null = null;
  private optionsBtn: HTMLButtonElement | null = null;
  private resetDemoBtn: HTMLButtonElement | null = null;

  // Semantic metrics elements
  private metricSections: HTMLElement | null = null;
  private metricFields: HTMLElement | null = null;
  private metricRequired: HTMLElement | null = null;
  private metricButtons: HTMLElement | null = null;
  private metricLinks: HTMLElement | null = null;
  private toggleDetailsBtn: HTMLButtonElement | null = null;
  private detailsPanel: HTMLElement | null = null;
  private detailFieldCount: HTMLElement | null = null;
  private detailReqCount: HTMLElement | null = null;
  private detailFileCount: HTMLElement | null = null;
  private detailSecCount: HTMLElement | null = null;
  private signalsList: HTMLElement | null = null;

  // Phase 4 Accessibility Engine elements
  private accessibilityScoreVal: HTMLElement | null = null;
  private scoreBandBadge: HTMLElement | null = null;
  private sevCritical: HTMLElement | null = null;
  private sevHigh: HTMLElement | null = null;
  private sevMedium: HTMLElement | null = null;
  private sevLow: HTMLElement | null = null;
  private toggleFindingsBtn: HTMLButtonElement | null = null;
  private findingsPanel: HTMLElement | null = null;
  private findingsCount: HTMLElement | null = null;
  private findingsList: HTMLElement | null = null;

  // Phase 5 AI Analysis elements
  private analyzeAiBtn: HTMLButtonElement | null = null;
  private aiStatusIndicator: HTMLElement | null = null;
  private aiAnalysisCard: HTMLElement | null = null;
  private aiModelTag: HTMLElement | null = null;
  private aiPagePurpose: HTMLElement | null = null;
  private aiProcessName: HTMLElement | null = null;
  private aiProcessGoal: HTMLElement | null = null;
  private aiNextActionText: HTMLElement | null = null;
  private aiNextActionTarget: HTMLElement | null = null;
  private aiBarriersCount: HTMLElement | null = null;
  private aiBarriersList: HTMLElement | null = null;
  private aiErrorBanner: HTMLElement | null = null;
  private aiErrorText: HTMLElement | null = null;

  // Phase 6 Guided Mode elements
  private startGuidedBtn: HTMLButtonElement | null = null;
  private guidedStatusIndicator: HTMLElement | null = null;
  private guidedPanel: HTMLElement | null = null;
  private guidedStageBadge: HTMLElement | null = null;
  private guidedTitle: HTMLElement | null = null;
  private guidedStageName: HTMLElement | null = null;
  private guidedProgressBar: HTMLElement | null = null;
  private guidedProgressFill: HTMLElement | null = null;
  private guidedProgressPercent: HTMLElement | null = null;
  private guidedStepCounter: HTMLElement | null = null;
  private guidedStepActionTag: HTMLElement | null = null;
  private guidedStepRequiredTag: HTMLElement | null = null;
  private guidedStepTitle: HTMLElement | null = null;
  private guidedStepDesc: HTMLElement | null = null;
  private guidedStepWhy: HTMLElement | null = null;
  private guidedBarrierBox: HTMLElement | null = null;
  private guidedStepBarrier: HTMLElement | null = null;
  private guidedShowTargetBtn: HTMLButtonElement | null = null;
  private guidedAssistBtn: HTMLButtonElement | null = null;
  private guidedTargetFeedback: HTMLElement | null = null;
  private guidedPrevBtn: HTMLButtonElement | null = null;
  private guidedNextBtn: HTMLButtonElement | null = null;
  private guidedExitBtn: HTMLButtonElement | null = null;
  private guidedErrorBanner: HTMLElement | null = null;
  private guidedErrorText: HTMLElement | null = null;

  // Phase 8 Safe Interaction Confirmation Dialog
  private confirmationDialog: InteractionConfirmationDialog = new InteractionConfirmationDialog();

  // Phase 7 Explain Anything elements
  private explainBtn: HTMLButtonElement | null = null;
  private explainStatusIndicator: HTMLElement | null = null;
  private explainPanel: HTMLElement | null = null;
  private explainCloseBtn: HTMLButtonElement | null = null;
  private explainModeBadge: HTMLElement | null = null;
  private explainSelectedText: HTMLElement | null = null;
  private explainElementTag: HTMLElement | null = null;
  private explainModeTabs: HTMLButtonElement[] = [];
  private explainContentCard: HTMLElement | null = null;
  private explainMainText: HTMLElement | null = null;
  private explainWhyBox: HTMLElement | null = null;
  private explainWhyText: HTMLElement | null = null;
  private explainExampleBox: HTMLElement | null = null;
  private explainExampleText: HTMLElement | null = null;
  private explainKeypointsBox: HTMLElement | null = null;
  private explainKeypointsList: HTMLElement | null = null;
  private explainTermsBox: HTMLElement | null = null;
  private explainTermsList: HTMLElement | null = null;
  private explainErrorBanner: HTMLElement | null = null;
  private explainErrorText: HTMLElement | null = null;
  private explainRetryBtn: HTMLButtonElement | null = null;

  // Phase 9 Document Intelligence elements
  private docIntelBtn: HTMLButtonElement | null = null;
  private docStatusIndicator: HTMLElement | null = null;
  private docPanel: HTMLElement | null = null;
  private docTypeBadge: HTMLElement | null = null;
  private docCloseBtn: HTMLButtonElement | null = null;
  private docFileInput: HTMLInputElement | null = null;
  private docSelectedMeta: HTMLElement | null = null;
  private docSelectedName: HTMLElement | null = null;
  private docSelectedSize: HTMLElement | null = null;
  private docRunBtn: HTMLButtonElement | null = null;
  private docResultsCard: HTMLElement | null = null;
  private docClassCat: HTMLElement | null = null;
  private docClassConf: HTMLElement | null = null;
  private docClassReason: HTMLElement | null = null;
  private docEvidenceBox: HTMLElement | null = null;
  private docEvidenceText: HTMLElement | null = null;
  private docFactsCount: HTMLElement | null = null;
  private docFactsList: HTMLElement | null = null;
  private docMatchesCount: HTMLElement | null = null;
  private docMatchesList: HTMLElement | null = null;
  private docErrorBanner: HTMLElement | null = null;
  private docErrorText: HTMLElement | null = null;
  private documentClient: DocumentClient = new DocumentClient();
  private selectedDocFile: File | null = null;
  private currentDocumentResponse: DocumentAnalysisResponse | null = null;

  // Phase 10 User Preferences elements & state
  private preferencesBtn: HTMLButtonElement | null = null;
  private preferencesPanel: HTMLElement | null = null;
  private prefCloseBtn: HTMLButtonElement | null = null;
  private prefSavedToast: HTMLElement | null = null;
  private prefLanguageSelect: HTMLSelectElement | null = null;
  private prefExplanationSelect: HTMLSelectElement | null = null;
  private prefHighContrastCb: HTMLInputElement | null = null;
  private prefLargerTextCb: HTMLInputElement | null = null;
  private prefReducedDensityCb: HTMLInputElement | null = null;
  private prefGuidedWhyCb: HTMLInputElement | null = null;
  private prefGuidedWarningsCb: HTMLInputElement | null = null;
  private prefGuidedProgressCb: HTMLInputElement | null = null;
  private prefConfirmVerbositySelect: HTMLSelectElement | null = null;
  private prefDocEvidenceCb: HTMLInputElement | null = null;
  private prefDocConfidenceCb: HTMLInputElement | null = null;
  private prefResetBtn: HTMLButtonElement | null = null;
  private userPreferences: UserPreferences = { ...DEFAULT_PREFERENCES };

  // Phase 12 Completion Checker elements & state
  private completionBtn: HTMLButtonElement | null = null;
  private completionStatusIndicator: HTMLElement | null = null;
  private completionPanel: HTMLElement | null = null;
  private completionCloseBtn: HTMLButtonElement | null = null;
  private completionOverallBadge: HTMLElement | null = null;
  private completionPercentLabel: HTMLElement | null = null;
  private completionProgressFill: HTMLElement | null = null;
  private completionProgressContainer: HTMLElement | null = null;
  private completionCurrentStage: HTMLElement | null = null;
  private completionStatusLabel: HTMLElement | null = null;
  private completionEvaluateBtn: HTMLButtonElement | null = null;
  private completionStagesList: HTMLElement | null = null;
  private completionBlockingCount: HTMLElement | null = null;
  private completionBlockingList: HTMLElement | null = null;
  private completionWarningsCount: HTMLElement | null = null;
  private completionWarningsList: HTMLElement | null = null;
  private completionDocsCount: HTMLElement | null = null;
  private completionDocsList: HTMLElement | null = null;
  private completionConsistencyCount: HTMLElement | null = null;
  private completionConsistencyList: HTMLElement | null = null;
  private completionCompletedCount: HTMLElement | null = null;
  private completionCompletedList: HTMLElement | null = null;
  private currentCompletionResult: CompletionResult | null = null;

  // Phase 13 Analytics elements & state
  private analyticsBtn: HTMLButtonElement | null = null;
  private analyticsPanel: HTMLElement | null = null;
  private analyticsCloseBtn: HTMLButtonElement | null = null;
  private analyticsRefreshBtn: HTMLButtonElement | null = null;
  private analyticsClearBtn: HTMLButtonElement | null = null;
  private analyticsEventsBadge: HTMLElement | null = null;
  private analyticsSessionId: HTMLElement | null = null;
  private analyticsSessionEvents: HTMLElement | null = null;
  private statA11yAnalyses: HTMLElement | null = null;
  private statA11yBarriers: HTMLElement | null = null;
  private statA11yScore: HTMLElement | null = null;
  private statA11yCrit: HTMLElement | null = null;
  private statA11yHigh: HTMLElement | null = null;
  private statA11yMed: HTMLElement | null = null;
  private statA11yLow: HTMLElement | null = null;
  private statGuidedStarted: HTMLElement | null = null;
  private statGuidedSteps: HTMLElement | null = null;
  private statGuidedRate: HTMLElement | null = null;
  private statExplainRequests: HTMLElement | null = null;
  private statExplainSimple: HTMLElement | null = null;
  private statExplainStandard: HTMLElement | null = null;
  private statDocsAnalyzed: HTMLElement | null = null;
  private statDocsMatches: HTMLElement | null = null;
  private statDocsAmbiguous: HTMLElement | null = null;
  private statCompChecks: HTMLElement | null = null;
  private statCompComplete: HTMLElement | null = null;
  private statCompBlockers: HTMLElement | null = null;
  private statSafeConfirmed: HTMLElement | null = null;
  private statSafeBlocked: HTMLElement | null = null;
  private statSafeCancelled: HTMLElement | null = null;
  private prefAnalyticsEnabledCb: HTMLInputElement | null = null;
  private prefAnalyticsClearBtn: HTMLButtonElement | null = null;

  private currentExplainSelection: SelectionContextPayload | null = null;
  private currentExplainMode: ExplanationMode = 'SIMPLE';
  private currentExplainResponse: ExplainAnythingResponse | null = null;

  private lastMetadata: PageMetadata | null = null;
  private lastRepresentation: PageRepresentation | null = null;
  private lastAccessibilityReport: AccessibilityReport | null = null;
  private lastAiResponse: AIPageAnalysisResponse | null = null;

  private currentGuidedResponse: GuidedModeResponse | null = null;
  private currentStepIndex: number = 0;
  private activeTabId: number | null = null;

  private state: PopupState = 'IDLE';
  private detailsVisible: boolean = false;
  private findingsVisible: boolean = false;

  public init(): void {
    this.analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement | null;
    this.statusMessage = document.getElementById('status-message');
    this.resultCard = document.getElementById('result-card');
    this.resultTitle = document.getElementById('result-title');
    this.resultUrl = document.getElementById('result-url');
    this.resultPageType = document.getElementById('result-page-type');
    this.resultElements = document.getElementById('result-elements');
    this.unsupportedCard = document.getElementById('unsupported-card');
    this.errorCard = document.getElementById('error-card');
    this.errorMessage = document.getElementById('error-message');
    this.optionsBtn = document.getElementById('open-options-btn') as HTMLButtonElement | null;
    this.resetDemoBtn = document.getElementById('reset-demo-btn') as HTMLButtonElement | null;

    this.metricSections = document.getElementById('metric-sections');
    this.metricFields = document.getElementById('metric-fields');
    this.metricRequired = document.getElementById('metric-required');
    this.metricButtons = document.getElementById('metric-buttons');
    this.metricLinks = document.getElementById('metric-links');
    this.toggleDetailsBtn = document.getElementById('toggle-details-btn') as HTMLButtonElement | null;
    this.detailsPanel = document.getElementById('details-panel');
    this.detailFieldCount = document.getElementById('detail-field-count');
    this.detailReqCount = document.getElementById('detail-req-count');
    this.detailFileCount = document.getElementById('detail-file-count');
    this.detailSecCount = document.getElementById('detail-sec-count');
    this.signalsList = document.getElementById('signals-list');

    // Phase 4 elements
    this.accessibilityScoreVal = document.getElementById('accessibility-score-val');
    this.scoreBandBadge = document.getElementById('score-band-badge');
    this.sevCritical = document.getElementById('sev-critical');
    this.sevHigh = document.getElementById('sev-high');
    this.sevMedium = document.getElementById('sev-medium');
    this.sevLow = document.getElementById('sev-low');
    this.toggleFindingsBtn = document.getElementById('toggle-findings-btn') as HTMLButtonElement | null;
    this.findingsPanel = document.getElementById('findings-panel');
    this.findingsCount = document.getElementById('findings-count');
    this.findingsList = document.getElementById('findings-list');

    // Phase 5 elements
    this.analyzeAiBtn = document.getElementById('analyze-ai-btn') as HTMLButtonElement | null;
    this.aiStatusIndicator = document.getElementById('ai-status-indicator');
    this.aiAnalysisCard = document.getElementById('ai-analysis-card');
    this.aiModelTag = document.getElementById('ai-model-tag');
    this.aiPagePurpose = document.getElementById('ai-page-purpose');
    this.aiProcessName = document.getElementById('ai-process-name');
    this.aiProcessGoal = document.getElementById('ai-process-goal');
    this.aiNextActionText = document.getElementById('ai-next-action-text');
    this.aiNextActionTarget = document.getElementById('ai-next-action-target');
    this.aiBarriersCount = document.getElementById('ai-barriers-count');
    this.aiBarriersList = document.getElementById('ai-barriers-list');
    this.aiErrorBanner = document.getElementById('ai-error-banner');
    this.aiErrorText = document.getElementById('ai-error-text');

    // Phase 6 elements
    this.startGuidedBtn = document.getElementById('start-guided-btn') as HTMLButtonElement | null;
    this.guidedStatusIndicator = document.getElementById('guided-status-indicator');
    this.guidedPanel = document.getElementById('guided-panel');
    this.guidedStageBadge = document.getElementById('guided-stage-badge');
    this.guidedTitle = document.getElementById('guided-title');
    this.guidedStageName = document.getElementById('guided-stage-name');
    this.guidedProgressBar = document.getElementById('guided-progress-bar');
    this.guidedProgressFill = document.getElementById('guided-progress-fill');
    this.guidedProgressPercent = document.getElementById('guided-progress-percent');
    this.guidedStepCounter = document.getElementById('guided-step-counter');
    this.guidedStepActionTag = document.getElementById('guided-step-action-tag');
    this.guidedStepRequiredTag = document.getElementById('guided-step-required-tag');
    this.guidedStepTitle = document.getElementById('guided-step-title');
    this.guidedStepDesc = document.getElementById('guided-step-desc');
    this.guidedStepWhy = document.getElementById('guided-step-why');
    this.guidedBarrierBox = document.getElementById('guided-barrier-box');
    this.guidedStepBarrier = document.getElementById('guided-step-barrier');
    this.guidedShowTargetBtn = document.getElementById('guided-show-target-btn') as HTMLButtonElement | null;
    this.guidedAssistBtn = document.getElementById('guided-assist-btn') as HTMLButtonElement | null;
    this.guidedTargetFeedback = document.getElementById('guided-target-feedback');
    this.guidedPrevBtn = document.getElementById('guided-prev-btn') as HTMLButtonElement | null;
    this.guidedNextBtn = document.getElementById('guided-next-btn') as HTMLButtonElement | null;
    this.guidedExitBtn = document.getElementById('guided-exit-btn') as HTMLButtonElement | null;
    this.guidedErrorBanner = document.getElementById('guided-error-banner');
    this.guidedErrorText = document.getElementById('guided-error-text');

    // Phase 7 elements
    this.explainBtn = document.getElementById('explain-btn') as HTMLButtonElement | null;
    this.explainStatusIndicator = document.getElementById('explain-status-indicator');
    this.explainPanel = document.getElementById('explain-panel');
    this.explainCloseBtn = document.getElementById('explain-close-btn') as HTMLButtonElement | null;
    this.explainModeBadge = document.getElementById('explain-mode-badge');
    this.explainSelectedText = document.getElementById('explain-selected-text');
    this.explainElementTag = document.getElementById('explain-element-tag');
    this.explainModeTabs = Array.from(document.querySelectorAll('.explain-mode-tab')) as HTMLButtonElement[];
    this.explainContentCard = document.getElementById('explain-content-card');
    this.explainMainText = document.getElementById('explain-main-text');
    this.explainWhyBox = document.getElementById('explain-why-box');
    this.explainWhyText = document.getElementById('explain-why-text');
    this.explainExampleBox = document.getElementById('explain-example-box');
    this.explainExampleText = document.getElementById('explain-example-text');
    this.explainKeypointsBox = document.getElementById('explain-keypoints-box');
    this.explainKeypointsList = document.getElementById('explain-keypoints-list');
    this.explainTermsBox = document.getElementById('explain-terms-box');
    this.explainTermsList = document.getElementById('explain-terms-list');
    this.explainErrorBanner = document.getElementById('explain-error-banner');
    this.explainErrorText = document.getElementById('explain-error-text');
    this.explainRetryBtn = document.getElementById('explain-retry-btn') as HTMLButtonElement | null;

    // Phase 9 Document Intelligence elements
    this.docIntelBtn = document.getElementById('doc-intel-btn') as HTMLButtonElement | null;
    this.docStatusIndicator = document.getElementById('doc-status-indicator');
    this.docPanel = document.getElementById('doc-panel');
    this.docTypeBadge = document.getElementById('doc-type-badge');
    this.docCloseBtn = document.getElementById('doc-close-btn') as HTMLButtonElement | null;
    this.docFileInput = document.getElementById('doc-file-input') as HTMLInputElement | null;
    this.docSelectedMeta = document.getElementById('doc-selected-meta');
    this.docSelectedName = document.getElementById('doc-selected-name');
    this.docSelectedSize = document.getElementById('doc-selected-size');
    this.docRunBtn = document.getElementById('doc-run-btn') as HTMLButtonElement | null;
    this.docResultsCard = document.getElementById('doc-results-card');
    this.docClassCat = document.getElementById('doc-class-cat');
    this.docClassConf = document.getElementById('doc-class-conf');
    this.docClassReason = document.getElementById('doc-class-reason');
    this.docEvidenceBox = document.getElementById('doc-evidence-box');
    this.docEvidenceText = document.getElementById('doc-evidence-text');
    this.docFactsCount = document.getElementById('doc-facts-count');
    this.docFactsList = document.getElementById('doc-facts-list');
    this.docMatchesCount = document.getElementById('doc-matches-count');
    this.docMatchesList = document.getElementById('doc-matches-list');
    this.docErrorBanner = document.getElementById('doc-error-banner');
    this.docErrorText = document.getElementById('doc-error-text');

    // Phase 10 Preferences elements
    this.preferencesBtn = document.getElementById('preferences-btn') as HTMLButtonElement | null;
    this.preferencesPanel = document.getElementById('preferences-panel');
    this.prefCloseBtn = document.getElementById('pref-close-btn') as HTMLButtonElement | null;
    this.prefSavedToast = document.getElementById('pref-saved-toast');
    this.prefLanguageSelect = document.getElementById('pref-language-select') as HTMLSelectElement | null;
    this.prefExplanationSelect = document.getElementById('pref-explanation-select') as HTMLSelectElement | null;
    this.prefHighContrastCb = document.getElementById('pref-high-contrast-cb') as HTMLInputElement | null;
    this.prefLargerTextCb = document.getElementById('pref-larger-text-cb') as HTMLInputElement | null;
    this.prefReducedDensityCb = document.getElementById('pref-reduced-density-cb') as HTMLInputElement | null;
    this.prefGuidedWhyCb = document.getElementById('pref-guided-why-cb') as HTMLInputElement | null;
    this.prefGuidedWarningsCb = document.getElementById('pref-guided-warnings-cb') as HTMLInputElement | null;
    this.prefGuidedProgressCb = document.getElementById('pref-guided-progress-cb') as HTMLInputElement | null;
    this.prefConfirmVerbositySelect = document.getElementById('pref-confirm-verbosity-select') as HTMLSelectElement | null;
    this.prefDocEvidenceCb = document.getElementById('pref-doc-evidence-cb') as HTMLInputElement | null;
    this.prefDocConfidenceCb = document.getElementById('pref-doc-confidence-cb') as HTMLInputElement | null;
    this.prefResetBtn = document.getElementById('pref-reset-btn') as HTMLButtonElement | null;

    // Phase 12 Completion Checker elements
    this.completionBtn = document.getElementById('completion-checker-btn') as HTMLButtonElement | null;
    this.completionStatusIndicator = document.getElementById('completion-status-indicator');
    this.completionPanel = document.getElementById('completion-panel');
    this.completionCloseBtn = document.getElementById('completion-close-btn') as HTMLButtonElement | null;
    this.completionOverallBadge = document.getElementById('completion-overall-badge');
    this.completionPercentLabel = document.getElementById('completion-percent-label');
    this.completionProgressFill = document.getElementById('completion-progress-fill');
    this.completionProgressContainer = document.getElementById('completion-progress-container');
    this.completionCurrentStage = document.getElementById('completion-current-stage');
    this.completionStatusLabel = document.getElementById('completion-status-label');
    this.completionEvaluateBtn = document.getElementById('completion-evaluate-btn') as HTMLButtonElement | null;
    this.completionStagesList = document.getElementById('completion-stages-list');
    this.completionBlockingCount = document.getElementById('completion-blocking-count');
    this.completionBlockingList = document.getElementById('completion-blocking-list');
    this.completionWarningsCount = document.getElementById('completion-warnings-count');
    this.completionWarningsList = document.getElementById('completion-warnings-list');
    this.completionDocsCount = document.getElementById('completion-docs-count');
    this.completionDocsList = document.getElementById('completion-docs-list');
    this.completionConsistencyCount = document.getElementById('completion-consistency-count');
    this.completionConsistencyList = document.getElementById('completion-consistency-list');
    this.completionCompletedCount = document.getElementById('completion-completed-count');
    this.completionCompletedList = document.getElementById('completion-completed-list');

    // Phase 13 Analytics elements
    this.analyticsBtn = document.getElementById('analytics-btn') as HTMLButtonElement | null;
    this.analyticsPanel = document.getElementById('analytics-panel');
    this.analyticsCloseBtn = document.getElementById('analytics-close-btn') as HTMLButtonElement | null;
    this.analyticsRefreshBtn = document.getElementById('analytics-refresh-btn') as HTMLButtonElement | null;
    this.analyticsClearBtn = document.getElementById('analytics-clear-btn') as HTMLButtonElement | null;
    this.analyticsEventsBadge = document.getElementById('analytics-events-badge');
    this.analyticsSessionId = document.getElementById('analytics-session-id');
    this.analyticsSessionEvents = document.getElementById('analytics-session-events');
    this.statA11yAnalyses = document.getElementById('stat-a11y-analyses');
    this.statA11yBarriers = document.getElementById('stat-a11y-barriers');
    this.statA11yScore = document.getElementById('stat-a11y-score');
    this.statA11yCrit = document.getElementById('stat-a11y-crit');
    this.statA11yHigh = document.getElementById('stat-a11y-high');
    this.statA11yMed = document.getElementById('stat-a11y-med');
    this.statA11yLow = document.getElementById('stat-a11y-low');
    this.statGuidedStarted = document.getElementById('stat-guided-started');
    this.statGuidedSteps = document.getElementById('stat-guided-steps');
    this.statGuidedRate = document.getElementById('stat-guided-rate');
    this.statExplainRequests = document.getElementById('stat-explain-requests');
    this.statExplainSimple = document.getElementById('stat-explain-simple');
    this.statExplainStandard = document.getElementById('stat-explain-standard');
    this.statDocsAnalyzed = document.getElementById('stat-docs-analyzed');
    this.statDocsMatches = document.getElementById('stat-docs-matches');
    this.statDocsAmbiguous = document.getElementById('stat-docs-ambiguous');
    this.statCompChecks = document.getElementById('stat-comp-checks');
    this.statCompComplete = document.getElementById('stat-comp-complete');
    this.statCompBlockers = document.getElementById('stat-comp-blockers');
    this.statSafeConfirmed = document.getElementById('stat-safe-confirmed');
    this.statSafeBlocked = document.getElementById('stat-safe-blocked');
    this.statSafeCancelled = document.getElementById('stat-safe-cancelled');
    this.prefAnalyticsEnabledCb = document.getElementById('pref-analytics-enabled-cb') as HTMLInputElement | null;
    this.prefAnalyticsClearBtn = document.getElementById('pref-analytics-clear-btn') as HTMLButtonElement | null;

    void this.loadAndApplyPreferences();

    this.attachEventListeners();
    this.setState('IDLE');
  }

  private attachEventListeners(): void {
    this.analyzeBtn?.addEventListener('click', () => {
      void this.handleAnalyzeCurrentPage();
    });

    this.analyzeAiBtn?.addEventListener('click', () => {
      void this.handleAnalyzeWithAi();
    });

    this.toggleDetailsBtn?.addEventListener('click', () => {
      this.toggleDetails();
    });

    this.toggleFindingsBtn?.addEventListener('click', () => {
      this.toggleFindings();
    });

    this.optionsBtn?.addEventListener('click', () => {
      if (chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('src/options/options.html'));
      }
    });

    this.resetDemoBtn?.addEventListener('click', () => {
      void this.handleResetDemo();
    });

    this.startGuidedBtn?.addEventListener('click', () => {
      void this.handleStartGuidedMode();
    });

    this.guidedShowTargetBtn?.addEventListener('click', () => {
      void this.handleShowTargetOnPage();
    });

    this.guidedAssistBtn?.addEventListener('click', () => {
      void this.handleAssistStep();
    });

    this.guidedNextBtn?.addEventListener('click', () => {
      void this.handleNextStep();
    });

    this.guidedPrevBtn?.addEventListener('click', () => {
      void this.handlePrevStep();
    });

    this.guidedExitBtn?.addEventListener('click', () => {
      void this.handleExitGuidedMode();
    });

    this.explainBtn?.addEventListener('click', () => {
      void this.handleExplainSelection();
    });

    this.explainCloseBtn?.addEventListener('click', () => {
      this.handleCloseExplain();
    });

    this.explainRetryBtn?.addEventListener('click', () => {
      void this.handleExplainSelection();
    });

    this.explainModeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode') as ExplanationMode;
        if (mode) {
          void this.handleExplainModeChange(mode);
        }
      });
    });

    // Phase 9 Document Intelligence event listeners
    this.docIntelBtn?.addEventListener('click', () => {
      this.handleToggleDocumentPanel();
    });

    this.docCloseBtn?.addEventListener('click', () => {
      this.handleCloseDocumentPanel();
    });

    this.docFileInput?.addEventListener('change', () => {
      this.handleDocFileSelected();
    });

    this.docRunBtn?.addEventListener('click', () => {
      void this.handleAnalyzeDocument();
    });

    // Phase 10 Preferences event listeners
    this.preferencesBtn?.addEventListener('click', () => {
      this.handleTogglePreferencesPanel();
    });

    this.prefCloseBtn?.addEventListener('click', () => {
      this.handleClosePreferencesPanel();
    });

    const prefInputs = [
      this.prefLanguageSelect,
      this.prefExplanationSelect,
      this.prefHighContrastCb,
      this.prefLargerTextCb,
      this.prefReducedDensityCb,
      this.prefGuidedWhyCb,
      this.prefGuidedWarningsCb,
      this.prefGuidedProgressCb,
      this.prefConfirmVerbositySelect,
      this.prefDocEvidenceCb,
      this.prefDocConfidenceCb,
      this.prefAnalyticsEnabledCb,
    ];

    prefInputs.forEach((input) => {
      input?.addEventListener('change', () => {
        void this.handlePreferenceChange();
      });
    });

    this.prefResetBtn?.addEventListener('click', () => {
      void this.handleResetPreferences();
    });

    this.prefAnalyticsClearBtn?.addEventListener('click', () => {
      void this.handleClearAnalytics();
    });

    // Phase 12 Completion Checker event listeners
    this.completionBtn?.addEventListener('click', () => {
      void this.handleToggleCompletionPanel();
    });

    this.completionCloseBtn?.addEventListener('click', () => {
      this.handleCloseCompletionPanel();
    });

    this.completionEvaluateBtn?.addEventListener('click', () => {
      void this.handleRunCompletionEvaluation();
    });

    // Phase 13 Analytics event listeners
    this.analyticsBtn?.addEventListener('click', () => {
      void this.handleToggleAnalyticsPanel();
    });

    this.analyticsCloseBtn?.addEventListener('click', () => {
      this.handleCloseAnalyticsPanel();
    });

    this.analyticsRefreshBtn?.addEventListener('click', () => {
      void this.handleRefreshAnalytics();
    });

    this.analyticsClearBtn?.addEventListener('click', () => {
      void this.handleClearAnalytics();
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.analyticsPanel && !this.analyticsPanel.classList.contains('hidden')) {
          this.handleCloseAnalyticsPanel();
        } else if (this.completionPanel && !this.completionPanel.classList.contains('hidden')) {
          this.handleCloseCompletionPanel();
        } else if (this.preferencesPanel && !this.preferencesPanel.classList.contains('hidden')) {
          this.handleClosePreferencesPanel();
        } else if (this.docPanel && !this.docPanel.classList.contains('hidden')) {
          this.handleCloseDocumentPanel();
        } else if (this.explainPanel && !this.explainPanel.classList.contains('hidden')) {
          this.handleCloseExplain();
        } else if (this.guidedPanel && !this.guidedPanel.classList.contains('hidden')) {
          void this.handleExitGuidedMode();
        }
      }
    });
  }

  private toggleDetails(): void {
    this.detailsVisible = !this.detailsVisible;
    if (this.detailsPanel) {
      if (this.detailsVisible) {
        this.detailsPanel.classList.remove('hidden');
      } else {
        this.detailsPanel.classList.add('hidden');
      }
    }
    if (this.toggleDetailsBtn) {
      this.toggleDetailsBtn.textContent = this.detailsVisible ? '[ Hide Page Metrics ]' : '[ View Page Metrics ]';
    }
  }

  private toggleFindings(): void {
    this.findingsVisible = !this.findingsVisible;
    if (this.findingsPanel) {
      if (this.findingsVisible) {
        this.findingsPanel.classList.remove('hidden');
      } else {
        this.findingsPanel.classList.add('hidden');
      }
    }
    if (this.toggleFindingsBtn) {
      this.toggleFindingsBtn.textContent = this.findingsVisible
        ? '[ Hide Accessibility Findings ]'
        : '[ View Accessibility Findings ]';
    }
  }

  public setState(state: PopupState, errorDetails?: string): void {
    this.state = state;

    // Reset visibility
    this.statusMessage?.classList.add('hidden');
    this.resultCard?.classList.add('hidden');
    this.unsupportedCard?.classList.add('hidden');
    this.errorCard?.classList.add('hidden');
    this.guidedPanel?.classList.add('hidden');

    if (this.analyzeBtn) {
      this.analyzeBtn.disabled = state === 'ANALYZING';
    }

    switch (state) {
      case 'IDLE':
        if (this.statusMessage) {
          this.statusMessage.textContent = 'Ready to analyze this page.';
          this.statusMessage.classList.remove('hidden');
        }
        break;

      case 'ANALYZING':
        if (this.statusMessage) {
          this.statusMessage.textContent = 'Analyzing page...';
          this.statusMessage.classList.remove('hidden');
        }
        break;

      case 'SUCCESS':
        this.resultCard?.classList.remove('hidden');
        break;

      case 'UNSUPPORTED_PAGE':
        this.unsupportedCard?.classList.remove('hidden');
        break;

      case 'ERROR':
        if (this.errorMessage && errorDetails) {
          this.errorMessage.textContent = errorDetails;
        }
        this.errorCard?.classList.remove('hidden');
        break;
    }
  }

  public getState(): PopupState {
    return this.state;
  }

  public async handleResetDemo(): Promise<void> {
    const res = await demoResetManager.resetDemo();
    if (res.success) {
      this.lastMetadata = null;
      this.lastRepresentation = null;
      this.lastAccessibilityReport = null;
      this.lastAiResponse = null;
      this.currentGuidedResponse = null;
      this.currentExplainSelection = null;
      this.currentExplainResponse = null;
      this.currentCompletionResult = null;

      this.detailsVisible = false;
      this.findingsVisible = false;
      this.detailsPanel?.classList.add('hidden');
      this.findingsPanel?.classList.add('hidden');
      this.aiAnalysisCard?.classList.add('hidden');
      this.guidedPanel?.classList.add('hidden');
      this.explainPanel?.classList.add('hidden');
      this.docPanel?.classList.add('hidden');
      this.completionPanel?.classList.add('hidden');
      this.preferencesPanel?.classList.add('hidden');
      this.analyticsPanel?.classList.add('hidden');

      this.setState('IDLE');
      if (this.statusMessage) {
        this.statusMessage.textContent = 'Demo state reset to clean baseline.';
        this.statusMessage.classList.remove('hidden');
      }

      if (this.activeTabId && chrome.tabs?.sendMessage) {
        try {
          chrome.tabs.sendMessage(
            this.activeTabId,
            createMessage(MessageType.RESET_DEMO, {}),
            () => {
              if (chrome.runtime?.lastError) {
                // Ignore error if tab doesn't have listener
              }
            }
          );
        } catch {
          // Ignore
        }
      }
    } else {
      if (this.errorMessage) {
        this.errorMessage.textContent = res.message;
      }
      this.setState('ERROR', res.message);
    }
  }

  public renderResult(
    metadata: PageMetadata,
    representation?: PageRepresentation,
    accessibilityReport?: AccessibilityReport
  ): void {
    if (this.resultTitle) {
      this.resultTitle.textContent = metadata.title || '(No Title)';
    }
    if (this.resultUrl) {
      this.resultUrl.textContent = formatDisplayUrl(metadata);
    }
    if (this.resultPageType) {
      this.resultPageType.textContent = 'Web Page';
    }
    if (this.resultElements) {
      this.resultElements.textContent = String(metadata.interactiveElementCount);
    }

    if (representation) {
      const m = representation.metrics;

      if (this.metricSections) this.metricSections.textContent = String(m.sectionCount);
      if (this.metricFields) this.metricFields.textContent = String(m.fieldCount);
      if (this.metricRequired) this.metricRequired.textContent = String(m.requiredFieldCount);
      if (this.metricButtons) this.metricButtons.textContent = String(m.buttonCount);
      if (this.metricLinks) this.metricLinks.textContent = String(m.linkCount);

      if (this.detailFieldCount) this.detailFieldCount.textContent = String(m.fieldCount);
      if (this.detailReqCount) this.detailReqCount.textContent = String(m.requiredFieldCount);
      if (this.detailFileCount) this.detailFileCount.textContent = String(m.formComplexity.fileUploadCount);
      if (this.detailSecCount) this.detailSecCount.textContent = String(m.sectionCount);

      if (this.signalsList) {
        this.signalsList.innerHTML = '';
        const sig = representation.accessibilitySignals;
        const li = document.createElement('li');
        li.textContent = `Total raw signals detected: ${sig.totalSignalsCount}`;
        this.signalsList.appendChild(li);
      }

      // Resolve or compute Phase 4 Accessibility Report
      const report = accessibilityReport || analyzeAccessibility(representation);

      if (report) {
        if (this.accessibilityScoreVal) {
          this.accessibilityScoreVal.textContent = String(report.score.finalScore);
        }
        if (this.scoreBandBadge) {
          this.scoreBandBadge.textContent = report.score.band;
          this.scoreBandBadge.className = `score-badge band-${this.getBandClass(report.score.band)}`;
        }

        if (this.sevCritical) this.sevCritical.textContent = String(report.summary.bySeverity.CRITICAL);
        if (this.sevHigh) this.sevHigh.textContent = String(report.summary.bySeverity.HIGH);
        if (this.sevMedium) this.sevMedium.textContent = String(report.summary.bySeverity.MEDIUM);
        if (this.sevLow) this.sevLow.textContent = String(report.summary.bySeverity.LOW);

        if (this.findingsCount) {
          this.findingsCount.textContent = String(report.findings.length);
        }

        this.renderFindingsList(report);
      }

      this.lastMetadata = metadata;
      this.lastRepresentation = representation;
      this.lastAccessibilityReport = report;

      if (report) {
        void analyticsService.recordEvent({
          eventType: AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
          feature: 'accessibility',
          success: true,
          countMetrics: {
            critical: report.summary.bySeverity.CRITICAL,
            high: report.summary.bySeverity.HIGH,
            medium: report.summary.bySeverity.MEDIUM,
            low: report.summary.bySeverity.LOW,
            totalBarriers: report.summary.totalFindings,
            score: report.score.finalScore,
          },
        });
      }

      // Reset AI section until triggered by user
      this.aiAnalysisCard?.classList.add('hidden');
      this.aiErrorBanner?.classList.add('hidden');
      if (this.analyzeAiBtn) {
        this.analyzeAiBtn.disabled = false;
        this.analyzeAiBtn.textContent = '✦ Analyze with AI';
      }
      this.aiStatusIndicator?.classList.add('hidden');

      // Reset Guided Mode trigger & panel
      this.guidedPanel?.classList.add('hidden');
      this.guidedErrorBanner?.classList.add('hidden');
      if (this.startGuidedBtn) {
        this.startGuidedBtn.disabled = false;
        this.startGuidedBtn.textContent = '🧭 Start Guided Mode';
      }
      this.guidedStatusIndicator?.classList.add('hidden');
    } else {
      // Fallback if only Phase 1 metadata exists
      if (this.metricFields) this.metricFields.textContent = String(metadata.interactiveElementCount);
      this.lastMetadata = metadata;
    }

    this.setState('SUCCESS');
  }

  public async handleAnalyzeWithAi(): Promise<void> {
    if (!this.lastMetadata) return;

    if (this.analyzeAiBtn) {
      this.analyzeAiBtn.disabled = true;
    }
    this.aiStatusIndicator?.classList.remove('hidden');
    this.aiErrorBanner?.classList.add('hidden');

    try {
      const requestPayload = buildAIAnalysisRequest(
        this.lastMetadata,
        this.lastRepresentation || undefined,
        this.lastAccessibilityReport || undefined
      );

      const aiResponse = await requestAIPageAnalysis(requestPayload);
      this.lastAiResponse = aiResponse;
      this.renderAiResult(aiResponse);

      void analyticsService.recordEvent({
        eventType: AnalyticsEventType.AI_ANALYSIS,
        feature: 'ai',
        success: true,
      });
    } catch (err: unknown) {
      const userMsg =
        err instanceof Error && 'userMessage' in err && typeof (err as { userMessage: unknown }).userMessage === 'string'
          ? (err as { userMessage: string }).userMessage
          : err instanceof Error
            ? err.message
            : 'AI analysis is temporarily unavailable.';
      if (this.aiErrorBanner && this.aiErrorText) {
        this.aiErrorText.textContent = userMsg;
        this.aiErrorBanner.classList.remove('hidden');
      }
    } finally {
      if (this.analyzeAiBtn) {
        this.analyzeAiBtn.disabled = false;
      }
      this.aiStatusIndicator?.classList.add('hidden');
    }
  }

  public renderAiResult(response: AIPageAnalysisResponse): void {
    if (this.aiModelTag) {
      this.aiModelTag.textContent = `${response.provider}:${response.model}`;
    }
    if (this.aiPagePurpose) {
      this.aiPagePurpose.textContent = response.pageUnderstanding.pagePurpose;
    }
    if (this.aiProcessName) {
      this.aiProcessName.textContent = response.processUnderstanding.processName;
    }
    if (this.aiProcessGoal) {
      this.aiProcessGoal.textContent = response.processUnderstanding.goal;
    }

    if (this.aiNextActionText) {
      this.aiNextActionText.textContent = response.nextAction.description;
    }
    if (this.aiNextActionTarget) {
      if (response.nextAction.targetElementId) {
        this.aiNextActionTarget.textContent = `Target: ${response.nextAction.targetElementId}`;
        this.aiNextActionTarget.classList.remove('hidden');
      } else {
        this.aiNextActionTarget.classList.add('hidden');
      }
    }

    if (this.aiBarriersCount) {
      this.aiBarriersCount.textContent = String(response.barriers.length);
    }

    this.renderAiBarriersList(response.barriers);
    this.aiAnalysisCard?.classList.remove('hidden');
  }

  private renderAiBarriersList(barriers: AIBarrierFinding[]): void {
    const list = this.aiBarriersList;
    if (!list) return;
    list.innerHTML = '';

    if (barriers.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'status-message';
      emptyDiv.textContent = 'No significant cognitive or semantic barriers identified by AI.';
      list.appendChild(emptyDiv);
      return;
    }

    barriers.forEach((barrier) => {
      const card = document.createElement('div');
      card.className = `ai-barrier-card severity-${barrier.severity.toLowerCase()}`;

      const header = document.createElement('div');
      header.className = 'ai-barrier-header';

      const title = document.createElement('span');
      title.className = 'ai-barrier-title';
      title.textContent = barrier.title;

      const typeTag = document.createElement('span');
      typeTag.className = 'ai-type-tag';
      typeTag.textContent = barrier.type.replace(/_/g, ' ');

      header.appendChild(title);
      header.appendChild(typeTag);
      card.appendChild(header);

      const explanation = document.createElement('p');
      explanation.className = 'ai-barrier-explanation';
      explanation.textContent = barrier.explanation;
      card.appendChild(explanation);

      if (barrier.affectedElementIds && barrier.affectedElementIds.length > 0) {
        const elemBadge = document.createElement('span');
        elemBadge.className = 'finding-element';
        elemBadge.textContent = `Elements: ${barrier.affectedElementIds.join(', ')}`;
        card.appendChild(elemBadge);
      }

      if (barrier.suggestedSimplification) {
        const simp = document.createElement('div');
        simp.className = 'ai-simplification-box';
        simp.textContent = `Recommendation: ${barrier.suggestedSimplification}`;
        card.appendChild(simp);
      }

      list.appendChild(card);
    });
  }

  private getBandClass(band: string): string {
    switch (band) {
      case 'Strong baseline': return 'strong';
      case 'Minor barriers': return 'minor';
      case 'Significant barriers': return 'significant';
      case 'Major barriers': return 'major';
      default: return 'severe';
    }
  }

  private renderFindingsList(report: AccessibilityReport): void {
    if (!this.findingsList) return;
    this.findingsList.innerHTML = '';

    if (report.findings.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'status-message';
      emptyDiv.textContent = 'No objective barriers detected by baseline rules.';
      this.findingsList.appendChild(emptyDiv);
      return;
    }

    report.findings.forEach((finding) => {
      const card = document.createElement('div');
      card.className = `finding-card severity-${finding.severity.toLowerCase()}`;

      // Header: Title and Severity Badge
      const header = document.createElement('div');
      header.className = 'finding-header';

      const title = document.createElement('span');
      title.className = 'finding-title-text';
      title.textContent = finding.title;

      const badge = document.createElement('span');
      badge.className = `finding-badge badge-${finding.severity.toLowerCase()}`;
      badge.textContent = finding.severity;

      header.appendChild(title);
      header.appendChild(badge);
      card.appendChild(header);

      // Description
      const desc = document.createElement('p');
      desc.className = 'finding-desc';
      desc.textContent = finding.description;
      card.appendChild(desc);

      // Affected Element Badge (Stable ACCESSOS ID)
      if (finding.affectedElementId) {
        const elemBadge = document.createElement('span');
        elemBadge.className = 'finding-element';
        elemBadge.textContent = `Target: ${finding.affectedElementId}`;
        card.appendChild(elemBadge);
      }

      // Remediation
      const rem = document.createElement('div');
      rem.className = 'finding-remediation';
      rem.textContent = `Fix: ${finding.remediation}`;
      card.appendChild(rem);

      this.findingsList?.appendChild(card);
    });
  }

  public async handleAnalyzeCurrentPage(): Promise<void> {
    this.setState('ANALYZING');

    if (!chrome.tabs?.query) {
      this.setState('ERROR', 'Browser tabs API unavailable.');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || tab.id === undefined) {
        this.setState('ERROR', 'Unable to locate active browser tab.');
        return;
      }

      if (isRestrictedUrl(tab.url)) {
        this.setState('UNSUPPORTED_PAGE');
        return;
      }

      this.activeTabId = tab.id;

      const response = await chrome.tabs.sendMessage(
        tab.id,
        createMessage(MessageType.ANALYZE_PAGE)
      );

      if (isPageAnalysisResultMessage(response)) {
        if (response.payload.success) {
          this.renderResult(
            response.payload.metadata,
            response.payload.representation,
            response.payload.accessibilityReport
          );
        } else {
          this.setState('ERROR', response.payload.error || 'Failed to extract metadata.');
        }
      } else {
        this.setState('ERROR', 'Unexpected message format received from page.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes('Receiving end does not exist') ||
        message.includes('Cannot access') ||
        message.includes('The extensions gallery cannot be scripted')
      ) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
        if (tab?.url && isRestrictedUrl(tab.url)) {
          this.setState('UNSUPPORTED_PAGE');
        } else {
          this.setState('ERROR', 'Cannot connect to page. Please refresh the page and try again.');
        }
      } else {
        this.setState('ERROR', message || 'Error communicating with active tab.');
      }
    }
  }

  // ==========================================================================
  // Phase 6 Guided Mode Operations
  // ==========================================================================

  public async handleStartGuidedMode(): Promise<void> {
    if (!this.lastMetadata) {
      await this.handleAnalyzeCurrentPage();
      if (!this.lastMetadata) return;
    }

    if (this.startGuidedBtn) {
      this.startGuidedBtn.disabled = true;
    }
    this.guidedStatusIndicator?.classList.remove('hidden');
    this.guidedErrorBanner?.classList.add('hidden');

    try {
      const requestPayload = buildGuidedModeRequest(
        this.lastMetadata,
        this.lastRepresentation || undefined,
        this.lastAccessibilityReport || undefined,
        this.lastAiResponse || undefined
      );

      const response = await requestGuidedModeStart(requestPayload);
      this.currentGuidedResponse = response;
      this.currentStepIndex = 0;

      this.renderGuidedMode(response);
      this.guidedPanel?.classList.remove('hidden');
      this.guidedPanel?.focus();
    } catch (err: unknown) {
      const userMsg =
        err instanceof Error && 'userMessage' in err && typeof (err as { userMessage: unknown }).userMessage === 'string'
          ? (err as { userMessage: string }).userMessage
          : err instanceof Error
            ? err.message
            : 'Guided Mode is temporarily unavailable.';
      if (this.guidedErrorBanner && this.guidedErrorText) {
        this.guidedErrorText.textContent = userMsg;
        this.guidedErrorBanner.classList.remove('hidden');
      }
    } finally {
      if (this.startGuidedBtn) {
        this.startGuidedBtn.disabled = false;
      }
      this.guidedStatusIndicator?.classList.add('hidden');
    }
  }

  public renderGuidedMode(response: GuidedModeResponse): void {
    this.currentGuidedResponse = response;
    this.currentStepIndex = 0;

    if (this.guidedTitle) {
      this.guidedTitle.textContent = response.title;
    }

    if (this.guidedStageBadge) {
      let stageNumber = '1';
      const numMatch = response.currentStage.match(/(?:Stage\s*|Phase\s*|^)(\d+)/i);
      if (numMatch) {
        stageNumber = numMatch[1];
      } else {
        const splitVal = response.currentStage.replace(/Stage\s*/i, '').split(':')[0]?.trim();
        stageNumber = splitVal && splitVal.length <= 3 ? splitVal : '1';
      }
      this.guidedStageBadge.textContent = `Stage ${stageNumber} of ${response.totalStages}`;
    }

    if (this.guidedStageName) {
      this.guidedStageName.textContent = response.currentStage;
    }

    if (this.guidedProgressPercent) {
      this.guidedProgressPercent.textContent = `${response.progressPercent}% Complete`;
    }

    if (this.guidedProgressFill) {
      this.guidedProgressFill.style.width = `${response.progressPercent}%`;
    }

    if (this.guidedProgressBar) {
      this.guidedProgressBar.setAttribute('aria-valuenow', String(response.progressPercent));
      if (this.userPreferences.guidedShowProgress) {
        this.guidedProgressBar.classList.remove('hidden');
      } else {
        this.guidedProgressBar.classList.add('hidden');
      }
    }

    this.renderCurrentStep();
  }

  public renderCurrentStep(): void {
    if (!this.currentGuidedResponse || !this.currentGuidedResponse.steps.length) {
      return;
    }

    const totalSteps = this.currentGuidedResponse.steps.length;
    const step = this.currentGuidedResponse.steps[this.currentStepIndex];

    if (this.guidedProgressBar) {
      if (this.userPreferences.guidedShowProgress) {
        this.guidedProgressBar.classList.remove('hidden');
      } else {
        this.guidedProgressBar.classList.add('hidden');
      }
    }

    if (this.guidedStepCounter) {
      this.guidedStepCounter.textContent = `Step ${this.currentStepIndex + 1} of ${totalSteps}`;
    }

    if (this.guidedStepActionTag) {
      this.guidedStepActionTag.textContent = step.actionType;
      this.guidedStepActionTag.className = `guided-action-tag action-${step.actionType.toLowerCase().replace(/_/g, '-')}`;
    }

    if (this.guidedStepRequiredTag) {
      this.guidedStepRequiredTag.textContent = step.required ? 'Required' : 'Optional';
      this.guidedStepRequiredTag.className = `guided-required-tag ${step.required ? '' : 'optional'}`;
    }

    if (this.guidedStepTitle) {
      this.guidedStepTitle.textContent = step.title;
    }

    if (this.guidedStepDesc) {
      this.guidedStepDesc.textContent = step.description;
    }

    if (this.guidedStepWhy) {
      this.guidedStepWhy.textContent = step.whyItMatters;
      const whyBox = this.guidedStepWhy.parentElement;
      if (whyBox) {
        if (this.userPreferences.guidedShowWhy) {
          whyBox.classList.remove('hidden');
        } else {
          whyBox.classList.add('hidden');
        }
      }
    }

    if (this.guidedBarrierBox && this.guidedStepBarrier) {
      if (step.barrierNote && step.barrierNote.trim()) {
        const isCritical =
          step.required ||
          (step.targetElementId && ['password', 'otp', 'cvv', 'card'].some((kw) => step.targetElementId!.toLowerCase().includes(kw)));
        if (this.userPreferences.guidedShowWarnings || isCritical) {
          this.guidedStepBarrier.textContent = step.barrierNote;
          this.guidedBarrierBox.classList.remove('hidden');
        } else {
          this.guidedBarrierBox.classList.add('hidden');
        }
      } else {
        this.guidedBarrierBox.classList.add('hidden');
      }
    }

    if (this.guidedShowTargetBtn) {
      if (step.targetElementId) {
        this.guidedShowTargetBtn.disabled = false;
        this.guidedShowTargetBtn.textContent = `🔍 Show on page (${step.targetElementId})`;
      } else {
        this.guidedShowTargetBtn.disabled = true;
        this.guidedShowTargetBtn.textContent = 'No page target';
      }
    }

    if (this.guidedTargetFeedback) {
      this.guidedTargetFeedback.textContent = '';
      this.guidedTargetFeedback.className = 'guided-target-feedback';
    }

    if (this.guidedPrevBtn) {
      this.guidedPrevBtn.disabled = this.currentStepIndex === 0;
    }

    if (this.guidedNextBtn) {
      this.guidedNextBtn.disabled = this.currentStepIndex >= totalSteps - 1;
    }
  }

  public async handleShowTargetOnPage(): Promise<void> {
    if (!this.currentGuidedResponse || !this.currentGuidedResponse.steps.length) {
      return;
    }

    const step = this.currentGuidedResponse.steps[this.currentStepIndex];
    if (!step.targetElementId) {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'No target element for this step.';
        this.guidedTargetFeedback.className = 'guided-target-feedback';
      }
      return;
    }

    const tabId = await this.getActiveTabId();
    if (!tabId) {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'Cannot locate active tab.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.HIGHLIGHT_ELEMENT, { targetElementId: step.targetElementId })
      );

      if (this.guidedTargetFeedback) {
        if (response && response.found) {
          this.guidedTargetFeedback.textContent = '✓ Located on page';
          this.guidedTargetFeedback.className = 'guided-target-feedback';
        } else {
          this.guidedTargetFeedback.textContent = '⚠️ Element not found on page';
          this.guidedTargetFeedback.className = 'guided-target-feedback error';
        }
      }
    } catch {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'Unable to highlight element on page.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
    }
  }

  public async handleAssistStep(): Promise<void> {
    if (!this.currentGuidedResponse || !this.currentGuidedResponse.steps.length) {
      return;
    }

    const step = this.currentGuidedResponse.steps[this.currentStepIndex];
    if (!step.targetElementId) {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'No target element to assist with for this step.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      return;
    }

    const tabId = await this.getActiveTabId();
    if (!tabId) {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'Cannot locate active tab.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      return;
    }

    // Block automated form submission explicitly
    if (step.actionType === 'SUBMIT_REVIEW') {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = '⚠️ Final submission cannot be automated. Please submit manually.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.HIGHLIGHT_ELEMENT, { targetElementId: step.targetElementId })
      );
      return;
    }

    // Block automated file upload (deferred to Phase 9)
    if (step.actionType === 'UPLOAD') {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = '⚠️ File uploads cannot be automated in Phase 8. Please select file manually.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.HIGHLIGHT_ELEMENT, { targetElementId: step.targetElementId })
      );
      return;
    }

    // Block automated input into sensitive fields
    const sensitiveKeywords = ['password', 'pwd', 'token', 'otp', 'secret', 'cvv', 'card'];
    const isSensitive = sensitiveKeywords.some(
      (kw) =>
        step.targetElementId!.toLowerCase().includes(kw) ||
        step.title.toLowerCase().includes(kw)
    );

    if (isSensitive) {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = '⚠️ Sensitive credential field cannot be automated. Please enter manually.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
      // Focus the sensitive field to assist the user visually without typing
      await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.EXECUTE_INTERACTION, {
          actionId: `focus-${Date.now()}`,
          actionType: 'FOCUS',
          targetElementId: step.targetElementId,
          source: 'GUIDED_MODE',
        })
      );
      return;
    }

    // Determine allowlisted ActionType
    let actionType: 'TYPE' | 'SELECT_OPTION' | 'TOGGLE_CHECKBOX' | 'FOCUS' = 'FOCUS';
    let value: string | undefined = undefined;
    let optionValue: string | undefined = undefined;
    let checked: boolean | undefined = undefined;

    if (step.actionType === 'ENTER') {
      actionType = 'TYPE';
      value = this.getSampleValueForStep(step);
    } else if (step.actionType === 'SELECT') {
      actionType = 'SELECT_OPTION';
      optionValue = this.getSampleOptionForStep(step);
    } else if (step.actionType === 'CONFIRM') {
      actionType = 'TOGGLE_CHECKBOX';
      checked = true;
    } else {
      actionType = 'FOCUS';
    }

    const intent: InteractionIntent = {
      actionId: `act-${Date.now()}`,
      actionType,
      targetElementId: step.targetElementId,
      value,
      valueSource: actionType === 'TYPE' ? 'USER_EXPLICIT' : 'NONE',
      optionValue,
      checked,
      reason: step.whyItMatters || step.description,
      riskLevel: 'LOW',
      requiresConfirmation: actionType !== 'FOCUS',
      source: 'USER',
    };

    // If non-mutating (FOCUS), execute immediately
    if (!intent.requiresConfirmation) {
      await this.dispatchInteractionToTab(tabId, intent);
      return;
    }

    // Mutating action requires confirmation modal
    this.confirmationDialog.show({
      intent,
      targetLabel: step.title,
      verbosity: this.userPreferences.confirmationVerbosity,
      onConfirm: async () => {
        await this.dispatchInteractionToTab(tabId, intent);
      },
      onCancel: () => {
        void analyticsService.recordEvent({
          eventType: AnalyticsEventType.ERROR,
          feature: 'interaction',
          success: false,
          coarseResultCategory: 'CANCELLED',
        });
        if (this.guidedTargetFeedback) {
          this.guidedTargetFeedback.textContent = 'Action cancelled by user.';
          this.guidedTargetFeedback.className = 'guided-target-feedback';
        }
      },
    });
  }

  private async dispatchInteractionToTab(tabId: number, intent: InteractionIntent): Promise<void> {
    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.EXECUTE_INTERACTION, intent)
      );

      if (this.guidedTargetFeedback) {
        if (response && response.payload) {
          const res: InteractionResult = response.payload;
          const isSuccess = res.status === 'SUCCESS';
          void analyticsService.recordEvent({
            eventType: isSuccess ? AnalyticsEventType.SAFE_INTERACTION_CONFIRMED : AnalyticsEventType.SAFE_INTERACTION_BLOCKED,
            feature: 'interaction',
            success: isSuccess,
            coarseResultCategory: isSuccess ? 'CONFIRMED' : 'REJECTED',
            anonymizedTargetCategory: intent.actionType === 'TYPE' ? 'input' : 'button',
          });

          if (isSuccess) {
            this.guidedTargetFeedback.textContent = '✓ Action executed and verified';
            this.guidedTargetFeedback.className = 'guided-target-feedback';
          } else {
            this.guidedTargetFeedback.textContent = `⚠️ ${res.message || res.status}`;
            this.guidedTargetFeedback.className = 'guided-target-feedback error';
          }
        } else {
          this.guidedTargetFeedback.textContent = '✓ Action sent to page';
          this.guidedTargetFeedback.className = 'guided-target-feedback';
        }
      }
    } catch {
      if (this.guidedTargetFeedback) {
        this.guidedTargetFeedback.textContent = 'Execution failed.';
        this.guidedTargetFeedback.className = 'guided-target-feedback error';
      }
    }
  }

  private getSampleValueForStep(step: GuidedStep): string {
    const textToMatch = `${step.targetElementId || ''} ${step.title || ''} ${step.description || ''}`.toLowerCase();

    // OTP, PIN, single-digit inputs
    if (textToMatch.includes('otp') || textToMatch.includes('digit') || textToMatch.includes('code') || textToMatch.includes('pin')) {
      return '5';
    }
    // Aadhaar / UIDAI identification
    if (textToMatch.includes('aadhaar') || textToMatch.includes('uid')) {
      return '123456789012';
    }
    // Captcha
    if (textToMatch.includes('captcha')) {
      return '1234';
    }
    // Names
    if (textToMatch.includes('first_name') || textToMatch.includes('first name')) return 'Rahul';
    if (textToMatch.includes('last_name') || textToMatch.includes('last name') || textToMatch.includes('surname')) return 'Kumar';
    if (textToMatch.includes('name')) return 'Rahul';

    // Email
    if (textToMatch.includes('email') || textToMatch.includes('mail')) return 'rahul.kumar@example.edu';

    // Phone / mobile / contact
    if (textToMatch.includes('phone') || textToMatch.includes('mobile') || textToMatch.includes('contact')) return '9876543210';

    // Financial / Income
    if (textToMatch.includes('income') || textToMatch.includes('salary')) return '240000';

    // Score / marks
    if (textToMatch.includes('score') || textToMatch.includes('marks') || textToMatch.includes('percentage') || textToMatch.includes('percent')) return '88';

    // Date
    if (textToMatch.includes('date') || textToMatch.includes('dob') || textToMatch.includes('birth')) return '2000-01-01';

    // Address
    if (textToMatch.includes('pincode') || textToMatch.includes('zip')) return '110001';
    if (textToMatch.includes('address') || textToMatch.includes('street')) return 'Civil Lines';

    return 'Sample Text';
  }

  private getSampleOptionForStep(step: GuidedStep): string {
    const id = step.targetElementId?.toLowerCase() || '';
    if (id.includes('category')) return 'GEN';
    if (id.includes('state') || id.includes('domicile')) return 'DL';
    if (id.includes('gender')) return 'Male';
    return '1';
  }


  public async handleNextStep(): Promise<void> {
    await this.clearPageHighlight();
    if (this.currentGuidedResponse) {
      void analyticsService.recordEvent({
        eventType: AnalyticsEventType.GUIDED_STEP_COMPLETED,
        feature: 'guided',
        success: true,
      });

      if (this.currentStepIndex < this.currentGuidedResponse.steps.length - 1) {
        this.currentStepIndex += 1;
        this.renderCurrentStep();
      } else {
        void analyticsService.recordEvent({
          eventType: AnalyticsEventType.GUIDED_MODE_COMPLETED,
          feature: 'guided',
          success: true,
        });
      }
    }
  }

  public async handlePrevStep(): Promise<void> {
    await this.clearPageHighlight();
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.renderCurrentStep();
    }
  }

  public async handleExitGuidedMode(): Promise<void> {
    await this.clearPageHighlight();
    void analyticsService.recordEvent({
      eventType: AnalyticsEventType.USER_EXITED_FEATURE,
      feature: 'guided',
      success: true,
    });
    this.guidedPanel?.classList.add('hidden');
    this.startGuidedBtn?.focus();
  }

  public async clearPageHighlight(): Promise<void> {
    const tabId = await this.getActiveTabId();
    if (!tabId) return;
    try {
      await chrome.tabs.sendMessage(tabId, createMessage(MessageType.CLEAR_HIGHLIGHT));
    } catch {
      // Content script may not be loaded or tab changed
    }
  }

  private async getActiveTabId(): Promise<number | null> {
    if (this.activeTabId) return this.activeTabId;
    if (!chrome.tabs?.query) return null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) {
        this.activeTabId = tab.id;
        return tab.id;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public getCurrentGuidedResponse(): GuidedModeResponse | null {
    return this.currentGuidedResponse;
  }

  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  public isGuidedModeActive(): boolean {
    return this.guidedPanel ? !this.guidedPanel.classList.contains('hidden') : false;
  }

  // =========================================================================
  // Phase 7: Explain Anything Methods
  // =========================================================================

  public async handleExplainSelection(): Promise<void> {
    const tabId = await this.getActiveTabId();
    if (!tabId) {
      this.showExplainError('Unable to locate active tab to capture selection.');
      return;
    }

    this.explainStatusIndicator?.classList.remove('hidden');
    if (this.explainBtn) this.explainBtn.disabled = true;

    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        createMessage(MessageType.GET_SELECTION)
      );

      if (
        !response ||
        !response.payload ||
        !response.payload.selection ||
        !response.payload.selection.selectedText
      ) {
        this.showExplainError(
          'No text currently selected on the page. Highlight any text on the webpage and try again.'
        );
        return;
      }

      this.currentExplainSelection = response.payload.selection;
      this.showExplainPanel();
      await this.fetchAndRenderExplanation();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve selected text from page.';
      this.showExplainError(msg);
    } finally {
      this.explainStatusIndicator?.classList.add('hidden');
      if (this.explainBtn) this.explainBtn.disabled = false;
    }
  }

  public showExplainPanel(): void {
    if (!this.explainPanel) return;
    if (this.userPreferences.explanationMode === 'DETAILED') {
      this.currentExplainMode = 'DETAILED';
    } else if (this.userPreferences.explanationMode === 'SIMPLE') {
      this.currentExplainMode = 'SIMPLE';
    } else {
      this.currentExplainMode = 'PLAIN_LANGUAGE';
    }
    this.explainPanel.classList.remove('hidden');
    this.explainErrorBanner?.classList.add('hidden');
    this.explainContentCard?.classList.remove('hidden');

    if (this.explainSelectedText && this.currentExplainSelection) {
      this.explainSelectedText.textContent = `"${this.currentExplainSelection.selectedText}"`;
    }

    if (this.explainElementTag) {
      if (this.currentExplainSelection?.targetElementId) {
        this.explainElementTag.textContent = `Target: #${this.currentExplainSelection.targetElementId}${
          this.currentExplainSelection.elementRole ? ` (${this.currentExplainSelection.elementRole})` : ''
        }`;
        this.explainElementTag.classList.remove('hidden');
      } else {
        this.explainElementTag.classList.add('hidden');
      }
    }

    this.updateExplainModeTabs();
    this.explainPanel.focus();
  }

  public showExplainError(message: string): void {
    if (!this.explainPanel) return;
    this.explainPanel.classList.remove('hidden');
    if (this.explainContentCard) this.explainContentCard.classList.add('hidden');
    if (this.explainErrorBanner) {
      this.explainErrorBanner.classList.remove('hidden');
      if (this.explainErrorText) {
        this.explainErrorText.textContent = message;
      }
    }
  }

  public handleCloseExplain(): void {
    void analyticsService.recordEvent({
      eventType: AnalyticsEventType.USER_EXITED_FEATURE,
      feature: 'explain',
      success: true,
    });
    this.explainPanel?.classList.add('hidden');
    this.explainBtn?.focus();
  }

  public async handleExplainModeChange(mode: ExplanationMode): Promise<void> {
    if (this.currentExplainMode === mode) return;
    this.currentExplainMode = mode;
    this.updateExplainModeTabs();
    if (this.currentExplainSelection) {
      await this.fetchAndRenderExplanation();
    }
  }

  private updateExplainModeTabs(): void {
    if (this.explainModeBadge) {
      const labels: Record<ExplanationMode, string> = {
        SIMPLE: 'Simple',
        DETAILED: 'Detailed',
        PLAIN_LANGUAGE: 'Plain Language',
        EXAMPLE: 'Example',
        KEY_POINTS: 'Key Points',
      };
      this.explainModeBadge.textContent = labels[this.currentExplainMode] || this.currentExplainMode;
    }

    this.explainModeTabs.forEach((tab) => {
      const tabMode = tab.getAttribute('data-mode') as ExplanationMode;
      if (tabMode === this.currentExplainMode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  public async fetchAndRenderExplanation(): Promise<void> {
    if (!this.currentExplainSelection) return;

    if (this.explainContentCard) this.explainContentCard.classList.remove('hidden');
    if (this.explainErrorBanner) this.explainErrorBanner.classList.add('hidden');

    if (this.explainMainText) {
      this.explainMainText.textContent = 'Explaining in plain language...';
    }

    // Hide sub-sections while loading
    this.explainWhyBox?.classList.add('hidden');
    this.explainExampleBox?.classList.add('hidden');
    this.explainKeypointsBox?.classList.add('hidden');
    this.explainTermsBox?.classList.add('hidden');

    try {
      const response = await requestExplanation({
        selectedText: this.currentExplainSelection.selectedText,
        context: {
          pageTitle: this.currentExplainSelection.pageTitle,
          sectionHeading: this.currentExplainSelection.sectionHeading,
          targetElementId: this.currentExplainSelection.targetElementId,
          contextBefore: this.currentExplainSelection.contextBefore,
          contextAfter: this.currentExplainSelection.contextAfter,
          elementRole: this.currentExplainSelection.elementRole,
        },
        mode: this.currentExplainMode,
      });

      this.currentExplainResponse = response;
      this.renderExplainResponse(response);

      void analyticsService.recordEvent({
        eventType: AnalyticsEventType.EXPLANATION_REQUESTED,
        feature: 'explain',
        success: true,
        coarseResultCategory: 'SUCCESS',
        stageId: this.currentExplainMode,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Explanation is temporarily unavailable.';
      this.showExplainError(msg);
    }
  }

  public renderExplainResponse(response: ExplainAnythingResponse): void {
    if (this.explainMainText) {
      this.explainMainText.textContent = response.explanation;
    }

    // Why it matters
    if (response.whyItMatters && this.explainWhyBox && this.explainWhyText) {
      this.explainWhyText.textContent = response.whyItMatters;
      this.explainWhyBox.classList.remove('hidden');
    } else {
      this.explainWhyBox?.classList.add('hidden');
    }

    // Example
    if (response.example && this.explainExampleBox && this.explainExampleText) {
      this.explainExampleText.textContent = response.example;
      this.explainExampleBox.classList.remove('hidden');
    } else {
      this.explainExampleBox?.classList.add('hidden');
    }

    // Key points
    if (
      response.keyPoints &&
      response.keyPoints.length > 0 &&
      this.explainKeypointsBox &&
      this.explainKeypointsList
    ) {
      this.explainKeypointsList.innerHTML = '';
      response.keyPoints.forEach((point) => {
        const li = document.createElement('li');
        li.textContent = point;
        this.explainKeypointsList?.appendChild(li);
      });
      this.explainKeypointsBox.classList.remove('hidden');
    } else {
      this.explainKeypointsBox?.classList.add('hidden');
    }

    // Terminology
    if (
      response.terminology &&
      response.terminology.length > 0 &&
      this.explainTermsBox &&
      this.explainTermsList
    ) {
      this.explainTermsList.innerHTML = '';
      response.terminology.forEach((t) => {
        const row = document.createElement('div');
        row.className = 'explain-term-row';
        const strong = document.createElement('strong');
        strong.className = 'explain-term-name';
        strong.textContent = `${t.term}: `;
        row.appendChild(strong);
        row.appendChild(document.createTextNode(t.definition));
        this.explainTermsList?.appendChild(row);
      });
      this.explainTermsBox.classList.remove('hidden');
    } else {
      this.explainTermsBox?.classList.add('hidden');
    }
  }

  public getCurrentExplainResponse(): ExplainAnythingResponse | null {
    return this.currentExplainResponse;
  }

  public getCurrentExplainMode(): ExplanationMode {
    return this.currentExplainMode;
  }

  public isExplainPanelActive(): boolean {
    return this.explainPanel ? !this.explainPanel.classList.contains('hidden') : false;
  }

  // Phase 9 Document Intelligence Methods
  public handleToggleDocumentPanel(): void {
    if (!this.docPanel) return;
    const isHidden = this.docPanel.classList.contains('hidden');
    if (isHidden) {
      this.docPanel.classList.remove('hidden');
      this.docPanel.focus();
    } else {
      this.docPanel.classList.add('hidden');
    }
  }

  public handleCloseDocumentPanel(): void {
    this.docPanel?.classList.add('hidden');
  }

  public handleDocFileSelected(): void {
    const file = this.docFileInput?.files?.[0];
    if (!file) {
      this.selectedDocFile = null;
      this.docSelectedMeta?.classList.add('hidden');
      if (this.docRunBtn) this.docRunBtn.disabled = true;
      return;
    }

    const validation = this.documentClient.validateFile(file);
    if (!validation.valid) {
      this.showDocError(validation.error || 'Invalid document file');
      this.selectedDocFile = null;
      this.docSelectedMeta?.classList.add('hidden');
      if (this.docRunBtn) this.docRunBtn.disabled = true;
      return;
    }

    this.hideDocError();
    this.selectedDocFile = file;
    if (this.docSelectedName) this.docSelectedName.textContent = file.name;
    if (this.docSelectedSize) this.docSelectedSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    this.docSelectedMeta?.classList.remove('hidden');
    if (this.docRunBtn) this.docRunBtn.disabled = false;
  }

  public async handleAnalyzeDocument(): Promise<void> {
    if (!this.selectedDocFile) return;

    if (this.docStatusIndicator) {
      this.docStatusIndicator.textContent = 'Analyzing document...';
      this.docStatusIndicator.classList.remove('hidden');
    }
    if (this.docRunBtn) this.docRunBtn.disabled = true;
    this.hideDocError();

    try {
      const file = this.selectedDocFile;
      const isText = file.name.endsWith('.txt');

      let fileBase64: string | undefined = undefined;
      let textContent: string | undefined = undefined;

      if (isText) {
        textContent = await file.text();
      } else {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileBase64 = btoa(binary);
      }

      // Extract page requirements if page representation is available
      const requirements = this.lastRepresentation
        ? extractPageRequirements(this.lastRepresentation)
        : [];

      const response = await this.documentClient.analyzeDocument({
        filename: file.name,
        fileBase64,
        text: textContent,
        mimeType: file.type || undefined,
        pageRequirements: requirements,
        pageUrl: this.lastMetadata?.url || undefined,
      });

      this.currentDocumentResponse = response;
      this.renderDocumentAnalysis(response);

      void analyticsService.recordEvent({
        eventType: AnalyticsEventType.DOCUMENT_ANALYSIS,
        feature: 'document',
        success: true,
        coarseResultCategory: response.document.documentType.category as any,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze document';
      this.showDocError(msg);
    } finally {
      this.docStatusIndicator?.classList.add('hidden');
      if (this.docRunBtn) this.docRunBtn.disabled = false;
    }
  }

  public renderDocumentAnalysis(res: DocumentAnalysisResponse): void {
    this.currentDocumentResponse = res;
    this.docResultsCard?.classList.remove('hidden');

    const cat = res.document.documentType.category;
    const catFormatted = cat.replace(/_/g, ' ');
    if (this.docTypeBadge) this.docTypeBadge.textContent = catFormatted;
    if (this.docClassCat) this.docClassCat.textContent = catFormatted;
    if (this.docClassConf) {
      this.docClassConf.textContent = `${Math.round(res.document.documentType.confidence * 100)}% match`;
      if (this.userPreferences.documentShowConfidence) {
        this.docClassConf.classList.remove('hidden');
      } else {
        this.docClassConf.classList.add('hidden');
      }
    }
    if (this.docClassReason) this.docClassReason.textContent = res.document.documentType.reason;

    if (res.document.documentType.evidence && this.docEvidenceBox && this.docEvidenceText) {
      this.docEvidenceText.textContent = `"${res.document.documentType.evidence}"`;
      if (this.userPreferences.documentShowEvidence) {
        this.docEvidenceBox.classList.remove('hidden');
      } else {
        this.docEvidenceBox.classList.add('hidden');
      }
    } else {
      this.docEvidenceBox?.classList.add('hidden');
    }

    // Render facts
    const facts = res.extractedFacts || (res.document && (res.document as any).facts) || [];
    if (this.docFactsCount) this.docFactsCount.textContent = String(facts.length);
    if (this.docFactsList) {
      this.docFactsList.innerHTML = '';
      if (facts.length === 0) {
        this.docFactsList.innerHTML = '<p class="doc-empty-hint" style="color:#64748b; font-size:10px;">No structured facts extracted from document.</p>';
      } else {
        for (const fact of facts) {
          const card = document.createElement('div');
          card.className = 'doc-fact-card';
          const sensClass = fact.sensitivity === 'HIGHLY_SENSITIVE' ? 'sens-highly-sensitive' : fact.sensitivity === 'SENSITIVE' ? 'sens-sensitive' : '';
          const displayVal = fact.sensitivity === 'HIGHLY_SENSITIVE' ? redactSensitiveValue(fact.value) : fact.value;
          const evidenceHtml =
            this.userPreferences.documentShowEvidence && fact.evidence
              ? `<div class="doc-fact-evidence">Evidence: "${fact.evidence}" (Page ${fact.sourcePage})</div>`
              : '';
          card.innerHTML = `
            <div class="doc-fact-header">
              <span class="doc-fact-type">${(fact.factType || (fact as any).key || 'FACT').replace(/_/g, ' ')}</span>
              <span class="doc-fact-sens ${sensClass}">${(fact.sensitivity || 'STANDARD').replace(/_/g, ' ')}</span>
            </div>
            <div class="doc-fact-val">${displayVal}</div>
            ${evidenceHtml}
          `;
          this.docFactsList.appendChild(card);
        }
      }
    }

    // Render requirement matches
    if (this.docMatchesCount) this.docMatchesCount.textContent = String(res.requirementMatches.length);
    if (this.docMatchesList) {
      this.docMatchesList.innerHTML = '';
      if (res.requirementMatches.length === 0) {
        this.docMatchesList.innerHTML = '<p class="doc-empty-hint" style="color:#64748b; font-size:10px;">No file requirements detected on this page.</p>';
      } else {
        for (const match of res.requirementMatches) {
          const card = document.createElement('div');
          card.className = 'doc-match-card';
          let statusClass = 'status-nomatch';
          let statusText = 'No Match';
          if (match.matchStatus === 'MATCH') {
            statusClass = 'status-match';
            statusText = 'Likely Match';
          } else if (match.matchStatus === 'PARTIAL_MATCH') {
            statusClass = 'status-partial';
            statusText = 'Partial Match';
          } else if (match.matchStatus === 'AMBIGUOUS') {
            statusClass = 'status-ambiguous';
            statusText = 'Ambiguous / Mismatch';
          } else if (match.matchStatus === 'NOT_ENOUGH_EVIDENCE') {
            statusClass = 'status-insufficient';
            statusText = 'Not Enough Evidence';
          }

          let warningsHtml = '';
          if (match.warnings && match.warnings.length > 0) {
            warningsHtml = `<div class="doc-match-warn">⚠️ ${match.warnings.join('; ')}</div>`;
          }

          let uploadTargetHtml = '';
          if (match.suggestedUploadFieldId) {
            uploadTargetHtml = `<div class="doc-match-target-callout">Suggested upload field: #${match.suggestedUploadFieldId} (manual upload selection required)</div>`;
          }

          card.innerHTML = `
            <div class="doc-match-header">
              <span class="doc-match-req">${match.requirementDescription}</span>
              <span class="doc-match-status-pill ${statusClass}">${statusText}</span>
            </div>
            <p class="doc-match-reason">${match.reason}</p>
            ${warningsHtml}
            ${uploadTargetHtml}
          `;
          this.docMatchesList.appendChild(card);
        }
      }
    }
  }

  public showDocError(message: string): void {
    if (this.docErrorText) this.docErrorText.textContent = message;
    this.docErrorBanner?.classList.remove('hidden');
  }

  public hideDocError(): void {
    this.docErrorBanner?.classList.add('hidden');
  }

  public getCurrentDocumentResponse(): DocumentAnalysisResponse | null {
    return this.currentDocumentResponse;
  }

  public isDocumentPanelActive(): boolean {
    return this.docPanel ? !this.docPanel.classList.contains('hidden') : false;
  }

  // ==========================================================================
  // Phase 10 User Preferences Operations
  // ==========================================================================

  public async loadAndApplyPreferences(): Promise<void> {
    this.userPreferences = await PreferencesStorage.getPreferences();
    this.syncPreferenceInputs();
    applyVisualPreferences(this.userPreferences, document);
    applyLocalization(this.userPreferences, document);
  }

  private syncPreferenceInputs(): void {
    if (this.prefLanguageSelect) this.prefLanguageSelect.value = this.userPreferences.language;
    if (this.prefExplanationSelect) this.prefExplanationSelect.value = this.userPreferences.explanationMode;
    if (this.prefHighContrastCb) this.prefHighContrastCb.checked = this.userPreferences.highContrast;
    if (this.prefLargerTextCb) this.prefLargerTextCb.checked = this.userPreferences.largerText;
    if (this.prefReducedDensityCb) this.prefReducedDensityCb.checked = this.userPreferences.reducedDensity;
    if (this.prefGuidedWhyCb) this.prefGuidedWhyCb.checked = this.userPreferences.guidedShowWhy;
    if (this.prefGuidedWarningsCb) this.prefGuidedWarningsCb.checked = this.userPreferences.guidedShowWarnings;
    if (this.prefGuidedProgressCb) this.prefGuidedProgressCb.checked = this.userPreferences.guidedShowProgress;
    if (this.prefConfirmVerbositySelect) this.prefConfirmVerbositySelect.value = this.userPreferences.confirmationVerbosity;
    if (this.prefDocEvidenceCb) this.prefDocEvidenceCb.checked = this.userPreferences.documentShowEvidence;
    if (this.prefDocConfidenceCb) this.prefDocConfidenceCb.checked = this.userPreferences.documentShowConfidence;
    if (this.prefAnalyticsEnabledCb) this.prefAnalyticsEnabledCb.checked = this.userPreferences.analyticsEnabled !== false;
  }

  public async handlePreferenceChange(): Promise<void> {
    const updated: UserPreferences = {
      version: this.userPreferences.version,
      language: (this.prefLanguageSelect?.value === 'hi' ? 'hi' : 'en'),
      explanationMode: (this.prefExplanationSelect?.value as ExplanationComplexity) || 'STANDARD',
      highContrast: Boolean(this.prefHighContrastCb?.checked),
      largerText: Boolean(this.prefLargerTextCb?.checked),
      reducedDensity: Boolean(this.prefReducedDensityCb?.checked),
      guidedShowWhy: Boolean(this.prefGuidedWhyCb?.checked),
      guidedShowWarnings: Boolean(this.prefGuidedWarningsCb?.checked),
      guidedShowProgress: Boolean(this.prefGuidedProgressCb?.checked),
      confirmationVerbosity: (this.prefConfirmVerbositySelect?.value as 'STANDARD' | 'DETAILED') || 'STANDARD',
      documentShowEvidence: Boolean(this.prefDocEvidenceCb?.checked),
      documentShowConfidence: Boolean(this.prefDocConfidenceCb?.checked),
      analyticsEnabled: Boolean(this.prefAnalyticsEnabledCb?.checked !== false),
    };

    await PreferencesStorage.savePreferences(updated);
    this.userPreferences = updated;
    applyVisualPreferences(this.userPreferences, document);
    applyLocalization(this.userPreferences, document);

    if (this.prefSavedToast) {
      this.prefSavedToast.classList.remove('hidden');
      setTimeout(() => {
        this.prefSavedToast?.classList.add('hidden');
      }, 2000);
    }

    if (this.currentGuidedResponse && this.guidedPanel && !this.guidedPanel.classList.contains('hidden')) {
      this.renderCurrentStep();
    }
    if (this.currentDocumentResponse && this.docResultsCard && !this.docResultsCard.classList.contains('hidden')) {
      this.renderDocumentAnalysis(this.currentDocumentResponse);
    }
    if (this.explainPanel && !this.explainPanel.classList.contains('hidden')) {
      if (this.userPreferences.explanationMode === 'DETAILED') {
        this.currentExplainMode = 'DETAILED';
      } else if (this.userPreferences.explanationMode === 'SIMPLE') {
        this.currentExplainMode = 'SIMPLE';
      } else {
        this.currentExplainMode = 'PLAIN_LANGUAGE';
      }
      this.updateExplainModeTabs();
      if (this.currentExplainSelection) {
        void this.fetchAndRenderExplanation();
      }
    }
  }

  public async handleResetPreferences(): Promise<void> {
    this.userPreferences = await PreferencesStorage.resetPreferences();
    this.syncPreferenceInputs();
    applyVisualPreferences(this.userPreferences, document);
    applyLocalization(this.userPreferences, document);

    if (this.prefSavedToast) {
      this.prefSavedToast.classList.remove('hidden');
      setTimeout(() => {
        this.prefSavedToast?.classList.add('hidden');
      }, 2000);
    }

    if (this.currentGuidedResponse && this.guidedPanel && !this.guidedPanel.classList.contains('hidden')) {
      this.renderCurrentStep();
    }
    if (this.currentDocumentResponse && this.docResultsCard && !this.docResultsCard.classList.contains('hidden')) {
      this.renderDocumentAnalysis(this.currentDocumentResponse);
    }
    if (this.explainPanel && !this.explainPanel.classList.contains('hidden')) {
      this.currentExplainMode = 'PLAIN_LANGUAGE';
      this.updateExplainModeTabs();
      if (this.currentExplainSelection) {
        void this.fetchAndRenderExplanation();
      }
    }
  }

  public handleTogglePreferencesPanel(): void {
    if (!this.preferencesPanel) return;
    const isHidden = this.preferencesPanel.classList.contains('hidden');
    if (isHidden) {
      this.preferencesPanel.classList.remove('hidden');
      this.preferencesPanel.focus();
    } else {
      this.preferencesPanel.classList.add('hidden');
    }
  }

  public handleClosePreferencesPanel(): void {
    this.preferencesPanel?.classList.add('hidden');
    this.preferencesBtn?.focus();
  }

  public getUserPreferences(): UserPreferences {
    return this.userPreferences;
  }

  public isPreferencesPanelActive(): boolean {
    return this.preferencesPanel ? !this.preferencesPanel.classList.contains('hidden') : false;
  }

  // =========================================================================
  // Phase 12 Completion Checker Handlers
  // =========================================================================

  public async handleToggleCompletionPanel(): Promise<void> {
    if (!this.completionPanel) return;
    const isHidden = this.completionPanel.classList.contains('hidden');
    if (isHidden) {
      this.completionPanel.classList.remove('hidden');
      this.completionPanel.focus();
      await this.handleRunCompletionEvaluation();
    } else {
      this.completionPanel.classList.add('hidden');
    }
  }

  public handleCloseCompletionPanel(): void {
    this.completionPanel?.classList.add('hidden');
    this.completionBtn?.focus();
  }

  public async handleRunCompletionEvaluation(): Promise<void> {
    if (this.completionStatusIndicator) {
      this.completionStatusIndicator.classList.remove('hidden');
    }

    const docMatches = this.currentDocumentResponse?.requirementMatches || [];
    let currentStageIndex = 0;
    if (this.currentGuidedResponse && typeof this.currentStepIndex === 'number') {
      currentStageIndex = Math.min(Math.max(this.currentStepIndex, 0), 7);
    }

    let evaluatedResult: CompletionResult | null = null;

    if (this.activeTabId && chrome.tabs?.sendMessage) {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(
            this.activeTabId!,
            createMessage(MessageType.CHECK_COMPLETION, {
              documentMatches: docMatches,
              currentStageIndex,
            }),
            (res) => {
              if (chrome.runtime.lastError || !res) {
                resolve(null);
              } else {
                resolve(res);
              }
            }
          );
        });

        if (response && response.payload && response.payload.success && response.payload.result) {
          evaluatedResult = response.payload.result;
        }
      } catch {
        // Fall back to local evaluation
      }
    }

    // Local evaluation fallback if needed
    if (!evaluatedResult) {
      if (this.lastRepresentation) {
        evaluatedResult = evaluateCompletion(
          this.lastRepresentation,
          {},
          docMatches,
          currentStageIndex
        );
      }
    }

    if (this.completionStatusIndicator) {
      this.completionStatusIndicator.classList.add('hidden');
    }

    if (evaluatedResult) {
      this.currentCompletionResult = evaluatedResult;
      this.renderCompletionResult(evaluatedResult);

      void analyticsService.recordEvent({
        eventType: AnalyticsEventType.COMPLETION_CHECK,
        feature: 'completion',
        success: true,
        coarseResultCategory: evaluatedResult.overallStatus as any,
        countMetrics: {
          blockingIssues: evaluatedResult.blockingIssues.length,
          warnings: evaluatedResult.warnings.length,
          percent: evaluatedResult.completionPercent,
        },
      });

      if (evaluatedResult.overallStatus === 'COMPLETE') {
        void analyticsService.recordEvent({
          eventType: AnalyticsEventType.COMPLETION_ACHIEVED,
          feature: 'completion',
          success: true,
        });
      } else if (evaluatedResult.overallStatus === 'BLOCKED') {
        void analyticsService.recordEvent({
          eventType: AnalyticsEventType.COMPLETION_BLOCKED,
          feature: 'completion',
          success: true,
        });
      }
    }
  }

  public renderCompletionResult(result: CompletionResult): void {
    // 1. Overall badge
    if (this.completionOverallBadge) {
      this.completionOverallBadge.textContent = result.overallStatus;
      this.completionOverallBadge.className = 'completion-status-badge';
      if (result.overallStatus === 'COMPLETE') {
        this.completionOverallBadge.classList.add('badge-complete');
      } else if (result.overallStatus === 'INCOMPLETE') {
        this.completionOverallBadge.classList.add('badge-incomplete');
      } else {
        this.completionOverallBadge.classList.add('badge-blocked');
      }
    }

    // 2. Progress percentage
    if (this.completionPercentLabel) {
      this.completionPercentLabel.textContent = `${result.completionPercent}%`;
    }
    if (this.completionProgressFill) {
      this.completionProgressFill.style.width = `${result.completionPercent}%`;
    }
    if (this.completionProgressContainer) {
      this.completionProgressContainer.setAttribute('aria-valuenow', String(result.completionPercent));
    }

    // 3. Stage & Status labels
    if (this.completionCurrentStage) {
      this.completionCurrentStage.textContent = result.currentStageName || `Stage ${result.currentStageIndex + 1}`;
    }
    if (this.completionStatusLabel) {
      this.completionStatusLabel.textContent = result.overallStatus;
    }

    // 4. Render Stages List
    if (this.completionStagesList) {
      this.completionStagesList.innerHTML = '';
      result.stageSummaries.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'completion-stage-card';
        const isCurrent = s.stageIndex === result.currentStageIndex;

        card.innerHTML = `
          <div class="stage-name-col">
            <span class="stage-title">${isCurrent ? '▶ ' : ''}${s.stageName}</span>
            <span class="stage-req-counts">${s.completedRequirements}/${s.totalRequirements} items satisfied${s.blockingIssuesCount > 0 ? ` (${s.blockingIssuesCount} blocking)` : ''}</span>
          </div>
          <span class="stage-status-pill ${s.status === 'COMPLETE' ? 'badge-complete' : 'badge-incomplete'}">${s.status}</span>
        `;
        this.completionStagesList?.appendChild(card);
      });
    }

    // 5. Render Blocking Issues
    if (this.completionBlockingCount) {
      this.completionBlockingCount.textContent = String(result.blockingIssues.length);
    }
    if (this.completionBlockingList) {
      this.completionBlockingList.innerHTML = '';
      if (result.blockingIssues.length === 0) {
        this.completionBlockingList.innerHTML = '<p class="empty-state-notice">Zero blocking issues found.</p>';
      } else {
        result.blockingIssues.forEach((issue) => {
          this.renderIssueCard(issue, this.completionBlockingList!, 'issue-blocking');
        });
      }
    }

    // 6. Render Warnings
    if (this.completionWarningsCount) {
      this.completionWarningsCount.textContent = String(result.warnings.length);
    }
    if (this.completionWarningsList) {
      this.completionWarningsList.innerHTML = '';
      if (result.warnings.length === 0) {
        this.completionWarningsList.innerHTML = '<p class="empty-state-notice">Zero non-blocking warnings.</p>';
      } else {
        result.warnings.forEach((issue) => {
          this.renderIssueCard(issue, this.completionWarningsList!, 'issue-warning');
        });
      }
    }

    // 7. Render Supporting Documents
    if (this.completionDocsCount) {
      this.completionDocsCount.textContent = String(result.documentRequirements.length);
    }
    if (this.completionDocsList) {
      this.completionDocsList.innerHTML = '';
      if (result.documentRequirements.length === 0) {
        this.completionDocsList.innerHTML = '<p class="empty-state-notice">No document requirements evaluated yet.</p>';
      } else {
        result.documentRequirements.forEach((doc) => {
          const card = document.createElement('div');
          const isSatisfied = doc.isSatisfied;
          card.className = `doc-req-card ${isSatisfied ? 'doc-match' : 'doc-mismatch'}`;

          let confHtml = '';
          if (this.userPreferences.documentShowConfidence && doc.confidence !== undefined && doc.confidence !== null) {
            confHtml = `<span class="doc-conf-pill">${Math.round(doc.confidence * 100)}% Match</span>`;
          }

          let evidenceHtml = '';
          if (this.userPreferences.documentShowEvidence && doc.evidence) {
            evidenceHtml = `<blockquote class="doc-evidence-quote">"${doc.evidence}"</blockquote>`;
          }

          card.innerHTML = `
            <div class="issue-header">
              <span class="issue-title">${doc.title} (${doc.documentType})</span>
              <span class="issue-badge ${isSatisfied ? 'badge-complete' : 'badge-incomplete'}">${doc.matchStatus}</span>
            </div>
            ${doc.documentName ? `<div class="issue-row"><span class="issue-label">File:</span><span>${doc.documentName}</span></div>` : ''}
            ${confHtml}
            <div class="issue-row"><span class="issue-label">Status:</span><span>${doc.reason}</span></div>
            ${evidenceHtml}
            <div class="issue-action-row">
              <span class="issue-label">Next Step:</span>
              <span>${doc.suggestedNextStep}</span>
            </div>
          `;
          this.completionDocsList?.appendChild(card);
        });
      }
    }

    // 8. Render Consistency Checks
    if (this.completionConsistencyCount) {
      this.completionConsistencyCount.textContent = String(result.consistencyChecks.length);
    }
    if (this.completionConsistencyList) {
      this.completionConsistencyList.innerHTML = '';
      if (result.consistencyChecks.length === 0) {
        this.completionConsistencyList.innerHTML = '<p class="empty-state-notice">No consistency checks evaluated.</p>';
      } else {
        result.consistencyChecks.forEach((check) => {
          const card = document.createElement('div');
          card.className = `completion-issue-card ${check.status === 'CONSISTENT' ? 'issue-complete' : check.isBlocking ? 'issue-blocking' : 'issue-warning'}`;
          card.innerHTML = `
            <div class="issue-header">
              <span class="issue-title">${check.ruleName}</span>
              <span class="issue-badge ${check.status === 'CONSISTENT' ? 'badge-complete' : 'badge-incomplete'}">${check.status}</span>
            </div>
            <div class="issue-body">
              <span>${check.explanation}</span>
              ${check.fieldIds.length > 0 ? `<div class="issue-row"><span class="issue-label">Fields:</span><span>${check.fieldIds.join(', ')}</span></div>` : ''}
            </div>
          `;
          this.completionConsistencyList?.appendChild(card);
        });
      }
    }

    // 9. Render Completed Items
    if (this.completionCompletedCount) {
      this.completionCompletedCount.textContent = String(result.completedRequirements.length);
    }
    if (this.completionCompletedList) {
      this.completionCompletedList.innerHTML = '';
      if (result.completedRequirements.length === 0) {
        this.completionCompletedList.innerHTML = '<p class="empty-state-notice">No requirements completed yet.</p>';
      } else {
        result.completedRequirements.forEach((req) => {
          const item = document.createElement('div');
          item.className = 'completed-item';
          item.style.fontSize = '11px';
          item.style.color = '#34d399';
          item.style.padding = '2px 0';
          item.textContent = `✓ ${req.title} (${req.type.replace('_', ' ')})`;
          this.completionCompletedList?.appendChild(item);
        });
      }
    }
  }

  private renderIssueCard(issue: CompletionRequirement, container: HTMLElement, cardClass: string): void {
    const card = document.createElement('div');
    card.className = `completion-issue-card ${cardClass}`;

    const whereDesc = issue.stageName || issue.stageId || (issue.targetElementId ? `Element ${issue.targetElementId}` : 'Form');

    card.innerHTML = `
      <div class="issue-header">
        <span class="issue-title">${issue.title}</span>
        <span class="issue-badge ${issue.isBlocking ? 'badge-blocked' : 'badge-incomplete'}">${issue.type.replace('_', ' ')}</span>
      </div>
      <div class="issue-body">
        <div class="issue-row"><span class="issue-label">WHAT:</span><span>${issue.description}</span></div>
        <div class="issue-row"><span class="issue-label">WHY:</span><span>${issue.reason}</span></div>
        <div class="issue-row"><span class="issue-label">WHERE:</span><span>${whereDesc}</span></div>
      </div>
      <div class="issue-action-row">
        <div><strong style="color: #94a3b8;">ACTION:</strong> <span>${issue.suggestedNextStep}</span></div>
        ${issue.targetElementId ? `<button type="button" class="show-on-page-btn" data-target-id="${issue.targetElementId}">Show on page</button>` : ''}
      </div>
    `;

    if (issue.targetElementId) {
      const showBtn = card.querySelector('.show-on-page-btn');
      showBtn?.addEventListener('click', () => {
        this.handleShowOnPage(issue.targetElementId!);
      });
    }

    container.appendChild(card);
  }

  public handleShowOnPage(targetElementId: string): void {
    if (!targetElementId) return;

    if (this.activeTabId && chrome.tabs?.sendMessage) {
      chrome.tabs.sendMessage(
        this.activeTabId,
        createMessage(MessageType.HIGHLIGHT_ELEMENT, { targetElementId }),
        (response) => {
          if (!response || !response.success) {
            console.warn(`[ACCESSOS] Target element '${targetElementId}' not found on page.`);
          }
        }
      );
    }
  }

  public getCurrentCompletionResult(): CompletionResult | null {
    return this.currentCompletionResult;
  }

  public isCompletionPanelActive(): boolean {
    return this.completionPanel ? !this.completionPanel.classList.contains('hidden') : false;
  }

  // =========================================================================
  // Phase 13 Local Analytics Handlers
  // =========================================================================

  public async handleToggleAnalyticsPanel(): Promise<void> {
    if (!this.analyticsPanel) return;
    const isHidden = this.analyticsPanel.classList.contains('hidden');
    if (isHidden) {
      if (this.completionPanel) this.completionPanel.classList.add('hidden');
      if (this.preferencesPanel) this.preferencesPanel.classList.add('hidden');
      if (this.docPanel) this.docPanel.classList.add('hidden');
      if (this.explainPanel) this.explainPanel.classList.add('hidden');
      if (this.guidedPanel) this.guidedPanel.classList.add('hidden');

      this.analyticsPanel.classList.remove('hidden');
      this.analyticsPanel.focus();
      await this.handleRefreshAnalytics();
    } else {
      this.analyticsPanel.classList.add('hidden');
    }
  }

  public handleCloseAnalyticsPanel(): void {
    this.analyticsPanel?.classList.add('hidden');
    this.analyticsBtn?.focus();
  }

  public async handleRefreshAnalytics(): Promise<void> {
    const aggregates = await analyticsService.getAggregates();
    const session = analyticsService.getSession();
    this.renderAnalyticsDashboard(aggregates, session);
  }

  public async handleClearAnalytics(): Promise<void> {
    await analyticsService.clearAnalytics();
    await this.handleRefreshAnalytics();
  }

  public renderAnalyticsDashboard(aggregates: AnalyticsAggregates, session: { sessionId: string; eventCount: number }): void {
    if (this.analyticsEventsBadge) {
      this.analyticsEventsBadge.textContent = `${aggregates.totalEvents} Events`;
    }
    if (this.analyticsSessionId) {
      this.analyticsSessionId.textContent = session.sessionId;
    }
    if (this.analyticsSessionEvents) {
      this.analyticsSessionEvents.textContent = String(session.eventCount);
    }

    // Accessibility
    if (this.statA11yAnalyses) this.statA11yAnalyses.textContent = String(aggregates.accessibility.analyses);
    if (this.statA11yBarriers) this.statA11yBarriers.textContent = String(aggregates.accessibility.totalBarriers);
    if (this.statA11yScore) {
      this.statA11yScore.textContent = aggregates.accessibility.scoreCount > 0 ? `${aggregates.accessibility.averageScore}/100` : '--';
    }
    if (this.statA11yCrit) this.statA11yCrit.textContent = String(aggregates.accessibility.barriers.critical);
    if (this.statA11yHigh) this.statA11yHigh.textContent = String(aggregates.accessibility.barriers.high);
    if (this.statA11yMed) this.statA11yMed.textContent = String(aggregates.accessibility.barriers.medium);
    if (this.statA11yLow) this.statA11yLow.textContent = String(aggregates.accessibility.barriers.low);

    // Guided Mode
    if (this.statGuidedStarted) this.statGuidedStarted.textContent = String(aggregates.guidedMode.started);
    if (this.statGuidedSteps) this.statGuidedSteps.textContent = String(aggregates.guidedMode.stepsCompleted);
    if (this.statGuidedRate) this.statGuidedRate.textContent = `${aggregates.guidedMode.completionRate}%`;

    // Explain Anything
    if (this.statExplainRequests) this.statExplainRequests.textContent = String(aggregates.explainAnything.requests);
    if (this.statExplainSimple) this.statExplainSimple.textContent = String(aggregates.explainAnything.modes.SIMPLE);
    if (this.statExplainStandard) this.statExplainStandard.textContent = String(aggregates.explainAnything.modes.STANDARD);

    // Documents
    if (this.statDocsAnalyzed) this.statDocsAnalyzed.textContent = String(aggregates.documents.analyzed);
    if (this.statDocsMatches) this.statDocsMatches.textContent = String(aggregates.documents.matches);
    if (this.statDocsAmbiguous) this.statDocsAmbiguous.textContent = String(aggregates.documents.ambiguous);

    // Completion
    if (this.statCompChecks) this.statCompChecks.textContent = String(aggregates.completion.checks);
    if (this.statCompComplete) this.statCompComplete.textContent = String(aggregates.completion.complete);
    if (this.statCompBlockers) this.statCompBlockers.textContent = String(aggregates.completion.totalBlockers);

    // Interaction Safety
    if (this.statSafeConfirmed) this.statSafeConfirmed.textContent = String(aggregates.interactions.confirmed);
    if (this.statSafeBlocked) this.statSafeBlocked.textContent = String(aggregates.interactions.blocked);
    if (this.statSafeCancelled) this.statSafeCancelled.textContent = String(aggregates.interactions.cancelled);
  }

  public isAnalyticsPanelActive(): boolean {
    return this.analyticsPanel ? !this.analyticsPanel.classList.contains('hidden') : false;
  }
}


if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
  });
}
