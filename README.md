# Top Edge Technologies HRMS — frontend shell

Frontend-only shell for the Top Edge Technologies HR Management System. There is no backend yet:
every request is answered in the browser by [Mock Service Worker](https://mswjs.io), so the app
runs end to end from `npm run dev`.

**Warning → Policy** is the fully built reference feature (form, sub-forms per time span, table,
view page, create / edit / optimistic delete). **Settings → Control Panel** is built too: the
organisation setup (Branch, Location, Area, Job Title) with lists, create/edit forms and a map
picker, plus General Settings. **Roster** is built as well: roster groups with a weekly shift
pattern, and enrolling employees in them. The other modules are routed, gated and shown in the
navigation, with placeholder pages listing the screens planned for them.

The look follows the Figma file _HRango – UI design_ (Warning Section frames): navy sidebar,
light grey canvas, white cards, purple primary button, chip selectors, blue pager.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5190>, then sign in with the mock demo account (the login page has a
**Fill in the demo account** button):

| Email                         | Password    |
| ----------------------------- | ----------- |
| `shelley.kannes@topedge.tech` | `Demo@1234` |

These are test values that exist only inside the mock API (`src/features/auth/constants.ts`).

Requirements: Node 20.19+ (developed on Node 25). Mock data created in the browser is kept in
`sessionStorage`, so it survives a reload but not a new tab; close the tab to reset it.

If a tab sits in the background for a long time, the browser can stop MSW's service worker; API
calls then return the HTML page instead of JSON. Reload the tab to start it again.

## Scripts

| Script                    | What it does                                            |
| ------------------------- | ------------------------------------------------------- |
| `npm run dev`             | Vite dev server on port 5190 (MSW on, devtools on)      |
| `npm run build`           | Type-check (`tsc -b`) and production build to `dist/`   |
| `npm run preview`         | Serve the production build on port 5191                 |
| `npm run typecheck`       | `tsc -b` only                                           |
| `npm run lint`            | ESLint, zero warnings allowed                           |
| `npm run lint:fix`        | ESLint with autofix (import order, type imports, …)     |
| `npm run format`          | Prettier (with Tailwind class sorting)                  |
| `npm test`                | Vitest in watch mode                                    |
| `npm run test:run`        | Vitest once (CI)                                        |
| `npm run test:coverage`   | Vitest with V8 coverage                                 |
| `npm run routes:generate` | Regenerate `src/routeTree.gen.ts` without starting Vite |

Git hooks (Husky): **pre-commit** runs lint-staged (ESLint + Prettier on staged files);
**pre-push** runs the type check and the test suite. The folder was `git init`-ed so the hooks are
installed; nothing has been committed.

## Tech stack

| Concern      | Choice                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Build        | Vite 8, `@vitejs/plugin-react` 6                                                                                                 |
| UI           | React 19.3, TypeScript 6 (strict, no `any`), Tailwind CSS 4.3, shadcn/ui on the `radix-ui` package                               |
| Routing      | TanStack Router (file-based, code-split, typed params/search)                                                                    |
| Server state | TanStack Query 5                                                                                                                 |
| Client state | Zustand 5 with `persist` + `immer` (+ `devtools` in dev)                                                                         |
| Forms        | React Hook Form 7 + Zod 4 (`@hookform/resolvers` 5)                                                                              |
| HTTP         | Axios instance with auth and error-normalising interceptors                                                                      |
| Mock API     | MSW 3 (service worker in the browser, `setupServer` in tests)                                                                    |
| Misc         | lucide-react, date-fns 4, react-day-picker, sonner, clsx + tailwind-merge                                                        |
| Maps         | Leaflet 1.9 + react-leaflet 5 (lazy-loaded chunk), OpenStreetMap and Esri World Imagery tiles                                    |
| Quality      | ESLint 10 (typescript-eslint strict type-checked, react-hooks 7, TanStack plugins, import sorting), Prettier, Husky, lint-staged |
| Tests        | Vitest 5, React Testing Library, user-event, jsdom                                                                               |

Two versions are held back on purpose: **TypeScript 6.0**, because typescript-eslint does not
support TypeScript 7 yet, and **@hookform/resolvers 5.9**, because 6.0.0 (published the day before
this scaffold) has an unresolvable peer dependency.

## Folder structure

```
src/
  app/                 composition root
    app.tsx            <App>: providers + RouterProvider
    providers.tsx      QueryClientProvider, TooltipProvider, Toaster, ThemeSync, devtools
    router.tsx         createAppRouter(), RouterContext, Register declaration
    session.ts         wires axios to the auth store (token, 401 → /login)
    navigation.ts      sidebar items (typed against the route tree)
    modules.ts         copy for the scaffolded modules
    layouts/           RootLayout, AuthenticatedLayout (sidebar + topbar + <Outlet/>)
    pages.tsx          404 and route error pages
  routes/              TanStack file routes (thin: search schema, loader, head, component)
    __root.tsx
    login.tsx                          /login (public)
    _app.tsx                           pathless layout = auth gate
    _app/index.tsx                     /
    _app/<module>.tsx                  /recruitment, /payroll, …
    _app/warning/index.tsx             /warning?policyPage=&penaltyPage=  (overview: both lists, History, Column Preferences)
    _app/warning/policy/index.tsx      /warning/policy?page=&edit=
    _app/warning/policy/$policyId.tsx  /warning/policy/:policyId
    _app/warning/penalty/index.tsx     /warning/penalty?page=&edit=
    _app/attendance/index.tsx          /attendance → redirects to the overview
    _app/attendance/overview.tsx       /attendance/overview?scope=all|subordinates&month=yyyy-MM&page=&q=&status=&employeeId=&department=
    _app/attendance/time-sheet.tsx     /attendance/time-sheet?scope=my|all&employeeId=&status=&from=&to=&page=&pageSize=&q=
    _app/attendance/logs.tsx           /attendance/logs?from=&to=&employeeId=&type=&source=&page=
    _app/attendance/settings.tsx       /attendance/settings?tab=basic|scheduling|rest-days|break-types|ip-restrictions|geo-fencing|holidays
    _app/attendance/$section.tsx       /attendance/overtime, /attendance/missing-punch (placeholders)
    _app/requests.tsx                  layout: Requests sub menu + <Outlet/> (/requests → /requests/punch)
    _app/requests/punch.tsx            /requests/punch?tab=request|approvals&scope=my|all&view=requested|delegates|consents&status=&page=
    _app/requests/shift.tsx            /requests/shift (same search params)
    _app/requests/$type.tsx            /requests/expense, leave, … (placeholders for the types not built yet)
    _app/payroll.tsx                   layout (<Outlet/>); /payroll → /payroll/dashboard
    _app/payroll/                      dashboard, settings/{general,tax,rewards,pay-components,account-type,
                                       disbursement-banks}?view=&page=, payrolls/{monthly,daily-wages}?page=,
                                       salary-sheet?payrollId=&month=, pay-slips/{my,all}, vouchers,
                                       vouchers/employee, final-settlement, balances/{opening-balance,
                                       employee-accounts,account-statement}, salary-revision,
                                       leave-encashment, reports/employee-accounts (index routes
                                       redirect to the first child)
    _app/roster.tsx                    /roster?page=&pageSize=&q=&dialog=add|edit|view|enroll&id=
    _app/scheduling.tsx                /scheduling?scope=my|all|subordinates&view=week|month|year&date=&from=&to=&page=&q=&…filters
    _app/settings/index.tsx            /settings → redirects to the Control Panel
    _app/settings/<child>.tsx          /settings/custom-forms, system-users, … (placeholders)
    _app/settings/control-panel.tsx    layout: Control Panel menu + <Outlet/>
    _app/settings/control-panel/       general, branches/{index,new,$branchId}, locations/…, areas/…,
                                       job-titles/…, users, subscriptions, help
    _app/settings/off-boarding.tsx     layout: Off Boarding menu + <Outlet/>; /checklist?page=
    _app/assets.tsx                    layout; /assets → /assets/company-assets; company-assets,
                                       allocations, types, clearance-form (each ?page=)
    _app/end-of-employment.tsx         layout; /end-of-employment → /all; all, completed, pending
  features/
    warning/           reference feature
      api/             warning-policy.api.ts (axios calls), warning-policy.queries.ts (keys + queryOptions)
      components/      policy-page, policy-form-card, time-span-card, period-fields/*, policy-table, policy-detail-page
      hooks/           use-warning-policies, use-warning-policy-mutations, use-policy-form
      schemas/         policy-form.schema.ts (+ test)
      store/           policy-table-prefs.store.ts (feature-local Zustand store)
      types/           warning-policy.types.ts
      utils/           policy-mappers.ts (form <-> API)
      constants.ts     labels and options
      index.ts         public API (barrel)
    settings/          Control Panel: api/org-resource.ts (one typed resource per record type),
                       lookups.api.ts, hooks/, schemas/, components/{control-panel,branches,
                       locations,areas,job-titles,general,shared}, routing.ts (list search schemas)
    roster/            Roster: api/roster.api.ts, hooks/ (groups, enrollments, group form),
                       schemas/, utils/shift-time.ts (shift maths), components/ (page, dialogs,
                       schedule fields, enrollment list, employee picker), routing.ts
    scheduling/        Scheduling: api/scheduling.api.ts, hooks/, schemas/schedule-forms.schema.ts,
                       utils/ (schedule-dates, shift-hours, schedule-csv), components/ (page, header,
                       filters, board, year board, day cell, dialogs/, fields/), routing.ts
    attendance/        Attendance: api/attendance.api.ts and settings.api.ts (Settings lists, Logs),
                       hooks/, schemas/time-sheet.schema.ts, utils/ (local-time, row-actions,
                       logs-csv, criteria), components/ (overview/, time-sheet/, dialogs/, shared/,
                       layout/ sub menu, settings/ tabs, logs/), constants.ts (statuses with their
                       Figma icons), routing.ts
    requests/          Requests: api/requests.api.ts (one set of calls per type), hooks/, schemas/,
                       components/ (layout/ sub menu, punch/, shift/, dialogs/, shared/ lists and tabs)
    payroll/           Payroll: api/payroll.api.ts (calls per screen, one resource factory for the
                       Settings lists), hooks/ (use-payroll, use-payroll-records), schemas/,
                       utils/ (format, csv, filters with saved presets, styles), components/
                       (dashboard/ with charts, settings/, monthly/, daily-wages/, salary-sheet/,
                       payslips/, vouchers/, final-settlement/, balances/, salary-revision/,
                       leave-encashment/, reports/, shared/ dialogs, pickers and chips),
                       constants.ts, routing.ts
    assets/            Assets: api/assets.api.ts, hooks/use-assets.ts, components/ (company-assets/,
                       asset-types/, allocations/, clearance/ incl. the ClearanceFormDialog that
                       End of Employment opens), constants.ts (status chips, labels)
    offboarding/       End of Employment and Settings → Off Boarding Checklist: api/, hooks/,
                       components/ (end-of-employment/, checklist/ with the Off Boarding menu)
    auth/  dashboard/  inbox/          smaller features, same layout
  components/
    ui/                shadcn primitives (button, select, dropdown-menu, textarea, switch, tabs, …)
    layout/            Sidebar, Topbar, PageHeader, PageContainer, DataTable<T> (sortable headers,
                       `brand` purple header), Pagination, RowActionsMenu, …
    form/              FormField, TextField, TextareaField, SelectField, CheckboxField, SwitchField,
                       DatePickerField, TimePickerField, ChipCarousel, FieldLayoutContext
    map/               LocationMap (lazy Leaflet map with pin and Map / Satellite switch),
                       GeoFenceMap (draws a circle or polygon fence)
    feedback/          Spinner, ErrorState, ConfirmDialog, UnsavedChangesDialog, AppDialog
    icons/             figma-icons.tsx (sidebar icons exported from Figma), roster-icon, flags,
                       scope-icons.tsx (My / All / Subordinates tab icons), request-icons.tsx
                       (Requests sub menu, Delegates, Leaves and Requests sidebar icons),
                       attendance-menu-icons.tsx (Attendance sub menu, Download / Import, Filter),
                       payroll-icons.tsx (Payroll Settings menu and sub-tab icons)
  hooks/               cross-feature hooks (useMediaQuery, useDebouncedValue, useUnsavedChangesGuard)
  lib/                 env.ts, axios.ts, api-error.ts, query-client.ts, date.ts, constants.ts,
                       paginated-cache.ts, utils.ts
  mocks/               MSW: handlers.ts, browser.ts, node.ts, collection.ts, utils.ts, <feature>/{handlers,seed}.ts,
                       employees/seed.ts (shared company directory), payroll/ (seed, db, expression,
                       engine, http helpers and settings / run / records / encashment handlers),
                       assets/ and offboarding/ (seed, db, handlers; they share data with each
                       other and with Payroll's Final Settlement)
  stores/              global Zustand stores: auth-store, ui-store (theme + language), sidebar-store
  styles/globals.css   Tailwind entry + design tokens (light and dark)
  test/                Vitest setup and render helpers
  types/               shared types (API envelopes, auth)
```

### Conventions

- **Files** are kebab-case; components are PascalCase exports; hooks are `use-*.ts` exporting `use*`.
- **Suffixes** say what a file is: `*.api.ts`, `*.queries.ts`, `*.schema.ts`, `*.store.ts`,
  `*.types.ts`, `*.test.ts(x)`.
- **Barrels**: every feature has an `index.ts`. Code outside a feature imports only from
  `@/features/<name>`, never from its internals. `components/form` and `components/layout` have
  barrels too; `components/ui` is imported per file, as shadcn expects.
- **Side effects**: `package.json` declares `"sideEffects": ["*.css"]`, so the build can skip a
  barrel's unused exports. That keeps each feature's pages in their own lazy chunks even though
  route files import search schemas from the barrel. A file imported only for what it does on
  load (`import './setup'`) must be added to that list, or the build drops it.
- **Chunks**: no chunk may pass 500 kB. `npm run build` warns when one does. MSW and its libraries
  get a chunk of their own (`build.rolldownOptions.output.codeSplitting` in `vite.config.ts`).
- **Imports** use the `@/` alias for anything outside the current feature, relative paths inside
  it. ESLint sorts them: packages, `@/…`, then relative.
- **Route files stay thin**: search schema, loader (prefetch), `head`, and the page component
  imported from a feature. Feature components read params with `getRouteApi('<route id>')`, so they
  never import route files.
- **State placement**: server data → TanStack Query; shareable UI state (page, record being edited)
  → URL search params; personal preferences (theme, sidebar, page size) → persisted Zustand; form
  state → React Hook Form.
- **Errors**: everything thrown by a request is an `ApiError` (`src/lib/api-error.ts`). Mutations
  toast through the global `MutationCache`; set `meta.successMessage` / `meta.errorMessage` /
  `meta.suppressErrorToast` per mutation.
- Public hooks carry JSDoc; components document non-obvious behaviour only.

## How the reference feature is wired

```
policyFormSchema (Zod)          features/warning/schemas
   │  zodResolver
usePolicyForm (RHF + useFieldArray, edit loading via `values`)
   │  toPolicyInput()           string inputs → numbers, span-specific cleanup
useCreate/UpdateWarningPolicy (TanStack mutations)
   │  warningPolicyApi → apiClient (axios: token header, ApiError)
MSW handler /api/warning-policies   validates, 409 on duplicates, persists to sessionStorage
   │  onSuccess
invalidateQueries(warningPolicyKeys.lists())  → PolicyTable refetches → toast
```

- **Time span sub-forms**: `TimeSpanCard` watches `timeSpan` (`useWatch`) and renders
  `WeeklyPeriodFields`, `MonthlyPeriodFields` or `YearlyPeriodFields`. Changing the span replaces
  the period blocks; "+ Add Year/Month/Week" appends one that starts after the previous block.
- **Validation** lives in one flat schema; span-dependent rules (weekday vs. date ranges, 31/366-day
  limits, clock out after clock in, minutes ≤ total) are in `superRefine`, with issue paths that
  land on the right field. Duplicate titles come back from the mock API as a 409 with
  `fieldErrors`, which the form shows under the title.
- **Optimistic delete** (`useDeleteWarningPolicy`): cancel list queries, snapshot every cached page,
  remove the row, roll back on error, refetch on settle.
- **URL state**: `?page=` and `?edit=` are validated by a Zod search schema; bad values fall back.
  After creating a policy the table jumps to the page that lists it.

### The rest of the Warning module

| Screen                          | Route                      | What it does                                                                                                         |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Overview ("Policy")             | `/warning`                 | Warning Policy and Penalty lists (collapsible, "+ Add Form", Edit/Delete), History button, Column Preferences button |
| Policy form ("Policy")          | `/warning/policy`          | The reference form above; "← Cancel" returns to the overview                                                         |
| Penalty form ("Warning Policy") | `/warning/penalty`         | Policy Name, Title, Type Of Scale, then one or more penalty rules ("+ Add Penalty"), and the Penalty list            |
| History                         | dialog on the overview     | Every create/update/delete of a policy or penalty, grouped "Today - …" / "Yesterday - …", View/Delete, Delete All    |
| Column Preferences              | side panel on the overview | Show/hide columns of both tables (at least one stays), persisted per user                                            |

- **Penalty rules** (`penalty-form.schema.ts`): Count (1–10 warnings), Time Span (Week/Month/Year)
  with start/end weekdays or dates, the Day chip, Mon–Sun toggles for weekly rules, the From–To
  window, Points (a percentage when the scale is Percentage, capped at 100), Penalty Type,
  Deduction (Payroll/Leave/Both) and Badge Color (with swatches). Range checks are shared with the
  policy schema (`schemas/shared.ts`).
- **History** is written by the mock API itself whenever a policy or penalty changes, as a real
  audit log would be; the mutation hooks invalidate it. Deletes are optimistic.
- **Shared list card**: both lists use `PaginatedTableCard` (`components/layout`), which handles
  loading, refetch, error, empty, "Showing x–y of z", rows per page and the pager.
- **View preferences** (`store/warning-view-prefs.store.ts`): hidden columns and collapsed cards,
  persisted. Page size is shared by both lists.

## Settings → Control Panel

Settings opens as a group in the sidebar (Custom Forms, **Control Panel**, System User, User Group
Permissions, Biometric Devices), with the current page in blue. In the collapsed rail the group
icon opens the same links as a menu. The Control Panel has its own menu card (General Settings;
Organization → Branch, Location, Area, Job Title; Users; Subscriptions; Help & Support). Below
56rem of content width the card folds into a button that shows the current section.

| Screen                                                                | Route                                            | What it does                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General Settings                                                      | `/settings/control-panel/general`                | Organization name, legal name, contact details, time zone, currency, date format (with a live sample), week start, fiscal year start                        |
| Branches                                                              | `/settings/control-panel/branches?q=&companyId=` | Search, company filter, paged table, Edit / Delete                                                                                                          |
| Branch Create                                                         | `…/branches/new`, `…/branches/$branchId`         | Name, Employee Prefix, Company, Location (of that company), Area (of that location), Manager, Description, Country → State → City, Latitude, Longitude, map |
| Locations                                                             | `/settings/control-panel/locations`              | Same list; Location Create has Name, Employee Prefix, Company, Description, coordinates and the map                                                         |
| Areas                                                                 | `/settings/control-panel/areas?locationId=`      | Same list; Area Create has Name, Location, Description                                                                                                      |
| Job Titles                                                            | `/settings/control-panel/job-titles`             | Same list; the form has Name, **Limit Head Count** and, while it is ticked, a required **Max Head Count**, then Description                                 |
| Users, Subscriptions, Help & Support, and the other Settings children | their own routes                                 | Placeholder cards listing what is planned (not designed yet)                                                                                                |

How it is put together:

- **Hierarchy**: Company → Location → Area → Branch, plus Job Titles on their own. Choosing a company
  limits the Location list and clears Location and Area; choosing a location limits Areas and, if
  the branch has no coordinates yet, copies the location's pin. Country → State → City work the
  same way.
- **One resource definition per record type** (`api/org-resource.ts`): REST calls, query keys and
  query options are built by `createOrgResource()`, and the generic hooks (`useOrgList`,
  `useSaveOrgRecord`, optimistic `useDeleteOrgRecord`) and `OrgListPage` are written once against
  it. Saving any record refreshes every Control Panel list, because names appear in other lists.
- **Forms** use `useOrgRecordForm()` (RHF + Zod, edit loading via `values`, server field errors
  such as a duplicate name shown on the right input) and `SettingsFormCard` (title, labels on the
  left via `FieldLayoutContext`, Save green / Cancel red). Leaving with unsaved changes asks first
  (`useUnsavedChangesGuard`, built on TanStack Router's `useBlocker`, also covers closing the tab).
- **Map picker** (`GeoLocationFields`): Latitude / Longitude inputs, a "Search Location" combobox
  (keyboard friendly, answered by the mock geocoder at `/api/geo/search`), and the Leaflet map.
  Typing coordinates moves the pin, searching flies to the place, clicking or dragging the pin
  fills the inputs. Map / Satellite switches the tiles. The wheel zooms only after the map has
  focus, so the page scrolls normally past it.
- **Mock API** (`src/mocks/settings/`): a generic CRUD handler factory with list search and parent
  filters, reference checks (a location must belong to the chosen company, an area to the chosen
  location), unique names per parent (409 with `fieldErrors`), and delete guards (a location with
  branches or areas, or an area used by a branch, cannot be deleted; the row comes back with the
  reason in a toast). Lookups: `/api/companies`, `/api/employees`, `/api/geo/{countries,regions,cities}`.
- **List URLs**: `?page`, `?pageSize`, `?q` and the filters are validated with Zod; defaults are
  stripped from the URL. Optional columns hide by the card's width (container queries), so the
  table fits beside the menu.

## Roster

A roster group is a named weekly shift pattern (clock in / clock out per day, some days off) that
employees are enrolled in for a period. **Roster** sits in the sidebar between Performance and
Warning, as in the Roster frames.

| Screen                               | How to open it              | What it does                                                                                                                                       |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roster list                          | `/roster`                   | Purple table (#, Group Title, Employee Enrolled, Status, Action), search, "Show n entries", pager; Status switch per row (optimistic)              |
| Add Roster Group / Edit Roster Group | Add New / blue edit icon    | Group Title, Status, default Clock In / Clock Out with Defined Minutes, Apply For All, then the week: Weekend switch, Clock In, Clock Out, minutes |
| View                                 | orange eye icon             | The same layout, read-only, with an Edit button                                                                                                    |
| Enroll Employee in "…" Roster        | green person icon           | Active / Discontinued tabs, "Show n entries", search, sortable columns, pager; Discontinue per active row                                          |
| Enroll New Employee                  | button in the enroll dialog | Searchable employee checklist, Start Date, End Date (optional), Branch (optional, from Settings → Branch)                                          |

How it works:

- **Shift maths** (`utils/shift-time.ts`): Defined Minutes is clock out minus clock in. A clock out
  earlier than the clock in ends the next day (16:00 → 00:30 is 510 minutes) and is marked "+1 day".
- **Apply For All** copies the default Clock In / Clock Out to every working day and keeps them in
  step while it is ticked (the day inputs are locked). Unticking keeps the copied times, now
  editable. Marking a day as Weekend clears its times; it shows "Day off".
- **Validation** (`schemas/roster-group-form.schema.ts`): a title (unique, checked by the API), both
  times on each working day and different from each other, the default pair when Apply For All is
  on, and at least one working day.
- **Modals in the URL**: `?dialog=add`, `?dialog=edit&id=…`, `?dialog=view&id=…`,
  `?dialog=enroll&id=…`. Back closes a modal and a link can open one. Closing a form with unsaved
  changes asks first.
- **Enrollment rules** (mock API, `src/mocks/roster/`): one active roster per employee at a time.
  The picker lists people who can be enrolled first; anyone already on a roster is shown with
  "On Morning Work" or "Already on this roster" and cannot be ticked. Discontinue ends the
  enrollment today and moves it to the Discontinued tab. A group with enrolled employees cannot be
  deleted (the row comes back with the reason in a toast).
- **Phones**: the list becomes cards, and the week in the dialogs becomes one card per day.

## Scheduling

Scheduling puts people's shifts on a calendar: one row per employee, one column per day, and a
coloured block per shift (clock in / clock out). It sits in the sidebar after Warning. The screens
follow the Scheduling section of the Figma file (node `3093:15184`).

| Screen / flow                            | How to open it                                   | What it does                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scheduling — My                          | `/scheduling` (default tab)                      | The signed-in person's own row, the "Active Status" box (today's shift), search, legend, filters (Active Status, period, Date From / To)                                                               |
| Scheduling — All / Subordinates          | the All / Subordinates tabs                      | Every employee, or the people who report to you. Adds Apply Default Shift, Create, Delete, Export and Import, and the full filter set (time slot, group, location, branch, department, employee, type) |
| Board                                    | both tabs, Week or Month                         | Purple period header with ‹ › to move, yellow week bands ("Oct- Week 4"), today's column highlighted, "Planned Hours" footer per day, 10 employees per page                                            |
| Year view                                | period filter → Year                             | Planned hours and shift count per person per month; click a month to open it                                                                                                                           |
| Create Scheduling (step 1)               | Create, or "+" → Create schedule on an empty day | Start / End Date, Time Roster (eye button shows the roster), Apply Geo Fence, Repeat with From / To, weekdays and Step, Rest Days, Breaks                                                              |
| Create Scheduling (step 2)               | Next                                             | Shift Scheduling, Time Slot (name, times, overnight, Reverse Decision, Total Duration rules, overtime), Breaks, a preview of the shifts, Employees Name; Back / Save / Cancel                          |
| Select Geo Fence                         | "+" in the geo fence picker                      | Circle or Polygon, Name, Radius, location search and the map; Reset and Undo corner. The new fence is selected on save                                                                                 |
| Apply Default Shift                      | Apply Default Shift                              | Start / End Date and a Roster Group, then Select Employees; each person gets that roster's times for every day                                                                                         |
| Delete Scheduling (Delete Default Shift) | Delete                                           | Start / End Date, Delete Rest Days, Delete for All Employees (on), or Next → Select Employees; asks before deleting                                                                                    |
| Create New Rest Day                      | "+" → Create rest day on an empty day            | Start Date, Repeat, Step, From / To, weekdays, "Is Rest Day Payable?", and the employee picker                                                                                                         |
| On click (Edit / View / Swap / Delete)   | click a shift                                    | White strip with Edit, View and Swap, red strip to delete (asks first; rest days are kept)                                                                                                             |
| Edit Scheduling                          | Edit on a shift                                  | Date, Time Roster, Apply Geo Fence, Rest Days; only changed fields are sent                                                                                                                            |
| View Scheduling                          | View on a shift                                  | Read-only roster, times, planned hours, geo fences, breaks, overtime and flags, with an Edit button                                                                                                    |
| Swap Shift                               | Swap on a shift, drag a shift, or ‹ › on a block | Swap with another person's day (or move into an empty day). Dragging onto another cell does the same; the small chevrons move a shift one day                                                          |
| Enable/Disable Multiselect               | the purple button                                | Clicking a shift selects it (× mark); "N selected", Multi Edit ("Scheduling Edit") and Multi Delete (asks first)                                                                                       |
| Import / Export                          | All tab                                          | Export downloads the filtered board as CSV (all pages). Import reads a CSV (template provided) and lists bad lines                                                                                     |

How it works:

- **Repeat and Step** (`utils/schedule-dates.ts`): Repeat "Every N Week" with weekdays picks those
  days between From and To; Step is how many weeks in a row are on before the gap. Every 3 weeks
  with Step 2 means two weeks on, one off. "None" schedules every day between Start and End Date.
  Rest Days turn those weekdays into days off.
- **Times**: if step 2's times are left as the roster gives them, each day keeps its own roster
  times (the roster may differ per weekday). A clock out before the clock in is an overnight shift
  (moon icon) and counts into the next morning.
- **Planned hours** (`utils/shift-hours.ts`): clock out minus clock in, minus breaks that are not
  marked Inclusive. Flexible slots use their workable hours instead. The footer adds up everyone
  shown that day.
- **Colours** follow the time roster (Morning Work, Swing, Part Time, …), so a column shows at a
  glance who works which slot. Dots: indigo for work from home, blue for rest day, green for a
  geo fence.
- **Saving over existing days** replaces them (the toast says how many days were added or
  updated). Deleting a range keeps rest days unless "Delete Rest Days" is ticked.
- **URL state** (`routing.ts`): tab, period, date, page, search and every filter are in the URL,
  so a view can be shared. Date From / Date To override the period (up to 93 days).
- **Mock API** (`src/mocks/scheduling/`): the board is built from the Roster enrollments (Hybrid
  Work people, Swing, Part Time, Flexible, everyone else on Morning Work) from last month to next
  month. Subordinates are the people whose manager is the signed-in user. Swapping, moving,
  bulk edits, imports and geo fences (unique names, 409) are all handled there.
- **Phones**: the name column stays pinned while the days scroll sideways; dialogs become one
  column and the breaks table becomes cards.

## Attendance

Attendance turns each person's schedule into a record of what actually happened: punches, day
states, minutes and warnings. **Attendance** in the sidebar opens a group with **Attendance
Overview**, **Time Sheet**, **Attendance Logs** and **Attendance Settings**, following the Figma
frames "Attandnace Overview" (`2542:7496`), "My Time Sheet" (`2559:10025`) and the Attendance
Settings and Logs frames.

| Screen                 | How to open it                       | What it does                                                                                                                                                             |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Attendance Overview    | `/attendance/overview`               | Search, All / Subordinates, the 21-state legend (with the Figma icons), Employee Status / Name / Department / Month / Year + Search, then a grid of the month per person |
| My Time Sheet          | `/attendance/time-sheet`             | Current time with Clock In / Clock Out, Days Overview This Month tiles, From / To + Search, Show n entries, search, and one row per day with View                        |
| All Time Sheet         | the All tab                          | Employee Status and Employee Name pick the person; each row adds Edit, Missing Punch, Relaxation, Absent and Overtime as they apply                                      |
| Time Sheet View        | the blue eye                         | The person card, expected and actual times, breaks (one fold each), comments; History, Logs, Edit (All) and Cancel                                                       |
| History                | History in View                      | Edited By, Action (with old → new) and Date, newest first, paged                                                                                                         |
| Attendance Log         | Logs in View                         | Every punch: Punch Type, Punch Time, Description, Type (Import from Machine, Manual, Dashboard), Is Manually Updated                                                     |
| Time Sheet Edit in All | the green pencil                     | Check In / Check Out date and time beside the expected ones, Mark Absent / Half Day / Short Day, the Breaks table (+ Add, or "No Record Found") and Comments Details     |
| Row action dialogs     | orange, red and purple round buttons | Missing Punch (add the punch with a reason), Relaxation (waive late or early minutes), Absent (count the day as leave, duty, a visit or WFH), Overtime (approve minutes) |

How it works:

- **Built from Scheduling** (`src/mocks/attendance/engine.ts`): a scheduled shift is the
  expected clock in / out. The mock "machine" punches around it, always the same way for a given
  person and day, with the odd late arrival, early leave, missing punch, overtime, leave or
  official duty. HR's edits and manual punches are laid on top. Change a schedule in Scheduling
  and the attendance follows.
- **Day states**: holidays win, then rest days (Weekend when the roster has the day off, Rest Day
  otherwise), then what HR recorded, then leave, then Yet to Start (future, or today before the
  punch), Absent (no punches), and finally Late Arrival / Early Left / WFH / Present. Flexible
  rosters show Workable hours and part-time ones Workable shifts.
- **Sandwich**: days off between two absences or leaves count as Sandwich.
- **Warnings**: each late arrival or absence adds 20% in the Warnings column; the fifth in a
  month makes a "Late Penalty" (or "Absent Penalty"). A relaxed day does not count.
- **Minutes**: Late Mins from the expected clock in (5 minutes of grace before it counts as late),
  Duration from check in to check out, Worked Hours without breaks, Shift Worked Hours inside the
  shift only, overtime from 15 minutes past the expected clock out until HR approves it.
- **Clock In / Clock Out** records a "Dashboard" punch for the signed-in person; their day stays
  Yet to Start until they clock in.
- **Edits are audited**: every change writes a History line, and typed-in times show in the
  Attendance Log as Manual with "Is Manually Updated" ticked.
- **URL state**: tab, month, filters, person, dates, page, page size and search live in the URL.
  The filter cards apply on Search, as drawn.
- **Phones**: the grid and the time sheet scroll sideways under a sticky first column; the tiles
  and filters wrap; dialogs become one column and the breaks table becomes cards.

### Attendance Settings and Attendance Logs

Both pages sit beside the design's Attendance sub menu (Scheduling, Overtime, Official Visits,
Missing Punch, Attendance Logs, Attendance Insights, Settings), which folds into a dropdown on
narrow screens.

| Screen          | How to open it                      | What it does                                                                                                                                                            |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic           | `/attendance/settings`              | Six switches (ignore punch type, Check IN/OUT for breaks, short duration, dashboard punch, multi shift, picture on punch), Minimum Workable Minutes, Save Changes       |
| Scheduling      | the Scheduling tab                  | The scheduling switches, saved the same way                                                                                                                             |
| Rest Days       | the Rest Days tab                   | Rest days given with Create New Rest Day (the Scheduling dialog), Rest Day View with Delete, and the red Delete for a date range                                        |
| Break Types     | the Break Types tab                 | Name, Start and End Identifier; Create, View / Edit, Delete (refused while a time sheet uses the type)                                                                  |
| IP Restrictions | the IP Restrictions tab             | An IPv4 / IPv6 address with a subnet mask, or an IP range, with who it applies to (all, or criteria rows), an Active switch, Create / Edit / Delete                     |
| Geo Fencing     | the Geo Fencing tab                 | Two steps: draw the fence on the map (circle or polygon), then who it applies to; an Active switch                                                                      |
| Holidays        | the Holidays tab                    | Year filter, Create Holiday (Attendance Exempt, Name, Start / End Date, Description) and Holiday Rule Create (Religion, Geo Location, Organization Structure, Employee) |
| Attendance Logs | `/attendance/logs`                  | From / To (up to 31 days), Employee, Punch Type, Source; Employees, Punch Type, Punch Time, Source, Machine, Description; View, Edit and Delete                         |
| Create / Edit   | + Create, or Edit on a manual punch | Employee Name, Punch Type, Punch Time, Punch Date, Description                                                                                                          |
| Import          | Import                              | Computer: drop a CSV (Employee Code, Date, Time, Punch Type; template link), bad lines explained. Machine: tick machines, see what each one handed over                 |
| Download        | Download                            | Every punch of a chosen date as a CSV file                                                                                                                              |

How the settings reach the rest of the app:

- **Holidays** decide the Holiday day state. An Attendance Exempt holiday without rules is for
  everyone; with rules, for anyone a rule takes in (a religion, a country / state / city, a
  location and branch, or named people). A holiday that is not exempt is listed but the day is
  still worked.
- **Break Types** are the choices in the time sheet's Breaks table and its View.
- **Geo fences** are the same ones Scheduling offers; switching one off hides it there, and
  deleting it takes it off the schedules that used it.
- **Rest Days** are the Scheduling rest-day batches: deleting one gives the people their roster's
  shift back on those days.
- **Dashboard punch off** disables Clock In / Clock Out on My Time Sheet (the server refuses it
  too). **Minimum Workable Minutes** turns a finished day with fewer worked minutes into a Short
  Day.
- **Machines**: each branch has a check-in and a check-out machine (`MCH-00001` …) and a spare.
  Today's machine punches show only up to the last time the machine was read; Import → Machine
  reads it and the rest of the day's punches appear. Imported files add punches with source
  "Imported File". Machine and dashboard punches are read-only; manual and imported ones can be
  edited or deleted, and the time sheet recalculates.

## Requests

**Requests** in the sidebar (after Attendance and Leaves) opens the Requests sub menu: Punch,
Expense, Leave, Shift Requests, Loan & Advances, Work From Home, Official Visits, Promotion,
Relaxation, Rest Days, Travel, Transfer, Resignation and Settings, with the Figma icons.
Every type with screens in the design is built: **Punch**, **Shift Requests**, **Transfer**,
**Settings** (Request Restriction, Delegation, Request Flows) and, on the shared standard pages
below, **Leave**, **Loan & Advances**, **Work From Home**, **Promotion**, **Relaxation**, **Rest
Days**, **Travel** and **Resignation** (Figma sections `Request` `2622:1071`, `Approval`
`2706:62063`, `Shift Request+ Approval` `2706:65722`, `Transfer`, `Request Settings` and
`Requests` `2697:5532`). Expense and Official Visits have no screens in the design and open a
placeholder. The sidebar's Requests opens into the same list as a tree.

| Screen                 | How to open it              | What it does                                                                                                                                                   |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Punch Request          | `/requests/punch`           | My / All, Create, the "All Requests" status dropdown with counts, the count strip ("3 (All) (1) Pending…"), the list and its pager                             |
| Punch Request Create   | Create                      | Employee (All only), Date, Expected Check In / Out Time (from the person's schedule), Punch Type (Check In, Check Out, Missing Punch), Punch Time, Description |
| Punch Approval         | the Approvals tab           | Requested (yours), Delegates (passed to you), Consents (your say asked), with Approving Authority and Next Requestee                                           |
| Shift Request          | `/requests/shift`           | The form as drawn (Employee Name, Date, Time Roster, Swap From, Swap To, Description) and the requests under it                                                |
| Shift Approval         | the Approvals tab           | Code, Employee, Date, Time Roster, Swap From, Swap To, Description, Status                                                                                     |
| View / Approve/Reject  | the row menu                | Employee card, the request, Created, Next Requestee, consent and approval remarks; Approve / Reject (or Give Consent / Decline) with "Are you sure…?"          |
| Flow / History         | the row menu                | Flow: each approver, their authority and status. History: who did what and when, "(Delegate)" when someone acted for the approver                              |
| Edit / Delete / Cancel | the row menu (own requests) | Edit or Delete while nobody has acted; Cancel a completed request with a reason, which the final authority approves                                            |

How it works (`src/mocks/requests/`):

- **Approval flow**: the line manager, then the HR manager (one step when they are the same
  person). The HR manager's own requests go to the country manager and the second HR manager.
  Approving the last step completes the request; rejecting any step ends it.
- **Delegates**: Bilal Ahmed's approvals are passed to the signed-in HR manager, so his team's
  requests show under Delegates and History marks them "(Delegate)".
- **Consents**: a shift swap asks the colleague's consent; it must be given before the final
  approval. Some punch requests ask the HR manager's consent as well.
- **Effects**: an approved punch request adds the punch to Attendance (source "Punch Request", so
  the time sheet shows it as manually updated). An approved shift request changes the schedule:
  the new time roster for that day, or the two people's shifts swapped. Approving a cancellation
  puts it back.
- **Who may do what** comes from the server with each row (`actions`), so the menu only offers
  what applies: View, Edit, Delete, Flow, History, Cancel, Approve/Reject, Consent.
- **Checks**: punch requests are for today or earlier and need a shift that day; one pending
  request per day and punch type. Shift requests are for today or later; the new roster must
  work that weekday and differ from the current shift; the swap colleague must have a shift.
- **URL state**: tab, My / All, approvals view, status and page are in the URL.
- **Phones**: the sub menu folds into a button with the current type; lists become cards.

### Request Settings and Transfer

Settings opens three pages in the sub menu (on phones the fold-out reads "Settings · Delegation").

| Screen                    | How to open it                    | What it does                                                                                                                                                                          |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request Restriction       | `/requests/settings/restrictions` | Company, Start Date, End Date; Create (Start Date, End Date, Request Types, Description), View, Delete, a red bulk Delete for ticked rows, Filters                                    |
| Delegations               | `/requests/settings/delegation`   | Delegator, Delegatee, Type, Description, Active chip; Create, View, Enable / Disable, bulk Active / In Active for ticked rows, Filters                                                |
| Request Flows             | `/requests/settings/flows`        | The chosen type's flow nodes (ID, Can Edit, Is Condition, Name, Node, Next, Expression, If True, If False); Filters picks the Request Type (`?type=`)                                 |
| Request Flow Edit         | Edit on Request Flows             | Add Node, the node table with On Looker, Can Disagree, Is Condition, Node, Employee, Next, Expression, If True / If False, the red ⊗ per row; Save and Cancel                         |
| Request Flow assignment   | under the node list               | Per person: tick employees (All, or Search Employee) and pick their chain of authorities ("HOD → Final Authority"), or General Flow                                                   |
| Transfer Request          | `/requests/transfer`              | Request / Approvals tabs; All Request with status counts, Filters (Employee, Location, Branch, Effective Date, Department, Status), Create, ⋮ Edit / View / Delete / History / Cancel |
| Transfer Request Create   | Create                            | Employee Name, Location, Branch, Department, Line Manager, Final Authority, Effective Date, Attachment, Description, with the **Application** editor beside the form                  |
| Transfer Approvals        | the Approvals tab                 | Requested / Delegates, status counts, Approving Authority and Next Requestee, bulk Approved / Unapproved for ticked rows                                                              |
| Transfer Approval Approve | ⋮ Approve/Reject                  | The employee card (current place), where they move, the request and Created, Remarks, the Application beside it; Flow, History, Approve, Reject, Cancel                               |

How it works (`src/mocks/requests/settings-db.ts`, `settings-handlers.ts`, `transfer-*.ts`):

- **Restrictions** close a request type for a date range in the person's company: creating a
  punch or shift request, or creating or editing a transfer, on such a date is refused with
  "Punch requests are closed from … to …". Overlapping restrictions of the same type are refused.
- **Delegations** are per request type: an active delegation puts the delegator's approvals of
  that type under the delegatee's Delegates view. One active delegation per person and type; no
  delegating to yourself. The seed passes Bilal Ahmed's punch, shift and transfer approvals to
  the HR manager.
- **Request Flows**: every type (and its "… Cancel Request") follows the General Flow (Line
  Manager → Final Authority) until it is edited. A flow is walked from its first node: Next (or
  If True / If False on a condition row such as `department = Sales`) picks the following node;
  On Looker only adds "Informed (On Looker)" to the history; Can Disagree and Consentee nodes ask
  for consent; other nodes are approval steps. The same approver twice in a row decides once, and
  nobody approves their own request. Saving refuses loops and Next values that point nowhere.
- **Assignments** give one person their own chain for a type (seeded: Saad Hadier's and Zainab
  Noor's leave); it replaces the flow's nodes for that person.
- **Transfer**: the Application editor is a small rich-text box (Style, Bold, Underline, Clear,
  Font, Highlight, lists, Alignment). Regenerate writes the transfer letter from the form,
  addressed to the Final Authority; it is cleaned to the editor's own formatting before it is
  saved or shown. The request goes through the Transfer flow; approving the last step records
  the move in a transfer log (the employee card still shows the seeded place), and approving a
  cancellation takes it out again. Seeds: RQ-TRF-0001 (waiting for Bilal, so under Delegates),
  RQ-TRF-0002 (Bilal approved, waiting for the HR manager), RQ-TRF-0003 (approved).

### The newer request types (shared "standard" pages)

The Figma "Requests" section (`2697:5532`, banners such as "Rest Days" `4247:89539`) draws the
remaining types on one layout, so they share one page, one set of popups and one mock engine:

- **Page** (`features/requests/standard/standard-page.tsx`): Requests / Approvals tabs (plus a
  Settings tab where a type has one), the title, Filter and Create, the type's My / All pill
  ("My Requests | All Requests", "My Loan & Advances | …"), Approved / Unapproved for the ticked
  rows, the status tabs, the list and the pager. Approvals has Requested / Cancellations /
  Delegates as the type draws them.
- **Popups** (`standard-dialogs.tsx`): View and Approve/Reject (the employee card, the type's
  fields, Created, the approvers' remarks, the Remarks box or "Reason for Approval *", and the
  type's own approval fields), Flow, History, Cancel ("Reason for Cancellation *"), Delete
  ("Are you sure you want to Delete this?") and the bulk Unapprove reason.
- **A type** is a folder in `features/requests/standard/kinds/<kind>/` (its payload type, form,
  columns, filters and View rows) and a server definition in
  `mocks/requests/standard/kinds/<kind>.ts` (field checks, filters, look-ups, seeds and what an
  approval changes), registered in `standard/registry.ts` and `mocks/requests/standard/index.ts`.
  `/requests/$type` renders the page for a registered type and the placeholder otherwise.
- **Engine** (`mocks/requests/standard/engine.ts`): the same REST shape as Transfer, the flows,
  delegations and restrictions of Requests → Settings (Rest Day is added to Settings' request
  types), Bilal Ahmed's approvals of every type delegated to the signed-in HR manager.
- **Rest Days** (frames `2877:16549` … `2888:19984`, `4247:89087`): Create Rest Day Request
  (Employee Name, Department, Roster, Date (from), Date (to), Reason, Selected Days = the
  roster's working days in the range); Requests list Code, Employees, Department, Rosters, Shift,
  Date (from), Date (to), Payable, Status; Approvals list Code, Employees, Department, Time
  Slots, Date, Time, Duration, Authority, Request Flow, Status; Requested / Cancellations /
  Delegates. Approving turns those days into paid rest days on the schedule; an approved
  cancellation puts the shifts back. Codes RD-001…
- **Loan & Advances** (My `4172:56537`, All `4190:93673`, Requested `4190:95964`, Delegates
  `4190:98077`, Settings `4190:100688` / `4195:106914` / `4195:108102`): "My Loan & Advances |
  All Loan & Advances", status tabs, Approved / Unapproved; Approvals Requested and Delegates.
  Create: Type, Category, Required Amount (RS), Required Date, Attachment, Extension No., Reason
  and Guarantors ("+ Add" opens Guarantor Create: Name, CNIC, Attachment, Known Since,
  Relationship, Extension No, Description). The type's rules apply: months of service, contract
  types, one pending request per type, Gap Between Requests, Guarantor Required. Approve/Reject
  shows the employee's approved / repaid / remaining totals and asks Approved Amount (at most the
  amount asked), Payment Method and Repayment Date (bulk Approved uses the amount asked, Bank and
  the 1st of next month). On approval the type's terms are copied to the request; Settings →
  Repayment lists the installments (approved ÷ No of Installments, every Gap Between
  Installments months from the repayment date; none for a Non Payable type). Settings → Types /
  Categories: create, edit, view, inactivate; one in use cannot be deleted. Codes LA-0001…
- **Leave** (My `4189:54603`, All `4191:64478`, Approvals `4194:70604`, Delegates
  `4194:79769`): "My Request | All Requests", the Balance card (Leave Type, Balance, Availed,
  Available, Pending) and a "Request" heading over the status tabs. Entitlements are seeded per
  person and leave type (Shelley: Casual 8, Sick 15); Availed counts approved days, Pending
  pending days, Available = total − availed − pending, this year. Only shift days count; saving
  refuses more than Available and overlaps. Short leave: Half Day (0.5) or Quarter Day (0.25) of
  one shift day, the times inside the shift, Start / End Time filled in from it. The Approve
  popup adds Total, Available and Availed Leaves; approval leaves the schedule as it is. Codes
  LV-0001…
- **Work From Home**: "My Requests | All Requests", "Completed" for an approved request; Create
  has Start / End Date and a week strip of the person's shifts ("Rest Day" / "Day off") to tick
  ("Please select at least one shift."); days already from home cannot be asked again.
  Approval sets the schedule entries to work from home; an approved cancellation restores
  them. Approvals: Requested and Delegates with an Approver column. Both strips read
  `GET /requests/<kind>/schedule`. Codes WFH-0001…
- **Resignation**: "My Resignation | All Resignations", Approvals Requested / Cancellations /
  Delegates. Create: Employee (All), Type (Voluntary, Retirement, Contract End), Resignation
  Date, Last Working Date, Notice Period (the days between, read-only), Reason, Attachment. One
  open resignation per person. Approval adds a pending End of Employment record (Off-boarding);
  an approved cancellation removes it while HR has not started on it. Codes RSG-0001…
- **Relaxation**: "My Requests | All Requests", Approvals Requested / Cancellations / Delegates,
  no status tabs and no bulk buttons (approving needs "Reason for Approval *"). Create: Employee
  Name (All), Date, the day's Time Slot (read-only), Start Time, End Time, Reason; the times must
  fall inside that day's shift (overnight shifts handled), and requests on one day may not
  overlap. Approval relaxes the attendance day (late arrival and early leave waived, the day
  shows Relaxation, history logged); an approved cancellation restores it. Codes RLX-0001…
- **Travel** (`4163:54986` … `4189:52596`): "My Request | All Requests", status tabs, Approved
  / Unapproved; Approvals Requested and Delegates. Travel Request Create: Purpose, Extension No,
  Alternative Phone No, Description, Advance Required with Advances (Amount, Currency), Details
  (each opens Travel Detail Create: type, from / to, mode, distance, dates and times, Stay
  Required with Hotel Bookings, Ticket Bookings for Bus, Train and Air), and the Application card
  with Regenerate (Transfer's editor). Legs start today or later and may not overlap each other
  or another trip; hotels and tickets fall inside the trip; Night is worked out from the hotel
  dates. Codes TR-0001…
- **Promotion**: one list of everyone's requests (HR files them for an employee). Create:
  Employee, Demotion No / Yes, Grade, Level, Designation, Job Title, Previous Salary (from
  Payroll), Salary, Benefits (EOBI, Medical), Effective Date, Attachment, Description. A
  promotion cannot lower the salary nor a demotion raise it; one open request per person.
  Approval adds a Payroll salary revision from the effective date; an approved cancellation
  removes it. Codes PR-0001…

Not checked against Figma: the connector reached the account's Starter-plan call limit while
these were built, so **Promotion**, **Resignation**, **Relaxation** and **Work From Home** were
built from the written design notes (`HRango/requirements/HRango - UI design/Design/01-Requests`),
and so was the newer Punch layout; Loan & Advances' Settings Categories and Repayment screens and
some Approve/Reject variants were also not read. Their titles, columns, filters and option lists
(Resignation Types, Promotion Grades and Levels) should be compared with the frames when Figma
can be read again.

**Punch** moved onto the same layout (the newer Punch frames, `4037:29125` … `4187:63877`):
"My Punch Request | All Punch Requests", Filter (Punch Start / End Time, Method, Next Requestee,
Status, From, To; All and Approvals add Location, Branch, Department, Employment Status, and
Delegates the Delegator), Approved / Unapproved, status tabs, Requested / Delegates / Consents.
Its popups, flow, consents and the Attendance effect are unchanged. Shift Requests keeps the
older frames' layout (no newer Shift frames).

## Leaves

The sidebar's own **Leaves** item (between Attendance and Requests), as distinct from Requests →
Leave, which is a request type. The design is the "Leaves" section (4428:89942) of `HRango - UI
design`, page Design: six 1440 × 1024 frames (My Leaves, Leave Applications, Settings → General,
three Leave Types states) and three tall Leave Type form frames. Exports and an index are in
`HRango2/Design/leaves` (`INDEX.md`). The field-by-field notes in
`HRango/requirements/HRango - UI design/Design/05-Leaves/README.md` were read alongside; where
the frames and the notes disagree, the frames won.

Code: `src/features/leaves` (types, constants, API, hooks, schemas; `components/layout` for the
sub menu, `applications`, `settings`), mocks in `src/mocks/leaves` (`rules.ts` holds the balance
and eligibility rules), routes under `src/routes/_app/leaves`.

| Screen             | How to open it                                          | What it does                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| My Leaves          | Sidebar → Leaves (`/leaves/my-leaves?status=&page=`)    | "All Requests (n)" dropdown with the counts per status, Filter, + Apply Leave, the table (Sr#., Category, Type, Leave Date, Applied On, Reason, Days, Rosters, Status, Actions: view, cancel)                                                                                       |
| Leave Applications | Sub menu (`/leaves/applications`)                       | Everyone's leaves with the Employees column; Approve / Reject (with remarks) on pending ones                                                                                                                                                                                        |
| General Settings   | Sub menu → Settings (`/leaves/settings/general`)        | Leave Final Approval By, Approve Leave on Status, Post Leave Application Deadline, Save Changes                                                                                                                                                                                     |
| Leave Types        | Settings → Leave Types (`/leaves/settings/leave-types`) | Sr#., Type, No. of Leaves, Leave Encashment and Status switches, the pencil; "+ Add New" in the Settings title row opens the "Add Leave Types" popup (`?dialog=add`): the checkboxes with their dependent fields, Pre Condition, Balance Settings, Experience and Short Leave Slabs |
| Leave Policies     | Settings → Leave Policies (`/leaves/settings/policies`) | Sr#., Leave Policy, Enroll Employee (count, or the button on an employee-level policy), Policy Level, the Leave Policy (in force) and Status switches, the pencil; "+ Add New" opens Add Policy (Policy, Title, policy level, Allow half day / short day leave)                     |
| Leave Encashment   | Sub menu                                                | A link to Payroll → Leave Encashment, as the notes list it                                                                                                                                                                                                                          |

How it works:

- **One set of leave requests.** My Leaves and Leave Applications read and write the same
  requests as Requests → Leave (the `standardRequests` collection, kind `leave`): a leave applied
  here appears there and back, codes continue the LV- series, and Apply goes through the same
  flow planning (Line Manager → HR Manager, restrictions). Approving on Leave Applications records
  the approval on every remaining step and completes the request; rejecting needs remarks.
- **One set of leave types.** The types under Settings → Leave Types are the ones Requests →
  Leave offers (`src/mocks/requests/standard/kinds/leave.ts` reads them), filtered on Apply by Is
  Active, probation, gender and marital status; a type in use cannot be deleted.
- **Balances** (`src/mocks/leaves/rules.ts`): the entitlement Requests → Leave seeds (so Casual /
  Sick match that module exactly), else the type's own number or its experience slab; Pro Rated
  and Earned Balance adjust it. Both modules show the same balance.
- **Policies** are the two kinds the Add Policy select offers: a **Leave Distribution Policy** in
  force covers its people (company level: everyone; employee level: the enrolled), and only
  covered people may apply; a **Half leave & Short leave** policy says whether half-day and short
  leave are allowed for its people (an employee-level policy outranks the company one).

### Leaves: departures from the design

- **Typos fixed**: "Martial Status" → Marital Status, "Probition" → Probation, "Short Remaining
  leaves in Pay Slip" → Show Remaining Leaves in Payslip (the second Experience frame itself
  writes it that way).
- **No frame of their own**: Apply Leave and Enroll Employee (built in the module's style), and
  the Edit mode of both popups, which reuse the Add frame with "Save" and a Delete button in the
  footer (the lists draw only the pencil, and a type or policy in use must be refused).
- **Fields the frames draw but do not define** got one documented meaning: Leave Final Approval By
  (HR Manager / Line Manager / Head of Department), Approve Leave on Status (Approved / Pending:
  when days count as availed), Post Leave Application Deadline (a switch: back-dated applications
  must be within the type's Back Date Leave Limit in Days), Do When Attachment is Required
  (Refuse / Accept and note), Tenure (Yearly / Monthly / Whole Employment), Balance According to
  (Flat / Experience, the frame's two-way switch), Accumulative Count (a number, as the frame
  draws an input), Short Leave Slab Type (Hours / Minutes), Has Future Date Limit (60 days
  ahead), the types list's Leave Encashment switch (the type's Encashment) and Status switch (Is
  Active), the policies list's second "Leave Policy" column (a switch: the policy is in force).
  Checkboxes stored without behaviour in the mock, said in their hints: Auto Allotment, Auto
  Balance on Joining Month, Composite, Sandwich Across Leave Type, Carry Forward, Show Remaining
  Leaves in Payslip. Short Leave Slabs appear with the Short Leave checkbox; Experience Slabs with
  Balance According to = Experience.
- **Add Policy**: Employee Level Policy shows "Employee level Policy will apply to the employees
  you enroll in it." while it is chosen (the frame draws only the company sentence); the two
  policy-level controls are the frame's switches, of which one is on, rather than a radio group.
- **Data**: employee codes are the directory's (`Id-001…`), not the frame's sample "R2-97907";
  marital status is not in the directory, so the mock treats every third person as single.
- **Small items**: "All Requests (20) Pending (2) …" is a dropdown, as the frame draws it (a hidden
  layer); its items read "Completed" and the chips "Approved", both as drawn. Chips are 10 px and
  the person cell 11 / 9 px (readability floor); inactive inner tabs use Poppins (majority of the
  frames). The clock icon the frame trails after two selects is the Select's chevron (a clock on a
  select cannot work). Icons: the pencil (border_color) and the slab tables' red cancel are cut
  from the frames; the settings tabs reuse the same file's gear, Leaves and document icons (the
  frames' tab vectors are clip-path groups with no clean shape); lucide ChevronDown, MoreVertical
  and Check (the 14 px checkbox tick) where no export draws them; Filter is the design's own
  page_info icon; the slab tables' "Select Type" uses the shared Select and its chevron.

## Payroll

**Payroll** in the sidebar opens a tree, as drawn: Dashboard; Payroll Settings (General, Tax,
Rewards, Pay Components, Account Type, Disbursement Banks); Payrolls (Monthly, Daily Wages);
Salary Sheet; Pay Slips (My, All); Vouchers (Employee Voucher Creation); Final Settlement; Balances
(Opening Balance, Employee Accounts, Employee Account Statement); Salary Revision; Leave
Encashment; Reports. Figma sections (duplicate file): Dashboard `3335:19650`, Monthly + Salary
Sheet + Pay Slips `3321:18975`, Daily Wages `3477:20364`, Vouchers `3427:19622`, Employee Voucher
`3867:23111`, Balances + Final Settlement `3431:20265`, Salary Revision `3523:19615`, Leave
Encashment `3552:23120`, Payslip edit `3502:23220`, Payroll Settings `3000:13263`.

| Screen                     | How to open it                                    | What it does                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                  | `/payroll/dashboard`                              | Payroll Comparison Yearly (last year and this year, net pay per month), Expenses Month Wise, Expense Report for a month, Month Wise Loan & Advance, Employee Month Wise Earning for a chosen person |
| Settings → General         | `/payroll/settings/general`                       | Payroll Configuration (the 22 settings: switches, selects and boxes) and Leave Configuration                                                                                                        |
| Settings → Tax             | `/payroll/settings/tax`                           | Tax Rebate (rows with an attachment) and Tax Structure (slabs with a fixed amount and a rate, surcharge rule)                                                                                       |
| Settings → Rewards         | `/payroll/settings/rewards`                       | Benefits (individual or group, with members) and Incentives                                                                                                                                         |
| Settings → Pay Components  | `/payroll/settings/pay-components`                | Pay Items (type, calculation, expression over `{variables}`, taxable, tax distribution), Formulas and Rules; an expression that does not work out is refused                                        |
| Account Type, Banks        | the Account Type and Disbursement Banks tabs      | The accounts balances are kept in (Medical, PF, EOBI, Loan …) and the company's paying banks                                                                                                        |
| Payrolls Monthly           | `/payroll/payrolls/monthly`                       | Code, Name, Tax Structure, Month, Last Running, Status, Last Closing and the action icons each status allows; + Create, bulk On Hold                                                                |
| Create / Edit / View       | + Create, Edit, View                              | Name, Currency, Tax Structure, Tax Applicable, Payroll Processing, Processing Date, Applicable Days, No of Fixed Days, Company Bank, Description, the Pay Items table; View adds History            |
| Run / Stop / Error         | the row icons                                     | Run works out every person's pay slip; Stop closes the payroll ("cannot be reverted"); Error lists who could not be paid and why; Employments adds people                                           |
| Payrolls Daily Wages       | `/payroll/payrolls/daily-wages`                   | Create in two steps (time slot, name and dates, then each person's hours and amounts), View / Edit / Download, and Voucher to pay it out                                                            |
| Salary Sheet               | Salary Sheet icon, or `/payroll/salary-sheet`     | One line per person for a payroll and month: each pay item, earnings, deductions, net payable and a Total line                                                                                      |
| Pay Slips (My / All)       | `/payroll/pay-slips/my`, `/payroll/pay-slips/all` | My: the Employee Accounts summary and your slips. All: filters, select and hold, Pay, Recalculate, Edit lines (marked Manually Updated, with History), and the pay slip document with Print         |
| Vouchers                   | `/payroll/vouchers`                               | Every voucher line (payroll, daily wages, employee vouchers) with View and Delete                                                                                                                   |
| Employee Voucher           | `/payroll/vouchers/employee`                      | The voucher form as drawn: employee, Voucher Details, Attachment, Approval Web Flow, Verification; Edit, View, Delete                                                                               |
| Final Settlement           | `/payroll/final-settlement`                       | Leavers with their settlement; View shows the separation details and the settlement slip; Close FS completes it                                                                                     |
| Opening Balance            | `/payroll/balances/opening-balance`               | Each person's opening balance per account; Add, Adjust, Import (with Sample Import)                                                                                                                 |
| Employee Accounts          | `/payroll/balances/employee-accounts`             | Employee, Account, Month, Credit, Debit; Create (Credit+ / Debit-), Import File (Opening Balance, Provident Fund), Filters, and the ⋮ menu (Edit, View)                                             |
| Employee Account Statement | `/payroll/balances/account-statement`             | One person's entries per account and month with credit, debit and processed                                                                                                                         |
| Salary Revision            | `/payroll/salary-revision`                        | Create (Flat or Percentage on the current salary, effective date), Edit, View, Delete, Import                                                                                                       |
| Leave Encashment           | `/payroll/leave-encashment`                       | Leave, Employee, Year, Amount per leave, one line per person; Create / Edit / View (Leave Type, All Employees or Employees, Year, Payroll or Manually, Amount Per Leave), Delete, Filters           |
| Reports                    | `/payroll/reports/employee-accounts`              | Provident fund, tax rebate and tax paid per person                                                                                                                                                  |

How it works (`src/mocks/payroll/`):

- **Pay engine** (`engine.ts`): each pay item is an expression over variables such as
  `{gross_salary}`, `{worked_days}` or `{overtime_minutes}` (`expression.ts`; the 17 variables are
  listed in `FORMULA_VARIABLES`). The day counts come from Attendance for the payroll's month, the
  salary from the latest Salary Revision, and opening balances are added to their pay items.
  `{annual_tax}` comes from the tax structure's slabs plus the surcharge, and `{monthly_tax}` is a
  twelfth of it. A value someone edited by hand is kept on recalculation.
- **Statuses**: a payroll is Pending until it is run, then Run, Closed or On Hold. Pay slips are
  Ready to Release, Released, On Hold or Released With FS. Closing a payroll releases its ready
  slips; running a closed payroll moves it to the next month, up to the current one.
- **Links between screens**: employee vouchers and the Daily Wages Voucher button add voucher
  lines; a final settlement makes its own pay slip, released when the settlement is closed;
  employee account entries and opening balances feed the statement and the report.
- **Sample data**: three payrolls as drawn (Head Office running this month, Software closed last
  month, Abdul on hold with an error for one person), worked out on first use.
- **Lists** keep their filters in a saved preset (Save Preset) per list; the URL holds the page.
- **Checked** page by page at 375 and 769 px (no sideways page scroll, dialogs inside the screen)
  and in dark mode on Monthly and the Dashboard; wider screens were not re-checked for Payroll.

### Leave Encashment

Unused leave days paid out (`src/mocks/payroll/encashment-handlers.ts`). The design names the
fields but not the sums, so these are the defaults:

- **Leave types** are the Leave Quotas account types (Sick Leave, Casual Leaves). A person's
  **days** are that account's credits less its debits within the leave year (Payroll Settings →
  Leave Configuration: calendar or fiscal year). People with no days left are skipped; if nobody
  has any, Save says so.
- **Amount per leave**: with Type **Payroll**, a day's gross salary (the salary ÷ 30). With
  **Manually**, the Amount Per Leave basis: Earned Salary = a day's salary; Per Hour Rate = the
  hourly rate (a day ÷ 8) × the person's roster shift hours; Overtime = the same at 1.5×;
  Overnight = the same at 2× (`ENCASHMENT_BASIS_RATES` in `constants.ts`). The salary is the one at
  the end of the leave year, or today while the year runs. The sample "Hybrid Work" roster has
  1–2 hour shifts (as in its design), so the hourly bases come out low for its 22 people.
- **Paying it**: the days are debited from the leave quota in the month the encashment is made, so
  they cannot be paid twice. Payroll encashments go into that month's **Leave Encashment** pay
  item (the `{leave_encashment}` variable; the line is added even when the payroll does not list
  the pay item) and open pay slips are worked out again. Manual ones add a voucher line per person
  on Vouchers.
- **Edit, View, Delete** act on the whole encashment a line belongs to; deleting one for several
  people says how many. Once a payroll encashment is in a released pay slip it can no longer be
  edited or deleted.
- **Sample data**: Sick Leave for Omer Farooq through this month's Head Office payroll, and Casual
  Leaves for Haroon Jalani and Fatima Zahra paid Manually; six people have quotas this year.

## Assets and off-boarding

Two sidebar groups after Payroll, as drawn: **Assets** (Company Assets, Asset Allocations, Asset
Types, Asset Clearance Form) and **End of Employment** (All, Completed, Pending), plus
**Settings → Off Boarding Settings** (the Off Boarding Checklist). Figma sections (duplicate
file): Assets `3526:20963`, Asset Types `3537:19639`, Asset Clearance Form `3842:24105` (with
bulk approve; built) and `3809:29538` (the same forms opened over End of Employment), End of
Employment `3802:23581`, Settings Checklist `4163:39444`. The sidebar icons are the Figma
exports (`3802:23761`, `3802:25120`). Code: `src/features/assets`, `src/features/offboarding`,
mocks in `src/mocks/assets` and `src/mocks/offboarding`. Both reuse Payroll's record-page kit
(cards, dialogs, pickers, filters), exported from `@/features/payroll`.

| Screen                              | How to open it                                          | What it does                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company Assets                      | `/assets/company-assets`                                | Code, Name, Identification Number, Status; ⋮ Edit, View, Delete, History, Deactivate (Activate when unavailable); Create, Import File ⌄ (Assets CSV, Sample File), Filters                                     |
| Asset Create / Edit / View          | Create, Edit, View                                      | Name, Asset Type, Identification Number, Taxable and Condition (Old / New) on one row, Manufacturer, Model, Attachment, Current Value (RS), Acquired date, Description; View: History                          |
| Asset History                       | History (row menu or View)                              | Employee, Action, Performed At; each line opens to Field, Old Value, New Value                                                                                                                                 |
| Asset Types                         | `/assets/types`                                         | Code, Name, Description, Status; Create / Edit / View (Name, Active, Description), Delete, Filters (Status, Name)                                                                                              |
| Asset Allocations                   | `/assets/allocations`                                   | Company, Employee, Asset, Identification Number, Allocation Date, Deallocation Date, Status; ⋮ View, Deallocate; Allocate; Filters (Employees, Asset Type, Is Allocated, Assets, From, To)                     |
| Allocate / View / Deallocate        | Allocate, View, Deallocate                              | "Asset": Employee, Asset Type, Asset (available ones of that type), Allocation Date, Attachment, Description; Deallocate asks the date                                                                         |
| Asset Clearance Form                | `/assets/clearance-form`                                | Row and select-all boxes, Employee ID, Name, Department, Clearance Date, Status; bulk Approved / Unapproved with a confirmation; Create, Filters                                                               |
| Clearance Form Create / Edit / View | Create, Edit, View (or after an End of Employment save) | Employee Name (ID and Department filled in), Clearance Date; Asset Details per asset held (Asset Name, Asset ID, Date Allocated, Condition, Reason, Return Status, Comments); Verification & Approval          |
| End of Employment                   | `/end-of-employment/all`, `/completed`, `/pending`      | Employee, Branch, Location, Department, Designation, Date, Creation Date, Completion Date, Status; ⋮ Edit, View, Delete (pending) or View, Rehire (completed); Create, Import File, Filters                    |
| End of Employment dialog            | Create, Edit, View                                      | The person's card (Age, Email, Phone, Experience); Information tab (Employee, Reason, Notice Period → Last Working Date, Final Settlement, Asset Clearance, Attachment, Description, Delegatee); Checklist tab |
| Rehire                              | Rehire (completed records)                              | Employee, Last Working Date, Joining Date, then "Are you sure you want to Perform this action?"                                                                                                                |
| Off Boarding Checklist              | Settings → Off Boarding Settings                        | The Off Boarding menu (Control Panel, Off Boarding Settings, Off Boarding Checklist); Code, Name; ⋮ Edit, View; Create, Filters (Name, Code)                                                                   |
| Checklist / Additional Information  | Create, Edit, View; the table's icons                   | Name, Status (Deactive / Active), Description, Additional Information table; a field: Name, Type (Number, String, Date, Boolean), Required, Min / Max or Min / Max Length                                      |

How it works:

- **Asset status**: Available, Allocated (it has an open allocation) or Unavailable (deactivated,
  or lost / damaged at a clearance). Every change is kept in Asset History: Create, Update (the
  fields that changed, old and new), Allocate, Deallocate, Deactivate / Activate, Clearance.
- **Allocations**: an active asset that nobody holds can be allocated to someone still working
  here, from its acquired date. Deallocate ends it on a date. A deactivated or allocated asset
  cannot be allocated; an allocated one cannot be deactivated; one that was ever allocated cannot
  be deleted (deactivate it instead). An asset type in use cannot be deleted.
- **Clearance**: one form per leaver at a time, with an Asset Details block per asset they hold
  (filled in from their open allocations). It stays "Pending by HR" until **Approved** (bulk, on
  the ticked rows): each asset's allocation then ends on the clearance date, and an asset marked
  Not Returned or Damaged becomes Unavailable. **Unapproved** puts the form back to pending and
  gives the assets back as they were (unless someone else has been given one since). Approved
  forms cannot be edited or deleted until unapproved.
- **End of Employment**: one pending record per person. Without a notice period the last working
  date is the day it is made. **Final Settlement** ticked makes (or takes over) the person's
  Payroll Final Settlement and keeps it in step while it is pending; unticking drops it.
  **Asset Clearance** ticked opens a clearance form filled in for the person after Save (nothing
  to clear when they hold no assets). The record turns **Completed** once the settlement is
  closed, the clearance approved and the checklist's required answers given; it goes back to
  pending if one of those is undone. Completed records cannot be edited or deleted; **Rehire**
  records a joining date after the last working date.
- **Checklist tab**: the fields of the active Off Boarding Checklists (Number with min / max,
  String with length limits, Date, Boolean), checked on Save.
- **Employee card**: Age, Email and Phone are sample values worked out from the person (the mock
  directory has none); Experience runs from the joining date to the last working date.
- **Sample data**: six asset types (Printer inactive), nine assets, six allocations; Payroll's two
  leavers: Talha Aziz (pending: his clearance for a laptop and phone is with HR, his settlement is
  open) and Nida Hassan (completed); the "Off Boarding Checklist" (ECL-00001) with Asset Clear
  (date, required), Exit Interview Done, Notice Days Served and Handover Notes.

## Project Management

A sidebar tree between End of Employment and Performance, as in the Project Management files'
side menu: **Home Dashboard, Workspace Dashboard, Project Dashboard, Task Dashboard** and
**Create Workspace**. Two Figma files make up the module:

- `HRango Project Management Module` (`3qdYwYoOYE8B3VnUaqIMeL`, page 337:136274): the Create
  Workspace page, the Workspace Navigation panel and the three-step Create Workspace wizard
  (about 200 frames, most of them states of the status editor).
- `HRango Project Workspace UX UI Design` (`uDxoMdHpwl3tN5jqZpmofM`): the Workspace Page with its
  List view, and the boards of task-field popups, column menus and permissions.

Neither file could be read through the Figma connector (view-only file, Starter-plan call
limit), so every screen was exported from the Figma web app instead: "Copy as code > CSS (all
layers)" and "Copy as SVG" of each frame. The exports, the icons cut from them and an index are
in `HRango2/Design/project-management` (`INDEX.md`); the tools there cut icons out of a frame
SVG (`tools/svg-cut.mjs`) and turn them into React components (`tools/svg-to-jsx.mjs`). Text,
colours, sizes and radii come from the CSS exports; the icons and the Create Workspace
illustration are the design's own vectors.

Code: `src/features/project-management` (types, constants, API, hooks; `components/layout` for
the panel, landing and dashboards; `create-workspace`, `workspace`, `task-fields`, `comments`),
mocks in `src/mocks/project-management`, routes under `src/routes/_app/project-management`.

| Screen                  | How to open it                                                                         | What it does                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create Workspace page   | Sidebar → Create Workspace (`/project-management/workspaces`)                          | The Workspaces panel beside "Create your own workspace!" and its Create Workspace button                                                                                                                                    |
| Workspaces panel        | Beside every workspace page                                                            | Search, "+" (Create Workspace, with its tooltip), Favorites, each workspace; the open one shows its folders, lists and docs; "…" expands or collapses the tree, "+" adds a folder, list or doc; dashed "+ Create Workspace" |
| Create Workspace wizard | "+", Create Workspace (`?create=true`)                                                 | Add Workspace Details → Define Workflow → Customize Template, with the Default Views, Edit Statuses and Organizer pages                                                                                                     |
| Workspace page          | A workspace or list in the panel (`/project-management/workspaces/$workspaceId?list=`) | Cover banner, members and Invite Members, view bar, the List view grouped by status                                                                                                                                         |
| Task fields             | The List view's cells                                                                  | Assignees, dates and recurrence, priority, tags and labels, dependencies, status and task type, story points, time estimate and tracking, files, and the read-only columns                                                  |
| Comments                | A task's comment controls                                                              | Threads with Mark as Resolve, assignment, replies, @mentions of people and tasks, likes, emoji, edit, copy link, delete                                                                                                     |
| Sharing & Permissions   | Task row menu → Sharing & Permissions                                                  | Share as a list view or a page, invite by email, people with Full Edit / Edit All / View, private link, link for anyone with a validity period and access limit, the task properties shown                                  |
| Dashboards              | Sidebar → Home / Workspace / Project / Task Dashboard                                  | Not designed in either file: a placeholder says so                                                                                                                                                                          |

How it works:

- **Data**: workspaces (with their setup from the wizard: views, statuses, organizer features),
  their folders, lists and docs, tasks with subtasks, comments, tags and labels, and sharing
  settings, all in the mock API under `/project-management`. A private workspace is listed for
  its owner and members only.
- **Sample data**: "UX/UI Design Team Work Space" (favourite) with the folders UX Design Process
  and User Research & Planning from the Workspace Navigation frame, seven tasks (two subtasks),
  tags, labels and a comment thread; "User Research & Planning" and "QA Testing Phase" (both
  empty).

- **Templates** (Define Workflow): each template starts with the views, statuses and organizer
  features its Customize Template summary lists. Project Management, for example, has List,
  Board, Calendar, Gantt and Team, and To Do > Planning > In-Progress > At Risk > Update Required
  > Completed. The status templates (Custom, Content, Kanban, Marketing, Scrum) carry the lists
  > of their status pages.

### Project Management: departures from the design

Panel, landing, comments, sharing and dashboards:

- **Workspaces panel**: the collapse icon and the Favorites star are lucide icons (both are hidden
  layers in the export, which cannot be copied as SVG); the other icons are cut from Workspace
  Navigation. The "…" and "+" buttons under the search have no menus in the design: "…" expands or
  collapses the tree and "+" adds a folder, list or doc to the open workspace. Docs have no
  screen, so a doc row is not a link.
- **Dashboards**: Home, Workspace, Project and Task Dashboard are in the menu but drawn in neither
  file; each opens a placeholder that says so.
- **Comments**: a comment's emoji button opens a reply with the chosen emoji (there is no
  reaction model behind the drawn button); the mention menu's Locations tab is disabled (the app
  has no locations); a mention is written into the text as `@Name` or a task's ID and drawn blue
  or as a task chip. "05:30 Pm" is written "05:30 PM". Mark as Resolve and Assigned to … are on
  each thread, as drawn.
- **Sharing & Permissions**: the dialog's frames are hidden layers in the export, so its layout
  follows the design's text and the module's styles rather than a drawn frame. "Copy private
  link" copies a `/shared/…` address that has no page yet (there is no public share page).

Create Workspace wizard:

- **Organizer toggles are shown.** The design hides each row's Toggle Button, so nothing could be
  switched; the toggle sits before the info button. The off state (grey track and knob) is
  inferred.
- **Default Views** start from the template's summary (Work Starter: List, Board) although the
  four frames draw all seven views on; a template's extra view (Gantt) gets its own row. The
  "Default View Selected" badge marks the current default view from the start.
- **Step 3's heading** names the chosen template (the design always says Work Starter). The
  organizer summary uses the page's names ("Incomplete Warnings", "Dependencies Warning").
- **Copy fixed**: "represent" → "represents", "it's own" → "its own", "character" →
  "characters". Product & Engineering's card repeats Project Management's text, as drawn (there is
  no other copy for it). The owner popup's button says "Add Member", as drawn.
- **Not drawn, so laid out to match**: the picker's selected row (lavender, outline, tick), the
  members overflow ("+n Members" list with remove), the status row menu (Rename, Change Color,
  Delete), inline rename (the add-status editor with Save), the delete confirmation (the New
  Template popup's layout; the "delete state" frame exports identical to the base page), the
  tooltips' text and the name placeholder.
- **Status templates** made, renamed or deleted in the wizard live only in the wizard (there is no
  template API); a workspace started from a new one records the Custom template. Default-mode
  "Add Status Color +" chips are disabled, since default statuses are read-only. Closed is drawn
  above Done, so it stays there. Status names must be unique within a group.
- **Smaller choices**: the colour picker's 7.5 px "Custom" label is 9 px (the readability floor);
  the red close on a detail page closes the wizard; Make Private keeps the visibility list open
  to add members, and a private workspace needs at least one member before Continue. Icons:
  lucide Pencil and Trash2 in the row menus (hidden in every export), and Gantt, Workload, Mind
  Map, Email, Sprint Points and WIP Limits icons (no export draws them); every other icon is the
  design's.

Task fields:

- **Scale**: the column components are drawn at 0.72 of their Figma size, as the List view is
  (18 px text becomes 13 px; Add Assignee is 496 px wide). Popups scroll when the window is
  shorter than they are.
- **Copy fixed**: "There are no tasks to link as dependencies", "No story points allocated".
  Placeholders added where the design draws an empty cell blank: "Add Assignee", "Add a comment".
- **Dates**: hours run 01–12 (the drawn "00" cannot be a 12-hour value); "Later" is four hours
  from now; the calendar's Today link shows the current month; a clear (x) was added to start
  date, due date and recurrence (the design has no way to remove them); Repeat On shows for weekly
  repeats only; today's date reads "Today", as the due-date cell draws it.
- **Tags and labels**: the three-dot icon inside a cell's chip is not a control (it would nest
  in the cell button); Rename, Delete and the 12 swatches are on each row's menu in the popup.
- **Dependencies**: Waiting On and Blocking share one list, each row labelled, with an unlink
  (x). "+ Add a Roll-up" picks which of the linked tasks' fields show as columns, remembered per
  workspace in this browser. "Create New Task" makes a task in the same list and links it.
- **Story points**: one rating per task (the design draws stars per allocated person); points
  run 0–100 and the total reads "NN Points" (no maximum was found in the exports).
- **Time**: pausing the timer records the run as an entry of at least one minute (there is no
  stop control); entries can be deleted (x); the time estimate's tooltip text is ours.
- **Files**: Dropbox, OneDrive, Box and Google Drive are shown but disabled (they cannot be
  connected here) with a cloud icon (their logos are raster images in the design). Upload keeps
  the file's details only (up to 25 MB): the mock has no file storage.
- **Other**: the Task ID copy copies the task's address (the tooltip says "URL Copied
  Successfully"); Invite from email checks the address and records it, but no email is sent; with
  the Multiple Assignees organizer feature off, picking someone replaces the assignee; the status
  popup's gear (status settings) has no screen and is disabled. Icons: lucide stand-ins for the
  chevron, back, tag, menus, plus, gear, info, star, play / pause / timer, copy, comment, delete,
  attach, cloud and file types; the status ring, Waiting On / Blocking discs, Priority Clear and
  Milestone diamond are drawn from the CSS colours; search, invite, close, calendar, flags,
  dependency warning, link, Add Time clock and description lines are the design's.

Workspace page and List view:

- **Only the List view is drawn.** Board, Calendar, Timeline, Activity and the other views open
  a "This view is not designed yet" state with a way back to List; "+ View" adds a view the
  workspace does not have yet.
- **Banner**: the four round buttons get their labels (Workspace Settings, Add Description,
  Change Cover, Quick Action Menu) from the design's hidden layers. Workspace Settings holds
  Rename, Add to Favorite and Copy link; Quick Action Menu links to the four dashboards. Change
  Cover offers the default image (taken from the design), five gradients and an upload (up to
  2 MB). Invite Members has no frame of its own, so it reuses the wizard's Add Members popup.
- **Menus with no frame**, laid out in the module's style: the group three-dot menu (Select All
  Tasks, Collapse / Expand All Groups), the selection bar (n tasks selected, Delete, Clear),
  Filters (Status, Priority, Assignee), Customize (show / hide and move each column) and Move To
  (search, then each workspace with its lists).
- **Column header menu** uses the page CSS's two-column layout (one column on phones). Task Name
  cannot be moved, hidden or deleted. Sort as Top sorts ascending, Sort as Bottom descending; the
  sort is not saved, and rows cannot be dragged while one is on. Delete Column asks first, then
  removes the column and its permissions (the tasks keep their values; "+" adds it back).
- **Row menu**: Copy link and Open in new tab are in the notes but not in the menu frame, so they
  follow Remind Me; a link opens the workspace, scrolls to the task and opens its parents. "Add to
  Favorite" reads "Remove from Favorite" for a favourite. Remind Me opens a popover beside the row
  (a calendar inside a nested menu cannot be reached with Tab); quick picks are at 9:00 and
  "Later" is three hours from now. Reminders are stored but nothing notifies yet. Convert to
  Subtask picks a parent; a subtask also gets Convert to Task; Convert to List asks first, makes a
  list named after the task and moves its subtasks into it. Moving to another workspace keeps the
  task's ID, subtasks and comments; its tags and dependency links stay behind (they belong to the
  old workspace).
