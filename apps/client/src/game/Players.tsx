import { useEffect, useReducer } from "react";

import type { WorldClient } from "../net/world-client";
import { PlayerAvatar } from "./PlayerAvatar";

export function Players({ client }: { client: WorldClient }) {
  const [, bumpRoster] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return client.subscribeRoster(() => bumpRoster());
  }, [client]);

  return (
    <>
      {Array.from(client.players.values()).map((player) => (
        <PlayerAvatar
          key={player.id}
          view={player}
          isLocal={player.id === client.localId}
        />
      ))}
    </>
  );
}
