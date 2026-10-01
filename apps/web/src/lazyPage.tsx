/**
 * Code-split pages that survive deploys. When a new build replaces the old
 * chunks, an open tab asking for an old file gets a failed dynamic import —
 * which would otherwise blank the page until a manual refresh. We retry once,
 * then reload the page a single time; if that still fails, a boundary offers
 * a reload button instead of an empty screen.
 */
import { Component, lazy, type ComponentType, type ReactNode } from 'react';

const RELOAD_KEY = 'sc-chunk-reload';

async function importWithRecovery<T>(load: () => Promise<T>): Promise<T> {
  try {
    const mod = await load();
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
    return mod;
  } catch (first) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      return await load();
    } catch {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem(RELOAD_KEY) === location.pathname; } catch { /* ignore */ }
      if (!reloaded) {
        try { sessionStorage.setItem(RELOAD_KEY, location.pathname); } catch { /* ignore */ }
        location.reload();
        return new Promise<T>(() => {}); // the reload takes over
      }
      throw first;
    }
  }
}

export function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => importWithRecovery(load).then((m) => ({ default: m[name] })));
}

export class PageErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-serif text-[24px] font-semibold">This page didn’t load.</p>
        <p className="max-w-sm text-sm text-slate-600">SealChain was probably just updated. Reloading fetches the latest version.</p>
        <button type="button" onClick={() => location.reload()} className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-ink-contrast">Reload the page</button>
      </div>
    );
  }
}