- **Set Role Permission** follows the newer frame (132:126211). Typos fixed ("tailors, access",
  "edit ,", "the currently field"). Teams are departments. There is no role data in the app, so a
  person's role (Workspace Admin Creator, HR's, Managers, Team Leaders, Contributors) is worked out
  from the workspace owner, their department and their designation.
- **Small choices**: the status ring takes the status colour (the frame draws To Do grey);
  milestones show a diamond; subtasks indent 1.75 rem per level; only groups with tasks are shown
  (plus the one a task is being added to); Task Name and the row's three-dot stay put while the
  columns scroll on wide screens; Average Story Points is a footer under the Story Points column
  of each group (the page CSS also has a separate 377 px column for it). Icons: lucide for the
  milestone, the Team / Table / Gantt / Workload / Mind Map views, copy link, open in new tab, the
  header menu's sort, move and hide items, and the permission levels; the status ring and sort
  arrows are drawn from the frame's geometry; the rest are the design's.

## Manpower Planning

A sidebar tree after Custom Form: **Planning, E-Budgeting, Open Positions, Budget Approvals** and
**E-Budget Settings**, each with its own icon from the design (`NavChild.icon` draws it in place
of the tree's ring bullet). The design is the Manpower Planning frames (3072:15397 and on) of
`HRango Dashboard App Version` (`0xfQhTTT4BANZDG9JiUUkM`, page App UI). As with Project
Management, the connector could not read the file, so every frame was exported from the Figma
web app (CSS (all layers) and SVG) into `HRango2/Design/manpower-planning` (`INDEX.md`). All 30
icons (sidebar, sub-pages, content) are cut from those frames.

Code: `src/features/manpower-planning` (types, constants, API, hooks, schemas, `utils/plan-math.ts`;
components per page under `components/`), mocks in `src/mocks/manpower-planning`, routes under
`src/routes/_app/manpower-planning`.

| Screen            | How to open it                                                   | What it does                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning          | Sidebar → Planning (`/manpower-planning/planning`)               | "Employee Planning": search, refresh, plan year filter, the filter row (title, year, mode, status), the plan table with Details / Approvals and the row menu, Delete Plan Year confirm |
| Add Planning      | Add New Plan (`/planning/new`; `/planning/$planId/edit` to edit) | The plan's header fields, Plan for New Positions and Plan for Existing Positions with Import / Add / Refresh / Export, Submit                                                          |
| Plan Details      | A plan's Details (`/planning/$planId`)                           | The Add Planning page, read-only                                                                                                                                                       |
| E-Budgeting       | Sidebar → E-Budgeting                                            | Budgets per position title with amount, duration and status; add, edit and delete                                                                                                      |
| Open Positions    | Sidebar → Open Positions                                         | Positions opened by approved budgets, with the JD download, Edit and Close / Reopen                                                                                                    |
| Budget Approvals  | Sidebar → Budget Approvals                                       | Pending budgets to approve or reject                                                                                                                                                   |
| E-Budget Settings | Sidebar → E-Budget Settings (`?tab=`)                            | Budget Duration (with Add Budget Duration), Position Title and Employee Position tabs                                                                                                  |

How it works:

- **Settings feed planning.** Budget durations are the plan years (one is the current period,
  which drives the Current Planning tick); position titles name the jobs; employee positions say
  where a job sits (division, station, department, sub-department, group, grade, cost centre,
  reports-to) and its salary range.
- **Add Planning.** Each new-position line is one vacancy: choosing its employee position fills
  in the place, group and min / max salary; Total Salary is the max salary plus the allowance.
  Existing-position lines are real people, with their monthly salary from Payroll. Monthly Amount
  is the sum of every line's month; Annual Amount is each line's month times the months it is
  planned for. Lines must fall inside the plan year.
- **Submitting a plan** makes one pending budget per position title on E-Budgeting. Approving a
  budget sets it Active and opens an Open Position with that headcount; rejecting marks it
  Rejected. The plan's status follows its budgets (all approved → Approved, any rejected →
  Rejected, otherwise Pending).
