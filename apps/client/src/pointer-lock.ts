export function requestPointerLockSafe(): void {
  const canvas = document.querySelector("canvas");
  const result = canvas?.requestPointerLock() as unknown;

  if (
    result &&
    typeof (result as { catch?: unknown }).catch === "function"
  ) {
    void (result as Promise<void>).catch(() => {
      // El navegador puede rechazar la captura; el jugador puede reintentar.
    });
  }
}

export function exitPointerLockSafe(): void {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}
