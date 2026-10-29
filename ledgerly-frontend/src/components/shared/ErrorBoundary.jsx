import { Component } from "react";
import { logger } from "@/lib/logger";

/**
 * Catches a crash in any page so the whole app doesn't go blank. Shows a calm message with a
 * reference that also appears in the browser console next to the full error.
 */
export class ErrorBoundary extends Component {
  state = { error: null, reference: "" };

  static getDerivedStateFromError(error) {
    return { error, reference: Math.random().toString(36).slice(2, 10) };
  }

  componentDidCatch(error, info) {
    logger.error(`Page crashed (reference ${this.state.reference}): ${error.message}`, { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6" role="alert">
        <div className="max-w-md bg-surface-card rounded-xl shadow-sm p-8 flex flex-col gap-4">
          <span className="material-symbols-outlined text-[32px] text-negative-deep">error</span>
          <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary">Something went wrong</h1>
          <p className="font-body-regular text-body-regular text-text-secondary">
            This page hit a problem. Your data is safe. Reload to try again, and if it keeps happening,
            contact support with this reference: <span className="font-table-cell-mono font-semibold text-text-primary">{this.state.reference}</span>
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => window.location.reload()} className="h-9 px-4 rounded-lg bg-primary text-on-primary font-body-sm-medium text-body-sm-medium">Reload</button>
            <a href="/" className="h-9 px-4 rounded-lg bg-surface-subtle text-on-surface font-body-sm-medium text-body-sm-medium inline-flex items-center">Go to home page</a>
          </div>
        </div>
      </div>
    );
  }
}
