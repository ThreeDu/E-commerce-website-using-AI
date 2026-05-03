import { Component } from "react";
import { Link } from "react-router-dom";
import "../../css/error-boundary.css";

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
      <div className="error-boundary">
        <div className="error-boundary__card">
          <div className="error-boundary__icon" aria-hidden="true">⚠️</div>
          <h2 className="error-boundary__title">Đã xảy ra lỗi</h2>
          <p className="error-boundary__message">
            Ứng dụng gặp lỗi không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error ? (
            <details className="error-boundary__details">
              <summary>Chi tiết lỗi (development only)</summary>
              <pre className="error-boundary__stack">
                {String(this.state.error)}
              </pre>
            </details>
          ) : null}
          <div className="error-boundary__actions">
            <button
              type="button"
              className="error-boundary__btn error-boundary__btn--primary"
              onClick={this.handleReset}
            >
              Thử lại
            </button>
            <Link to="/" className="error-boundary__btn error-boundary__btn--ghost" onClick={this.handleReset}>
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
