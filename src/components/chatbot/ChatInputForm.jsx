function ChatInputForm({ handleKeyDown, input, pending, recording, sendMessage, setInput, textareaRef, toggleRecording }) {
  return (
    <form
      className="border-t border-black/8 grid grid-cols-[1fr_auto_auto] gap-2 p-2.5 bg-white items-end"
      onSubmit={(event) => {
        event.preventDefault();
        sendMessage(input);
      }}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={recording ? "Đang lắng nghe..." : "Nhập nhu cầu của bạn..."}
        disabled={pending}
        rows={1}
        className={`border rounded-xl p-2 px-3 text-sm focus:outline-none focus:ring-2 w-full resize-none h-[38px] min-h-[38px] max-h-[100px] overflow-y-auto scrollbar-thin ${
          recording ? "border-red-400 bg-red-50 focus:ring-red-200" : "border-black/10 focus:ring-[#dfeeff]"
        }`}
      />

      <button
        type="button"
        onClick={toggleRecording}
        disabled={pending}
        title={recording ? "Dừng ghi âm" : "Ghi âm giọng nói"}
        className={`border border-black/10 rounded-xl min-w-[40px] h-[36px] flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
          recording 
            ? "bg-red-500 text-white animate-pulse" 
            : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          {recording ? (
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          ) : (
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          )}
        </svg>
      </button>

      <button
        type="submit"
        disabled={pending || !String(input).trim()}
        aria-label="Gửi"
        title="Gửi"
        className="border border-black/10 rounded-xl bg-[#dfeeff] text-[#0f314f] min-w-[44px] h-[36px] font-bold cursor-pointer transition-all hover:shadow-sm active:scale-96 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          "..."
        ) : (
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" className="w-[18px] h-[18px] scale-x-[-1]">
            <path
              d="M3.4 11.2a1 1 0 0 0 0 1.6l16.6 8.4a1 1 0 0 0 1.4-1.1l-3.1-7.1-15-1.8Zm0 1.6 16.6-8.4a1 1 0 0 1 1.4 1.1l-3.1 7.1-15 1.8Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </form>
  );
}

export default ChatInputForm;