- **Locks.** A plan with an approved budget opens read-only; approved budgets cannot be edited or
  deleted; editing a rejected budget sends it back to pending; deleting a plan withdraws its
  waiting budgets and keeps approved ones; a duration, title or employee position in use cannot be
  deleted.
- **Sample data**: the drawn rows (added by Hamza Ashraf), including Apps Planning approved for
  2025 and the 2024 Accounts / UI/UX Designer / Marketing budgets, plus a pending "Finance
  Planning" so there is something to approve.

### Manpower Planning: departures from the design

- **Copy fixed**: Postion → Position, Divison → Division, Coast Center → Cost Center,
  IsCurrentBdugetDurationPeriod → IsCurrentBudgetDurationPeriod. The two "Details" headings of the
  existing-positions table (a pasted duplicate) are Department and Station.
- **Controls that could not work as drawn**: Total Monthly Amount is a read-only computed total
  (drawn as a dropdown). In the Employee Position popup, Station and Sub Department are selects
  (drawn as text boxes with "Accounts" pasted in), Min and Max Salary are number boxes (drawn as
  selects), and Position Title*, Cost Center and Reports To are added because the list and its
  filters use them but the popup had no fields for them.
- **Not drawn, laid out in the module's style**: Add / Edit Budget Duration and Edit Position
  Title reuse the add popups; Edit Budget and Edit Open Position use the Add Budget Duration
  layout; Approve / Reject Budget and the deletes use the Delete Budget popup; the plan's
  Approvals dialog and the Plan Details page are new; Activate / Deactivate is on the title and
  position row menus (the Status filter needs an inactive state); Open Positions' row menu is
  Edit and Close / Reopen; the pager shows only when there is more than one page.
