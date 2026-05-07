/**
 * Loading spinner shown while lazy-loaded components are being fetched.
 */
import "../../css/loading-fallback.css";

function LoadingFallback() {
  return (
    <div className="loading-fallback" role="status" aria-label="Đang tải trang">
      <div className="loading-fallback__spinner" aria-hidden="true" />
      <p className="loading-fallback__text">Đang tải trang...</p>
    </div>
  );
}

export default LoadingFallback;
