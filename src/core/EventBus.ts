export interface GameEvents {
  // Core lifecycle
  'tick': { tickCount: number };
  'stateChanged': { subsystem: string; state: unknown };

  // Era events
  'era:advance': { from: string; to: string };
  'era:milestoneCompleted': { eraId: string; milestoneId: string };
  'era:blendChanged': { progress: number; currentEra: string; nextEra: string };

  // Resource events
  'resource:changed': { resourceId: string; amount: number; delta: number };
  'resource:depleted': { resourceId: string };

  // Population events
  'population:changed': { total: number; delta: number };
  'population:roleAssigned': { role: string; count: number };

  // Tech events
  'tech:researched': { techId: string };
  'tech:started': { techId: string };
  'tech:available': { techId: string };

  // Character events
  'character:levelUp': { stat: string; newValue: number };
  'character:xpGained': { amount: number; source: string };

  // Environment events
  'environment:seasonChanged': { season: string };
  'environment:weatherChanged': { weather: string };
  'environment:dayNightChanged': { isDay: boolean };

  // Game events (historical)
  'gameEvent:triggered': { eventId: string };
  'gameEvent:choiceMade': { eventId: string; choiceId: string };

  // NPC & Lifespan events
  'npc:born': { npcId: string; parentId?: string };
  'npc:died': { npcId: string; age: number };
  'npc:stageChanged': { npcId: string; from: string; to: string };
  'npc:relationshipChanged': { fromId: string; toId: string; type: string; bond: number };
  'succession:triggered': { candidates: number };
  'succession:completed': { newPlayerId: string; generation: number };

  // UI events
  'ui:panelOpened': { panelId: string };
  'ui:panelClosed': { panelId: string };
  'ui:speedChanged': { speed: number };

  // Save/Load
  'game:saved': { slotId: string };
  'game:loaded': { slotId: string };
  'game:paused': Record<string, never>;
  'game:resumed': Record<string, never>;
}

type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`EventBus error in handler for "${String(event)}":`, err);
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}
