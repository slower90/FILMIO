import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { setBaseUrl } from '@workspace/api-client-react';
import App from './App';

import './index.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

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
        <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 text-white">
          <section className="w-full max-w-xl rounded-md border border-[#2A2A36] bg-[#12121A] p-8 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#F59E0B]">FILMIO startup error</p>
            <h1 className="mt-3 text-2xl font-semibold">The app could not start.</h1>
            <p className="mt-3 text-sm leading-6 text-[#A1A1AA]">
              Check the Clerk production configuration and browser console, then reload this page.
            </p>
            <p className="mt-4 break-words rounded-sm bg-black/30 p-3 font-mono text-xs text-[#D4D4D8]">
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
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
