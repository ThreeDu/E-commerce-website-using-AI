/**
 * Loading spinner shown while lazy-loaded components are being fetched.
 */
function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] py-10 px-5" role="status" aria-label="Đang tải trang">
      <div className="w-10 h-10 border-4 border-[#e5e7eb] border-t-[#2563eb] rounded-full animate-spin mb-4" aria-hidden="true" />
      <p className="m-0 text-text-secondary text-[15px]">Đang tải trang...</p>
    </div>
  );
}

export default LoadingFallback;
