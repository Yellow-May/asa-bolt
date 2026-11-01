# Admin UI review — 31 October 2026

Reviewed in a separate Chrome tab using the isolated localhost:5174 preview, an in-memory database,
synthetic contacts and fake notification delivery. Reviewed Requests, Schedule, Locations,
Pricing & routes, Route reviews, Notifications and Calendar. Checked Locations at 375 × 667.

## Process observed

- Configured-route bookings enter Requests with their quoted fare. Accepting the synthetic booking
  recorded its agreed fare and made it visible in Schedule. Pickup and cancellation actions then appear.
- Rejecting a pending booking requires a reason in the shared confirmation dialog. The synthetic
  rejection saved its reason and status; the preview recorded a notification attempt.
- Ride details expose the contact, notification status, status history and schedule editor.
  Schedule changes use conflict preview and a required reason. Their full save flow was inspected
  in source, rather than manually executed during this review.
- Schedule combines upcoming accepted rides, weekly operating windows and date closures.
- A custom-location trip enters Route reviews with its date, time, contact, note and any map pins.
  Approving locations / marking a pin review complete does not agree a fare or confirm a ride.
  That final customer/admin agreement remains separate under the owner's approved review workflow.
- Pricing includes default rates, pricing areas and a paginated route catalogue. Notification
  history distinguishes provider acceptance from delivery. Calendar reports that setup is pending.

## Addressed during this review

- Locations previously rendered the entire catalogue with oversized rows. It now shows 10 locations
  per page, alphabetical order, live search, Published/Hidden filtering, result counts and page controls.
  Row actions stay beside the location. Add/edit uses the shared modal with validation and save feedback.
- Admin headings, container padding and the mobile section navigation are more compact.
- A fresh visit to the home URL opens the dashboard when this browser has an admin token. The server
  validates it before returning protected records. Customer view remains available during navigation.
  Sign-out clears the saved token; expired/revoked sessions return to sign-in.

## Remaining improvements

1. **Requests hierarchy:** full pending route-review cards precede ride requests. As that queue grows,
   ordinary booking decisions move further down the page. Use a compact pending-review summary or a
   separately paginated review section. Remove duplicate pickup labels and pickup-note text.
2. **Schedule density:** upcoming rides, weekly hours, the add-window form and date closures compete on
   one long page. Put create/edit actions in focused dialogs and shorten repeated explanatory copy.
3. **Pricing density and precision:** the page leads with research and several configuration forms.
   Group research as secondary information, use focused editors, and format the suggested research
   rate for display (currently a long decimal) while preserving precise calculation values.
4. **Delivery/setup copy:** Notifications and Calendar contain lengthy technical explanations.
   Keep operational status and next action visible; put setup detail in expandable sections.

## Verification and limits

Manually checked location page 2, search resetting to page 1, edit/save retaining the active filter,
mobile layout, admin login/restore, Customer view, sign-out, and signed-out home behavior.
Location pagination uses the existing loaded owner snapshot, matching the current route-list pattern;
it does not introduce a new paginated API. Server-side pagination is a later scaling improvement.

The existing admin session lasts eight hours and is stored server-side in memory; restarting the API
requires signing in again. Session duration and authentication requirements were preserved.
Real delivery, Google authorization, a full regression run and production behavior were not verified.
No builds or automated tests were run. Formatting, ESLint and whitespace checks are the permitted checks.

## Route pricing follow-up — 31 October 2026

Manually reviewed the simplified Locations flow in Chrome on localhost:5174 with the isolated
in-memory database and synthetic location. Add location is the sole add action. Selecting two
locations reveals Price route; selection persists across pages and search. Verified mouse dragging,
mobile touch dragging at 375 × 667, keyboard reversal, previous directional prices, manual editing,
Generate price, automatic initial pricing, and save/reopen. The reverse route retained its separate
price. The compact modal kept its controls and footer visible on mobile.

Fixed the shared dialog's initial focus while loading makes its buttons unavailable, and simplified
the drag handle to use pointer capture for both mouse and touch. Reopening the modal focused its
content, closing restored the trigger, and subsequent checks showed zero new console messages.
Formatting and ESLint passed. Automated tests and builds remain unrun under the owner's instructions.
