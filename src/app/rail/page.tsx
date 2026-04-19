/**
 * rail/page.tsx — National Rail tab
 *
 * Lets the user view live departures for long-distance UK rail journeys
 * (e.g. London -> Leeds, London -> Edinburgh) using the Rail Data
 * Marketplace LDBWS REST API.
 *
 * Page sections:
 *   1. Saved routes — pinned cards with next two departures inline
 *   2. From / To search — pick an origin and optional destination
 *   3. Departure board — live arrivals, tap for calling points
 *
 * All styling uses existing dot-matrix primitives (BoardPanel, AmberText)
 * so it matches the rest of the app visually.
 *
 * ----------------------------------------------------------------------
 * FEATURE FLAG (temporary):
 *
 * Until your Rail Data Marketplace API key is in .env.local, this page
 * shows a polished "COMING SOON" placeholder instead of the live UI.
 *
 * TO ENABLE THE FULL UI:
 *   1. Sign up at https://raildata.org.uk
 *   2. Subscribe to "Live Arrival and Departure Boards" (Rail Delivery
 *      Group) — free, usually approved instantly.
 *   3. On that product's Specification tab, copy the Consumer key.
 *   4. Add RDM_API_KEY=<that-key> to .env.local and Vercel env vars.
 *   5. Change RAIL_FEATURE_ENABLED below to `true`.
 *   6. Commit + push — that's it. Calling points come bundled with the
 *      main departure fetch, so no second subscription is needed.
 * ----------------------------------------------------------------------
 */

"use client";

import { useState, useRef } from "react";
import { Star, StarOff, ArrowLeftRight, TrainFront, Mail } from "lucide-react";
import AmberText from "@/components/shared/AmberText";
import BoardPanel from "@/components/shared/BoardPanel";
import RailStationSearch from "@/components/rail/RailStationSearch";
import RailDepartureBoard from "@/components/rail/RailDepartureBoard";
import SavedRouteCard from "@/components/rail/SavedRouteCard";
import ServiceDetailSheet from "@/components/rail/ServiceDetailSheet";
import { useSavedRailJourneys } from "@/hooks/useSavedRailJourneys";
import type { UKRailStation, RailDeparture } from "@/lib/rail-types";
import type { SavedRailJourney } from "@/lib/db";

/**
 * Feature flag: flip to `true` once your RDM_API_KEY is active.
 * See the comment block at the top of this file for details.
 */
const RAIL_FEATURE_ENABLED = false;

/* Local-only minimal station shape used in page state */
interface StationSelection {
  crs: string;
  name: string;
}

/* ========================================
 * TOP-LEVEL PAGE COMPONENT
 * Decides between the Coming Soon placeholder and the full UI based
 * on the RAIL_FEATURE_ENABLED flag. Splitting it this way keeps
 * React's Rules of Hooks happy — hooks only run in RailPageFull,
 * never in the placeholder path.
 * ======================================== */
export default function RailPage() {
  if (!RAIL_FEATURE_ENABLED) {
    return <ComingSoonPlaceholder />;
  }
  return <RailPageFull />;
}

/* ========================================
 * FULL RAIL UI
 * Only renders once the RDM API key is live.
 * ======================================== */
