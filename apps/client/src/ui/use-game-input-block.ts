import { useEffect } from "react";
import type { WorldClient } from "../net/world-client";

/** Suspende solo controles del mundo; los botones de la ventana siguen activos. */
export function useGameInputBlock(client: WorldClient, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const unblock = client.blockInput();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')]
        .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    window.addEventListener("keydown", trapFocus, true);
    return () => {
      window.removeEventListener("keydown", trapFocus, true);
      unblock();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll:true});
    };
  }, [client, open]);
}
