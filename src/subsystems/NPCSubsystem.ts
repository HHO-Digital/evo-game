import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type {
  NPCDefinition,
  NPCRelationship,
  NPCTraits,
  LifeStage,
  RelationshipType,
  SuccessionCandidate,
  LifespanConfig,
  NPCRole,
  EraId,
} from '@/types';
import { ERA_LIFESPAN } from '@/types/npc';
import { clamp, randomInt, randomRange, chance } from '@/utils/math';

// ── Name pools for NPC generation ─────────────────────────────────────

const DAWN_NAMES = [
  'Asha', 'Kael', 'Nuri', 'Thane', 'Lyra', 'Orin', 'Sela', 'Rowan',
  'Ember', 'Flint', 'Brook', 'Wren', 'Sage', 'Thorn', 'Dawn', 'Cliff',
  'Moss', 'Fern', 'Stone', 'Blaze', 'Reed', 'Heath', 'Lark', 'Vale',
];

const BACKSTORIES = [
  'Born during a harsh winter, they learned resilience early.',
  'The eldest child, always looking out for others.',
  'A natural explorer, always wandering beyond the camp.',
  'Quiet and observant, they notice what others miss.',
  'Strong and determined, they never back down.',
  'Kind-hearted and gentle, trusted by the whole tribe.',
  'Quick-witted and clever, always finding solutions.',
  'Born under strange lights in the sky, seen as special.',
];

// ── State ─────────────────────────────────────────────────────────────

export interface NPCSubsystemState {
  npcs: Map<string, NPCDefinition>;
  playerCharacterId: string;
  playerAge: number;
  playerLifeStage: LifeStage;
  successionPending: boolean;
  successionCandidates: SuccessionCandidate[];
  generationCount: number;
  retiredPlayers: string[];
}

export class NPCSubsystem extends SubsystemBase<NPCSubsystemState> {
  private unsubscribers: (() => void)[] = [];
  private currentEra: EraId = 'dawn';
  private nextNpcId = 1;
  private yearAccumulator = 0;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      npcs: new Map(),
      playerCharacterId: '',
      playerAge: 25,
      playerLifeStage: 'adult',
      successionPending: false,
      successionCandidates: [],
      generationCount: 1,
      retiredPlayers: [],
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    // Create the initial player character NPC entry
    const player = this.createNPC({
      name: 'Elder',
      role: 'elder',
      age: 25,
      isPlayable: true,
    });
    this.state.playerCharacterId = player.id;

    // Create initial tribe NPCs (a small family/group)
    const partner = this.createNPC({
      name: this.randomName(),
      role: 'tribemember',
      age: 23,
      isPlayable: true,
    });
    this.addRelationship(player.id, partner.id, 'partner', 80);

    // A child
    const child = this.createNPC({
      name: this.randomName(),
      role: 'child',
      age: 6,
      isPlayable: false, // too young
    });
    player.childrenIds.push(child.id);
    partner.childrenIds.push(child.id);
    child.parentId = player.id;
    this.addRelationship(player.id, child.id, 'family', 90);
    this.addRelationship(partner.id, child.id, 'family', 90);

    // A few other tribe members
    for (let i = 0; i < 3; i++) {
      const npc = this.createNPC({
        name: this.randomName(),
        role: 'tribemember',
        age: randomInt(16, 40),
        isPlayable: true,
      });
      this.addRelationship(player.id, npc.id, 'friend', randomInt(30, 60));
    }

    // Listen for era changes
    this.unsubscribers.push(
      this.eventBus.on('era:advance', ({ to }) => {
        this.currentEra = to as EraId;
      }),
    );

