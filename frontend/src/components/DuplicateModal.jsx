/**
 * DuplicateModal.jsx
 *
 * Drop-in modal shown when a duplicate file is detected during upload.
 * Parent component passes:
 *   - duplicateFile: the existing File record from the server
 *   - newFileName:   the name of the file the user is trying to upload
 *   - onRename:      () => void  — user chooses to rename & upload anyway
 *   - onReplace:     () => void  — user wants to replace existing file
 *   - onCancel:      () => void  — user cancels upload
 */
export default function DuplicateModal({ duplicateFile, newFileName, onRename, onReplace, onCancel }) {
  if (!duplicateFile) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 mx-auto mb-5">
          <i className="fas fa-triangle-exclamation text-amber-500 text-2xl"></i>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 text-center mb-1">Duplicate File Detected</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          A file with the same content already exists in your storage.
        </p>

        {/* File info */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">You're uploading</p>
            <p className="text-sm font-semibold text-slate-800 break-all">{newFileName}</p>
          </div>
          <div className="border-t border-slate-200 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Existing file</p>
            <p className="text-sm font-semibold text-slate-800 break-all">{duplicateFile.original_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {duplicateFile.file_size_display} · Uploaded {new Date(duplicateFile.uploaded_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onRename}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <i className="fas fa-pen-to-square"></i> Rename & Upload
          </button>
          <button
            onClick={onReplace}
            className="w-full py-3.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-2xl font-bold text-sm hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-arrow-rotate-right"></i> Replace Existing
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-xmark"></i> Cancel Upload
          </button>
        </div>
      </div>
    </div>
  )
}