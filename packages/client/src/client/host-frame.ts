/**
 * Whether the Bot surface renders inside an SDKWork host frame.
 *
 * A mode-based host owns the surrounding chrome: the standard sidebar carries
 * navigation and the Bot page owns the center column. In that composition the
 * surface must not draw its own channel sidebar — two navigations beside each
 * other is the layout this fork removes. The flag travels as context because
 * the sidebar lives several components below the page (`BotModePage` →
 * `MobileBotPanel` → `BotPanel` → `BotMain` → `BotMainContent`), and the host
 * frame is ambient to every one of them rather than a per-surface fact.
 */
import { createContext, useContext } from 'react';

/** True while the surface renders inside a host frame that owns the chrome. */
export const HostFrameContext = createContext(false);

/**
 * Read the host-frame flag.
 * @returns true when the host frame owns the surrounding chrome.
 */
export function useHostFrame(): boolean {
  return useContext(HostFrameContext);
}
