import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';

import { setBaseUrl } from '@workspace/api-client-react';
import App from './App';
import { DEFAULT_API_BASE_URL } from './lib/api-url';

import './index.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isLocalPreview =
  typeof window !== "undefined" &&
  /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)$/.test(window.location.hostname);

// Local previews use Vite's same-origin /api proxy. This avoids asking the
// production Cloudflare Worker API to allow every ephemeral Replit preview
// origin while keeping the absolute API URL for deployed frontend bundles.
setBaseUrl(!isLocalPreview ? apiBaseUrl || DEFAULT_API_BASE_URL : null);

type RootErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected startup error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FILMIO failed to start', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <section className="w-full max-w-xl rounded-md border border-border bg-card p-8 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">FILMIO startup error</p>
            <h1 className="mt-3 text-2xl font-semibold">The app could not start.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Check the Clerk production configuration and browser console, then reload this page.
            </p>
            <p className="mt-4 break-words rounded-sm bg-muted p-3 font-mono text-xs text-muted-foreground">
              {this.state.message}
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="filmio-theme" disableTransitionOnChange>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </ThemeProvider>,
);
