import { useCallback, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import type { ServiceLocation } from "../../shared/contracts";
import { Dropdown } from "./Dropdown";
import { RoutePriceModal } from "./RoutePriceModal";
import { LocationEditor } from "./LocationEditor";

const pageSize = 10;
const statuses = [
  { value: "all", label: "All locations" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

export function LocationsPanel({
  token,
  locations,
  onSaved,
}: {
  token: string;
  locations: ServiceLocation[];
  onSaved: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ location?: ServiceLocation }>();
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState<[ServiceLocation, ServiceLocation]>();
  const selected = selectedIds.flatMap((id) => locations.find((item) => item.id === id) ?? []);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return locations
      .filter(
        (item) =>
          (status === "all" || item.published === (status === "published")) &&
          `${item.name} ${item.landmark}`.toLocaleLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, query, status]);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const handleSearch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPage(0);
  }, []);
  const handleStatus = useCallback((value: string) => {
    setStatus(value);
    setPage(0);
  }, []);
  const handlePrevious = useCallback(() => setPage(Math.max(0, currentPage - 1)), [currentPage]);
  const handleNext = useCallback(
    () => setPage(Math.min(pageCount - 1, currentPage + 1)),
    [currentPage, pageCount],
  );
  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const location = locations.find((item) => item.id === event.currentTarget.dataset.id);
      if (location) {
        setEditor({ location });
        setNotice("");
      }
    },
    [locations],
  );
  const handleAdd = useCallback(() => {
    setEditor({});
    setNotice("");
  }, []);
  const handleClose = useCallback(() => setEditor(undefined), []);
  const handleSaved = useCallback(async () => {
    await onSaved();
    setNotice("Location saved.");
  }, [onSaved]);

  const handleSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.currentTarget;
    setSelectedIds((current) =>
      checked ? [...current, value].slice(0, 2) : current.filter((id) => id !== value),
    );
  }, []);
  const handlePrice = useCallback(() => {
    if (selected.length === 2) setPricing([selected[0], selected[1]]);
  }, [selected]);
  const handlePriceClose = useCallback(() => setPricing(undefined), []);
  const handlePriceSaved = useCallback(async () => {
    await onSaved();
    setNotice("Route price saved.");
  }, [onSaved]);

  return (
    <section className="owner-content locations-panel">
      <div className="section-heading">
        <h2>Service locations</h2>
        <div className="action-row">
          <button type="button" className="button button-primary" onClick={handleAdd}>
            Add location
          </button>
        </div>
      </div>
      <div className="location-filters">
        <label>
          Search locations
          <input
            type="search"
            value={query}
            onChange={handleSearch}
            placeholder="Name or landmark"
          />
        </label>
        <label>
          Visibility
          <Dropdown
            value={status}
            options={statuses}
            onValueChange={handleStatus}
            label="Location visibility"
          />
        </label>
      </div>
      {selected.length > 0 && (
        <div className="location-selection" role="status">
          <span>{selected.map((item) => item.name).join(" · ")}</span>
          {selected.length === 2 && (
            <button type="button" className="button button-primary" onClick={handlePrice}>
              Price route
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="field-help">
          {notice}
        </p>
      )}
      <div className="location-table-wrapper">
        <table className="location-table">
          <caption className="sr-only">Service locations, sorted by name</caption>
          <thead>
            <tr>
              <th scope="col" className="location-check">
                <span className="sr-only">Select up to two locations</span>
              </th>
              <th scope="col">Location</th>
              <th scope="col" className="location-landmark">
                Landmark
              </th>
              <th scope="col">Visibility</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td className="location-check">
                  <label>
                    <input
                      type="checkbox"
                      value={item.id}
                      checked={selectedIds.includes(item.id)}
                      disabled={selected.length === 2 && !selectedIds.includes(item.id)}
                      onChange={handleSelect}
                      aria-label={`Select ${item.name}`}
                    />
                  </label>
                </td>
                <th scope="row">{item.name}</th>
                <td className="location-landmark">{item.landmark || "—"}</td>
                <td>
                  <span className={`location-status ${item.published ? "published" : ""}`}>
                    {item.published ? "Published" : "Hidden"}
                  </span>
                </td>
                <td>
                  <div className="location-actions">
                    {item.mapsUrl && (
                      <a
                        href={item.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open map for ${item.name}`}
                      >
                        Map ↗
                      </a>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      data-id={item.id}
                      onClick={handleEdit}
                      aria-label={`Edit ${item.name}`}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matches.length === 0 && (
        <p role="status">
          {locations.length === 0
            ? "No locations yet. Add your first location."
            : "No locations match. Try another search or visibility."}
        </p>
      )}
      <nav className="action-row pagination" aria-label="Location pages">
        <button
          type="button"
          className="button button-secondary"
          disabled={currentPage === 0}
          onClick={handlePrevious}
        >
          Previous
        </button>
        <span aria-live="polite">
          {matches.length
            ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, matches.length)} of ${matches.length}`
            : "0 locations"}{" "}
          · Page {currentPage + 1} of {pageCount}
        </span>
        <button
          type="button"
          className="button button-secondary"
          disabled={currentPage + 1 >= pageCount}
          onClick={handleNext}
        >
          Next
        </button>
      </nav>
      {pricing && (
        <RoutePriceModal
          token={token}
          locations={pricing}
          onClose={handlePriceClose}
          onSaved={handlePriceSaved}
        />
      )}
      {editor && (
        <LocationEditor
          token={token}
          location={editor.location}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
