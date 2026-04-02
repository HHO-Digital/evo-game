import { EventBus } from './EventBus';

export abstract class SubsystemBase<TState> {
  protected state: TState;

  constructor(
    protected readonly eventBus: EventBus,
    initialState: TState,
  ) {
    this.state = initialState;
  }

  abstract initialize(): void;
  abstract update(tickCount: number): void;
  abstract dispose(): void;

  getState(): Readonly<TState> {
    return this.state;
  }

  setState(state: TState): void {
    this.state = state;
  }

  protected emitStateChange(): void {
    this.eventBus.emit('stateChanged', {
      subsystem: this.constructor.name,
      state: this.state,
    });
  }
}
