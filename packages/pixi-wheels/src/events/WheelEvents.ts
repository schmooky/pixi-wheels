import type {
  AnticipationStyle,
  ResolvedSection,
  ResolvedTarget,
  SpinDirection,
  SpinProfile,
  WheelSpinResult,
} from '../config/types.js';

/**
 * Every event a wheel emits. One emitter per wheel; every payload names the
 * ring it came from (`'main'` for single-ring wheels), so a two-ring wheel
 * needs no second subscription.
 *
 * Audio, particles, Spine reactions and HUD updates hang off these. Every
 * exit path from a spin (normal stop, skip, slam, destroy) fires the right
 * events, so listening once keeps a game correct on all of them.
 */
export interface WheelEvents extends Record<string, unknown[]> {
  /** `spin()` was called. `fromIdle` is true when the ring was already turning. */
  'spin:start': [info: { ring: string; fromIdle: boolean; direction: SpinDirection }];
  /** The ring reached cruise speed and is waiting for a result. */
  'spin:cruise': [info: { ring: string; speed: number }];
  /** `setResult()` resolved a target. Fires before any deceleration is planned. */
  'spin:resultSet': [info: { ring: string; target: ResolvedTarget }];
  /**
   * The deceleration begins. `turns` is how many full turns the plan makes,
   * `duration` how long it will take in ms. Cue the "slowing down" audio here.
   */
  'spin:stopping': [info: { ring: string; turns: number; duration: number; anticipation: AnticipationStyle | null }];
  /**
   * The pointer reached the landing angle. The section is decided; a settle
   * move (`center` / `bounce`) may still follow. Cue the sector-win reveal.
   */
  'spin:landing': [info: { ring: string; section: ResolvedSection; landingAngle: number }];
  /** A settle move began. */
  'spin:settle:start': [info: { ring: string; mode: 'center' | 'bounce' }];
  /** A settle move ended. */
  'spin:settle:end': [info: { ring: string }];
  /** The spin is over and its promise has resolved. */
  'spin:complete': [result: WheelSpinResult];
  /** A tease was planned. `bait` is the section the player is meant to hope for. */
  'anticipation:start': [info: { ring: string; bait: ResolvedSection; style: AnticipationStyle }];
  /** The pointer reached the bait section's edge: the moment of maximum hope. */
  'anticipation:bait': [info: { ring: string; bait: ResolvedSection }];
  /** The tease resolved into the real landing. */
  'anticipation:end': [info: { ring: string; bait: ResolvedSection }];
  /**
   * A section divider passed under a pointer. Fires once per divider, in
   * order, at any speed - the natural hook for the ratchet click. `speed` is
   * the ring's angular speed (deg/s) at the crossing.
   */
  'pointer:tick': [
    info: {
      ring: string;
      pointer: string;
      from: ResolvedSection;
      to: ResolvedSection;
      speed: number;
      direction: SpinDirection;
    },
  ];
  /** A skip was accepted and the fast-forward is about to begin. */
  'skip:requested': [info: { ring: string; protectedByAnticipation: boolean }];
  /** The fast-forward finished and the ring is on its landing angle. */
  'skip:completed': [info: { ring: string }];
  /** The ring began its idle rotation. */
  'idle:start': [info: { ring: string; speed: number; direction: SpinDirection }];
  /** The ring stopped idling. */
  'idle:stop': [info: { ring: string }];
  /**
   * Section weights changed. Fires once for a snap change, and once at the
   * end of an animated transition. Labels and skins have already re-laid out.
   */
  'sections:changed': [info: { ring: string; sections: readonly ResolvedSection[]; step: number | null }];
  /** An animated weight transition began. */
  'sections:transition:start': [info: { ring: string; durationMs: number; step: number | null }];
  /** An animated weight transition ended. */
  'sections:transition:end': [info: { ring: string; step: number | null }];
  /** `setSpeed()` switched the active profile. */
  'speed:changed': [info: { ring: string; name: string; profile: SpinProfile; previous: string }];
  /** The wheel was destroyed. Every listener is dropped after this fires. */
  'destroyed': [];
}
