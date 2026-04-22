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

import { useState, useRef, useEffect, useCallback } from "react";
import { Star, ArrowLeftRight, TrainFront, Mail, Check, Trash2, ArrowRight } from "lucide-react";
import { mutate } from "swr";
import AmberText from "@/components/shared/AmberText";
import BoardPanel from "@/components/shared/BoardPanel";
import PageHeader from "@/components/shared/PageHeader";
import PullToRefresh from "@/components/shared/PullToRefresh";
import RailStationSearch from "@/components/rail/RailStationSearch";
import RailDepartureBoard from "@/components/rail/RailDepartureBoard";
import ServiceDetailSheet from "@/components/rail/ServiceDetailSheet";
import TrackedJourneyCard from "@/components/rail/TrackedJourneyCard";
import PlanJourneyPanel from "@/components/rail/PlanJourneyPanel";
import SeatEditor from "@/components/rail/SeatEditor";
import { useSavedRailJourneys } from "@/hooks/useSavedRailJourneys";
import { useTrackedRailJourneys } from "@/hooks/useTrackedRailJourneys";
import { cleanStationName } from "@/lib/utils";
import type { UKRailStation, RailDeparture } from "@/lib/rail-types";
import type { SavedRailJourney, TrackedRailJourney } from "@/lib/db";

/**
 * Feature flag: flip to `false` to hide the live UI behind the
 * Coming Soon placeholder again. See the comment block at the top
 * of this file for setup details.
 */
const RAIL_FEATURE_ENABLED = true;

/* Local-only minimal station shape used in page state */
interface StationSelection {
  crs: string;
  name: string;
}

/*
 * Quick-pick chips — one tap populates FROM or TO.
 * Kept shared between QUICK FROM and QUICK TO so users can build
 * common journeys (e.g. KGX -> LDS) with two taps.
 */
