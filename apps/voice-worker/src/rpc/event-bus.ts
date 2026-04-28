import { EventEmitter } from 'node:events';

class EventBus extends EventEmitter {
  emitEvent(event: string, data: unknown): void {
    this.emit('event', event, data);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(64);
