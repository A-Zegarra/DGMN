import type { CameraMode, PlayerView } from "../net/world-client";
import { PartnerAvatar } from "./PartnerAvatar";
import { TamerAvatar } from "./TamerAvatar";

export function PlayerEntity({
  view,
  isLocal,
  cameraMode,
  onSelect,
}: {
  view: PlayerView;
  isLocal: boolean;
  cameraMode: CameraMode;
  onSelect?: () => void;
}) {
  const hideTamer = isLocal && cameraMode === "first-person";

  return (
    <>
      {!hideTamer && (
        <TamerAvatar
          view={view}
          isLocal={isLocal}
          showTag={!isLocal}
          onSelect={isLocal ? undefined : onSelect}
        />
      )}
      <PartnerAvatar
        view={view}
        isLocal={isLocal}
        showTag={!isLocal}
        onSelect={isLocal ? undefined : onSelect}
      />
    </>
  );
}