const QUICK_STATION_CHIPS: { crs: string; label: string; name: string }[] = [
  { crs: "KGX", label: "KGX", name: "London Kings Cross" },
  { crs: "LST", label: "LST", name: "London Liverpool Street" },
  { crs: "PAD", label: "PAD", name: "London Paddington" },
  { crs: "LDS", label: "LDS", name: "Leeds" },
  { crs: "EDB", label: "EDB", name: "Edinburgh" },
  { crs: "BRI", label: "BRI", name: "Bristol Temple Meads" },
  { crs: "MAN", label: "MAN", name: "Manchester Piccadilly" },
];

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
   * Deep-link pre-fill from ?fromCrs=&fromName=&toCrs=&toName= query
   * params. Used when the user taps a saved rail route or a rail
   * search result on the Depart tab so the board loads ready-to-go.
   *
   * Reads window.location.search once on mount to avoid pulling the
   * whole page under a Suspense boundary (useSearchParams would).
   */
  const didPrefillFromQuery = useRef(false);
  useEffect(() => {
    if (didPrefillFromQuery.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromCrs = params.get("fromCrs");
    const fromName = params.get("fromName");
    const toCrs = params.get("toCrs");
    const toName = params.get("toName");
    if (!fromCrs && !toCrs) return;
    didPrefillFromQuery.current = true;
    if (fromCrs && fromName) {
      setFromStation({ crs: fromCrs.toUpperCase(), name: fromName });
    }
    if (toCrs && toName) {
      setToStation({ crs: toCrs.toUpperCase(), name: toName });
    }
  }, []);

  /*
   * Currently expanded departure (opens the ServiceDetailSheet).
   * We keep the full departure object in state — not just an ID — so
   * the sheet can render calling points immediately without a second
   * API call. The calling points are bundled in the initial board
   * response thanks to GetArrDepBoardWithDetails.
   *
   * expandedContext carries the from/to the popup should show. When
   * the popup is opened from the main board the context matches the
   * page's fromStation/toStation — but when opened from a tracked
   * journey card, it comes from that card's saved route instead.
   */
  const [expandedDeparture, setExpandedDeparture] =
    useState<RailDeparture | null>(null);
  const [expandedContext, setExpandedContext] = useState<{
    fromCrs: string;
    fromName: string;
    toCrs: string | null;
    toName: string | null;
  } | null>(null);

  /*
   * Transient feedback after a save. Flipping this to true for ~1.5s
   * after addJourney() completes gives the user clear visual
   * confirmation that the save succeeded — without needing a full
   * toast component.
   */
  const [justSaved, setJustSaved] = useState(false);

  /* Hook managing saved routes */
  const { journeys, addJourney, removeJourney } = useSavedRailJourneys();

  /*
   * Hook managing tracked journeys (the service you're actively on
   * or plan to get). Pinned above saved routes; auto-clears once
   * the destination arrival time has passed.
   */
  const {
    journeys: trackedJourneys,
    trackJourney,
    removeJourney: removeTrackedJourney,
    updateJourney: updateTrackedJourney,
  } = useTrackedRailJourneys();

  /* Which tracked journey is currently having its seat edited (null when closed). */
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);

  /* Ref to the departures panel for smooth-scroll on saved-route tap */
  const departuresRef = useRef<HTMLDivElement>(null);

  /* ---- Handlers ---- */

  const handleFromSelect = (station: UKRailStation) => {
    setFromStation({ crs: station.crs, name: station.name });
  };

  const handleToSelect = (station: UKRailStation) => {
    setToStation({ crs: station.crs, name: station.name });
  };

  /** One-tap pick a common station as the FROM input. */
  const handleQuickFrom = (chip: { crs: string; name: string }) => {
    setFromStation({ crs: chip.crs, name: chip.name });
  };

  /** One-tap pick a common station as the TO input. */
  const handleQuickTo = (chip: { crs: string; name: string }) => {
    setToStation({ crs: chip.crs, name: chip.name });
  };

  /**
   * Page-level pull-to-refresh handler. Uses SWR's global mutate to
   * invalidate every /api/rail/departures key — that covers the main
   * board AND every saved-route card, each of which has its own SWR
   * key based on its from/to CRS pair. Pulling from the top of the
   * page therefore refreshes everything the user can see.
   */
  const handlePullRefresh = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/rail/departures"),
      undefined,
      { revalidate: true }
    );
  }, []);

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

  /** Save current FROM/TO pair to favourites and flash the feedback state. */
  const handleSaveCurrentRoute = async () => {
    if (!fromStation || !toStation) return;
    await addJourney({
      fromCrs: fromStation.crs,
      fromName: fromStation.name,
      toCrs: toStation.crs,
      toName: toStation.name,
    });
    setJustSaved(true);
  };

  /*
   * Tap on a service row in the main departure board. Opens the
   * calling-points popup with the page's current from/to as context.
   */
  const handleServiceTap = useCallback(
    (dep: RailDeparture) => {
      if (!fromStation) return;
      setExpandedDeparture(dep);
      setExpandedContext({
        fromCrs: fromStation.crs,
        fromName: fromStation.name,
        toCrs: toStation?.crs || null,
        toName: toStation?.name || null,
      });
    },
    [fromStation, toStation]
  );

  /*
   * Tap on a tracked-journey card. Opens the same calling-points
   * popup using the tracked journey's from/to as context (not the
   * page's fromStation/toStation, which may differ).
   */
  const handleTrackedOpen = useCallback(
    (tracked: TrackedRailJourney, live: RailDeparture | null) => {
      if (!live) return;
      setExpandedDeparture(live);
      setExpandedContext({
        fromCrs: tracked.fromCrs,
        fromName: tracked.fromName,
        toCrs: tracked.toCrs,
        toName: tracked.toName,
      });
    },
    []
  );

  /*
   * TRACK JOURNEY handler for the popup. Captures the service's
   * scheduled time + the destination ETA so the tracked card has
   * everything it needs — including the expiry for auto-clear.
   */
  const handleTrackJourney = useCallback(
    async (ctx: {
      departure: RailDeparture;
      fromCrs: string;
      fromName: string;
      toCrs: string;
      toName: string;
      destinationEta: string;
    }) => {
      /* Today's local date in YYYY-MM-DD so it matches the card's comparison. */
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      await trackJourney({
        fromCrs: ctx.fromCrs,
        fromName: ctx.fromName,
        toCrs: ctx.toCrs,
        toName: ctx.toName,
        travelDate: `${y}-${m}-${d}`,
        scheduledDeparture: ctx.departure.scheduledDeparture,
        destinationEta: ctx.destinationEta,
        serviceId: ctx.departure.serviceId,
      });
    },
    [trackJourney]
  );

  /*
   * Save handler for the PlanJourneyPanel (future-dated journeys).
   * destinationEta defaults to "23:59" so the card stays pinned until
   * end-of-travel-day; once live data arrives on travel day, the card
   * calls back via handleEtaResolved to overwrite this with the real
   * arrival time so auto-clear fires at the right moment.
   */
  const handlePlanJourney = useCallback(
    async (input: {
      fromCrs: string;
      fromName: string;
      toCrs: string;
      toName: string;
      travelDate: string;
      scheduledDeparture: string;
      seatCoach: string;
      seatNumber: string;
    }) => {
      await trackJourney({
        fromCrs: input.fromCrs,
        fromName: input.fromName,
        toCrs: input.toCrs,
        toName: input.toName,
        travelDate: input.travelDate,
        scheduledDeparture: input.scheduledDeparture,
        destinationEta: "23:59",
        seatCoach: input.seatCoach,
        seatNumber: input.seatNumber,
      });
    },
    [trackJourney]
  );

  /* Seat save handler used by the SeatEditor modal. */
  const handleSaveSeat = useCallback(
    async (id: string, coach: string, seat: string) => {
      await updateTrackedJourney(id, {
        seatCoach: coach,
        seatNumber: seat,
      });
    },
    [updateTrackedJourney]
  );

  /*
   * Called by TrackedJourneyCard when live data resolves a more
   * accurate destination ETA than the one stored (e.g. on travel
   * day for a journey planned days ahead). We write it back so
   * auto-clear fires at the right moment.
   */
  const handleEtaResolved = useCallback(
    async (id: string, destinationEta: string, serviceId?: string) => {
      await updateTrackedJourney(id, { destinationEta, serviceId });
    },
    [updateTrackedJourney]
  );

  const editingJourney = editingSeatId
    ? trackedJourneys.find((j) => j.id === editingSeatId) ?? null
    : null;

  /*
   * Is the currently-expanded service already in the tracked list?
   * Used to grey out the TRACK button and show "TRACKING" instead.
   */
  const expandedFromUpper = expandedContext?.fromCrs?.toUpperCase();
  const expandedToUpper = expandedContext?.toCrs?.toUpperCase();
  const expandedScheduled = expandedDeparture?.scheduledDeparture;
  const expandedIsTracked =
    !!expandedScheduled &&
    !!expandedFromUpper &&
    !!expandedToUpper &&
    trackedJourneys.some(
      (j) =>
        j.fromCrs === expandedFromUpper &&
        j.toCrs === expandedToUpper &&
        j.scheduledDeparture === expandedScheduled
    );

  /*
   * Auto-clear the justSaved flash after 1.5s. Using an effect rather
   * than inline setTimeout keeps the timeout tied to component
   * lifecycle — if the user navigates away mid-flash, nothing leaks.
   */
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

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
    /*
     * Page-level PullToRefresh so pulling down from anywhere on the
     * Rail tab (not just the departure board area) triggers a refresh
     * of all rail-related SWR data.
     */
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        <PageHeader
          title="National Rail"
          subtitle="LONG-DISTANCE LIVE DEPARTURES"
        />

      {/*
       * Tracked journeys — active / upcoming services the user has
       * pinned. Rendered above saved routes so the "I'm on this
       * train" tile is the first thing the user sees.
       */}
      {trackedJourneys.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase px-1">
            MY JOURNEY
          </div>
          <div className="space-y-2">
            {trackedJourneys.map((t) => (
              <TrackedJourneyCard
                key={t.id}
                journey={t}
                onOpen={handleTrackedOpen}
                onRemove={removeTrackedJourney}
                onEditSeat={(id) => setEditingSeatId(id)}
                onEtaResolved={handleEtaResolved}
              />
            ))}
          </div>
        </div>
      )}

      {/*
       * Saved Routes — horizontal scroll strip (mirrors the Plan tab's
       * pattern). Each chip is tap-to-open and has a small remove
       * button. Station names are cleaned so long pairs still fit on
       * one line inside a compact chip.
       */}
      {journeys.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase px-1">
            SAVED ROUTES
          </div>
          <div
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {journeys.map((j) => (
              <div
                key={j.id}
                onClick={() => handleOpenSaved(j)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenSaved(j);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open ${j.fromName} to ${j.toName}`}
                className="shrink-0 snap-start border border-board-border bg-surface p-2.5 cursor-pointer hover:border-amber-faint focus:border-amber-faint focus:outline-none transition-colors flex items-center gap-1.5 min-w-0"
              >
                <Star
                  size={11}
                  strokeWidth={1.5}
                  fill="currentColor"
                  className="text-amber shrink-0"
                />
                <span className="font-mono text-[11px] tracking-wider text-amber uppercase whitespace-nowrap flex items-center gap-1.5">
                  {cleanStationName(j.fromName)}
                  <ArrowRight size={10} strokeWidth={1.5} className="text-amber-faint" />
                  {cleanStationName(j.toName)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeJourney(j.id);
                  }}
                  className="shrink-0 ml-1 p-1 text-amber-faint hover:text-red-500 transition-colors"
                  aria-label={`Remove ${j.fromName} to ${j.toName}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- FROM / TO search (renamed from "PLAN A JOURNEY" to avoid
           collision with the separate PLAN nav tab for TfL journeys). */}
      <BoardPanel title="NEW ROUTE">
        <div className="space-y-3">
          {/* Quick chips — one tap sets FROM. */}
          <div>
            <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
              QUICK FROM
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STATION_CHIPS.map((t) => {
                const isActive = fromStation?.crs === t.crs;
                return (
                  <button
                    key={t.crs}
                    onClick={() => handleQuickFrom(t)}
                    aria-label={`Set from to ${t.name}`}
                    title={t.name}
                    className={`px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                      isActive
                        ? "border-amber text-amber bg-amber/10"
                        : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <RailStationSearch
            label="FROM"
            placeholder="Or search any UK station..."
            value={fromStation?.name || ""}
            onSelect={handleFromSelect}
            onClear={() => setFromStation(null)}
          />

          {/* Quick chips — one tap sets TO. */}
          <div>
            <div className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mb-1.5">
              QUICK TO
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STATION_CHIPS.map((t) => {
                const isActive = toStation?.crs === t.crs;
                return (
                  <button
                    key={t.crs}
                    onClick={() => handleQuickTo(t)}
                    aria-label={`Set to ${t.name}`}
                    title={t.name}
                    className={`px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
                      isActive
                        ? "border-amber text-amber bg-amber/10"
                        : "border-board-border text-amber-faint hover:border-amber-faint hover:text-amber"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <RailStationSearch
            label="TO (OPTIONAL)"
            placeholder="Filter to destination..."
            value={toStation?.name || ""}
            onSelect={handleToSelect}
            onClear={() => setToStation(null)}
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 border transition-all duration-200 disabled:cursor-not-allowed ${
                justSaved
                  ? "border-amber bg-amber text-board-bg amber-glow"
                  : "border-amber text-amber hover:bg-amber hover:text-board-bg disabled:opacity-40"
              }`}
              aria-label={
                currentSaved ? "Route already saved" : "Save this route"
              }
            >
              {/*
               * Three visual states on the save button:
               *   1. justSaved (transient, ~1.5s): filled amber bg with a
               *      check mark and "SAVED!" — confirms action succeeded.
               *   2. currentSaved (persistent): filled Star + "SAVED".
               *   3. default: outline Star + "SAVE ROUTE".
               *
               * Using StarOff for state 2 would read as "this star is
               * disabled", which is the wrong affordance for "already
               * saved"; so we use a filled Star instead.
               */}
              {justSaved ? (
                <>
                  <Check size={14} strokeWidth={2} />
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    SAVED!
                  </span>
                </>
              ) : currentSaved ? (
                <>
                  <Star size={14} strokeWidth={1.5} fill="currentColor" />
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

      {/* ---- Track journey (collapsible form) ---- */}
      <PlanJourneyPanel
        quickChips={QUICK_STATION_CHIPS}
        onPlan={handlePlanJourney}
      />

      {/* ---- Departures board (only when FROM is set) ---- */}
      <div ref={departuresRef}>
        {fromStation ? (
          <RailDepartureBoard
            fromCrs={fromStation.crs}
            fromName={fromStation.name}
            toCrs={toStation?.crs || null}
            toName={toStation?.name || null}
            maxRows={10}
            onServiceTap={handleServiceTap}
          />
        ) : (
          /* Empty state only when the page has nothing else to show */
          journeys.length === 0 && trackedJourneys.length === 0 && (
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

        {/* ---- Service detail popup ---- */}
        <ServiceDetailSheet
          departure={expandedDeparture}
          highlightCrs={expandedContext?.toCrs || null}
          highlightName={expandedContext?.toName || null}
          fromName={expandedContext?.fromName || null}
          fromCrs={expandedContext?.fromCrs || null}
          onTrack={handleTrackJourney}
          alreadyTracked={expandedIsTracked}
          onClose={() => {
            setExpandedDeparture(null);
            setExpandedContext(null);
          }}
        />

        {/* ---- Seat reservation editor ---- */}
        <SeatEditor
          open={!!editingJourney}
          initialCoach={editingJourney?.seatCoach}
          initialSeat={editingJourney?.seatNumber}
          onSave={(coach, seat) => {
            if (!editingJourney) return;
            return handleSaveSeat(editingJourney.id, coach, seat);
          }}
          onClose={() => setEditingSeatId(null)}
        />
      </div>
    </PullToRefresh>
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
      <PageHeader
        title="National Rail"
        subtitle="LONG-DISTANCE LIVE DEPARTURES"
      />

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
