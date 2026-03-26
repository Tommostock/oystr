/**
 * tfl-types.ts — TypeScript types for TfL API responses
 *
 * These types describe the shape of data we get back from TfL.
 * Having types helps catch bugs early — if you try to access
 * a property that doesn't exist, TypeScript will warn you.
 */

/* ========================================
 * ARRIVAL PREDICTION
 * Returned by /StopPoint/{id}/Arrivals
 * and /Line/{lineId}/Arrivals
 * Each object represents one train/bus arriving at a station.
 * ======================================== */
export interface ArrivalPrediction {
  /** Unique ID for this specific vehicle */
  vehicleId: string;
  /** TfL line ID, e.g. "central" */
  lineId: string;
  /** Display name, e.g. "Central" */
  lineName: string;
  /** Platform info, e.g. "Eastbound - Platform 1" */
  platformName: string;
  /** Direction of travel: "inbound" or "outbound" */
  direction: string;
  /** Where the train is going, e.g. "Epping" */
  destinationName: string;
  /** Free-text location like "Between Mile End and Stratford" */
  currentLocation: string;
  /** General direction, e.g. "Epping" */
  towards: string;
  /** ISO timestamp of expected arrival */
  expectedArrival: string;
  /** Seconds until arrival at this station */
  timeToStation: number;
  /** Name of the station this prediction is for */
  stationName: string;
  /** Naptan ID of the station */
  naptanId: string;
  /** Mode of transport: "tube", "bus", "dlr", etc. */
  modeName: string;
}

/* ========================================
 * LINE STATUS
 * Returned by /Line/Mode/{modes}/Status
 * Each object represents the status of one line.
 * ======================================== */
export interface LineStatus {
  /** Line ID, e.g. "central" */
  id: string;
  /** Display name, e.g. "Central" */
  name: string;
  /** Mode name, e.g. "tube" */
  modeName: string;
  /** Array of status objects (usually just one) */
  lineStatuses: LineStatusDetail[];
}

export interface LineStatusDetail {
  /** Status severity level (0-20, 10 = Good Service) */
  statusSeverity: number;
  /** Human-readable status, e.g. "Good Service" or "Minor Delays" */
  statusSeverityDescription: string;
  /** Reason for disruption (empty when good service) */
  reason: string;
}

/* ========================================
 * STOP POINT (STATION)
 * Returned by /StopPoint/Search/{query}
 * and /StopPoint/{id}
 * ======================================== */
export interface StopPoint {
  /** Naptan ID — the unique identifier for this station/stop */
  naptanId: string;
  /** Station name, e.g. "Mile End Underground Station" */
  commonName: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lon: number;
  /** Transport modes available, e.g. ["tube", "dlr"] */
  modes: string[];
  /** Lines serving this station */
  lines: { id: string; name: string }[];
}

/** Response from /StopPoint/Search/{query} */
export interface StopPointSearchResponse {
  matches: StopPoint[];
  total: number;
}

/* ========================================
 * JOURNEY PLANNER
 * Returned by /Journey/JourneyResults/{from}/to/{to}
 * ======================================== */
export interface JourneyResponse {
  journeys: Journey[];
}

export interface Journey {
  /** Total duration in minutes */
  duration: number;
  /** Start time ISO string */
  startDateTime: string;
  /** Arrival time ISO string */
  arrivalDateTime: string;
  /** Individual legs of the journey */
  legs: JourneyLeg[];
  /** Fare information (Oyster/contactless pay-as-you-go) */
  fare?: {
    /** Total cost in pence (e.g. 300 = GBP 3.00) */
    totalCost: number;
    fares: {
      /** Peak fare in pence */
      peak: number;
      /** Off-peak fare in pence */
      offPeak: number;
      /** Charge level: "Peak" or "Off Peak" */
      chargeLevel: string;
    }[];
  };
}

export interface JourneyLeg {
  /** Human-readable instruction */
  instruction: {
    summary: string;
    detailed: string;
  };
  /** Starting station/point */
  departurePoint: {
    commonName: string;
    naptanId?: string;
    lat: number;
    lon: number;
  };
  /** Ending station/point */
  arrivalPoint: {
    commonName: string;
    naptanId?: string;
    lat: number;
    lon: number;
  };
  /** Mode of transport for this leg */
  mode: {
    id: string;
    name: string;
  };
  /** Which line(s) this leg uses */
  routeOptions: {
    lineIdentifier: {
      id: string;
      name: string;
    };
  }[];
  /** Duration of this leg in minutes */
  duration: number;
  /** Departure time ISO string */
  departureTime: string;
  /** Arrival time ISO string */
  arrivalTime: string;
}

/* ========================================
 * ROUTE SEQUENCE
 * Returned by /Line/{lineId}/Route/Sequence/{direction}
 * Used to draw lines on the map in station order.
 * ======================================== */
export interface RouteSequenceResponse {
  lineId: string;
  lineName: string;
  direction: string;
  orderedLineRoutes: {
    name: string;
    naptanIds: string[];
    serviceType: string;
  }[];
  stations: {
    naptanId: string;
    name: string;
    lat: number;
    lon: number;
  }[];
  stopPointSequences: {
    lineId: string;
    lineName: string;
    direction: string;
    branchId: number;
    nextBranchIds: number[];
    prevBranchIds: number[];
    stopPoint: {
      naptanId: string;
      name: string;
      lat: number;
      lon: number;
    }[];
  }[];
}
