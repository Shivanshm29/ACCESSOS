/**
 * ACCESSOS Memory & Resource Safety Manager (Phase 15 Production Hardening)
 * Features:
 * 1. Bounded collections (BoundedMap with FIFO/LRU eviction to prevent unbounded growth).
 * 2. Event listener registry with centralized cleanup.
 * 3. Timer registry with guaranteed cancellation.
 * 4. AbortController registry for in-flight request cancellation.
 * 5. Lifecycle teardown hooks.
 */

export class BoundedMap<K, V> {
  private map: Map<K, V> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 100) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  public set(key: K, value: V): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict oldest entry (FIFO)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
    return this;
  }

  public get(key: K): V | undefined {
    return this.map.get(key);
  }

  public has(key: K): boolean {
    return this.map.has(key);
  }

  public delete(key: K): boolean {
    return this.map.delete(key);
  }

  public clear(): void {
    this.map.clear();
  }

  public get size(): number {
    return this.map.size;
  }

  public entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }
}

export interface RegisteredListener {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

export class ListenerRegistry {
  private listeners: RegisteredListener[] = [];

  public add(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  public cleanupAll(): void {
    for (const item of this.listeners) {
      try {
        item.target.removeEventListener(item.type, item.listener, item.options);
      } catch {
        // Suppress cleanup errors if target was destroyed
      }
    }
    this.listeners = [];
  }

  public get count(): number {
    return this.listeners.length;
  }
}

export class TimerRegistry {
  private timeoutIds: Set<number | NodeJS.Timeout> = new Set();
  private intervalIds: Set<number | NodeJS.Timeout> = new Set();

  public setTimeout(handler: () => void, timeoutMs: number): number | NodeJS.Timeout {
    const id = setTimeout(() => {
      this.timeoutIds.delete(id);
      handler();
    }, timeoutMs);
    this.timeoutIds.add(id);
    return id;
  }

  public setInterval(handler: () => void, intervalMs: number): number | NodeJS.Timeout {
    const id = setInterval(handler, intervalMs);
    this.intervalIds.add(id);
    return id;
  }

  public clearTimeout(id: number | NodeJS.Timeout): void {
    clearTimeout(id as number);
    this.timeoutIds.delete(id);
  }

  public clearInterval(id: number | NodeJS.Timeout): void {
    clearInterval(id as number);
    this.intervalIds.delete(id);
  }

  public clearAll(): void {
    for (const id of this.timeoutIds) {
      clearTimeout(id as number);
    }
    this.timeoutIds.clear();

    for (const id of this.intervalIds) {
      clearInterval(id as number);
    }
    this.intervalIds.clear();
  }

  public get activeCount(): number {
    return this.timeoutIds.size + this.intervalIds.size;
  }
}

export class AbortRegistry {
  private controllers: Set<AbortController> = new Set();

  public create(): AbortController {
    const controller = new AbortController();
    this.controllers.add(controller);
    return controller;
  }

  public abortAndRemove(controller: AbortController, reason?: string): void {
    if (this.controllers.has(controller)) {
      try {
        controller.abort(reason);
      } catch {
        // Fallback for environments lacking AbortSignal.abort(reason)
      }
      this.controllers.delete(controller);
    }
  }

  public abortAll(reason: string = 'Teardown or navigation'): void {
    for (const controller of this.controllers) {
      try {
        controller.abort(reason);
      } catch {
        // ignore
      }
    }
    this.controllers.clear();
  }

  public get activeCount(): number {
    return this.controllers.size;
  }
}

export class ResourceManager {
  public listeners = new ListenerRegistry();
  public timers = new TimerRegistry();
  public requests = new AbortRegistry();

  /**
   * Cleans up all registered listeners, timers, and aborts pending requests.
   */
  public teardown(): void {
    this.listeners.cleanupAll();
    this.timers.clearAll();
    this.requests.abortAll('Resource manager teardown');
  }
}

export const globalResourceManager = new ResourceManager();
