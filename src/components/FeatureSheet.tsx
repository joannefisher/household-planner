"use client";

import { useEffect, useRef } from "react";

// A bottom sheet (centred on the iPad) in the same style as the event and family sheets.
export function FeatureSheet({
  open,
  title,
  onClose,
  onBack,
  className = "",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={dialog} className={`sheet feature-sheet ${className}`} onClose={onClose}>
      {open && (
        <div className="sheet-form">
          <div className="sheet-top">
            {onBack ? (
              <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">‹</button>
            ) : null}
            <h2 className="sheet-title fs-title">{title}</h2>
            <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} aria-label="Close">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
