import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot, faCheck, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function AdminChatMessages({ handleCancelConfirm, handleConfirm, messages }) {
  return (
    messages.map((msg, i) => {
     // Tool execution pill
     if (msg.role === 'tool') {
       return (
         <div key={i} className="flex items-center justify-center my-1 animate-fade-in">
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] text-blue-700 font-mono shadow-2xs font-semibold">
             <FontAwesomeIcon icon={faCheck} className="text-[10px] text-blue-600" />
             <span>{msg.content}</span>
           </div>
         </div>
       );
     }

     // Operation Confirmation request
     if (msg.role === 'confirmation') {
       return (
         <div key={i} className="flex gap-3 items-start animate-fade-in max-w-2xl">
           <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
             <FontAwesomeIcon icon={faTriangleExclamation} />
           </div>
           <div className="p-4 rounded-2xl rounded-tl-xs bg-amber-50 border border-amber-300 shadow-sm">
             <p className="m-0 mb-3 text-xs text-amber-900 font-bold leading-relaxed">
               ⚠️ Yêu cầu xác nhận thao tác quản trị:
             </p>
             <p className="m-0 mb-3 text-xs text-slate-700 leading-relaxed font-medium">
               {msg.content}
             </p>
             <div className="flex gap-2">
               <button
                 type="button"
                 onClick={() => handleConfirm(msg.confirmationData)}
                 className="px-4 py-1.5 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
               >
                 Xác nhận thực hiện
               </button>
               <button
                 type="button"
                 onClick={handleCancelConfirm}
                 className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
               >
                 Hủy bỏ
               </button>
             </div>
           </div>
         </div>
       );
     }

     const isUser = msg.role === 'user';

     return (
       <div
         key={i}
         className={`flex gap-3 items-start animate-fade-in ${
           isUser ? 'flex-row-reverse self-end max-w-2xl' : 'self-start max-w-2xl'
         }`}
       >
         {/* Avatar */}
         <div
           className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold shadow-xs ${
             isUser
               ? 'bg-slate-900 text-white'
               : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
           }`}
         >
           {isUser ? 'AD' : <FontAwesomeIcon icon={faRobot} />}
         </div>

         {/* Message Bubble */}
         <div
           className={`px-4 sm:px-5 py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs break-words ${
             isUser
               ? 'bg-blue-600 text-white rounded-tr-xs font-medium'
               : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs [&_th]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:text-slate-800 [&_th]:font-bold [&_td]:p-2 [&_td]:border [&_td]:border-slate-200 [&_code]:bg-slate-100 [&_code]:text-blue-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-2 [&_strong]:text-slate-900 [&_strong]:font-bold [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:pl-5 [&_ol]:my-1.5 [&_a]:text-blue-600 [&_a]:underline'
           }`}
         >
           {msg.role === 'assistant' ? (
             msg.content ? (
               <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
             ) : (
               <div className="flex gap-1.5 py-1 items-center">
                 <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                 <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.15s]" />
                 <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.3s]" />
               </div>
             )
           ) : (
             msg.content
           )}
         </div>
       </div>
     );
    })
  );
}

export default AdminChatMessages;
