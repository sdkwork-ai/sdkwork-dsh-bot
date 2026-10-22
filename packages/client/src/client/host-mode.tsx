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
import { HostFrameContext } from './host-frame.js';
import { BotPanel } from './bot-main.js';

/**
 * Mode id and rail-shortcut id the Bot surface occupies. One string for both:
 * the host's rail drops a panel's duplicate sidebar row when a shortcut carries
 * that panel's id, and the panel id is `PANEL_ID` (`'botharness'`).
 */
export const HOST_MODE_ID = 'botharness';

/** The rail shortcut sits above Settings; later shortcuts order above it. */
const HOST_MODE_RAIL_ORDER = 20;

/** The standard sidebar's quick entry: below the frame's own app entries. */
const HOST_MODE_ACTION_ORDER = 45;

/** Bot panel props the host frame hands to the surface, minus the mobile back path. */
export type BotModeFaces = Parameters<typeof BotPanel>[0];

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
  openPanel?: ((mode: string) => void) | undefined;
  closePanel?: (() => void) | undefined;
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
 * The host's code-surface overlay opener, when the frame has one.
 *
 * A panel-mode host renders the surface beside its standard sidebar, so the Bot
 * opens through `openPanel` rather than as a rail mode; the sidebar keeps the
 * frame's normal navigation and the page never draws its own. Falls back to
 * `setMode` for a host that only knows rail modes.
 * @param layout - the client layout service.
 * @returns the opener, or undefined on a host without code-surface overlays.
 */
export function hostModeOpen(layout: unknown): ((mode: string) => void) | undefined {
  const candidate = (layout as HostModeSwitch | undefined)?.openPanel;
  return typeof candidate === 'function' ? candidate.bind(layout) : undefined;
}

/**
 * The host's code-surface overlay closer, when the frame has one.
 * @param layout - the client layout service.
 * @returns the closer, or undefined on a host without code-surface overlays.
 */
export function hostModeClose(layout: unknown): (() => void) | undefined {
  const candidate = (layout as HostModeSwitch | undefined)?.closePanel;
  return typeof candidate === 'function' ? candidate.bind(layout) : undefined;
}

/**
 * Whether the host frame declares both mode seats this module contributes into.
 *
 * The authority is the layout service, not the slots table: a mode frame is the
 * one whose layout exposes `openPanel` (a code-surface overlay) or `setMode` (a
 * rail mode), and this module only contributes where one of them exists. The
 * slots service is asked only when it publishes a declaration lookup — the
 * browser-side service does not, and treating "no lookup" as "no app modes"
 * made a real mode frame fall back to the pre-mode composition.
 * @param ctx - the client root context.
 * @returns true when the seats are declared, or when the host publishes no way
 *   to ask and the layout service alone decides.
 */
export function hostModeSeatsDeclared(ctx: { slots: unknown }): boolean {
  const slots = ctx.slots as { specDynamic?: (key: string) => unknown };
  if (typeof slots.specDynamic !== 'function') return true;
  return slots.specDynamic('mode.page') !== undefined
    && slots.specDynamic('mode.rail.panel') !== undefined;
}

/**
 * Whether the host frame publishes navigation right now.
 *
 * Read live, never captured: the layout service may activate after this plugin,
 * so an apply-time answer is not a fact about the frame. Callers that must not
 * install pre-mode chrome ask this when they install.
 * @param ctx - the client root context.
 * @returns true when the layout service offers `openPanel` or `setMode`.
 */
export function hostModePresent(ctx: { layout?: unknown }): boolean {
  return hostModeOpen(ctx.layout) !== undefined || hostModeSwitch(ctx.layout) !== undefined;
}

/**
 * Page frame: the center column's full box, no scroll, no outer chrome.
 *
 * `width`/`height: 100%` plus `position: relative` make this element the
 * containing block for the surface: the Bot layout anchors absolute children
 * (topbar, panels) to it instead of to the frame, and a host that renders the
 * page through a content-sized wrapper still gets a full-size surface.
 */
const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  position: 'relative',
  width: '100%',
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
 *
 * The host frame owns the surrounding chrome — its standard sidebar is mounted
 * by the frame, not by this page — so the surface renders without its own
 * channel sidebar (see `host-frame.ts`).
 * @param props - the Bot faces the host passes through, plus the surface's own props.
 * @returns the page frame around the Bot surface.
 */
