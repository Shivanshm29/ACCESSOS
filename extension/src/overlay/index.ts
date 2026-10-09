/**
 * ACCESSOS Guided Overlay Manager Foundation
 * Handles safe visual highlighting and step-by-step guidance overlays.
 */

export class OverlayManager {
  private overlayContainer: HTMLElement | null = null;

  public isAttached(): boolean {
    return this.overlayContainer !== null && document.body.contains(this.overlayContainer);
  }

  public mount(): void {
    if (this.isAttached()) {
      return;
    }
    const container = document.createElement('div');
    container.id = 'accessos-overlay-root';
    container.className = 'accessos-overlay-root';
    document.body.appendChild(container);
    this.overlayContainer = container;
  }

  public unmount(): void {
    if (this.overlayContainer && this.overlayContainer.parentElement) {
      this.overlayContainer.parentElement.removeChild(this.overlayContainer);
    }
    this.overlayContainer = null;
  }
}
