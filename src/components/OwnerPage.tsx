import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_CONFIG } from "../../shared/config";
import type {
  Booking,
  FareRule,
  LocationRequest,
  OperatingSchedule,
  ScheduleException,
  ServiceLocation,
} from "../../shared/contracts";
import { ApiError, apiFetch, type OwnerSnapshot } from "../api";
import { forgetOwnerToken, readOwnerToken, rememberOwnerToken } from "../owner-session";
import { LocationsPanel } from "./LocationsPanel";
import { LocationRequestsPanel } from "./LocationRequestsPanel";
import { PricingPanel } from "./PricingPanel";
import { RequestsPanel } from "./RequestsPanel";
import { SchedulingPanel } from "./SchedulingPanel";
import { Message } from "./Message";
import { NotificationsCenter } from "./NotificationsCenter";
import { CalendarPanel } from "./CalendarPanel";

interface OwnerPageProps {
  onBack: () => void;
}
type OwnerTab =
  "queue" | "schedule" | "locations" | "fares" | "requests" | "notifications" | "calendar";
export function OwnerPage({ onBack }: OwnerPageProps) {
  const [token, setToken] = useState(readOwnerToken);
  const [password, setPassword] = useState("");
  const [snapshot, setSnapshot] = useState<OwnerSnapshot>();
  const [tab, setTab] = useState<OwnerTab>(() =>
    new URLSearchParams(window.location.search).has("calendar") ? "calendar" : "queue",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const loadSnapshot = useCallback(async (sessionToken: string) => {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      const [bookings, schedules, exceptions, locations, fares, requests] = await Promise.all([
        apiFetch<Booking[]>("/owner/bookings", { headers }),
        apiFetch<OperatingSchedule[]>("/owner/schedules", { headers }),
        apiFetch<ScheduleException[]>("/owner/exceptions", { headers }),
        apiFetch<ServiceLocation[]>("/owner/locations", { headers }),
        apiFetch<FareRule[]>("/owner/fare-rules", { headers }),
        apiFetch<LocationRequest[]>("/owner/location-requests", { headers }),
      ]);
      setSnapshot({ bookings, schedules, exceptions, locations, fares, requests });
      setError("");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        setError("Your admin session has ended. Sign in again.");
        setToken("");
        setSnapshot(undefined);
        forgetOwnerToken();
      } else setError("Could not refresh the admin data. Check your connection and try Refresh.");
    }
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    void loadSnapshot(token).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadSnapshot, token]);
  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{ token: string }>("/owner/login", {
        method: "POST",
        body: { password },
      });
      if (!rememberOwnerToken(result.token))
        setNotice("You are signed in, but this browser could not remember your session.");
      setToken(result.token);
      setPassword("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function handleLogout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await apiFetch("/owner/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 401)) {
        setError("Could not sign out. Check your connection and try again.");
        return;
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
    forgetOwnerToken();
    setToken("");
    setSnapshot(undefined);
    setNotice("");
  }
  async function handleReview(event: React.MouseEvent<HTMLButtonElement>) {
    const status = event.currentTarget.dataset.status ?? "";
    const id = event.currentTarget.dataset.id ?? "";
    if (!token || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/owner/location-requests/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          status,
          responseNote:
            status === "approved"
              ? "Route reviewed. Contact the admin to confirm the fare and ride."
              : "This route request was declined.",
        },
      });
      await loadSnapshot(token);
      setNotice(`Route review ${status}.`);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not review this location request.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!token)
    return (
      <main className="narrow-page owner-login">
        <button className="text-button" type="button" onClick={onBack}>
          ← Customer booking
        </button>
        <div className="eyebrow">Private dispatch desk</div>
        <h1>Admin sign-in</h1>
        {error && <Message tone="error">{error}</Message>}
        <form className="stack-form" onSubmit={handleLogin}>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to dashboard"}
          </button>
        </form>
      </main>
    );
  const bookings = snapshot?.bookings ?? [];
  return (
    <main className="owner-shell" aria-busy={busy || loading}>
      <header className="owner-header">
        <div>
          <div className="eyebrow">{BRAND_CONFIG.name} / dispatch</div>
          <h1>Admin portal</h1>
        </div>
        <div className="action-row">
          <button className="button button-secondary" type="button" onClick={onBack}>
            Customer view
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy || loading}
            onClick={() => void loadSnapshot(token)}
          >
            Refresh
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => void handleLogout()}
          >
            Sign out
          </button>
        </div>
      </header>
      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}
      {loading && <Message tone="info">Loading admin data…</Message>}
      <nav className="tab-nav" aria-label="Admin sections">
        {(
          [
            "queue",
            "schedule",
            "locations",
            "fares",
            "requests",
            "notifications",
            "calendar",
          ] as OwnerTab[]
        ).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            aria-current={tab === item ? "page" : undefined}
            type="button"
            key={item}
            onClick={() => {
              setTab(item);
              setNotice("");
            }}
          >
            {tabTitle(item)}
          </button>
        ))}
      </nav>
      {snapshot && (
        <>
          {tab === "queue" && (
            <>
              {snapshot.requests.some(
                (request) => request.trip && request.status === "pending",
              ) && (
                <LocationRequestsPanel
                  requests={snapshot.requests.filter(
                    (request) => request.trip && request.status === "pending",
                  )}
                  onReview={handleReview}
                />
              )}
              <RequestsPanel
                token={token}
                bookings={bookings}
                schedules={snapshot.schedules}
                exceptions={snapshot.exceptions}
                selectedId={selectedRequestId}
                onSaved={() => loadSnapshot(token)}
              />
            </>
          )}
          {tab === "schedule" && (
            <SchedulingPanel
              token={token}
              bookings={bookings}
              schedules={snapshot.schedules}
              exceptions={snapshot.exceptions}
              onSaved={() => loadSnapshot(token)}
              onOpenRequest={(id) => {
                setSelectedRequestId(id);
                setTab("queue");
              }}
            />
          )}
          {tab === "locations" && (
            <LocationsPanel
              token={token}
              locations={snapshot.locations}
              onSaved={() => loadSnapshot(token)}
            />
          )}
          {tab === "fares" && (
            <PricingPanel token={token} onSaved={() => void loadSnapshot(token)} />
          )}
          {tab === "requests" && (
            <LocationRequestsPanel requests={snapshot.requests} onReview={handleReview} />
          )}
          {tab === "notifications" && (
            <NotificationsCenter token={token} onSaved={() => loadSnapshot(token)} />
          )}
          {tab === "calendar" && <CalendarPanel token={token} />}
        </>
      )}
    </main>
  );
}

function tabTitle(tab: OwnerTab): string {
  if (tab === "fares") return "Pricing & routes";
  return tab === "queue"
    ? "Requests"
    : tab === "requests"
      ? "Route reviews"
      : tab[0].toUpperCase() + tab.slice(1);
}
