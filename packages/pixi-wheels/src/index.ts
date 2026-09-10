// Core
export { Wheel } from './core/Wheel.js';
export type { WheelParams, WheelSpinOptions, WheelResultOptions } from './core/Wheel.js';
export { Ring } from './core/Ring.js';
export type { RingParams } from './core/Ring.js';
export { WheelBuilder, RingBuilder } from './core/WheelBuilder.js';
export type { PointerSpec } from './core/WheelBuilder.js';
export { RingGeometry, localAngleUnderPointer, rotationForLocalAngle } from './core/RingGeometry.js';
export type { RingGeometryOptions } from './core/RingGeometry.js';
export { WHEEL_CONFIG_VERSION, assertWheelConfig } from './core/WheelConfig.js';
export type { WheelConfig, RingConfig, PointerConfigEntry } from './core/WheelConfig.js';
export { WheelTemplates, WHEEL_TEMPLATE_NAMES } from './core/templates.js';
export type { WheelTemplateName } from './core/templates.js';

// Config
export { SpinPresets } from './config/SpinPresets.js';
export {
  DEFAULTS,
  DEFAULT_PALETTE,
  DEFAULT_FLAP,
  DEFAULT_POINTER,
  DEFAULT_SETTLE,
  DEFAULT_LANDING,
  DEFAULT_SKIP,
} from './config/defaults.js';
export type {
  SpinDirection,
  LabelOrientation,
  LabelContext,
  LabelContent,
  SectionStyle,
  WheelSectionConfig,
  ResolvedSectionStyle,
  ResolvedSection,
  SettleMode,
  SettleConfig,
  LandingMode,
  LandingOptions,
  AnticipationStyle,
  AnticipationOptions,
  SpinProfile,
  IdleConfig,
  SkipConfig,
  WheelTarget,
  ResolvedTarget,
  WheelSpinResult,
  SpinOptions,
  PointerFacing,
  FlapConfig,
  PointerConfig,
  DynamicStep,
  DynamicSectionsConfig,
  WeightTransitionOptions,
} from './config/types.js';

// Spin
export { SpinController } from './spin/SpinController.js';
export type { SpinState, SpinHost } from './spin/SpinController.js';
export { planStop, planSkip, planSettle, pickTurns } from './spin/StopPlanner.js';
export type { StopLeg, StopLegKind, StopPlan, PlanStopInput, PlanSkipInput, ResolvedAnticipation } from './spin/StopPlanner.js';

// Adapters
export { resolveTarget } from './adapter/resolveTarget.js';
export type { ResolveTargetOptions } from './adapter/resolveTarget.js';
export { createTargetAdapter, readPath } from './adapter/targetAdapter.js';
export type { TargetAdapterConfig } from './adapter/targetAdapter.js';

// Pointers
export { Pointer } from './pointer/Pointer.js';
export type { PointerCrossing } from './pointer/Pointer.js';
export type { PointerSkin } from './pointer/PointerSkin.js';
export { GraphicsPointerSkin } from './pointer/GraphicsPointerSkin.js';
export type { GraphicsPointerSkinOptions } from './pointer/GraphicsPointerSkin.js';
export { TexturePointerSkin } from './pointer/TexturePointerSkin.js';
export type { TexturePointerSkinOptions } from './pointer/TexturePointerSkin.js';
export { registerBuiltinSkins } from './skins/builtins.js';
export type { PointerSkinConfigTexture, PointerSkinConfigGraphics } from './skins/builtins.js';

// Skins
export type { RingSkin, RingSkinContext, AssetResolver } from './skins/RingSkin.js';
export { GraphicsRingSkin, wedgePath } from './skins/GraphicsRingSkin.js';
export type { GraphicsRingSkinOptions } from './skins/GraphicsRingSkin.js';
export { DebugRingSkin } from './skins/DebugRingSkin.js';
export { TextureRingSkin } from './skins/TextureRingSkin.js';
export type { TextureRingSkinOptions, TextureRingDecoration, RingSkinConfigTexture } from './skins/TextureRingSkin.js';
export { HeadlessRingSkin } from './skins/HeadlessRingSkin.js';
export { SectionLabels } from './skins/labels.js';
export {
  registerRingSkin,
  registerPointerSkin,
  createRingSkin,
  createPointerSkin,
  registeredRingSkinTypes,
  registeredPointerSkinTypes,
  NO_ASSETS,
} from './skins/skinRegistry.js';
export type { RingSkinConfig, PointerSkinConfig, RingSkinFactory, PointerSkinFactory } from './skins/skinRegistry.js';

// Events
export { EventEmitter } from './events/EventEmitter.js';
export type { WheelEvents } from './events/WheelEvents.js';

// Utils
export type { Disposable } from './utils/Disposable.js';
export { TickerRef } from './utils/TickerRef.js';
export type { TickerCallback } from './utils/TickerRef.js';
export { normalizeDeg, signedDeg, arcDelta, directionSign, isAngleInArc, DEG_TO_RAD, RAD_TO_DEG } from './utils/angles.js';
export { resolveEase, initialSlope, constantAccelEase, EASE_NAMES } from './utils/easing.js';
export { scaleToFit, fitContainer, fitText, chordAt, labelSlot } from './utils/fit.js';
export type { FitMode, FitOptions, Size, LabelSlot, LabelSlotOptions } from './utils/fit.js';
export type { Ease, EaseFn } from './utils/easing.js';
export { setLogLevel, getLogLevel } from './utils/notify.js';
export type { LogLevel } from './utils/notify.js';

// Debug
export { debugSnapshot, debugRingSnapshot, debugArc, enableDebug } from './debug/debug.js';
export type { DebugSnapshot, DebugRingSnapshot, DebugSectionSnapshot } from './debug/debug.js';
export { debugOverlay, OVERLAY_LABEL } from './debug/debugOverlay.js';
export type { DebugOverlayLayer, DebugOverlayOptions, DebugOverlayHandle } from './debug/debugOverlay.js';

// Testing utilities ship at the `pixi-wheels/testing` subpath.