function RailPageFull() {
  /* FROM and TO selections — TO is optional (view all departures if null) */
  const [fromStation, setFromStation] = useState<StationSelection | null>(null);
  const [toStation, setToStation] = useState<StationSelection | null>(null);

  /*
   * Currently expanded departure (opens the ServiceDetailSheet).
   * We keep the full departure object in state — not just an ID — so
   * the sheet can render calling points immediately without a second
   * API call. The calling points are bundled in the initial board
   * response thanks to GetArrDepBoardWithDetails.
   */
  const [expandedDeparture, setExpandedDeparture] =
    useState<RailDeparture | null>(null);

  /* Hook managing saved routes */
  const { journeys, addJourney, removeJourney } = useSavedRailJourneys();

  /* Ref to the departures panel for smooth-scroll on saved-route tap */
  const departuresRef = useRef<HTMLDivElement>(null);

  /* ---- Handlers ---- */

  const handleFromSelect = (station: UKRailStation) => {
    setFromStation({ crs: station.crs, name: station.name });
  };

  const handleToSelect = (station: UKRailStation) => {
    setToStation({ crs: station.crs, name: station.name });
  };

  /** Swap FROM and TO — handy for return journeys */
  const handleSwap = () => {
    const tmpFrom = fromStation;
    setFromStation(toStation);
    setToStation(tmpFrom);
  };

  /** Open a saved route — sets from/to + scrolls to board */
  const handleOpenSaved = (journey: SavedRailJourney) => {
    setFromStation({ crs: journey.fromCrs, name: journey.fromName });
    setToStation({ crs: journey.toCrs, name: journey.toName });
    /* Smooth scroll so the board comes into view on mobile */
    setTimeout(() => {
      departuresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  /** Save current FROM/TO pair to favourites */
  const handleSaveCurrentRoute = async () => {
    if (!fromStation || !toStation) return;
    await addJourney({
      fromCrs: fromStation.crs,
      fromName: fromStation.name,
      toCrs: toStation.crs,
      toName: toStation.name,
    });
  };

  /* Is the currently-selected route already saved? */
  const currentSaved =
    fromStation && toStation
      ? journeys.some(
          (j) =>
            j.fromCrs === fromStation.crs.toUpperCase() &&
            j.toCrs === toStation.crs.toUpperCase()
        )
      : false;

  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          National Rail
        </AmberText>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
          LONG-DISTANCE LIVE DEPARTURES
        </div>
      </div>

      {/* ---- Saved Routes ---- */}
      {journeys.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase px-1">
            SAVED ROUTES
          </div>
          {journeys.map((j) => (
            <SavedRouteCard
              key={j.id}
              journey={j}
              onOpen={handleOpenSaved}
              onRemove={removeJourney}
            />
          ))}
        </div>
      )}

      {/* ---- FROM / TO search ---- */}
      <BoardPanel title="PLAN A JOURNEY">
        <div className="space-y-3">
          <RailStationSearch
            label="FROM"
            placeholder="London Kings Cross..."
            value={fromStation?.name || ""}
            onSelect={handleFromSelect}
          />
          <RailStationSearch
            label="TO (OPTIONAL)"
            placeholder="Leeds, Edinburgh..."
            value={toStation?.name || ""}
            onSelect={handleToSelect}
          />

          {/* Action row: Swap + Save */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSwap}
              disabled={!fromStation && !toStation}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-amber-faint text-amber-faint hover:border-amber hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Swap from and to"
            >
              <ArrowLeftRight size={14} strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                SWAP
              </span>
            </button>

            <button
              onClick={handleSaveCurrentRoute}
              disabled={!fromStation || !toStation || currentSaved}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-amber text-amber hover:bg-amber hover:text-board-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={
                currentSaved ? "Route already saved" : "Save this route"
              }
            >
              {currentSaved ? (
                <>
                  <StarOff size={14} strokeWidth={1.5} />
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    SAVED
                  </span>
                </>
              ) : (
                <>
                  <Star size={14} strokeWidth={1.5} />
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    SAVE ROUTE
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </BoardPanel>

      {/* ---- Departures board (only when FROM is set) ---- */}
      <div ref={departuresRef}>
        {fromStation ? (
          <RailDepartureBoard
            fromCrs={fromStation.crs}
            fromName={fromStation.name}
            toCrs={toStation?.crs || null}
            toName={toStation?.name || null}
            maxRows={10}
            onServiceTap={setExpandedDeparture}
          />
        ) : (
          /* Empty state when nothing chosen yet */
          journeys.length === 0 && (
            <BoardPanel>
              <div className="py-8 text-center space-y-3">
                <AmberText variant="dim" size="sm" uppercase>
                  CHOOSE A STATION TO BEGIN
                </AmberText>
                <p className="font-mono text-xs tracking-wider text-amber-faint">
                  PICK AN ORIGIN ABOVE TO SEE LIVE
                  <br />
                  DEPARTURES FROM ANY UK RAIL STATION
                </p>
              </div>
            </BoardPanel>
          )
        )}
      </div>

      {/* ---- Service detail bottom sheet ---- */}
      <ServiceDetailSheet
        departure={expandedDeparture}
        highlightCrs={toStation?.crs || null}
        onClose={() => setExpandedDeparture(null)}
      />
    </div>
  );
}

/* ========================================
 * COMING SOON PLACEHOLDER
 * Shown until the Rail Data Marketplace API key is approved
 * (up to 3 working days after signing up at raildata.org.uk).
 *
 * Deliberately static — no hooks, no network calls — so this page
 * renders instantly and works fully offline.
 * ======================================== */
function ComingSoonPlaceholder() {
  return (
    <div className="p-4 space-y-4">
      {/* ---- Page Header ---- */}
      <div className="text-center pt-4 pb-2">
        <AmberText as="h1" size="lg" uppercase className="dot-matrix">
          National Rail
        </AmberText>
        <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
          LONG-DISTANCE LIVE DEPARTURES
        </div>
      </div>

      {/* ---- Coming Soon board ---- */}
      <BoardPanel title="SERVICE STATUS">
        <div className="py-8 text-center space-y-5">
          {/* Animated train icon in amber */}
          <div className="flex justify-center">
            <div className="relative">
              <TrainFront
                size={56}
                strokeWidth={1.25}
                className="text-amber amber-glow"
              />
              {/* Subtle pulse underneath */}
              <div
                className="absolute inset-0 -z-10 blur-xl opacity-40"
                style={{ background: "radial-gradient(circle, #ff9500 0%, transparent 70%)" }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Main heading */}
          <div>
            <AmberText
              as="p"
              size="2xl"
              uppercase
              className="dot-matrix animate-blink"
            >
              COMING SOON
            </AmberText>
          </div>

          {/* Body copy */}
          <div className="space-y-3 px-4">
            <p className="font-mono text-xs tracking-wider text-amber uppercase leading-relaxed">
              LIVE DEPARTURES FOR
              <br />
              LONDON -- LEEDS
              <br />
              LONDON -- EDINBURGH
              <br />
              LONDON -- MANCHESTER
              <br />
              LONDON -- BRISTOL
              <br />
              AND ANY UK RAIL ROUTE
            </p>

            <div className="border-t border-board-border mx-6 pt-3">
              <p className="font-mono text-[11px] tracking-wider text-amber-faint uppercase leading-relaxed">
                AWAITING DATA PROVIDER
                <br />
                API APPROVAL
                <br />
                <span className="text-amber-dim">UP TO 3 WORKING DAYS</span>
              </p>
            </div>
          </div>
        </div>
      </BoardPanel>

      {/* ---- Info panel: what's coming ---- */}
      <BoardPanel title="WHAT TO EXPECT">
        <ul className="space-y-2.5 font-mono text-xs tracking-wider text-amber-dim">
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>LIVE DEPARTURE BOARDS FOR ANY UK STATION</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>SAVE YOUR FREQUENT ROUTES FOR ONE-TAP ACCESS</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>TAP A TRAIN TO SEE EVERY STOP ALONG ITS ROUTE</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>PLATFORM INFO, OPERATOR, DELAYS, CANCELLATIONS</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber shrink-0">&gt;</span>
            <span>AUTO-REFRESH EVERY 30 SECONDS</span>
          </li>
        </ul>
      </BoardPanel>

      {/* ---- Email hint ---- */}
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          <Mail size={12} strokeWidth={1.5} />
          <span>WATCH YOUR INBOX FROM RAILDATA.ORG.UK</span>
        </div>
      </div>
    </div>
  );
}
