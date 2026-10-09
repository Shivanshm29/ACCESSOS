/**
 * ACCESSOS Core Types
 * Foundational domain and state definitions for the browser extension.
 */

export * from './representation';

export type BarrierCategory =
  | 'accessibility'
  | 'language'
  | 'literacy'
  | 'digital_navigation';

export type AssistantMode = 'idle' | 'inspecting' | 'guided';

export type PopupState =
  | 'IDLE'
  | 'ANALYZING'
  | 'SUCCESS'
  | 'UNSUPPORTED_PAGE'
  | 'ERROR';

export interface PageMetadata {
  title: string;
  url: string;
  hostname: string;
  pathname: string;
  pageType: 'webpage';
  interactiveElementCount: number;
}

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  readingAssistanceEnabled: boolean;
  simplifiedLanguageEnabled: boolean;
  highContrastEnabled: boolean;
  textSizeDelta: number;
}

export interface ExtensionState {
  isActive: boolean;
  mode: AssistantMode;
  activeTabId?: number;
}