export function BotModePage(props: BotModeFaces): ReactElement {
  return createElement(HostFrameContext.Provider, { value: true },
    createElement('div', { style: pageStyle, 'data-botharness-mode-page': '' },
      createElement(BotPanel, props)));
}

/** The shortcut's own facts, injected at registration. */
export interface BotModeRailEntryInjected {
  /** Open the Bot mode page. */
  select: () => void;
}

/** The sidebar quick entry's injected facts. */
export interface BotSidebarActionInjected {
  /** Open the Bot overlay page. */
  open: () => void;
}

const actionStyle: CSSProperties = {
  alignItems: 'center',
  background: 'transparent',
  borderWidth: 0,
  borderRadius: 8,
  color: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  gap: 8,
  height: 32,
  padding: '0 8px',
  width: '100%',
};

/**
 * Render the Bot entry in the frame's standard sidebar quick actions.
 *
 * This is the entry a panel-mode host needs: the host renders `sidebar.actions`
 * rows itself and calls this component's opener, so the click reaches
 * `openPanel` directly. A `sidebar.panellist` row cannot do that — the host owns
 * its click and selects the main panel, which is a different composition.
 * @param props - the injected opener plus the sidebar's own width and translate seats.
 * @returns the quick entry button.
 */
export function BotSidebarAction(
  props: { open: () => void; wide?: boolean | undefined; t?: ((key: string) => string) | undefined },
): ReactElement {
  return createElement('button', {
    type: 'button',
    onClick: props.open,
    style: actionStyle,
    'data-botharness-sidebar-action': '',
  },
  createElement('span', { style: { display: 'flex', flexShrink: 0 } }, BOT_GLYPH_SVG),
  props.wide === false
    ? null
    : createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      props.t?.('panel.label') ?? 'Bot'));
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
 * Both registrations are unconditional and therefore safe on any host: a slot
 * the host never declares ignores what is registered against it, and a surface
 * the host cannot select is never rendered. Resolving the layout's capabilities
 * at apply time is what made this fragile — a frame whose layout service
 * activates after this plugin answered "no modes" and dropped the whole module.
 * The page registration is what a panel-mode host needs; the rail shortcut
 * makes the surface reachable on a host that only knows rail modes.
 * @param ctx - the client root context.
 * @param faces - the Bot faces the surface renders from.
 * @param localeNamespace - the plugin's locale namespace, so the surface keeps
 *   receiving its translation function from the host's locale seat.
 * @returns whether the host frame exposed its navigation at apply time; callers
 *   must not gate reachability on it (see `hostModePresent`).
 */
export function registerHostMode<T extends object>(
  ctx: { slots: unknown; layout?: unknown },
  faces: T,
  localeNamespace: string,
): boolean {
  const seats = ctx.slots as HostModeSeats;
  seats.inject('mode.page', () => seats.register({
    name: 'mode.page',
    key: HOST_MODE_ID,
    locale: localeNamespace,
    // The host merges the locale share into these faces at render time.
    inject: () => faces as unknown as Record<string, unknown>,
  }, BotModePage));
  // A panel-mode host opens the surface from its sidebar row, and a rail
  // shortcut carrying the same id makes that host drop the row as a duplicate —
  // two entry points, one of which hides the one the frame expects. Only a host
  // without `openPanel` needs the shortcut.
  if (hostModeOpen(ctx.layout) === undefined) {
    seats.inject('mode.rail.panel', () => seats.register({
      name: 'mode.rail.panel',
      id: HOST_MODE_ID,
      order: HOST_MODE_RAIL_ORDER,
      inject: (): BotModeRailEntryInjected => ({
        select: () => { hostModeSwitch(ctx.layout)?.(HOST_MODE_ID); },
      }),
    }, BotModeRailEntry));
  } else {
    // Quick entry in the standard sidebar; its click is ours, so it opens the
    // overlay rather than selecting a main panel.
    seats.inject('sidebar.actions', () => seats.register({
      name: 'sidebar.actions',
      id: HOST_MODE_ID,
      order: HOST_MODE_ACTION_ORDER,
      locale: localeNamespace,
      inject: (): BotSidebarActionInjected => ({
        open: () => { hostModeOpen(ctx.layout)?.(HOST_MODE_ID); },
      }),
    }, BotSidebarAction));
  }
  return hostModePresent(ctx);
}
