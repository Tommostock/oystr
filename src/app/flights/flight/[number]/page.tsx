/**
 * flights/flight/[number]/page.tsx — Single-flight detail view
 *
 * Lands here from:
 *   - The "FIND A FLIGHT" search box on /flights
 *   - Tapping a row on any FlightDepartureBoard / FlightArrivalsBoard
 *
 * Shows a dot-matrix styled breakdown of one flight: the two airports,
 * all relevant times (scheduled / estimated / actual), terminal + gate
 * + baggage belt, aircraft info, great-circle distance + duration, and
 * live GPS position when the aircraft is airborne.
 */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plane,
  Clock,
  Radio,
  Star,
  Armchair,
  Check,
  Calendar,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import BoardPanel from "@/components/shared/BoardPanel";
import BoardState from "@/components/shared/BoardState";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FlightSeatEditor from "@/components/flights/FlightSeatEditor";
import { useFlightDetail } from "@/hooks/useFlightDetail";
import { useTrackedFlights } from "@/hooks/useTrackedFlights";
import { formatAirportFullName } from "@/lib/airports";
import type { FlightDetail, FlightDetailLeg } from "@/lib/flight-types";

/*
 * FlightMap depends on Leaflet, which touches `window` at import
 * time and breaks SSR. Loading it dynamically with ssr: false
 * defers the import to the browser.
 */
const FlightMap = dynamic(
  () => import("@/components/flights/FlightMap"),
  { ssr: false, loading: () => (
    <div className="w-full h-[280px] border border-board-border bg-surface flex items-center justify-center">
      <span className="font-mono text-[10px] tracking-widest text-amber-faint uppercase">
        MAP LOADING...
      </span>
    </div>
  ) }
);

interface PageProps {
  /* Next.js 15 passes dynamic params as a Promise in client pages. */
  params: Promise<{ number: string }>;
}

/* ========================================
 * UTILITIES
 * ======================================== */

/**
 * Map normalised status to a CSS class string so we can colour the
 * status chip consistently. Greens for on-track, ambers for delays
 * and planning-stage, reds for bad news.
 */
function statusChipClasses(status: FlightDetail["status"]): string {
  switch (status) {
    case "on-time":
    case "boarding":
    case "landed":
      return "border-good text-good bg-good/10";
    case "cancelled":
    case "diverted":
    case "gate-closed":
      return "border-bad text-bad bg-bad/10";
    case "delayed":
      return "border-amber text-amber bg-amber/15 amber-glow";
    default:
      return "border-amber-faint text-amber-faint";
  }
}

/**
 * Pretty-print the status. Replaces the kebab-case enum with
 * upper-case words so it looks like the lettering on a real board.
 */
function prettyStatus(status: FlightDetail["status"]): string {
  switch (status) {
    case "on-time":    return "ON TIME";
    case "gate-closed": return "GATE CLOSED";
    case "unknown":    return "SCHEDULED";
    default:           return status.toUpperCase();
  }
}

/**
 * Format a duration in minutes as e.g. "7h 50m".
 */