    this.emitStateChange();
  }

  update(tickCount: number): void {
    const lifespan = this.getLifespanConfig();
    this.yearAccumulator++;

    // Process one "year" of life
    if (this.yearAccumulator >= lifespan.ticksPerYear) {
      this.yearAccumulator = 0;
      this.processYear(tickCount);
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Year processing ───────────────────────────────────────────────

  private processYear(tickCount: number): void {
    const lifespan = this.getLifespanConfig();

    for (const [id, npc] of this.state.npcs) {
      if (npc.lifeStage === 'deceased') continue;

      // Age the NPC
      const age = this.getNPCAge(npc, tickCount);
      const newStage = this.computeLifeStage(age, lifespan);

      // Stage transitions
      if (newStage !== npc.lifeStage) {
        const oldStage = npc.lifeStage;
        npc.lifeStage = newStage;

        // Child becomes young adult -> potentially playable
        if (oldStage === 'child' && newStage === 'young_adult') {
          npc.isPlayable = true;
          npc.role = 'tribemember';
        }
      }

      // Elder death check
      if (npc.lifeStage === 'elder' && age > lifespan.adultMaxAge) {
        const yearsOverAdult = age - lifespan.adultMaxAge;
        const deathChance = lifespan.elderDeathChance * (1 + yearsOverAdult * 0.1);
        if (chance(deathChance)) {
          this.killNPC(id, tickCount);
        }
      }

      // Hard cap
      if (age >= lifespan.maxAge) {
        this.killNPC(id, tickCount);
      }
    }

    // Age the player character
    const playerNpc = this.state.npcs.get(this.state.playerCharacterId);
    if (playerNpc && playerNpc.lifeStage !== 'deceased') {
      this.state.playerAge = this.getNPCAge(playerNpc, tickCount);
      this.state.playerLifeStage = playerNpc.lifeStage;
    }

    // Random NPC events: births, new relationships
    this.maybeSpawnChild(tickCount);
    this.maybeNewEncounter(tickCount);

    this.emitStateChange();
  }

  // ── NPC creation ──────────────────────────────────────────────────

  private createNPC(opts: {
    name: string;
    role: NPCRole;
    age: number;
    isPlayable: boolean;
    parentId?: string;
  }): NPCDefinition {
    const id = `npc_${this.nextNpcId++}`;
    const lifespan = this.getLifespanConfig();
    // Backdate birthTick based on age
    const birthTick = -(opts.age * lifespan.ticksPerYear);

    const npc: NPCDefinition = {
      id,
      name: opts.name,
      birthTick,
      lifeStage: this.computeLifeStage(opts.age, lifespan),
      role: opts.role,
      era: this.currentEra,
      traits: this.randomTraits(),
      parentId: opts.parentId,
      childrenIds: [],
      relationships: [],
      isPlayable: opts.isPlayable,
      isRetiredPlayer: false,
      backstory: BACKSTORIES[randomInt(0, BACKSTORIES.length - 1)],
    };

    this.state.npcs.set(id, npc);
    return npc;
  }

  // ── Death & Succession ────────────────────────────────────────────

  private killNPC(id: string, tickCount: number): void {
    const npc = this.state.npcs.get(id);
    if (!npc || npc.lifeStage === 'deceased') return;

    npc.lifeStage = 'deceased';
    npc.deathTick = tickCount;

    // If this is the player character, trigger succession
    if (id === this.state.playerCharacterId) {
      this.triggerSuccession();
    }
  }

  private triggerSuccession(): void {
    const candidates = this.getSuccessionCandidates();
    this.state.successionCandidates = candidates;
    this.state.successionPending = true;
    this.emitStateChange();

    // Emit event for UI to show succession screen
    this.eventBus.emit('game:paused', {});
    this.eventBus.emit('gameEvent:triggered', { eventId: '__succession__' });
  }

  /** Get sorted succession candidates: family first, then friends by bond strength. */
  getSuccessionCandidates(): SuccessionCandidate[] {
    const playerId = this.state.playerCharacterId;
    const player = this.state.npcs.get(playerId);
    if (!player) return [];

    const candidates: SuccessionCandidate[] = [];

    for (const [id, npc] of this.state.npcs) {
      if (id === playerId) continue;
      if (npc.lifeStage === 'deceased' || npc.lifeStage === 'child') continue;
      if (!npc.isPlayable) continue;

      // Find relationship to player
      const rel = player.relationships.find(r => r.targetId === id);
      const type: RelationshipType = rel?.type ?? 'stranger';
      const bond = rel?.bond ?? 0;

      let reason = '';
      if (npc.childrenIds.length > 0 || player.childrenIds.includes(id)) {
        reason = 'Your child, ready to carry on your legacy.';
      } else if (type === 'partner') {
        reason = 'Your partner, who shared your journey.';
      } else if (type === 'family') {
        reason = 'Family — bound by blood.';
      } else if (type === 'friend') {
        reason = 'A trusted friend who fought alongside you.';
      } else if (type === 'mentor' || type === 'student') {
        reason = 'One who learned from you, or taught you.';
      } else {
        reason = 'Someone you\'ve crossed paths with.';
      }

      candidates.push({ npc, relationship: type, bond, reason });
    }

    // Sort: family first (children > partner > family > friend > others), then by bond
    const typePriority: Record<RelationshipType, number> = {
      family: 0, partner: 1, mentor: 2, student: 3, friend: 4, rival: 5, stranger: 6,
    };

    candidates.sort((a, b) => {
      // Children always first
      const aIsChild = player.childrenIds.includes(a.npc.id) ? -1 : 0;
      const bIsChild = player.childrenIds.includes(b.npc.id) ? -1 : 0;
      if (aIsChild !== bIsChild) return aIsChild - bIsChild;

      const typeDiff = typePriority[a.relationship] - typePriority[b.relationship];
      if (typeDiff !== 0) return typeDiff;
      return b.bond - a.bond;
    });

    return candidates;
  }

  /** Player selects their successor. */
  selectSuccessor(npcId: string): boolean {
    if (!this.state.successionPending) return false;

    const npc = this.state.npcs.get(npcId);
    if (!npc || npc.lifeStage === 'deceased') return false;

    // Retire the old player character
    const oldPlayer = this.state.npcs.get(this.state.playerCharacterId);
    if (oldPlayer) {
      oldPlayer.isRetiredPlayer = true;
      this.state.retiredPlayers.push(oldPlayer.id);
    }

    // Set new player character
    this.state.playerCharacterId = npcId;
    this.state.playerAge = this.getNPCAge(npc, 0); // approximate
    this.state.playerLifeStage = npc.lifeStage;
    this.state.successionPending = false;
    this.state.successionCandidates = [];
    this.state.generationCount++;

    this.emitStateChange();
    this.eventBus.emit('game:resumed', {});

    return true;
  }

  // ── Random life events ────────────────────────────────────────────

  private maybeSpawnChild(tickCount: number): void {
    // ~5% chance per year that a paired adult NPC has a child
    if (!chance(0.05)) return;

    // Find NPCs with partners who are adult-age
    const adults = Array.from(this.state.npcs.values()).filter(
      n => n.lifeStage === 'adult' && n.partnerId != null,
    );
    if (adults.length === 0) return;

    const parent = adults[randomInt(0, adults.length - 1)];
    const partner = this.state.npcs.get(parent.partnerId!);
    if (!partner || partner.lifeStage === 'deceased') return;

    // Don't have too many children
    if (parent.childrenIds.length >= 4) return;

    const child = this.createNPC({
      name: this.randomName(),
      role: 'child',
      age: 0,
      isPlayable: false,
      parentId: parent.id,
    });

    parent.childrenIds.push(child.id);
    partner.childrenIds.push(child.id);
    this.addRelationship(parent.id, child.id, 'family', 85);
    this.addRelationship(partner.id, child.id, 'family', 85);

    // If parent is player, add relationship
    if (parent.id === this.state.playerCharacterId || partner.id === this.state.playerCharacterId) {
      this.addRelationship(this.state.playerCharacterId, child.id, 'family', 95);
    }
  }

  private maybeNewEncounter(tickCount: number): void {
    // ~3% chance per year to meet a new NPC (wanderer, trader, etc.)
    if (!chance(0.03)) return;

    const npc = this.createNPC({
      name: this.randomName(),
      role: chance(0.5) ? 'trader' : 'explorer',
      age: randomInt(18, 45),
      isPlayable: true,
    });

    // Create relationship with player
    this.addRelationship(
      this.state.playerCharacterId,
      npc.id,
      'stranger',
      randomInt(10, 30),
    );
  }

  // ── Relationship management ───────────────────────────────────────

  addRelationship(fromId: string, toId: string, type: RelationshipType, bond: number): void {
    const from = this.state.npcs.get(fromId);
    const to = this.state.npcs.get(toId);
    if (!from || !to) return;

    // Add or update bidirectional relationships
    this.upsertRelation(from, toId, type, bond);
    this.upsertRelation(to, fromId, type, bond);

    if (type === 'partner') {
      from.partnerId = toId;
      to.partnerId = fromId;
    }
  }

  /** Strengthen bond between two NPCs (called after shared events). */
  strengthenBond(fromId: string, toId: string, amount: number): void {
    const from = this.state.npcs.get(fromId);
    if (!from) return;
    const rel = from.relationships.find(r => r.targetId === toId);
    if (rel) {
      rel.bond = clamp(rel.bond + amount, 0, 100);
    }
    // Mirror
    const to = this.state.npcs.get(toId);
    if (to) {
      const reverseRel = to.relationships.find(r => r.targetId === fromId);
      if (reverseRel) {
        reverseRel.bond = clamp(reverseRel.bond + amount * 0.8, 0, 100);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private upsertRelation(npc: NPCDefinition, targetId: string, type: RelationshipType, bond: number): void {
    const existing = npc.relationships.find(r => r.targetId === targetId);
    if (existing) {
      existing.type = type;
      existing.bond = Math.max(existing.bond, bond);
    } else {
      npc.relationships.push({ targetId, type, bond });
    }
  }

  private getNPCAge(npc: NPCDefinition, tickCount: number): number {
    const lifespan = this.getLifespanConfig();
    return Math.floor((tickCount - npc.birthTick) / lifespan.ticksPerYear);
  }

  private computeLifeStage(age: number, config: LifespanConfig): LifeStage {
    if (age < config.childMaxAge) return 'child';
    if (age < config.youngAdultMaxAge) return 'young_adult';
    if (age < config.adultMaxAge) return 'adult';
    return 'elder';
  }

  private getLifespanConfig(): LifespanConfig {
    return ERA_LIFESPAN[this.currentEra] ?? ERA_LIFESPAN['dawn'];
  }

  private randomName(): string {
    return DAWN_NAMES[randomInt(0, DAWN_NAMES.length - 1)];
  }

  private randomTraits(): NPCTraits {
    return {
      bravery: randomInt(20, 80),
      curiosity: randomInt(20, 80),
      kindness: randomInt(20, 80),
      industriousness: randomInt(20, 80),
      wisdom: randomInt(20, 80),
    };
  }

  // ── Public accessors ──────────────────────────────────────────────

  getPlayerNPC(): NPCDefinition | undefined {
    return this.state.npcs.get(this.state.playerCharacterId);
  }

  getNPC(id: string): NPCDefinition | undefined {
    return this.state.npcs.get(id);
  }

  getLivingNPCs(): NPCDefinition[] {
    return Array.from(this.state.npcs.values()).filter(n => n.lifeStage !== 'deceased');
  }

  getPlayerRelationships(): NPCRelationship[] {
    const player = this.state.npcs.get(this.state.playerCharacterId);
    return player?.relationships ?? [];
  }
}
