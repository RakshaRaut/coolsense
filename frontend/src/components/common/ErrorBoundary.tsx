import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CoolSense] Unhandled UI error', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border border-danger/25 bg-danger-soft text-danger">
            <AlertTriangle className="size-6" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-fg">
            The interface hit an unexpected error
          </h1>
          <p className="mt-2 max-w-md text-[12.5px] leading-6 text-muted">
            {this.state.error.message || 'An unknown error occurred while rendering this view.'}
          </p>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-elevated px-4 text-[13px] font-medium text-fg transition hover:border-line-strong"
            >
              <RotateCcw className="size-4" /> Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/dashboard')}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-white transition hover:brightness-110 dark:text-[#04141f]"
            >
              Reload dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
