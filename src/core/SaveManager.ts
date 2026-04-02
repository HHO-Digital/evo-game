import { openDB, type IDBPDatabase } from 'idb';

interface SaveSlot {
  id: string;
  timestamp: number;
  eraId: string;
  eraName: string;
  tickCount: number;
  data: Record<string, unknown>;
}

const DB_NAME = 'evo-game-saves';
const STORE_NAME = 'saves';

export class SaveManager {
  private db: IDBPDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }

  async save(slotId: string, data: Record<string, unknown>, eraId: string, eraName: string, tickCount: number): Promise<void> {
    const saveSlot: SaveSlot = {
      id: slotId,
      timestamp: Date.now(),
      eraId,
      eraName,
      tickCount,
      data: structuredClone(data),
    };
    await this.db?.put(STORE_NAME, saveSlot);
  }

  async load(slotId: string): Promise<Record<string, unknown> | null> {
    const slot = await this.db?.get(STORE_NAME, slotId) as SaveSlot | undefined;
    return slot?.data ?? null;
  }

  async listSaves(): Promise<SaveSlot[]> {
    const all = (await this.db?.getAll(STORE_NAME) ?? []) as SaveSlot[];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteSave(slotId: string): Promise<void> {
    await this.db?.delete(STORE_NAME, slotId);
  }

  exportSave(saveData: Record<string, unknown>): string {
    return JSON.stringify(saveData, null, 2);
  }

  importSave(jsonString: string): Record<string, unknown> {
    return JSON.parse(jsonString) as Record<string, unknown>;
  }
}
