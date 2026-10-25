import type { CameraMode, PlayerView } from "../net/world-client";
import { PartnerAvatar } from "./PartnerAvatar";
import { TamerAvatar } from "./TamerAvatar";

export function PlayerEntity({
  view,
  isLocal,
  cameraMode,
}: {
  view: PlayerView;
  isLocal: boolean;
  cameraMode: CameraMode;
}) {
  const hideTamer = isLocal && cameraMode === "first-person";

  return (
    <>
      {!hideTamer && <TamerAvatar view={view} isLocal={isLocal} />}
      <PartnerAvatar
        view={view}
        isLocal={isLocal}
        showTag={!hideTamer}
      />
    </>
  );
}