- **Behaviour chosen**: Import Positions adds the active employee positions that match the plan's
  header; Import Existing Employees adds the people in the plan's department / station; Export
  Data downloads the existing positions as CSV; Refresh Positions reloads salary ranges; Upload
  Excel reads a CSV saved from Excel (the app has no .xlsx parser). The page-title icons: mail
  emails a link to the page, phone lists the HR contacts, info explains the page, filter shows
  or hides the filter row.
- **Statuses**: only green Active / Approved are drawn; budgets also show Pending / Rejected,
  plans Pending / Rejected, open positions Closed.
- **Small items**: Start and End Date in Add Budget Duration carry no asterisk (as drawn) but are
  validated; the Employee Position list shows the code under the title; long values truncate in
  the narrow Add Planning cells, as drawn.

## Benefits

One sidebar item, **Benefits**, right after Performance as in the design's side menu. The design
is the "Benefits" section (3054:4092) of `HRango Dashboard App Version`, exported the same way
into `HRango2/Design/benefits` (`INDEX.md`). Its frames draw an older app shell, so only the
content area is built. The sidebar icon and the four stats-row illustrations are cut from the
frames.

Code: `src/features/benefits` (types, constants, `categories.ts`, API, hooks with
`use-plan-year-wizard.ts`, schemas; components under `plan-years`, `enrollment`, `plans`,
`employees`, `files`, `shared`), mocks in `src/mocks/benefits`, routes under
`src/routes/_app/benefits`.

