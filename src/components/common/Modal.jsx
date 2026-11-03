/**
 * Dimmed full-screen overlay that centers its children (the dialog box).
 *
 * Props:
 * - zIndex   {string}  Tailwind z-index class (default: "z-50")
 * - children {node}    Dialog content
 */
function Modal({ zIndex = "z-50", children }) {
  return (
    <div className={`fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center ${zIndex} p-4`} role="presentation">
      {children}
    </div>
  );
}

export default Modal;
