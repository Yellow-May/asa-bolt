import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useCallback, useRef, type ReactNode } from "react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  busy,
  error,
  children,
  footer,
  onClose,
}: ConfirmationDialogProps) {
  const previousFocus = useRef<HTMLElement | undefined>(undefined);
  const content = useRef<HTMLDivElement | null>(null);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !busy) onClose();
    },
    [busy, onClose],
  );
  const handleOpenFocus = useCallback((event: Event) => {
    if (document.activeElement instanceof HTMLElement)
      previousFocus.current = document.activeElement;
    event.preventDefault();
    content.current?.focus({ preventScroll: true });
  }, []);
  const handleCloseFocus = useCallback((event: Event) => {
    event.preventDefault();
    const target = previousFocus.current?.isConnected
      ? previousFocus.current
      : document.getElementById("page-content");
    target?.focus();
  }, []);

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirmation-overlay" />
        <AlertDialog.Content
          ref={content}
          className="confirmation-dialog"
          aria-busy={busy}
          onOpenAutoFocus={handleOpenFocus}
          onCloseAutoFocus={handleCloseFocus}
        >
          <header className="confirmation-header">
            <AlertDialog.Title>{title}</AlertDialog.Title>
          </header>
          <div className="confirmation-body">
            <AlertDialog.Description>{description}</AlertDialog.Description>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {children}
          </div>
          <footer className="confirmation-footer">
            <AlertDialog.Cancel asChild>
              <button className="button button-secondary" type="button" disabled={busy}>
                Go back
              </button>
            </AlertDialog.Cancel>
            {footer}
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