| Screen                               | How to open it                                                    | What it does                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Page frame                           | Every tab                                                         | "Benefits Management", the stats row (Plan Years, Plans, Enrollment Windows, Employees), the sub menu, "Showing:" plan year filter (`?year=`) |
| Plan Years                           | Sidebar → Benefits (`/benefits/plan-years`)                       | The plan years with plans, duration, status and employee elections; Update missing information; row menu                                      |
| New Plan Year                        | New Plan Year (`/benefits/plan-years/new`)                        | Details → Plans → New Hires, then Create Plan Year                                                                                            |
| Edit Plan Year                       | Row menu → Edit (New Hire opens it at New Hires)                  | The three-step popup: Details, Plans (coverage groups and their plans, Select All), New Hires (when enrollment starts, how long to elect)     |
| Delete Plan Year                     | Row menu → Delete                                                 | Confirm, then removes the plan year with its windows and elections                                                                            |
| New Open Enrollment Window           | Row menu → Open Enrollment (Qualifying Life Event fills the name) | Step 1 (name, plan year, effective date, plans, last day to enrol), Step 2 (who can enrol: available / selected lists with search), Create    |
| Plans                                | Sub menu → Plans                                                  | "Benefit Plans" with category, name, end date, status, eligibility and enrolment counts; copy and delete                                      |
| Add Plan                             | Add New Plan → a category (`/benefits/plans/new?category=`)       | "Add {Category} Plan": Plan Details (name, type, type ID, carrier, dates, attachment, description), then saves                                |
| Enrollment Windows, Employees, Files | Sub menu                                                          | Not drawn: the windows, each person's elections and missing details (with Update), and the plans' attachments, in the design's table style    |

