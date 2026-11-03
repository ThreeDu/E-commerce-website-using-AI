import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { getProductImageSrc } from "../../utils/productUtils";
import { formatCurrency } from "../../utils/formatUtils";
import { cleanSpecialTokens } from "./chatbotHelpers";

function renderAssistantMarkdown(text) {
  const sanitizedText = cleanSpecialTokens(text);
  return (
    <div className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-sm text-[#0f2233] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="w-full max-w-full overflow-x-auto my-2 rounded-xl border border-black/12 bg-white shadow-sm scrollbar-thin">
              <table className="w-full min-w-[320px] border-collapse border-spacing-0 text-xs" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="p-2 px-3 border-r border-b border-black/10 align-top bg-[#eef6ff] font-bold text-[#0f314f] text-left last:border-r-0" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2 px-3 border-r border-b border-black/8 align-top text-[#334155] leading-normal last:border-r-0 hover:bg-black/[0.02]" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="m-0 mt-2 first:mt-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="m-0 my-2 pl-5 list-disc break-words [overflow-wrap:anywhere] space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="m-0 my-2 pl-5 list-decimal break-words [overflow-wrap:anywhere] space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="break-words [overflow-wrap:anywhere]" {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre className="w-full max-w-full overflow-x-auto my-2.5 p-3 rounded-xl bg-[#1e293b] text-[#e2e8f0] text-xs font-mono leading-relaxed border border-slate-700 scrollbar-thin shadow-inner" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const isCodeBlock = !inline && (className?.includes("language-") || String(children).includes("\n"));
            if (isCodeBlock) {
              return (
                <code className="font-mono text-xs text-[#e2e8f0]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-xs bg-[#e2e8f0] text-[#0f172a] px-1.5 py-0.5 rounded font-semibold break-words [overflow-wrap:anywhere] whitespace-pre-wrap" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {sanitizedText}
      </ReactMarkdown>
    </div>
  );
}

function ChatMessageList({ addToCart, compareProduct1, createMessage, latestAiId, latestAiMessageRef, messages, sendMessage, setCompareProduct1, setMessages, trackEvent }) {
  return (
    messages.map((msg) => {
     const isLatestAi = msg.id === latestAiId;
     return (
       <article key={msg.id} ref={isLatestAi ? latestAiMessageRef : null} className="w-full">
       <div className={`flex gap-2 items-start ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
         {msg.role === "assistant" ? (
           <div className="w-7 h-7 rounded-full grid place-items-center text-[#0f2233] bg-gradient-to-br from-[#d8ecff] to-[#f6f2ff] border border-[#0f494f]/15 shadow-sm [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
             <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
               <path
                 d="M8 4.5a1 1 0 0 1 2 0v1h4v-1a1 1 0 1 1 2 0v1.2a4.5 4.5 0 0 1 4 4.48v5.32a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-5.32a4.5 4.5 0 0 1 4-4.48V4.5Zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                 fill="currentColor"
               />
             </svg>
           </div>
         ) : null}
         <div className={`max-w-[85%] min-w-0 overflow-hidden rounded-[18px] p-2.5 px-3 border border-[#0f2233]/10 shadow-sm animate-chatbot-pop ${msg.role === "user" ? "bg-[#efeaff] border-[#0f494f]/12 origin-top-right" : "bg-[#f7faff] origin-top-left"}`}>
           {msg.role === "assistant" ? (
             msg.text ? (
               renderAssistantMarkdown(msg.text)
             ) : (
               <div className="flex gap-1.5 p-1 items-center">
                 <span className="w-2 h-2 rounded-full bg-[#0f314f]/50 animate-bounce" />
                 <span className="w-2 h-2 rounded-full bg-[#0f314f]/50 animate-bounce [animation-delay:0.15s]" />
                 <span className="w-2 h-2 rounded-full bg-[#0f314f]/50 animate-bounce [animation-delay:0.3s]" />
               </div>
             )
           ) : (
             <p className="m-0 text-sm leading-relaxed">{msg.text.replace(/\s*\[Mã:\s*[a-f0-9]+\]/gi, "")}</p>
           )}
           {msg.products.length > 0 ? (
             <div className="mt-2 grid gap-2">
               {msg.products.map((product, index) => (
                 <article
                   key={product._id}
                   className="grid gap-2 text-[#0f2233] p-3 border border-black/8 rounded-xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#0f494f]/18 animate-chatbot-pop group"
                   style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
                 >
                   <Link
                     to={`/products/${product._id}`}
                     className="grid grid-cols-[56px_1fr] gap-2 text-[#0f2233] no-underline"
                     onClick={() => {
                       trackEvent({
                         eventType: "click",
                         productId: product._id,
                         category: product.category,
                         metadata: {
                           source: "chatbot_card_click",
                         },
                       });
                     }}
                   >
                     <img
                       src={getProductImageSrc(product)}
                       alt={product.name}
                       className="w-14 h-14 object-cover rounded-lg bg-[#eef4fa] transition-all group-hover:scale-[1.04] group-hover:shadow-md"
                       onError={(event) => {
                         event.currentTarget.onerror = null;
                         event.currentTarget.src = "/placeholder.svg";
                       }}
                     />
                     <div>
                       <h4 className="m-0 text-xs font-bold leading-tight">{product.name}</h4>
                       <p className="mt-1 text-xs font-bold text-[#0f314f] transition-colors group-hover:text-[#1a4d7a]">{formatCurrency(product.finalPrice || product.price)}</p>
                       {Number(product.price || 0) > Number(product.finalPrice || product.price || 0) ? (
                         <p className="mt-0.5 text-[11px] text-[#6b7280] line-through">{formatCurrency(product.price)}</p>
                       ) : null}
                       {(product.averageRating && Number(product.averageRating) > 0) || (product.totalPurchases && Number(product.totalPurchases) > 0) ? (
                         <div className="flex flex-wrap items-center gap-1 mt-1 mb-1">
                           {product.averageRating && Number(product.averageRating) > 0 ? (
                             <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#b45309] bg-[#fef3c7] border border-[#fde68a] px-1.5 py-0.5 rounded">
                               ★ {Number(product.averageRating).toFixed(1)}
                             </span>
                           ) : null}
                           {product.totalPurchases && Number(product.totalPurchases) > 0 ? (
                             <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#c2410c] bg-[#ffedd5] border border-[#fed7aa] px-1.5 py-0.5 rounded">
                               🔥 Đã bán: {product.totalPurchases}
                             </span>
                           ) : null}
                         </div>
                       ) : null}
                       <p className="mt-0.5 text-[11px] text-[#64748b]">{product.reason}</p>
                     </div>
                   </Link>

                   <div className="flex gap-1 mt-1.5 w-full">
                     <button
                       type="button"
                       className="flex-1 border border-black/10 bg-white text-[#0f2233] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#edf4ff] active:scale-97"
                       onClick={() => {
                         addToCart({ ...product, id: product._id });
                         trackEvent({
                           eventType: "cart",
                           productId: product._id,
                           category: product.category,
                           metadata: {
                             source: "chatbot_add_to_cart",
                           },
                         });
                       }}
                     >
                       Thêm giỏ
                     </button>

                     <button
                       type="button"
                       className="flex-1 border border-black/10 bg-[#fbf5ff] text-[#6b21a8] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#f3e8ff] active:scale-97"
                       onClick={() => {
                         if (!compareProduct1) {
                           setCompareProduct1(product);
                           setMessages((prev) => [
                             ...prev,
                             createMessage("assistant", `Bạn đã chọn **${product.name}** làm sản phẩm đầu tiên. Vui lòng bấm nút **"So sánh"** trên một sản phẩm khác trong danh sách, hoặc gõ tên sản phẩm thứ hai để xem so sánh và nhận xét từ AI.`),
                           ]);
                         } else {
                           if (compareProduct1._id === product._id) {
                             setCompareProduct1(null);
                             setMessages((prev) => [
                               ...prev,
                               createMessage("assistant", `Đã hủy chọn so sánh sản phẩm **${product.name}**.`),
                             ]);
                           } else {
                             const prod1 = compareProduct1;
                             setCompareProduct1(null);
                             sendMessage(`So sánh ${prod1.name} [Mã: ${prod1._id}] và ${product.name} [Mã: ${product._id}]`);
                           }
                         }
                       }}
                     >
                       So sánh
                     </button>

                     <button
                       type="button"
                       className="flex-1 border border-black/10 bg-[#f0fdf4] text-[#166534] rounded-lg min-h-[30px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#dcfce7] active:scale-97"
                       onClick={() => {
                         sendMessage(`Tư vấn chi tiết cấu hình sản phẩm ${product.name} [Mã: ${product._id}]`);
                       }}
                     >
                       Chi tiết
                     </button>
                   </div>
                 </article>
               ))}
             </div>
           ) : null}
         </div>
       </div>
     </article>
     );
    })
  );
}

export default ChatMessageList;
