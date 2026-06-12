import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * React Error Boundary.
 *
 * Catches unhandled runtime errors in any child component tree
 * and displays a user-friendly fallback instead of a white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] py-10 px-5">
        <div className="text-center max-w-[480px] w-full bg-white border border-border rounded-xl py-10 px-8 shadow-elevated">
          <div className="text-5xl mb-4" aria-hidden="true">⚠️</div>
          <h2 className="m-0 mb-3 text-2xl text-[#111827]">Đã xảy ra lỗi</h2>
          <p className="m-0 mb-6 text-text-secondary leading-relaxed">
            Ứng dụng gặp lỗi không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error ? (
            <details className="text-left mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <summary className="cursor-pointer text-red-700 font-semibold text-[13px]">Chi tiết lỗi (development only)</summary>
              <pre className="mt-2 p-2 text-xs text-red-900 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                {String(this.state.error)}
              </pre>
            </details>
          ) : null}
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              className="py-2.5 px-5 rounded-md font-bold text-sm cursor-pointer no-underline inline-flex items-center border-none bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors"
              onClick={this.handleReset}
            >
              Thử lại
            </button>
            <Link to="/" className="py-2.5 px-5 rounded-md font-bold text-sm cursor-pointer no-underline inline-flex items-center border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors" onClick={this.handleReset}>
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
