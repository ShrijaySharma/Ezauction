import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
                    <div className="max-w-2xl w-full bg-gray-800 rounded-lg p-8 shadow-xl border border-red-500/30">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong.</h1>
                        <p className="text-gray-300 mb-6">
                            The application encountered an unexpected error. Please try refreshing the page.
                        </p>

                        <div className="bg-black/50 p-4 rounded-md overflow-auto max-h-64 mb-6 border border-gray-700">
                            <p className="font-mono text-red-400 mb-2">{this.state.error && this.state.error.toString()}</p>
                            <pre className="font-mono text-xs text-gray-500 whitespace-pre-wrap">
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
