"use client";

import { SheetProvider } from "./sheet-provider";
import { ModalProvider } from "./modal-provider";
import { ConfirmProvider } from "./confirm-provider";
import { ToastProvider } from "./toast-provider";

export default function OverlayProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ModalProvider>
          <SheetProvider>{children}</SheetProvider>
        </ModalProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