### Benefits: departures from the design

- **Copy fixed**: "Benefits Plans Years" → "Benefit Plan Years"; the elections column is
  "Employee Elections" everywhere (7 frames say so, 3 say "Plan Details" or "Details"); "0 pending
  , 0 approved" loses the stray space; the Add Medical Plan frame's heading "Benefits" is
  "Benefits Management", as on every other frame.
- **Placeholders**: pasted samples became prompts ("1 Jan 2023" → "Select date", "EPO" → "Select
  Plan Type", "Employee benefits" → "Select Carrier", "12312" → "Enter Plan Type ID", "Fiscal
  Year" → "Enter Enrollment Name"). The pasted people are people from the employee directory; Life
  Coverage lists its own plans instead of the pasted HDHP ones, and the Dental row's "HDHP1" is
  "Dental PPO".
- **Counts follow the data**: the directory has 34 people, so the tab reads "Employees (34)" and
  the stat 34 (drawn as 120 and 20). The stats row (a separate frame) sits between the heading and
  the card, in its drawn order. Its numbers are Poppins Bold, not Roboto (the app self-hosts only
  Poppins and Inter).
- **Edit Plan Year** is a centred popup, as drawn; its title changes per step, as drawn. Select
  All shows only on the Plans step (the frames carry it onto New Hires, where it would do
  nothing). A coverage group shows ticked while any of its plans is chosen, as drawn; screen
  readers hear "mixed".
- **New Plan Year** draws no buttons: Cancel and Continue: Plans / Continue: New Hires / Create
  Plan Year are added, its later steps reuse the popup's steps, and finished steps can be clicked
  to go back. "After a waiting period" stores only the choice (no frame shows where its length
  goes); the election unit is day / week / month.
- **Enrollment window**: the single "complete their enrollment" date is the last day to enrol (a
  window shows Open until then, then Closed); the effective date must fall in the plan year; the
  plans offered are the plan year's. In step 2, "All Employees" is a department filter, and the
  lists also work with the keyboard and double-click.
- **Plans**: the copy icon duplicates a plan as "(copy)"; Delete uses the Delete Plan Year popup's
  layout and is refused while people are enrolled. Add Plan saves after Plan Details: Coverage
  Options, Eligibility & Cost, Enrollment Details and Payroll deduction are not drawn, so they show
  as disabled ("not available yet"). Eligible is always Full-Time; plan types are per category;
  a carrier list and a Cancel button are added; attachments are PDF, Word or images up to 5 MB,
  and the mock keeps only the name and size.
- **Header icons**: mail sends a link to the page, phone shows the HR contacts, info explains the
  page, filter opens the "Showing:" list (disabled on the two form pages; the Add Plan page has no
  "Showing:" box, since it has nothing to filter).
- **Chips**: only Active is drawn; Upcoming, Ended, Open / Closed and the election statuses use
  the frames' own colours.
- **Not drawn**: the Enrollment Windows, Employees and Files tabs and the Update Information
  dialog, built minimally in the design's table style.

## Responsive behaviour

Every page fills the content area at every width: no centred column with empty margins on big
monitors, and no sideways page scroll on phones. Checked page by page (and the Roster, History
and enrollment dialogs) at 320, 375, 768, 1024, 1280, 1536, 1920 and 3200 px.

| Width        | Shell                                                      | Content                                                                                      |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| < 640 px     | Off-canvas drawer, 64 px top bar                           | Single-column forms, header buttons share a full-width row, pager shows chevrons             |
| 640–767 px   | Drawer                                                     | Two-column fields where the card is wide enough                                              |
| 768–1023 px  | Drawer                                                     | Tables switch from stacked cards to columns                                                  |
| 1024–1919 px | Fixed sidebar (collapsible to a 76 px rail), 74 px top bar | Pages use the full width; layout inside cards follows the card width                         |
| ≥ 1760 px    | Same                                                       | Policy and Penalty: form and table side by side (page ≥ 90rem); detail: summary beside rules |
| ≥ 1920 px    | Same, scaled                                               | Settings forms: two columns of fields once the card is ≥ 72rem; the map spans both           |
| ≥ 2560 px    | UI scale reaches 125%                                      | As above, everything 25% larger so a 1440p/4K screen at 100% OS scaling is readable          |

How it is built:

- **Fluid UI scale.** `html { font-size }` in `globals.css` is 100% up to 1920 px and grows to
  125% at 2560 px. Everything sized in rem grows with it. Keep new sizes in rem (Tailwind spacing,
  `text-*`, arbitrary values like `h-[4.625rem]`), not px, so they scale too.
- **Page-level containers.** `PageContainer` always uses the full content width and is a named
  container (`@container/page`). `splitPageClassName` makes a page one full-width column below
  90rem of page width and two columns above it. Do not cap page widths; let the layout inside
  grow instead (more columns, wider tables).
- **Wide forms** (`SettingsFormCard`): fields sit label-left from a 36rem card, and in two
  columns from 72rem, so a 4K screen does not get 2,000 px-wide inputs.

- **Container queries for layout inside cards.** `Card` and `PageHeader` are CSS containers, so
  grids use `@md:` / `@lg:` / `@3xl:` and respond to the card's own width. The same form is
  right with the sidebar open, collapsed or off-canvas. Prefer these over viewport breakpoints
  for anything inside a card.
- **Viewport breakpoints for shell decisions** (`BREAKPOINTS` in `src/hooks/use-media-query.ts`):
  drawer vs. sidebar (`lg`), table vs. stacked cards (`md`), compact pager (`sm`).
- **`DataTable` stacks below `md`**: each row becomes a card of "label: value" lines. Mark a
  column `mobile: 'heading'` (card title) or `mobile: 'hidden'`; `layout` forces either mode.
  Sortable tables (`sortKey` + `onSortChange`) get a "Sort by" bar in the stacked layout, since
  there are no headers to click. Long text columns use `whitespace-normal` so they wrap instead
  of scrolling sideways on tablets; optional columns can hide by card width (`hidden @3xl:table-cell`).
- **`ChipCarousel` measures its row** (`useElementWidth`) and shows as many chips as fit (3 on a
  320 px phone, up to 5).
- **Touch**: `pointer-coarse:` raises buttons, chips, pager cells and menu items to about 40 px on
  touch screens. Inputs use 16 px text below `sm`, so iOS does not zoom in on focus. The bottom
  padding respects the iPhone home indicator (`env(safe-area-inset-bottom)`).
- Tests render at 1024 px by default; `setViewportWidth(375)` from `src/test/test-utils.tsx`
  switches `useMediaQuery` to a phone (see `data-table.test.tsx` and the "phone layout" test).

## Adding things

### A route

1. Create a file under `src/routes/`, e.g. `src/routes/_app/leaves.tsx` (inside `_app/` = signed-in
   only; outside = public).
2. Export `Route = createFileRoute('/_app/leaves')({ component, head, validateSearch?, loader? })`.
   `npm run dev` (or `npm run routes:generate`) rewrites `src/routeTree.gen.ts`.
3. To show it in the sidebar, add an entry to `NAV_ITEMS` in `src/app/navigation.ts`; `to` is
   type-checked against the route tree.

### A feature

1. Copy the shape of `src/features/warning/`: `types/` → `schemas/` → `api/*.api.ts` →
   `api/*.queries.ts` (key factory + `queryOptions`) → `hooks/` → `components/` → `index.ts`.
2. Add the mock API (next section) so the feature works without a backend.
3. Mount the page from a route file and export only what other code needs from `index.ts`.

### A store

- **Global** (used across features): `src/stores/<name>-store.ts`, built like `ui-store.ts`:
  `create<State & Actions>()(devtools(persist(immer(...), { name, version, partialize })))`.
  Export it from `src/stores/index.ts` and add a `reset…Store()` for tests (call it in
  `src/test/setup.ts`).
- **Feature-local**: `src/features/<feature>/store/<name>.store.ts`, same pattern, exported through
  the feature barrel only if other code needs it.
- Persist only what should survive a reload (`partialize`), and bump `version` when the shape changes.

### A mock

1. Seed data: `src/mocks/<feature>/seed.ts` returning typed records.
2. Handlers: `src/mocks/<feature>/handlers.ts` using `http.*` from `msw`, `apiPath()`,
   `requireAuth()`, `latency()`, `paginate()` and `errorResponse()` from `src/mocks/utils.ts`.
   Use `createMockCollection()` for CRUD tables.
3. Register them in `src/mocks/handlers.ts` (and reset the table in `resetMockDb()`).
   Tests use the same handlers through `src/mocks/node.ts`; override one with `server.use(...)`.

### A shadcn component

`components.json` is configured, so `npx shadcn@latest add <component>` writes to
`src/components/ui/`. Map colours to the design tokens (`bg-card`, `border-input`, `text-label`,
`bg-chip`, …) rather than raw palette classes.

## Environment

Defined and validated in `src/lib/env.ts` (Zod); typed in `src/vite-env.d.ts`; documented in
`.env.example`. Only `VITE_*` keys reach the browser — never put secrets in them.

| Variable               | Default                      | Purpose                                          |
| ---------------------- | ---------------------------- | ------------------------------------------------ |
| `VITE_APP_NAME`        | `Top Edge Technologies HRMS` | Browser title and login screen                   |
| `VITE_API_BASE_URL`    | `/api`                       | Axios base URL; MSW mocks paths under it         |
| `VITE_API_TIMEOUT_MS`  | `15000`                      | Axios timeout                                    |
| `VITE_ENABLE_MOCKS`    | `true`                       | Start MSW before rendering                       |
| `VITE_MOCK_LATENCY_MS` | `400`                        | Simulated latency (0 in tests)                   |
| `VITE_ENABLE_DEVTOOLS` | `false`                      | TanStack Query/Router devtools (dev builds only) |

`.env.production` keeps mocks on because there is no backend yet. With a real API, set
`VITE_ENABLE_MOCKS=false` and `VITE_API_BASE_URL`; MSW is a lazily imported chunk and is then never
downloaded.

## Design tokens and assets

Tokens live in `src/styles/globals.css` as CSS variables (light under `:root`, dark under `.dark`),
exposed to Tailwind through `@theme inline`. Their sources:

| Token                           | Value                 | Source                            |
| ------------------------------- | --------------------- | --------------------------------- |
| `--primary` (Save)              | `#8B5CF6`             | Figma variable "Cornflower Blue"  |
| `--input` (field outline)       | `#CBD5E1`             | Figma variable "Geyser"           |
| `--label`                       | `#94A3B8`             | Figma variable "Gull Gray"        |
| `--field-foreground`            | `#334155`             | Figma variable "Pickled Bluewood" |
| `--foreground`                  | `#1E293B`             | Figma variable "Mirage"           |
| `--chip` (selected chip)        | `#D9D9D9`             | Figma variable "dark txt"         |
| `--sidebar`                     | `#17263A`             | sampled from the frame render     |
| `--sidebar-accent`              | `#293749`             | Figma Side Menu, current row      |
| `--sidebar-child`               | `#D9D9D9`             | Figma Side Menu, a group's pages  |
| `--title`                       | `#303030`             | Figma: titles, table text         |
| `--grey`                        | `#707070`             | Figma variable "grey"             |
| `--tab` (tab not chosen)        | `#5C5C5C`             | Figma text layers                 |
| `--person` (name in a table)    | `#505050`             | Figma text layers                 |
| `--field-value`                 | `#475569`             | Figma text layers (Inter fields)  |
| `--pill` (sub menu current row) | `#E8EAEC`             | Figma Requests Sub Menu           |
| `--secondary` (top bar buttons) | `#E8EDF9`             | sampled                           |
| `--background` (canvas)         | `#F1F5F9`             | sampled                           |
| `--pager-active`                | `#3366FF`             | sampled                           |
| `--success` (Settings Save)     | `#2CBD4D`             | Figma, Settings frames            |
| `--check` (Settings checkbox)   | `#293749`             | Figma, Settings frames            |
| `--nav-active` / `-foreground`  | `#EBEFF8` / `#263871` | Figma, Control Panel active row   |
| `--nav-foreground`              | `#303030`             | Figma, Control Panel row text     |
| `--sidebar-link-active`         | `#60A5FA`             | sampled (current Settings child)  |

- **Logo**: SVG exported from Figma node `2129:1797` (`src/assets/brand/logo-top-edge.svg`); the
  favicon is its flame mark.
- **Avatar**: the source image of Figma node `2129:1737`.
- **Sidebar icons**: the Figma sidebar icon exports, converted to React components with
  `currentColor` (`src/components/icons/figma-icons.tsx`), plus the calendar icon of the time-span
  card. Other icons are lucide-react, drawn at stroke 1.5 to match the thin Figma icons.
- **Fonts**: Poppins for the app chrome and lists, Inter for forms, dialogs and the older pages,
  both self-hosted (`@fontsource/poppins`, `@fontsource/inter`; `font-inter` in Tailwind). Every
  text size, weight and colour follows the module's Figma text layers, which were read with a
  script rather than measured from renders: `docs/figma-typography.md` lists them per module.
- The Figma link supplied is view-only for the Figma connector, so tokens were read from an
  editable duplicate of the same file; the frame PNGs in `HRango2/Design/warning Section` were
  used for layout and colour sampling.

The design has a dark-mode button but no dark screens, so the dark palette is chosen (navy
greys, same purple). The sidebar follows the newest Side Menu component (`2699:67267`): name
Poppins Medium 16, role Poppins Light 11 `#D1D4D8`, items Poppins Regular 13 `#B9BDC4`, the
current item white on `#293749`; its width stays 256 px (the component is 280 px). Requests and
Payroll open into trees of their pages in the sidebar (ring bullets, a group's pages
`#D9D9D9`, the current one white), as the Request Settings and Payroll frames draw them. The
pager is Inter 14 with the current page navy (blue on the Warning, Settings, Roster and Scheduling
lists, as their frames draw it).

### Text styles

Every text's family, weight, size and colour was set from the Figma text layers (read with a
script over each module's section; `docs/figma-typography.md` has the per-module tables). The
design uses two families, and the modules fall into three groups:

- **Requests and Attendance logs / settings** (Poppins lists): titles Medium 20 `#303030`
  (Request Settings 24); tabs Regular 13 `#5C5C5C`, the current one Medium 14 `#17263A`; table
  headers Medium 11 `#303030`, cells Regular 11 (Attendance) or 12 (Requests) `#707070`; chips
  Medium 10 in the status colour; the person cell Medium 11 `#505050` over Regular 9 `#707070`.
  The Logs, Settings and Punch dialogs are Poppins (title SemiBold 20 `#202020`, labels 14
  `#303030`, placeholders `#A4A4A4`). The type lives in `attendance/utils/settings-styles.ts`,
  `requests/components/shared/request-styles.ts`, `transfer-styles.ts` and
  `requests/standard/standard-styles.ts`.
- **Payroll, Assets and off-boarding** (Poppins lists, Inter dialogs): titles Medium 24 `#303030`
  (20 on phones); table headers Medium 14 and cells Regular 14 `#303030` (Payroll Settings tables
  11 px, cells `#707070`); person cells Medium 11 `#202020` with a Regular 9 `#707070` code;
  toolbar buttons Medium 12 white (Approved / Unapproved, Print Medium 14). Dialogs are set
  through `dialogFieldType` in `features/payroll/utils/styles.ts`: titles Inter Medium 24 `#000`,
  labels Regular 16 `#000` (18 on Payroll Create), values and placeholders Regular 14 `#475569`,
  the required mark Regular 18 `#E50141`, footer buttons Medium 16, row menus Regular 14
  `#475569`, confirmations Regular 22.
- **Older Inter frames** (Warning, Settings → Control Panel, Roster, Scheduling, the Attendance
  overview and time sheets): page and card titles Inter Medium 20 `#000`, dialog titles Medium 24,
  labels Regular 16 `#000` (Warning 13.2 `#94A3B8`), values Regular 14 `#475569`, buttons Medium 16. Warning tables are Inter Semi Bold / Regular 16.2 `#1E293B`; the Roster table Inter Medium
  20 (white header, `#303030` cells); the Scheduling board `#585858` for days, hours and shift
  times. Each of these modules keeps its classes in a `type-styles.ts`.

Rules where a frame could not be followed:

- **Readability floor**: no text below 9 px, and primary table text not below 11 px. Where a
  frame draws smaller, the same element's size from the module's other frames is used: the
  Requests person cell (drawn 9 / 7 px → 11 / 9), Transfer and Rest Days cells (9–10 px → 12),
  Transfer chips (8 → 10), the Control Panel menu (10 → 16, as the Off Boarding frames draw it),
  Scheduling geo-fence chips (10 → 11).
- **Fit**: the Attendance overview's day labels stay 11 px and the Scheduling week bands 12 px so
  they fit their columns; the Transfer employee card's 37 px name is 24 px.
- **One frame against the rest**: where frames of one module disagree (inner tab weights,
  placeholder colours, Punch Create in Inter or Poppins), the majority is used; placeholders drawn
  `#BEBEBE` (failing contrast) use `#475569`.
- Not drawn, so only switched to the module's family: Payroll and payslip History tables, the
  Roster Add / Edit form, the list footers ("Showing x of y"), the printable pay slip.

## Testing

`npm run test:run` — one test per layer, all against the same MSW handlers the browser uses:

| Layer                  | File                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store                  | `src/stores/ui-store.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Lib                    | `src/lib/api-error.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Schema                 | `src/features/warning/schemas/policy-form.schema.test.ts`                                                                                                                                                                                                                                                                                                                                                                        |
| Mutation hook          | `src/features/warning/hooks/use-warning-policy-mutations.test.tsx` (optimistic delete + rollback)                                                                                                                                                                                                                                                                                                                                |
| Component              | `src/components/layout/pagination.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                      |
| Routing / end-to-end   | `src/app/router.test.tsx` (auth redirect, 404, create flow, validation)                                                                                                                                                                                                                                                                                                                                                          |
| Penalty schema         | `src/features/warning/schemas/penalty-form.schema.test.ts`                                                                                                                                                                                                                                                                                                                                                                       |
| History grouping       | `src/features/warning/utils/history-grouping.test.ts`                                                                                                                                                                                                                                                                                                                                                                            |
| Warning overview       | `src/features/warning/components/overview/warning-overview.test.tsx` (History, Column Preferences, create penalty)                                                                                                                                                                                                                                                                                                               |
| Settings schemas       | `src/features/settings/schemas/org-forms.schema.test.ts` (required fields, coordinates, head count, mappers)                                                                                                                                                                                                                                                                                                                     |
| Settings flows         | `src/features/settings/settings.test.tsx` (sidebar group, create branch, unsaved-changes prompt, duplicate name, refused delete)                                                                                                                                                                                                                                                                                                 |
| Shift maths            | `src/features/roster/utils/shift-time.test.ts` (minutes, overnight shifts)                                                                                                                                                                                                                                                                                                                                                       |
| Roster schema          | `src/features/roster/schemas/roster-group-form.schema.test.ts` (working days, Apply For All, mapper)                                                                                                                                                                                                                                                                                                                             |
| Roster flows           | `src/features/roster/roster.test.tsx` (list, refused delete, add with Apply For All, View, enroll, sort, discontinue)                                                                                                                                                                                                                                                                                                            |
| Schedule dates         | `src/features/scheduling/utils/schedule-dates.test.ts` (periods, week bands, repeat and step, hours, CSV import)                                                                                                                                                                                                                                                                                                                 |
| Scheduling flows       | `src/features/scheduling/scheduling.test.tsx` (My / All, view and delete, multiselect, swap, create, default shift, range delete)                                                                                                                                                                                                                                                                                                |
| Attendance engine      | `src/mocks/attendance/engine.test.ts` (late, relaxation, overtime and breaks, holiday, weekend, sandwich, warnings, short day, machine reads)                                                                                                                                                                                                                                                                                    |
| Attendance utils       | `src/features/attendance/utils/attendance-utils.test.ts` (formats, row actions, edit form rules, log CSV read and write)                                                                                                                                                                                                                                                                                                         |
| Attendance flows       | `src/features/attendance/attendance.test.tsx` (overview grid, subordinates, my sheet, clock in, history, edit, absence, comment)                                                                                                                                                                                                                                                                                                 |
| Settings and Logs      | `src/features/attendance/attendance-settings.test.tsx` (dashboard punch off, break type and duplicate, holiday rule, manual punch, machine and file import)                                                                                                                                                                                                                                                                      |
| Request flow rules     | `src/mocks/requests/flow.test.ts` (line manager then HR, delegates, rejection, cancellation)                                                                                                                                                                                                                                                                                                                                     |
| Request flows          | `src/features/requests/requests.test.tsx` (create, approve into Attendance, reject reason, cancel, delegates, swap, consent, roster)                                                                                                                                                                                                                                                                                             |
| Request Settings       | `src/features/requests/request-settings.test.tsx` (create and bulk-delete restrictions, closed date stops a punch, delegations, a person's chain, looping flow, conditions)                                                                                                                                                                                                                                                      |
| Transfer               | `src/features/requests/transfer.test.tsx` (form errors, Regenerate letter, submit, approve into the transfer log, Delegates bulk approve, History)                                                                                                                                                                                                                                                                               |
| Standard request types | `src/features/requests/standard/kinds/*/*.test.tsx`: Rest Days (scopes, create, approve into the schedule, cancellation, bulk), Leave (balance, short leave), Loan & Advances (guarantors, approver fields, repayments, Settings), Work From Home (week strip, schedule), Travel (details, hotel, ticket), Promotion (salary revision), Resignation (End of Employment), Relaxation (shift times, attendance)                    |
| Project Management     | `src/features/project-management/*.test.tsx`: the panel, landing, dashboards, sharing, comments and moving a task across workspaces (`pm-shell`); the whole Create Workspace wizard with its views, statuses and organizer pages (`create-workspace`); the List view, its column and row menus and role permissions (`workspace`); every task field popup (`task-fields`)                                                        |
| Manpower Planning      | `src/features/manpower-planning/manpower-planning.test.tsx` (plans and filters, Delete Plan Year, Add Planning with new and existing positions, imports, details / approvals and the edit lock, approving a budget into open positions, rejecting and re-editing one, budget deletes, a load error with retry, JD download and open-position edit / close, budget duration, position titles, employee position and sheet upload) |
| Leaves                 | `src/features/leaves/leaves.test.tsx` (sub menu and tabs, My Leaves and Apply Leave with validation, Leave Applications approve / reject into the shared balance, General Settings save, Leave Types with dependent fields and a refused delete, Leave Policies create and enroll)                                                                                                                                               |
| Benefits               | `src/features/benefits/benefits.test.tsx` (plan years under the stats row, New Plan Year, the Edit Plan Year steps, delete with confirm, the two-step enrollment window and a Qualifying Life Event, missing information to Employees, Plans with a refused delete, the Add New Plan menu and form validation)                                                                                                                   |
| Pay engine             | `src/mocks/payroll/engine.test.ts` (expressions, the design's "Unsupported Operand Types" error, tax slabs, every seeded run)                                                                                                                                                                                                                                                                                                    |
| Payroll Settings       | `src/features/payroll/payroll-settings.test.tsx` (menu and sub-tabs, configuration, fiscal year, pay item expression, tax slab, group benefit, bank)                                                                                                                                                                                                                                                                             |
| Monthly, Dashboard     | `src/features/payroll/payroll-monthly.test.tsx` (icons by status, create → employments → run → close, errors and history, yearly chart table view)                                                                                                                                                                                                                                                                               |
| Pay Slips              | `src/features/payroll/payroll-payslips.test.tsx` (My accounts, hold / pay / recalculate, manual edit with History, slip document, salary sheet, FS close)                                                                                                                                                                                                                                                                        |
| Payroll records        | `src/features/payroll/payroll-records.test.tsx` (daily wages and vouchers, employee voucher, opening balance, account debit, % revision, report)                                                                                                                                                                                                                                                                                 |
| Leave Encashment       | `src/features/payroll/payroll-leave-encashment.test.tsx` (list, all employees through payroll, manual by voucher, nobody left, view, delete, paid lock)                                                                                                                                                                                                                                                                          |
| Assets                 | `src/features/assets/assets.test.tsx` (status chips, create with validation and History, deactivate refused while allocated, asset types, allocate and deallocate)                                                                                                                                                                                                                                                               |
| Clearance forms        | `src/features/assets/clearance.test.tsx` (list, bulk approve frees the assets, unapprove gives them back, approved delete refused, prefilled create)                                                                                                                                                                                                                                                                             |
| End of Employment      | `src/features/offboarding/end-of-employment.test.tsx` (scopes, notice period and Final Settlement, Asset Clearance opens the form, checklist error, rehire, completed locked)                                                                                                                                                                                                                                                    |
| Off Boarding Checklist | `src/features/offboarding/checklist.test.tsx` (list and menu, create with Number and Date fields and Min / Max check, edit and delete a field, read-only View)                                                                                                                                                                                                                                                                   |

`src/test/test-utils.tsx` has `renderApp(path)` (whole app on memory history),
`renderWithQueryClient()` and `createQueryWrapper()` for hooks. `src/test/setup.ts` swaps the
Leaflet map for a labelled placeholder, since jsdom has no layout or tile images.

## Decisions and deviations from the design

- **Week Start / End Day** are weekday selects (the design draws plain boxes); monthly and yearly
  start/end are date pickers. Picking a month chip on a monthly policy moves its date range to that
  month; changing a yearly start date sets the end to one year later.
- **+ Add Policy** starts a new blank policy (asking first if the form has unsaved changes);
  **← Cancel** returns to the Warning overview (asking first if there are unsaved changes);
  **Save** creates or updates. The same applies on the penalty form, where the list's "+ Add Form"
  also starts a new penalty.
- **Titles** follow the design: the overview and the policy form are both "Policy" and the penalty
  form is "Warning Policy"; a one-line description under each title tells them apart.
- **Penalty form**: the design's "To / From" are shown as **From / To** (start before end). Points
  read "Points (%)" when the scale is Percentage. The overview row menus are Edit / Delete as
  drawn; View stays on the Policy page.
- **History** shows real entries ("Policy updated — Grace") instead of the design's placeholder
  "Policy Sytem Change"; View expands who, what and when, with a link to the record.
- **Column Preferences** opens without dimming the page so the tables update in view; it covers
  both tables, not only the first.
- **Table**: oldest first, matching the design's numbering, so new policies appear on the last page
  (the table jumps there). A rows-per-page select was added next to the pager.
- **Language switcher** stores the choice and sets `<html lang>`; there are no translations yet.
- **Mail and bell** menus read a mock inbox and support "Mark all as read" (optimistic).
- The design's month/day chips have no stated meaning; here they record the month and day the rule
  takes effect (`month`, `day` on each period).

Settings:

- **"Branch" → "Company"**: on Branch Create and Location Create the parent select is labelled
  "Branch" but its placeholder is "Select Company". It is labelled **Company** here.
- **Job Title has no map**: the design repeats the Location search and map on the Job Title form,
  which looks copied from the Location form. A job title has no place, so it is left out.
- **Not in the design, added**: the Branch / Location / Area / Job Title lists, the Area form, edit
  pages ("Branch Edit", …), General Settings, validation messages and the delete confirmation.
- **Kept from the design**: green Save and red Cancel. The required asterisk sits beside the label
  instead of above it, and "Lattitude" is spelled "Latitude".
- **Map**: the design shows a Google map. This uses Leaflet with OpenStreetMap (Map) and Esri World
  Imagery (Satellite) so it works without an API key, and a mock geocoder for "Search Location".
- **Sidebar**: Settings expands in place (it has no page of its own; `/settings` opens the
  Control Panel).
- Labels are 15 px and the Control Panel menu 14 px instead of the design's 16 px / 10 px, to match
  the rest of the app and stay readable.

Roster:

- **Status switches are blue** in the list as in the dialogs; the list in the design draws them
  red, which reads as an error or "off".
- **View** has **Close** and an **Edit** button instead of a lone "Cancel" (nothing to cancel there).
- **Not in the design, added**: the Enroll New Employee form, Discontinue, column sorting on the
  server, the delete confirmation and the "+1 day" mark for overnight shifts.
- **Sample data** follows the design (Hybrid Work with 22 people, the first ten as listed), with
  "Fksam Khan" read as "Faisal Khan" and open-ended enrollments instead of equal start and end
  dates. The Hybrid Work times are those of the design's View frame.
- The sidebar icon for Roster is drawn in the style of the Figma icons; the design's is a pasted
  image.

Scheduling:

- **The Figma link** pointed at the Settings Job Title frame (`3934:23511`); the Scheduling section
  of the same file (`3093:15184`) and the 19 screenshots were used instead.
- **Shift colours follow the time roster**, not the day of the week, so the colour means something.
- **Planned Hours** in the footer is the total for everyone shown that day.
- **Not in the design, added**: the Swap button and the one-day chevrons (beside drag and drop),
  the confirmation before a range delete, a Name field on Select Geo Fence, an Edit button on
  View, the "+" menu on empty days (the way into Create New Rest Day), month totals in the Year
  view, the Subordinates tab's data, and the CSV import template.
- **Defaults**: the page opens on My and Month. The map is Leaflet with OpenStreetMap / Esri tiles,
  as in Settings.

Attendance:

- **Icons** are the Figma exports (legend frames `2542:7608` / `2559:9674`, row action key in
  the All Time Sheet frame), saved under `src/assets/attendance/`. Half leave, Official Visit and
  Late Arrival only exist in the second overview frame and were taken from there.
- **Labels fixed**: the person card's second column repeats "Joining Date" and shows "Lahore" as
  the Employee Code; it shows Employee Code, Company and Designation here. The overview's
  Department column shows the department name, not the "22" placeholder.
- **Break Out / Break In**: the Edit table uses Break Out for the start and Break In for the end;
  the View frame has them the other way round. Both dialogs use the Edit table's meaning, which
  also matches the Break Types identifiers ("Prayer Break Out" / "Prayer Break In").
- **Mark Absent** folds the times away as drawn, and also hides Breaks: an absent day has none.
- **The row actions' dialogs** (Missing Punch, Relaxation, Absent, Overtime) are not drawn; each is
  a short form with a reason, written in the same style.
- **Not in the design, added**: the legend chips highlight a state in the grid; clicking a day
  in the overview opens its time sheet; a status pill on days whose chips would not say it
  (Short leave, WFH…); "pending" overtime before approval; an Edit button on View for All.
- **Rules chosen** (the design does not state them): 5 minutes of grace, overtime from 15 minutes
  past the clock out, and five warnings a month make one penalty.
- **Sub menu**: Overtime and Missing Punch open placeholders; Official Visits opens the Requests
  type of that name, Scheduling opens Scheduling and Attendance Insights opens the overview. In
  the sidebar the page is "Attendance Settings", so it is not confused with the app's Settings.
- **Holidays** have a Year filter and an Attendance Exempt box (not drawn) to tell a day off from a
  day that is only marked. Rules are kept with the holiday and saved with Create.
- **Criteria rows** (IP Restrictions, Geo Fencing) fold to a one-line summary on Save, so long
  lists stay readable; Edit opens them again.
- **Attendance Logs**: the Machine column reads "Machine (MCH-00001)" as drawn; punches made from
  the dashboard, by a punch request or by HR show "—" there. Edit and Delete are offered only on
  manual and imported punches, and Download takes one date as the frame shows.
- **Not in the design, added**: the CSV template and line-by-line errors on Import, the per-machine
  result list, the 31-day limit on the log list, and the confirmation before each delete.

Requests:

- **Icons** are the Figma exports: the Requests sub menu (`2734:12194`), the Requested /
  Delegates / Consents tabs (`2743:11849`) and the newer sidebar with Leaves and Requests
  (`2706:62066`). **Leaves** is in the sidebar as drawn, as a placeholder page.
- **Row menu**: the lists show a ⋮ menu per row (the design pops the menu next to the status).
- **Shift Approval** gets the Requested / Delegates / Consents tabs like Punch; the frame shows
  only the list, but delegated shift requests and swap consents need the same views.
- **Shift Request** keeps the form at the top as drawn and lists the requests under it, so the
  person can follow what they asked for. "Swap From" shows the shift that day (the frame's "All"
  is placeholder text); "Swap To" lists colleagues in the same department with a different
  shift.
- **Missing Punch** (a Punch Type in the design) adds whichever punch the day lacks when approved.
- **Not in the design, added**: confirmation before Approve / Reject, a reason required to reject,
  the colleague's consent required before a swap's final approval, and the approval effects
  (the punch appears in Attendance as "Punch Request"; the shift changes in Scheduling;
  cancelling puts both back).
- **Sample codes** follow the design (`RQ-ATT-0881` …); shift requests use `RQ-SFT-…`.

Request Settings and Transfer (built as drawn; pasted placeholders and controls that cannot work
as drawn were fixed):

- **Placeholders**: date pickers show real dates (drawn "March, 2007") formatted "December 15,
  2023"; the Delegations columns hold people and request types (drawn company names and dates);
  the Delegatee filter reads "Select Delegatee" and the Transfer Status filter "Select Status"
  (both drawn with another field's placeholder); the Transfer Department column shows the new
  department (drawn dates); transfer codes are `RQ-TRF-…` (drawn `RQ-ATT-…`). The Approve frame's
  second "Created" heading and its "Employee Code: Lahore" sample are dropped.
- **Spelling**: "Delegation" (the sub menu draws "Deligation").
- **Request types**: Shift Request is listed after Punch in every type list (the app has it, the
  design's lists do not), and each "… Cancel Request" sits after its type (the stray generic
  "Cancel Request" is dropped).
- **Request Restriction**: no Company field on Create, as drawn; a new restriction takes the
  signed-in person's company. View has Cancel only (drawn with Save). The red bulk Delete for
  ticked rows is not in a frame.
- **Delegations**: the row menu offers Enable on in-active rows and Disable on active ones.
- **Request Flows**: the frame's header area is empty; a "Request Flows" heading and a line naming
  the type and flow ("Punch Request · General Flow") are added. Yes/no columns show a tick; Name
  shows the employee on Employee / Consentee rows.
- **Request Flow Edit**: Save is added (drawn with Cancel only); Add Node sits at the top right of
  the body rather than in the title. Expression, If True and If False are enabled only on
  condition rows, whose Next is greyed (they route by If True / If False); Employee only on
  Employee / Consentee nodes. New rows take the next free ID.
- **Assignment card**: placed under the node list and sharing its Request Type. The frames say
  both "Select Employee" and "Employees"; it is "Employees" (All by default) with a Search
  Employee box. Authorities keep the order they are picked in; General Flow is not combined with
  others. Save stays grey until a row is ticked.
- **Nodes the design leaves undefined**: Area Manager falls back to the country manager (areas
  have no manager on file); Retail Employee is treated as Line Manager; HOD Finance is the
  Finance head, HOD Admin the Operations head, HOD HR and HR/Admin the HR manager. Cancellations
  are decided by the last approver of the "… Cancel Request" flow (the HR manager by default).
- **Transfer**: there is no My / All, as drawn; the Requests tab lists every transfer under "All
  Request". The greyed "Transfer Request Edit" frame is the View, titled "Transfer Request View";
  Approvals → View is titled "Transfer Approval View" and has Cancel only. In the Approve popup,
  Location, Branch and Department are read-only grey like the other fields (drawn white, as if
  the approver could change where the person moves). The Transfer Flow popup closes with the
  drawn red Cancel. Bulk Approved / Unapproved is on both Approvals views (the Requested frame
  omits it); only rows waiting for you can be ticked, and Unapproved asks for a reason. Employee
  Name cannot change on Edit. Line Manager and Final Authority are kept with the request and name
  the letter's addressee, but approval follows the Transfer flow.
- **Application editor**: Style, Bold, Underline, Clear, Font, Highlight, both lists and
  Alignment, with no new dependency. The drawn Table, Link, Picture, Video, Full screen, Code view
  and Help buttons are left out. Regenerate and the toolbar are off when the letter is read-only.

Payroll (built as drawn; only plain typos and controls that cannot work as drawn were changed):

- **Monthly**: the Stop icon closes the payroll after the design's red-cross confirmation. Run on
  a payroll with nobody on it explains that employees must be added first. The design's
  "Select Employee" placeholder on Name reads "Enter name" here, since the field is the payroll's
  name.
- **Dashboard colours**: the drawn amber and green for the two years could not be told apart with
  colour blindness, so the years are amber and pink (the design's line is pink already), with a
  legend, end labels and a table view (≡). Empty panels show the design's "No Record Found!".
- **Settings**: the Custom Pay Item account type gets a Name field; Company Year Start is a month
  list; the Edit and View titles are not drawn and follow the Create titles; Is Custom is set for
  the formulas and rules people add; the Appraisal and Loans menu entries link to Performance and
  to Requests → Loan & Advances.
- **Pay slips**: the column reads "Net Payable" (the design has "Not Payable"); the contribution
  column is "Employee Contribution" and employer shares appear only in the second table; tax is
  under Deductions and Earnings includes reimbursements; a line under the title names the payroll
  and month; the slip uses the company name and has a Print button. My has fewer filters, and on
  phones the select box sits in the employee cell.
- **Records**: From / To in the filters are optional; the Voucher Type filter is a select; Daily
  Wages step 2 has a Back button and its filters apply as you type; Voucher View is not drawn and
  shows the line read-only; Opening Balance Adjust is for the current month; the Employee Account
  form's "Employee Reports" label reads "Employee"; Salary Revision Edit labels are Type and
  Salary, with the percentage as a number box. A CSV line with a bad amount is reported by line.
- **Leave Encashment**: the Create, Edit and View frames sit on a pasted Asset Types list; the
  list behind the dialogs here is the Leave Encashment list. Required marks follow the frames
  only partly (the empty Create marks Leave Type and Employees, the filled one Year): all three
  are marked on Create, none on Edit and View, as drawn there. Year is a year picker (the frame
  draws a date box). There is no Filters or Delete frame, so Filters (Employee, Department,
  Leave Type, Year) and the delete confirmation follow the other Payroll lists. The "Action"
  heading and the violet checkbox are as drawn; View's grey boxes too.
- **Employee Accounts** follows the main frame (Employee, Account, Month, Credit, Debit); two later
  frames draw Code, Employee, Department, Net Amount instead.
- **Tables** scroll sideways on narrow screens rather than squeezing cells, so the action icons
  stay on one line as drawn.

Assets and off-boarding (built as drawn; pasted placeholders and controls that cannot work as
drawn were fixed):

- **Placeholders**: the Company Assets and End of Employment filters carried other forms'
  placeholders ("Select Location", "Select Asset Type" on Status); they name their own fields
  here. Asset Type's Status chip reads Active / Inactive (drawn "Allocated"); codes are AST-,
  ATP-, ECL- throughout (the frames mix in "SR-00002" and "Resourceinn"); the clearance list's
  Employee ID shows the person's code (drawn an asset-type code). The Max box says "Max" (drawn
  "Min").
- **Names are typed**: Asset Type Name and Additional Information Name are text boxes (drawn as
  drop-downs).
- **Company Assets**: new assets start on Condition Old, as the Create frame draws the switch.
  Import File ⌄ offers Assets (a CSV) and Sample File; the menu's contents are not drawn.
  Deactivate becomes Activate on an unavailable asset. Edit and View mark only the fields their
  frames mark. Asset History shows the person as "Name - CODE" and opens the newest line.
- **Asset Types**: a Filters button (Status, Name) is added; only the Filters frame exists.
- **Allocations**: the columns are realigned (the chip was drawn under Deallocation Date, the menu
  under Status). Deallocate (not drawn) is added to the menu with a date dialog. The Asset box
  lists the available assets of the chosen type. View shows the employee as a plain field (drawn
  as a "Name ×" chip) and adds the Identification Number.
- **Clearance form**: built from the version with bulk Approved / Unapproved (`3842:24105`).
  Employee ID and Department fill in from the person and are read-only; Asset Details repeats per
  asset the person holds (with Add Asset / Remove); Asset ID and Date Allocated come from the
  allocation; Return Status keeps its three boxes but is one choice; Clearance Approved By is an
  employee select (drawn as a box). Bulk buttons ask "Are you sure you want to Perform this
  action?". View has Cancel only and no required marks (drawn with Save).
- **End of Employment**: the Status filter offers Pending / Completed and Notice Period Yes / No.
  The dialog has no visible title, as drawn; the card says "Choose the employee to see their
  details." until someone is chosen. View adds a muted "Waiting for: …" line while pending.
  Import File is a plain button as drawn; a file with errors offers the sample file.
- **Off Boarding Checklist**: the bin "Are you sure you want to Delete this?" is used for deleting
  a field row (the list menu has Edit and View only, as drawn). Checklist View hides the Create
  button and the Actions column; Additional Information View has no Save. Changing a field's Type
  clears Min and Max. "Off Boarding Settings" opens the checklist (it has no page of its own).
- **Shared code**: Payroll's Final Settlement reasons gained Transfer and Other (End of
  Employment's list); the Payroll barrel exports the record-page kit the new screens reuse.

## Frontend review (23 Oct 2026)

Every page (96 routes, the detail pages included) was opened in the browser at 1280 px, at
375 px as a touch phone, and at 1280 px in the dark theme, and measured for sideways page
scroll, elements past the right edge, text cut off without an ellipsis, boxes that hide their
content, text under 2.5:1 contrast, controls without a name and images without alt text
(`docs/page-audit.js`, pasted into the browser console, repeats the check). The layout was
clean at every width and in both themes; what the pass found and changed:

- **Select values ended mid-letter.** shadcn's trigger gave the value `line-clamp-1` and `flex`
  together, and the flex display cancels the clamp, so a long value in a narrow box (the Add
  Planning cells, the Edit Branch manager) was cut without an ellipsis. The value is now a
  truncating block (`src/components/ui/select.tsx`).
- **Rows per page read "1".** The 4.5rem box of `PaginatedTableCard` left 10 px for the number
  once the trigger's desktop padding applied; it now uses the narrow padding at every width.
- **The mock API died in a background tab.** Chrome stops a service worker that is idle, and the
  keep-alive ping MSW sends every 5 s is throttled once a tab has been hidden for a while, so
  after a few minutes away every request fell through to the host and each page showed "could
  not be loaded" until a reload. The API client now spots a reply the mock never produced (a
  host 404 or an HTML page instead of JSON), restarts the worker once
  (`restartMockServiceWorker` in `src/mocks/browser.ts`) and retries the request
  (`setMockApiRecovery` in `src/lib/axios.ts`; `src/lib/axios.test.ts`).

Seen and left as designed: the status chips (Pending, Approved, Active …) use the frames' own
amber and green on their tinted fills, which sit at 1.9–2.5:1; the green Save / Import buttons
are 2.5:1 white on `#2CBD4D`. Project Management keeps its own white panels and purple palette
in the dark theme (its frames have no dark variant), so it reads as a light module on a dark
page; the other modules follow the theme tokens. The production bundle's main chunk is about
495 kB minified (shared React, router, query, Radix and icons), just under Vite's 500 kB note.

## Not done yet

- No real backend, no refresh-token flow, no role-based permissions.
- No translations (i18n library not chosen).
- Other modules are placeholders; their planned screens come from the folder names in
  `HRango2/Design`.
- Settings: Users, Subscriptions, Help & Support, Custom Forms, System User, User Group Permissions
  and Biometric Devices are placeholders (no designs yet).
- Requests: Expense and Official Visits are placeholders (no screens in the design); the
  Requisition entry of the drawn sidebar tree has no screens and is left out. Leaves is a
  placeholder module, so Leave requests keep their own entitlements. Not built: the Consents tabs
  of Loan, Travel and Promotion (drawn empty), Leave's AI "Application" panel, Work From Home's
  Cancel times and Subordinates option, Approve/Reject on a requester's own Promotion or
  Resignation row, Punch filters Count and Request Flow (their meaning is not drawn), and the
  multi-shift note on Punch Create. Seeded approved requests did not run their approval effects. An approved transfer goes into a transfer log
  and does not change the employee directory (no employee module yet). Transfer attachments keep
  only the file name.
- Attendance: Missing Punch and Overtime (in the sub menu) are placeholders. Take Picture For
  Attendance and IP Restrictions are stored but not enforced on Clock In, since the mock has no
  camera or client IP.
- Payroll: attachments (tax rebates, employee vouchers, final settlement) keep only the file name,
  since the mock has no file store. Appraisal and Loans in the Payroll Settings menu open other
  modules' pages (Performance is a placeholder). Bank transfer files are not generated.
  Leave Encashment ignores a leave type's Encashment Min / Max Limit, since the Leaves module
  (where leave types are set up) is not built; leave quotas are Employee Accounts entries.
- Assets and off-boarding: End of Employment and Rehire do not change the employee directory's
  active status (there is no employee module yet). Attachments keep only the file name. The
  Separation Management and Configuration placeholder modules still list these screens among
  their planned ones. Off Boarding Settings has no page of its own; it opens the checklist.
- Project Management: the four dashboards and every view but List (Board, Calendar, Timeline, Activity, Table, Team, Gantt, Workload, Mind Map) have no design and are placeholders; docs have no editor; reminders are stored but never notify; invited emails and shared links send nothing (there is no email or public share page); third-party file sources (Google Drive, Dropbox, Box, OneDrive) cannot be connected; there are no real roles, so column permissions work them out from the directory.
- Manpower Planning: Upload Excel reads CSV only (no .xlsx parser); mail on the page title opens
  an email link rather than sending anything.
- Leaves: attachments keep only the file name. Enroll Employee and Apply Leave have no frame of
  their own (built in the module's style).
- Benefits: Add Plan's Coverage Options, Eligibility & Cost, Enrollment Details and Payroll
  deduction steps are not designed and are disabled; the Enrollment Windows, Employees and Files
  tabs are minimal (no design); plan attachments keep only the file name and cannot be opened.
- Map tiles come from the public OpenStreetMap and Esri servers, which suit development only.
  Production needs a tile provider with a key (or Google Maps, as drawn) and a real geocoding API
  behind "Search Location".
