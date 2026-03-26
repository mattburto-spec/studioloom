"use client";

import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { Station0Identity } from "./Station0Identity";
import { Station1Campfire } from "./Station1Campfire";
import { Station2Workshop } from "./Station2Workshop";
import { Station3CollectionWall } from "./Station3CollectionWall";
import { Station4Window } from "./Station4Window";
import { Station5Toolkit } from "./Station5Toolkit";
import { Station6Crossroads } from "./Station6Crossroads";
import { Station7Launchpad } from "./Station7Launchpad";
import { StationPlaceholder } from "./StationPlaceholder";
import { TransitionScreen } from "./TransitionScreen";
import { STATION_META } from "@/lib/discovery/state-machine";

/**
 * StationRenderer — delegates rendering to the correct station component.
 *
 * Each station is a self-contained component that receives the session
 * and manages its own interactions. The renderer just picks which one
 * to show based on the current state.
 *
 * Stations built so far:
 * - S0: Station0Identity (palette, tools, workspace)
 * - S1: Station1Campfire (quick-fire binary pairs)
 * - S2: Station2Workshop (scenarios, people grid)
 * - S3: Station3CollectionWall (interests, irritations, values)
 * - S4: Station4Window (scene hotspots, sliders, problem text)
 * - S5: Station5Toolkit (resources, efficacy, experience)
 * - S6: Station6Crossroads (doors, fear cards, project direction)
 * - S7: Station7Launchpad (statement, criteria, excitement, grand reveal)
 */

interface StationRendererProps {
  session: UseDiscoverySessionReturn;
}

export function StationRenderer({ session }: StationRendererProps) {
  const { machine } = session;
  const { current, currentStation, isTransition } = machine;

  // ─── Transition Screens ─────────────────────────────────────
  if (isTransition) {
    // Extract from/to from transition_N_M pattern
    const match = current.match(/^transition_(\d+)_(\d+)$/);
    const fromStation = match ? parseInt(match[1], 10) : (currentStation > 0 ? currentStation - 1 : 0);
    const toStation = match ? parseInt(match[2], 10) : currentStation;
    const fromMeta = STATION_META[fromStation];
    const toMeta = STATION_META[toStation];

    return (
      <TransitionScreen
        fromStation={fromStation}
        toStation={toStation}
        fromName={fromMeta?.name ?? ""}
        toName={toMeta?.name ?? ""}
        toEmoji={toMeta?.emoji ?? ""}
        toDescription={toMeta?.description ?? ""}
        onContinue={session.next}
      />
    );
  }

  // ─── Station Components ─────────────────────────────────────
  switch (currentStation) {
    case 0:
      return <Station0Identity session={session} />;
    case 1:
      return <Station1Campfire session={session} />;
    case 2:
      return <Station2Workshop session={session} />;
    case 3:
      return <Station3CollectionWall session={session} />;
    case 4:
      return <Station4Window session={session} />;
    case 5:
      return <Station5Toolkit session={session} />;
    case 6:
      return <Station6Crossroads session={session} />;
    case 7:
      return <Station7Launchpad session={session} />;
    default:
      return (
        <StationPlaceholder
          station={0}
          name="Unknown"
          description="Something went wrong"
          emoji="❓"
        />
      );
  }
}
