/**
 * rail-types.ts — TypeScript types for Rail Data Marketplace LDBWS responses
 *
 * These types describe the shape of data we get back from the
 * Live Departure Board Service (LDBWS) REST API on Rail Data Marketplace.
 *
 * See: https://raildata.org.uk/dashboard/dataProduct/P-6ad3580c-d8df-4ee3-93ed-96f84e2b9ade
 *
 * The API returns data nested under `trainServices.service[]` — our server-side
 * API route normalises this to the flat shapes below before sending to the client.
 */

/* ========================================
 * UK RAIL STATION
 * Minimal shape for the bundled static list of UK stations.
 * ======================================== */
export interface UKRailStation {
  /** 3-letter Computer Reservation System code (e.g. "KGX", "LDS") */
  crs: string;
  /** Display name (e.g. "London Kings Cross", "Leeds") */
  name: string;
}

/* ========================================
 * RAIL DEPARTURE (normalised)
 * One train leaving the FROM station.
 * ======================================== */
export interface RailDeparture {
  /** Unique ID for this specific service — used to fetch calling points */
  serviceId: string;
  /** Train operating company code (e.g. "LNER", "GWR") */
  operator: string;
  /** Platform number as displayed on the board (e.g. "1", "4a") */
  platform: string | null;
  /** Scheduled time of departure in HH:mm format */
  scheduledDeparture: string;
  /** Actual/expected time — either "On time" or an HH:mm estimate or "Cancelled" */
  estimatedDeparture: string;
  /** Final destination of the train */
  destination: string;
  /** Origin of the train (where it started) */
  origin: string;
  /** True if the train has been cancelled */
  cancelled: boolean;
  /** True if delayed (estimated != scheduled and not cancelled) */
  delayed: boolean;
  /** Reason text if delayed or cancelled (e.g. "a fault with the train") */
  delayReason?: string;
  /** Reason text if cancelled */
  cancelReason?: string;
  /** Length of the train in carriages, if known */
  length?: number;
}

/* ========================================
 * CALLING POINT (normalised)
 * One intermediate stop on a service's route.
 * ======================================== */
export interface CallingPoint {
  /** 3-letter CRS code of the station */
  crs: string;
  /** Display name of the station */
  name: string;
  /** Scheduled arrival/passing time in HH:mm */
  scheduledTime: string;
  /** Expected time (HH:mm) or "On time" or "Cancelled" */
  estimatedTime: string;
  /** Whether this call has been cancelled */
  cancelled: boolean;
}

/* ========================================
 * SERVICE DETAILS (normalised)
 * Full details for a tapped departure — returned by /api/rail/service
 * ======================================== */
export interface RailServiceDetails {
  /** Service ID (matches RailDeparture.serviceId) */
  serviceId: string;
  /** Operator code */
  operator: string;
  /** Scheduled departure from the user's FROM station in HH:mm */
  scheduledDeparture: string;
  /** Estimated departure — "On time" or HH:mm */
  estimatedDeparture: string;
  /** Platform */
  platform: string | null;
  /** Final destination name */
  destination: string;
  /** Length in carriages */
  length?: number;
  /**
   * Stops the train makes AFTER the FROM station, in order.
   * The user's destination will be one of these rows — highlight it in the UI.
   */
  callingPoints: CallingPoint[];
}

/* ========================================
 * API ERROR
 * Returned when RDM is misconfigured or upstream fails.
 * ======================================== */
export interface RailApiError {
  error: string;
  /** True when the server is missing RDM_API_KEY — UI shows a specific message */
  notConfigured?: boolean;
}
