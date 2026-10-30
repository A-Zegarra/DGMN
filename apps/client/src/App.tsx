import { useEffect, useState } from "react";

import { Game } from "./game/Game";
import { WorldClient } from "./net/world-client";
import { StartScreen } from "./ui/StartScreen";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567";

type ConnectionStatus = "idle" | "connecting" | "error";

export default function App() {
  const [client, setClient] = useState<WorldClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savingExit, setSavingExit] = useState(false);
  const [rememberedName, setRememberedName] = useState(() => {
    try {
      return localStorage.getItem("digiworld:name") ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    document.body.classList.remove("retro");
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }
    client.onDisconnect = () => {
      setClient(null);
      setStatus("idle");
    };
    return () => {
      client.onDisconnect = null;
    };
  }, [client]);

  const handleJoin = async (name: string, species: string) => {
    setStatus("connecting");
    setError(null);
    setRememberedName(name);

    try {
      localStorage.setItem("digiworld:name", name);
    } catch {
      // Almacenamiento no disponible: no es crítico.
    }

    try {
      const next = await WorldClient.connect(SERVER_URL, name, species);
      setClient(next);
      setStatus("idle");
    } catch (joinError) {
      console.error(joinError);
      setStatus("error");
      setError(
        joinError instanceof Error
          ? `No se pudo conectar: ${joinError.message}`
          : "No se pudo conectar con el servidor.",
      );
    }
  };

  const handleExit = async () => {
    if (!client || savingExit) {
      return;
    }
    setSavingExit(true);
    try {
      await client.saveAndLeave();
      setClient(null);
      setStatus("idle");
    } catch (saveError) {
      client.profileSaveError = saveError instanceof Error ? saveError.message : "No se pudo confirmar el guardado.";
    } finally { setSavingExit(false); }
  };

  if (client) {
    return <Game client={client} onExit={() => void handleExit()} />;
  }

  return (
    <StartScreen
      initialName={rememberedName}
      status={status}
      error={error}
      onJoin={handleJoin}
    />
  );
}
