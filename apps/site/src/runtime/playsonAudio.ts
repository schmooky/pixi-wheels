import { createEngine, type Engine, type Voice } from '@schmooky/zvuk';
import type { Wheel, WheelEvents } from 'pixi-wheels';

/**
 * The Super Wheel's own audio (Playson, used with permission), served from
 * `public/playson-wheel/audio/`, wired to the engine's events through
 * `@schmooky/zvuk`. The sound-hooks recipe spells this wiring out; the
 * Spine recipe reuses it.
 */
export const PLAYSON_SOUNDS = {
  music: 'wheel_music.mp3',
  activate: 'wheel_activate.mp3',
  spin: 'wheel_spin.mp3',
  tick: 'click.mp3',
  anticipation: 'anticipation.mp3',
  landing: 'landing.mp3',
  skip: 'skip.mp3',
  winCoin: 'sector_win_regular.mp3',
  winClover: 'sector_win_clover.mp3',
  winMini: 'win_mini.mp3',
  winMinor: 'win_minor.mp3',
  winMajor: 'win_major.mp3',
} as const;

export type PlaysonSoundName = keyof typeof PLAYSON_SOUNDS;

export interface PlaysonAudio {
  engine: Engine<'music' | 'sfx'>;
  /** Resolve the audio context from a user gesture. Safe to call every time. */
  unlock(): Promise<void>;
  /** Hang every cue off the wheel's events. Returns the detach function. */
  attach(wheel: Wheel): () => void;
  /** Start the wheel music loop, once. */
  startMusic(): void;
  close(): Promise<void>;
}

let cached: Promise<PlaysonAudio> | null = null;

/** Load the sound set once per page. */
export function loadPlaysonAudio(base = '/playson-wheel/audio/'): Promise<PlaysonAudio> {
  if (cached) return cached;
  cached = createPlaysonAudio(base);
  return cached;
}

async function createPlaysonAudio(base: string): Promise<PlaysonAudio> {
  const engine = createEngine<'music' | 'sfx'>({
    buses: { music: { level: 0.4 }, sfx: { level: 1 } },
    master: { headroom: -3 },
  });
  await Promise.all(
    (Object.keys(PLAYSON_SOUNDS) as PlaysonSoundName[]).map((name) =>
      engine.loadSound(name, base + PLAYSON_SOUNDS[name], { bus: name === 'music' ? 'music' : 'sfx' }),
    ),
  );
  let music: Voice | null = null;
  let spinVoice: Voice | null = null;
  let riser: Voice | null = null;

  const audio: PlaysonAudio = {
    engine,
    unlock: () => engine.unlock(),
    startMusic() {
      if (music) return;
      music = engine.sound('music').play({ loop: true, fadeIn: 0.8, volume: 0.9 });
    },
    attach(wheel) {
      const e = wheel.events;
      const handlers: Array<[keyof WheelEvents, (...args: never[]) => void]> = [];
      const on = <K extends keyof WheelEvents>(event: K, fn: (...args: WheelEvents[K]) => void): void => {
        e.on(event, fn);
        handlers.push([event, fn as (...args: never[]) => void]);
      };
      on('spin:start', () => {
          audio.startMusic();
          engine.sound('activate').play();
          spinVoice = engine.sound('spin').play({ volume: 0.9 });
      });
      on('pointer:tick', ({ speed }) => {
        engine.sound('tick').play({
          volume: Math.min(1, 0.25 + speed / 900),
          pitch: { base: 0.9 + Math.min(0.6, speed / 1400), jitter: 0.04 },
        });
      });
      on('anticipation:start', () => {
        riser = engine.sound('anticipation').play({ volume: 0.9 });
      });
      on('anticipation:end', () => {
        riser?.stop({ fade: 0.3 });
        riser = null;
      });
      on('skip:requested', () => {
        engine.sound('skip').play();
      });
      on('spin:landing', ({ section }) => {
          spinVoice?.stop({ fade: 0.25 });
          spinVoice = null;
          engine.sound('landing').play({ volume: 0.8 });
          const tags = section.tags;
          const win: PlaysonSoundName = tags.includes('mini')
            ? 'winMini'
            : tags.includes('minor')
              ? 'winMinor'
              : tags.includes('major')
                ? 'winMajor'
                : tags.includes('coin')
                  ? 'winCoin'
                  : 'winClover';
          engine.sound(win).play();
      });
      on('destroyed', () => {
        music?.stop({ fade: 0.5 });
        music = null;
      });
      return () => {
        for (const [event, fn] of handlers) e.off(event, fn as never);
      };
    },
    close: () => engine.close(),
  };
  return audio;
}
