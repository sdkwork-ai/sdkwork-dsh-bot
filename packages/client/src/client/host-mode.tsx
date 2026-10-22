/**
 * SDKWork BirdCoder host frame: the Bot surface as an app mode.
 *
 * Upstream DeepSeekBot is a DSH plugin whose product surface is a `main` panel:
 * the shell registers the Bot as a keyed main panel, adds a sidebar row, and
 * selects that panel when the last view was Bot mode. That composition fits a
 * bare DeepSeek Harness shell, whose center column is the only place a plugin
 * panel can live.
 *
 * The `sdkwork-birdcoder2` frame is different: it is mode-based. The leftmost
 * track is the app-mode rail, the sidebar belongs to the code surface, and a
 * non-code surface renders as a keyed `mode.page` that owns the center column
 * outright. Mounting the Bot as a main panel there leaves the code sidebar
 * beside a surface designed to be full-width, which is the layout mismatch this
 * module removes.
 *
 * So this fork contributes the Bot to the host frame the way the host's own
 * feature packages do — one `mode.page` for the surface and one
 * `mode.rail.panel` shortcut that opens it — while the pre-mode composition
 * (main panel + sidebar row) stays registered for hosts that declare neither
 * seat. `ctx.slots.inject` only runs its factory once the host declares the
 * seat, so a bare DSH host ignores this module without error, and the two
 * compositions never render at once.
 */
import { createElement, type CSSProperties, type ReactElement } from 'react';
import { BOT_GLYPH_SVG } from './bot-icon.js';
import { MobileBotPanel } from './mobile-bot-panel.js';

/**
 * Mode id and rail-shortcut id the Bot surface occupies. One string for both:
 * the host's rail drops a panel's duplicate sidebar row when a shortcut carries
 * that panel's id, and the panel id is `PANEL_ID` (`'botharness'`).
 */
export const HOST_MODE_ID = 'botharness';

/** The rail shortcut sits above Settings; later shortcuts order above it. */
const HOST_MODE_RAIL_ORDER = 20;

/** Bot panel props the host frame hands to the surface, minus the mobile back path. */
export type BotModeFaces = Parameters<typeof MobileBotPanel>[0];

/**
 * The frame's seat API. The host declares `mode.page` and `mode.rail.panel`; the
 * upstream declarations this fork compiles against predate them, so the two
 * calls go through this structural view instead of widening the host's SlotMap.
 */
interface HostModeSeats {
  inject(name: string, factory: () => unknown): () => void;
  register(options: Record<string, unknown>, component: unknown): () => void;
}

/** The layout service's mode switch, present only on a mode-based host frame. */
interface HostModeSwitch {
  setMode?: ((mode: string) => void) | undefined;
}

/**
 * The host's `setMode`, when the frame exposes one.
 * @param layout - the client layout service.
 * @returns the switch, or undefined on a host without app modes.
 */
export function hostModeSwitch(layout: unknown): HostModeSwitch['setMode'] {
  const candidate = (layout as HostModeSwitch | undefined)?.setMode;
  return typeof candidate === 'function' ? candidate.bind(layout) : undefined;
}

/**
 * Whether the host frame declares both mode seats this module contributes into.
 *
 * A declared slot is the contract: the host's slots service answers a declared
 * spec and nothing for a key it never declared, while an older service has no
 * lookup at all. Both answers mean "this host has no app modes", which keeps the
 * pre-mode composition the only one registered there.
 * @param ctx - the client root context.
 * @returns true when `mode.page` and `mode.rail.panel` are both declared.
 */
export function hostModeSeatsDeclared(ctx: { slots: unknown }): boolean {
  const slots = ctx.slots as { specDynamic?: (key: string) => unknown };
  if (typeof slots.specDynamic !== 'function') return false;
  return slots.specDynamic('mode.page') !== undefined
    && slots.specDynamic('mode.rail.panel') !== undefined;
}

/** Page frame: the center column's height, no scroll, no outer chrome. */
const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
};

/** Rail cell: one square shortcut in the host rail's foot cluster. */
function railButtonStyle(active: boolean): CSSProperties {
  return {
    alignItems: 'center',
    background: active ? 'var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.08))' : 'transparent',
    borderRadius: 10,
    borderWidth: 0,
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    height: 36,
    justifyContent: 'center',
    opacity: active ? 1 : 0.72,
    padding: 0,
    width: 36,
  };
}

/**
 * Render the Bot surface in the host frame's center column.
 * @param props - the Bot faces the host passes through, plus the surface's own props.
 * @returns the page frame around the Bot surface.
 */
export function BotModePage(props: BotModeFaces): ReactElement {
  return createElement('div', { style: pageStyle, 'data-botharness-mode-page': '' },
    createElement(MobileBotPanel, props));
}

/** The shortcut's own facts, injected at registration. */
export interface BotModeRailEntryInjected {
  /** Open the Bot mode page. */
  select: () => void;
}

/**
 * Render the Bot rail shortcut.
 * @param props - the host's rail share (`activeMode`) plus the injected opener.
 * @returns the rail shortcut button.
 */
export function BotModeRailEntry(
  props: { activeMode?: string | undefined } & BotModeRailEntryInjected,
): ReactElement {
  const active = props.activeMode === HOST_MODE_ID;
  return createElement('button', {
    type: 'button',
    title: 'Bot',
    'aria-label': 'Bot',
    'aria-current': active ? 'page' : undefined,
    'data-botharness-rail-entry': '',
    onClick: () => { props.select(); },
    style: railButtonStyle(active),
    dangerouslySetInnerHTML: { __html: BOT_GLYPH_SVG },
  });
}

/**
 * Contribute the Bot surface to a mode-based host frame.
 *
 * Both registrations are inert until the host declares their seat, so a host
 * without app modes keeps the pre-mode composition this plugin already
 * registers. A mode-based host renders only this page, because nothing selects
 * the main panel there any more.
 * @param ctx - the client root context.
 * @param faces - the Bot faces the surface renders from.
 * @param localeNamespace - the plugin's locale namespace, so the surface keeps
 *   receiving its translation function from the host's locale seat.
 * @returns whether this host frame takes the mode composition, so the caller can
 *   keep the pre-mode panel out of it.
 */
export function registerHostMode<T extends object>(
  ctx: { slots: unknown; layout?: unknown },
  faces: T,
  localeNamespace: string,
): boolean {
  const setMode = hostModeSwitch(ctx.layout);
  if (setMode === undefined || !hostModeSeatsDeclared(ctx)) return false;
  const seats = ctx.slots as HostModeSeats;
  seats.inject('mode.page', () => seats.register({
    name: 'mode.page',
    key: HOST_MODE_ID,
    locale: localeNamespace,
    // The host merges the locale share into these faces at render time.
    inject: () => faces as unknown as Record<string, unknown>,
  }, BotModePage));
  seats.inject('mode.rail.panel', () => seats.register({
    name: 'mode.rail.panel',
    id: HOST_MODE_ID,
    order: HOST_MODE_RAIL_ORDER,
    inject: (): BotModeRailEntryInjected => ({
      select: () => { setMode(HOST_MODE_ID); },
    }),
  }, BotModeRailEntry));
  return true;
}
