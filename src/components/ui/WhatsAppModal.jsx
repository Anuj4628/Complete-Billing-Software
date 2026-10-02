import { useState } from 'react'
import { X, CheckCircle, Copy, FolderOpen, MessageCircle, ChevronRight } from 'lucide-react'

/**
 * WhatsAppModal
 * Shows after PDF is silently saved to Desktop.
 * Guides user through 3 steps to share the PDF on WhatsApp.
 *
 * Props:
 *   open        – boolean
 *   onClose     – fn()
 *   filePath    – string  (full path where PDF was saved)
 *   waUrl       – string  (WhatsApp URL with pre-filled text)
 *   fileName    – string  (just the filename, for display)
 */
export default function WhatsAppModal({ open, onClose, filePath, waUrl, fileName }) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function handleCopyPath() {
    if (window.api?.clipboard?.writeText) {
      await window.api.clipboard.writeText(filePath)
    } else {
      try { await navigator.clipboard.writeText(filePath) } catch (_) {}
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShowInFolder() {
    if (window.api?.shell?.showItemInFolder) {
      await window.api.shell.showItemInFolder(filePath)
    }
  }

  function handleOpenWhatsApp() {
    window.open(waUrl, '_blank')
  }

  // Extract phone number for display from waUrl (wa.me/XXXXXXXXXXX)
  const phoneDisplay = waUrl?.match(/wa\.me\/(\d+)/)?.[1] || 'customer'

  const steps = [
    {
      num: 1,
      icon: <FolderOpen size={20} className="text-blue-500" />,
      title: 'PDF folder opened automatically',
      desc: (
        <>
          The folder containing <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">{fileName}</span> has been opened for you.
        </>
      ),
      actions: (
        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            onClick={handleShowInFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition-colors border border-blue-200 dark:border-blue-800"
          >
            <FolderOpen size={13} /> Re-open Folder
          </button>
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700"
          >
            {copied
              ? <><CheckCircle size={13} className="text-green-500" /> Copied!</>
              : <><Copy size={13} /> Copy Path</>
            }
          </button>
        </div>
      ),
    },
    {
      num: 2,
      icon: <MessageCircle size={20} className="text-green-500" />,
      title: 'Go to the WhatsApp window',
      desc: 'The chat with the pre-filled message has been opened. If you don\'t see it, click below.',
      actions: (
        <button
          onClick={handleOpenWhatsApp}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm"
        >
          <MessageCircle size={15} />
          Go to Chat
          <ChevronRight size={14} />
        </button>
      ),
    },
    {
      num: 3,
      icon: <CheckCircle size={20} className="text-purple-500" />,
      title: 'Paste the PDF (Ctrl + V)',
      desc: (
        <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg">
          <p className="text-sm text-green-900 dark:text-green-300 font-bold mb-1">Easiest Way:</p>
          <p className="text-xs text-green-700 dark:text-green-400">
            The PDF file has been <span className="font-bold">automatically copied</span> to your clipboard. 
            Just go to the WhatsApp chat and press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-sans font-bold shadow-sm">Ctrl + V</kbd> to paste it, then hit Send.
          </p>
          <p className="text-[10px] text-gray-400 mt-2 italic border-t border-green-100 dark:border-green-800/20 pt-2">
            Alternatively, you can still drag the file from the folder that just opened.
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Share Invoice on WhatsApp
              </h3>
              <p className="text-xs text-gray-500">Follow these 3 steps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-4 space-y-4">
          {steps.map((step, i) => (
            <div key={step.num} className="flex gap-3">
              {/* Step number + connector */}
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 mt-1 bg-gray-200 dark:bg-gray-700 min-h-[16px]" />
                )}
              </div>

              {/* Content */}
              <div className="pb-2 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {step.icon}
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {step.title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {step.desc}
                </p>
                {step.actions}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            💡 WhatsApp doesn't support auto-attaching files — this is the fastest manual way.
          </p>
        </div>
      </div>
    </div>
  )
}