function formatDuration(minutes: number | null): string | null {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}M`;
  if (m === 0) return `${h}H`;
  return `${h}H ${m}M`;
}

/**
 * Distance in km → "5,554 KM / 3,451 MI".
 */
function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  const miles = Math.round(km * 0.621371);
  return `${Math.round(km).toLocaleString()} KM / ${miles.toLocaleString()} MI`;
}

/**
 * Render an ISO date (YYYY-MM-DD) as e.g. "WED 22 APR 2026".
 * Returns the raw string unchanged if it can't be parsed.
 */
function formatFlightDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

/* ========================================
 * LEG PANEL
 * One airport block — used twice (departure, arrival). Laid out as a
 * big airport code on the left, city underneath, then a column with
 * times and terminal/gate/belt details on the right.
 * ======================================== */
interface LegPanelProps {
  title: string;
  leg: FlightDetailLeg;
  variant: "departure" | "arrival";
}

function LegPanel({ title, leg, variant }: LegPanelProps) {
  const { airport, scheduledTime, scheduledDate, estimatedTime, actualTime } =
    leg;

  // Choose the most useful "display" time: actual > estimated > scheduled
  const displayTime = actualTime ?? estimatedTime ?? scheduledTime;
  const isDelayed =
    estimatedTime != null && estimatedTime !== scheduledTime && !actualTime;

  /*
   * Disambiguated full name ("London Gatwick" not just "London") so
   * the user can tell apart the 5 London airports, 2 Paris airports,
   * 2 Milan airports, etc. at a glance.
   */
  const fullName = formatAirportFullName({
    name: airport.name,
    city: airport.city,
  });

  return (
    <BoardPanel title={title}>
      <div className="p-3 space-y-3">
        {/* Airport code + full disambiguated name */}
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-board text-4xl tracking-wider text-amber amber-glow">
              {airport.iata}
            </span>
          </div>
          <div
            className="font-mono text-[11px] tracking-wider text-amber-faint uppercase truncate mt-0.5"
            title={fullName}
          >
            {fullName}
          </div>
        </div>

        {/* Primary time (large, amber, glow) */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-board text-3xl tracking-wider text-amber amber-glow">
              {displayTime}
            </span>
            {isDelayed && (
              <span className="font-mono text-[10px] tracking-wider text-bad uppercase">
                DELAYED
              </span>
            )}
            {actualTime && (
              <span className="font-mono text-[10px] tracking-wider text-good uppercase">
                ACTUAL
              </span>
            )}
          </div>
          {displayTime !== scheduledTime && (
            <p className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
              SCHEDULED {scheduledTime}
            </p>
          )}
          {/* Date under the time so the user knows which day this is */}
          {scheduledDate && (
            <p className="font-mono text-[9px] tracking-widest text-amber-faint uppercase mt-0.5 flex items-center gap-1">
              <Calendar size={9} strokeWidth={1.5} />
              {formatFlightDate(scheduledDate)}
            </p>
          )}
        </div>

        {/* Terminal / Gate / Check-in / Belt — a responsive grid */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-board-border">
          <DetailItem label="TERMINAL" value={leg.terminal} />
          <DetailItem label="GATE" value={leg.gate} />
          {variant === "departure" && (
            <DetailItem label="CHECK-IN" value={leg.checkInDesk} />
          )}
          {variant === "arrival" && (
            <DetailItem label="BELT" value={leg.baggageBelt} />
          )}
        </dl>
      </div>
    </BoardPanel>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-widest text-amber-faint uppercase">
        {label}
      </dt>
      <dd className="font-board text-lg tracking-wider text-amber uppercase">
        {value || <span className="text-amber-faint">TBA</span>}
      </dd>
    </div>
  );
}

/* ========================================
 * PAGE
 * ======================================== */
export default function FlightDetailPage({ params }: PageProps) {
  const { number: rawNumber } = use(params);
  /*
   * Decode %20 if present so the header reads "BA 175" instead of
   * "BA%20175". The hook re-encodes before calling the API.
   */
  const flightNumber = decodeURIComponent(rawNumber).toUpperCase();

  const { flight, isLoading, error, notConfigured, notFound, refresh } =
    useFlightDetail({ flightNumber });

  const {
    flights: trackedFlights,
    trackFlight,
    removeFlight,
    updateSeats,
    buildTrackedFlightId,
  } = useTrackedFlights();

  /*
   * The tracked-flight ID we'd save this flight under, if we could.
   * Null while we don't yet know the travel date (i.e. before live
   * data resolves). Keeping this derived rather than stored keeps
   * the Save/Tracked toggle reactive to live data updates.
   */
  const trackedId =
    flight && flight.departure.scheduledDate
      ? buildTrackedFlightId({
          flightNumber: flight.flightNumber,
          travelDate: flight.departure.scheduledDate,
        })
      : null;

  const trackedRecord =
    trackedId != null
      ? trackedFlights.find((f) => f.id === trackedId) ?? null
      : null;
  const isTracked = trackedRecord !== null;

  /* Seat-editor modal open/closed */
  const [seatEditorOpen, setSeatEditorOpen] = useState(false);

  /* Brief "just tracked" flash on the button */
  const [justTracked, setJustTracked] = useState(false);
  useEffect(() => {
    if (!justTracked) return;
    const id = setTimeout(() => setJustTracked(false), 1500);
    return () => clearTimeout(id);
  }, [justTracked]);

  const handlePullRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  /**
   * Toggle tracking for the current flight. Uses live data to fill
   * in all the fields we'll need later (airports, times, UTC arrival
   * for auto-clear).
   */
  const handleToggleTrack = useCallback(async () => {
    if (!flight) return;
    if (trackedRecord) {

      await removeFlight(trackedRecord.id);
      return;
    }

    /*
     * Use the real UTC timestamp from the provider. Falling back to
     * dep_date + arr_local + Z would double-count the departure
     * airport's UTC offset and silently break auto-clear for any
     * transatlantic / intercontinental flight.
     */
    const arrivalIso =
      flight.arrival.scheduledTimeUtc ??
      flight.departure.scheduledTimeUtc ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await trackFlight({
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      airlineCode: flight.airlineCode,
      travelDate: flight.departure.scheduledDate,
      departureIata: flight.departure.airport.iata,
      departureName: flight.departure.airport.name,
      departureCity: flight.departure.airport.city,
      arrivalIata: flight.arrival.airport.iata,
      arrivalName: flight.arrival.airport.name,
      arrivalCity: flight.arrival.airport.city,
      scheduledDeparture: flight.departure.scheduledTime,
      scheduledArrivalUtc: arrivalIso,
      seats: [],
    });
    setJustTracked(true);
  }, [flight, trackedRecord, trackFlight, removeFlight]);

  /** Persist the edited seat list to IndexedDB. */
  const handleSeatsSave = useCallback(
    async (seats: string[]) => {
      if (!trackedRecord) return;
      await updateSeats(trackedRecord.id, seats);
    },
    [trackedRecord, updateSeats]
  );

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="p-4 space-y-4">
        <PageHeader
          title="Flight"
          subtitle="LIVE FLIGHT DETAIL"
          back={{
            href: "/flights",
            label: "FLIGHTS",
            ariaLabel: "Back to Flights",
          }}
        />

        {/* ---- Flight-number header ---- */}
        <div className="border border-board-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-faint">
            <Plane size={14} strokeWidth={1.5} />
            <span className="font-mono text-[10px] tracking-widest uppercase">
              FLIGHT
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-board text-3xl tracking-wider text-amber uppercase amber-glow">
              {flight?.flightNumber || flightNumber}
            </h2>
            {flight?.airline && (
              <span className="font-mono text-xs tracking-wider text-amber uppercase truncate">
                {flight.airline}
              </span>
            )}
          </div>
          {flight?.callSign && (
            <p className="font-mono text-[10px] tracking-wider text-amber-faint uppercase flex items-center gap-1.5">
              <Radio size={10} strokeWidth={1.5} />
              CALL SIGN {flight.callSign}
            </p>
          )}
          {flight && (
            <div className="pt-1 flex items-center gap-2 flex-wrap">
              <span
                className={
                  "inline-block px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase border " +
                  statusChipClasses(flight.status)
                }
              >
                {prettyStatus(flight.status)}
              </span>

              {/* ---- Track / Tracked toggle ---- */}
              <button
                onClick={handleToggleTrack}
                aria-label={
                  isTracked
                    ? `Stop tracking ${flight.flightNumber}`
                    : `Track ${flight.flightNumber}`
                }
                aria-pressed={isTracked}
                className={
                  "ml-auto inline-flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] tracking-widest uppercase transition-colors " +
                  (isTracked
                    ? "border-amber text-amber bg-amber/10 amber-glow"
                    : "border-board-border text-amber-faint hover:border-amber hover:text-amber")
                }
              >
                {justTracked ? (
                  <>
                    <Check size={10} strokeWidth={2} />
                    TRACKED
                  </>
                ) : isTracked ? (
                  <>
                    <Star
                      size={10}
                      strokeWidth={1.5}
                      className="fill-amber"
                    />
                    TRACKING
                  </>
                ) : (
                  <>
                    <Star size={10} strokeWidth={1.5} />
                    TRACK
                  </>
                )}
              </button>

              {/* ---- Seats button — only when tracking ---- */}
              {isTracked && (
                <button
                  onClick={() => setSeatEditorOpen(true)}
                  aria-label={
                    (trackedRecord?.seats.length ?? 0) > 0
                      ? "Edit seats"
                      : "Add seats"
                  }
                  className="inline-flex items-center gap-1.5 px-2 py-1 border border-board-border text-amber-faint hover:border-amber hover:text-amber font-mono text-[10px] tracking-widest uppercase transition-colors"
                >
                  <Armchair size={10} strokeWidth={1.5} />
                  {(trackedRecord?.seats.length ?? 0) > 0
                    ? trackedRecord?.seats.join(" ")
                    : "ADD SEATS"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ---- Content states ---- */}
        {notConfigured && (
          <BoardPanel title="FLIGHT">
            <BoardState
              variant="notConfigured"
              message="AWAITING API KEY"
              hint="Set FLIGHTS_API_KEY in your environment to enable flight search."
            />
          </BoardPanel>
        )}

        {!notConfigured && notFound && (
          <BoardPanel title="FLIGHT">
            <BoardState
              variant="empty"
              message="FLIGHT NOT FOUND"
              hint={
                <>
                  No current or upcoming operation for{" "}
                  <span className="text-amber">{flightNumber}</span>. Check the
                  number and try again — e.g. BA175, LH 400.
                </>
              }
            />
          </BoardPanel>
        )}

        {!notConfigured && !notFound && error && (
          <BoardPanel title="FLIGHT">
            <BoardState
              variant="error"
              message="COULD NOT LOAD FLIGHT"
              onRetry={() => refresh()}
            />
          </BoardPanel>
        )}

        {!notConfigured && !notFound && !error && isLoading && !flight && (
          <BoardPanel title="FLIGHT">
            <BoardState variant="loading" message="FETCHING FLIGHT..." />
          </BoardPanel>
        )}

        {/* ---- Departure / Arrival — stacked on mobile, side-by-side on md ---- */}
        {flight && (
          <>
            {/* ---- Flight map — airport markers, great-circle arc, and
                     live aircraft position when airborne ---- */}
            <FlightMap
              origin={flight.departure.airport}
              destination={flight.arrival.airport}
              liveLocation={flight.liveLocation}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LegPanel
                title="DEPARTURE"
                leg={flight.departure}
                variant="departure"
              />
              <LegPanel
                title="ARRIVAL"
                leg={flight.arrival}
                variant="arrival"
              />
            </div>

            {/* ---- Route / distance / duration ---- */}
            <BoardPanel title="ROUTE">
              <div className="p-3 grid grid-cols-2 gap-3">
                <DetailItem
                  label="DISTANCE"
                  value={formatDistance(flight.distanceKm)}
                />
                <DetailItem
                  label="BLOCK TIME"
                  value={formatDuration(flight.durationMinutes)}
                />
              </div>
            </BoardPanel>

            {/* ---- Aircraft ---- */}
            {(flight.aircraftModel || flight.aircraftRegistration) && (
              <BoardPanel title="AIRCRAFT">
                <div className="p-3 grid grid-cols-2 gap-3">
                  <DetailItem label="MODEL" value={flight.aircraftModel} />
                  <DetailItem
                    label="REGISTRATION"
                    value={flight.aircraftRegistration}
                  />
                </div>
              </BoardPanel>
            )}

            {/* ---- Live position — only when the aircraft is airborne ---- */}
            {flight.liveLocation && (
              <BoardPanel title="LIVE POSITION">
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem
                      label="LATITUDE"
                      value={flight.liveLocation.lat.toFixed(3)}
                    />
                    <DetailItem
                      label="LONGITUDE"
                      value={flight.liveLocation.lon.toFixed(3)}
                    />
                    {flight.liveLocation.altitudeFeet != null && (
                      <DetailItem
                        label="ALTITUDE"
                        value={`${flight.liveLocation.altitudeFeet.toLocaleString()} FT`}
                      />
                    )}
                    {flight.liveLocation.groundSpeedKts != null && (
                      <DetailItem
                        label="GROUND SPEED"
                        value={`${Math.round(
                          flight.liveLocation.groundSpeedKts
                        )} KTS`}
                      />
                    )}
                    {flight.liveLocation.trueTrack != null && (
                      <DetailItem
                        label="HEADING"
                        value={`${Math.round(
                          flight.liveLocation.trueTrack
                        )}°`}
                      />
                    )}
                  </div>
                  {flight.liveLocation.reportedAtUtc && (
                    <p className="font-mono text-[9px] tracking-wider text-amber-faint uppercase flex items-center gap-1.5">
                      <Clock size={10} strokeWidth={1.5} />
                      REPORTED {flight.liveLocation.reportedAtUtc}
                    </p>
                  )}
                </div>
              </BoardPanel>
            )}

            {/* ---- Last-updated footer ---- */}
            {flight.lastUpdatedUtc && (
              <p className="font-mono text-[9px] tracking-wider text-amber-faint uppercase text-center">
                AS OF {flight.lastUpdatedUtc}
              </p>
            )}
          </>
        )}
      </div>

      {/* ---- Seat editor (only mounts when the user opens it) ---- */}
      <FlightSeatEditor
        open={seatEditorOpen}
        initialSeats={trackedRecord?.seats ?? []}
        onSave={handleSeatsSave}
        onClose={() => setSeatEditorOpen(false)}
      />
    </PullToRefresh>
  );
}
