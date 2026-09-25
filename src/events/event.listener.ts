import { consola } from "consola";

type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private listeners: Map<string, EventCallback[]> = new Map();

  // S'abonner à un événement
  public on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    consola.debug(`[EventEmitter] Listener added for event: "${event}"`);
  }

  // Déclencher un événement
  public emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) {
      consola.debug(`[EventEmitter] Emitted event "${event}", but no listeners found.`);
      return;
    }
    
    consola.debug(`[EventEmitter] Emitting event: "${event}" to ${this.listeners.get(event)!.length} listener(s)`);
    for (const callback of this.listeners.get(event)!) {
      callback(...args);
    }
  }

  // Se désabonner
  public off(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) return;
    const initialLength = this.listeners.get(event)!.length;
    const filtered = this.listeners.get(event)!.filter(cb => cb !== callback);
    this.listeners.set(event, filtered);
    
    consola.debug(`[EventEmitter] Listener removed for event: "${event}" (Remaining: ${filtered.length}/${initialLength})`);
  }
}