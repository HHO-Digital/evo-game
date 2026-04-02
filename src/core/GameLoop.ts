const TICK_RATE = 10;
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAX_FRAME_SKIP = 5;

export class GameLoop {
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private gameSpeed = 1;
  private tickCount = 0;
  private rafId = 0;

  constructor(
    private onTick: (tickCount: number) => void,
    private onRender: (alpha: number) => void,
  ) {}

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private loop = (currentTime: number): void => {
    if (!this.running) return;

    const deltaTime = (currentTime - this.lastTime) * this.gameSpeed;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    let ticksThisFrame = 0;
    while (this.accumulator >= TICK_INTERVAL && ticksThisFrame < MAX_FRAME_SKIP) {
      this.onTick(this.tickCount++);
      this.accumulator -= TICK_INTERVAL;
      ticksThisFrame++;
    }

    const alpha = this.accumulator / TICK_INTERVAL;
    this.onRender(alpha);

    this.rafId = requestAnimationFrame(this.loop);
  };

  setSpeed(multiplier: number): void {
    this.gameSpeed = Math.max(0, Math.min(multiplier, 10));
  }

  getSpeed(): number {
    return this.gameSpeed;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  isRunning(): boolean {
    return this.running;
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
