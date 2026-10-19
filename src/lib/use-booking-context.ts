"use client";

import { useEffect, useRef } from "react";
import {
  EMPTY_BOOKING_FILTERS,
  type BookingFilters,
} from "@/lib/admin-bookings";

const KEY = "smartcar:office-booking-context:v1";
const statuses = [
  "",
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "CANCELLED_BY_CUSTOMER",
];

export function useBookingContext(
  value: BookingFilters,
  restore: (value: BookingFilters) => void,
  loading: boolean,
) {
  const ready = useRef(false);
  const skipFirst = useRef(true);
  const restoredScroll = useRef(false);
  useEffect(() => {
    let saved: BookingFilters = { ...EMPTY_BOOKING_FILTERS };
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      if (typeof raw.query === "string" && raw.query.length < 300)
        saved.query = raw.query;
      if (typeof raw.car === "string" && raw.car.length < 100)
        saved.car = raw.car;
      if (statuses.includes(raw.status)) saved.status = raw.status;
      if (["created_at", "pickup_date", "dropoff_date"].includes(raw.dateField))
        saved.dateField = raw.dateField;
      for (const field of ["from", "to"] as const)
        if (
          typeof raw[field] === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(raw[field])
        )
          saved[field] = raw[field];
    } catch {
      /* No context yet, or storage unavailable. */
    }
    const parameters = new URLSearchParams(window.location.search);
    const requestedStatus = parameters.get("status");
    if (requestedStatus && statuses.includes(requestedStatus))
      saved = { ...EMPTY_BOOKING_FILTERS, status: requestedStatus };
    if (parameters.has("booking")) saved = { ...EMPTY_BOOKING_FILTERS };
    restore(saved);
    ready.current = true;
  }, [restore]);
  useEffect(() => {
    if (!ready.current) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* Filtering stays usable. */
    }
  }, [value]);
  useEffect(() => {
    if (loading || restoredScroll.current) return;
    restoredScroll.current = true;
    let frame = 0;
    if (!window.location.search) {
      try {
        const top = Number(sessionStorage.getItem(KEY + ":scroll"));
        if (Number.isFinite(top) && top > 0)
          frame = requestAnimationFrame(() =>
            window.scrollTo({ top, behavior: "instant" }),
          );
      } catch {
        /* No saved scroll. */
      }
    }
    return () => cancelAnimationFrame(frame);
  }, [loading]);
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(KEY + ":scroll", String(window.scrollY));
      } catch {
        /* Optional. */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);
}

export function clearBookingContext() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY + ":scroll");
  } catch {
    /* Optional storage. */
  }
}
