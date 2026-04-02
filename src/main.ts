import { GameWorld } from '@/core/GameWorld';

async function boot(): Promise<void> {
  const world = new GameWorld();

  try {
    await world.initialize();
    console.log('[EVO] Game initialized successfully');
  } catch (err) {
    console.error('[EVO] Failed to initialize:', err);

    // Show a user-friendly error
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#e0e0e0;font-family:system-ui;text-align:center;padding:20px;">
          <div>
            <h1 style="font-size:48px;margin-bottom:16px;">EVO</h1>
            <p style="color:#ff6b6b;">Failed to initialize the game engine.</p>
            <p style="color:#888;font-size:14px;margin-top:8px;">Check the browser console for details.</p>
          </div>
        </div>
      `;
    }
  }

  // Expose for debugging
  (window as unknown as Record<string, unknown>).__EVO__ = world;
}

boot();
