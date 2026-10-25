import { AgumonModel } from "./AgumonModel";
import { GabumonModel } from "./GabumonModel";
import { GenericModel } from "./GenericModel";
import { PatamonModel } from "./PatamonModel";

export function DigimonModel({
  speciesId,
  moving,
  running,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
}) {
  if (speciesId === "agumon" || speciesId === "greymon") {
    return (
      <AgumonModel
        speciesId={speciesId}
        moving={moving}
        running={running}
      />
    );
  }

  if (speciesId === "gabumon" || speciesId === "garurumon") {
    return (
      <GabumonModel
        speciesId={speciesId}
        moving={moving}
        running={running}
      />
    );
  }

  if (speciesId === "patamon" || speciesId === "angemon") {
    return (
      <PatamonModel
        speciesId={speciesId}
        moving={moving}
        running={running}
      />
    );
  }

  return (
    <GenericModel speciesId={speciesId} moving={moving} running={running} />
  );
}
