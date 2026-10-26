import { useEffect, useReducer } from "react";

import type { WorldClient } from "../net/world-client";
import { PlayerEntity } from "./PlayerEntity";

export function Players({ client }: { client: WorldClient }) {
  const [, bumpRoster] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return client.subscribeRoster(() => bumpRoster());
  }, [client]);

  return (
    <>
      {Array.from(client.players.values()).map((player) => (
        <PlayerEntity
          key={player.id}
          view={player}
          isLocal={player.id === client.localId}
          cameraMode={client.cameraMode}
          onSelect={() => client.setTarget(player.id)}
        />
      ))}
    </>
  );
}
