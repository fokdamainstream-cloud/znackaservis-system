import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('ErrorBoundary zachytil chybu:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔴</span>
              <div>
                <h1 className="text-lg font-bold text-red-700">Chyba v aplikácii</h1>
                <p className="text-sm text-gray-500">Táto stránka sa nepodarila načítať</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4 mb-4 font-mono text-xs text-red-800 overflow-auto max-h-40">
              <strong>Chyba:</strong> {this.state.error?.message || String(this.state.error)}
            </div>

            {this.state.info?.componentStack && (
              <details className="mb-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Zobraziť stack trace
                </summary>
                <pre className="mt-2 bg-gray-50 rounded p-3 text-xs text-gray-600 overflow-auto max-h-48">
                  {this.state.info.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={() => this.setState({ hasError: false, error: null, info: null })}
              className="btn-secondary text-sm"
            >
              ↩ Skúsiť znova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
