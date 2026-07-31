# Life Plan

FastAPI backend (`server/`) + Next.js App Router frontend (`client/`). See conversation history / codebase for architecture details.

## Frontend conventions

### Tabbed pages (e.g. `money-flow`, `personal-growth`, `developer-growth`, `productivity`)

Pages that combine multiple sub-pages into tabs must render the tab bar in the **main content area**, not the `Header`'s `centerContent`/`subHeaderContent`. The header is shared chrome (nav, timers, avatar, theme toggle) and gets cluttered when pages inject their own titles/controls into it.

Pattern:

```tsx
<Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
<Sidebar ... />
<main>
  <div className="border-b border-zinc-200/80 bg-white px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-900 md:px-6">
    {/* mobile: <select> dropdown, w-full */}
    {/* desktop: flex row of buttons, each flex-1 so the bar fills the available width */}
  </div>
  {activeTab === "..." && <SomeTabPage />}
</main>
```

Rules:
- No redundant page title (`<h1>`) next to the tabs — the tab labels are enough context.
- Desktop tab buttons are `flex-1` each, edge-to-edge across the full width of `<main>` — no gap, no `rounded-*`, no border between or around buttons (no `border-l`, no wrapping `border`). Adjacent buttons are told apart only by their background color (selected vs. unselected), not a divider. The row sits outside `<main>`'s horizontal padding so it truly spans the full content width, not just the padded content column.
- Mobile keeps the `<select>` dropdown, inside its own padded wrapper (`px-4`) since it doesn't need to span edge-to-edge.
- Do not add page-specific content (titles, cash summaries, counters, etc.) to `Header`'s `centerContent`/`subHeaderContent` — keep the header generic.

### Right sidebars over centered dialogs

For any add/edit/detail/picker flow, **always prefer a right sidebar over a centered dialog**. Use the shared `RightDrawer` component (`client/components/RightDrawer.tsx`) instead of building a new centered modal (`Dialog.tsx`) or a bespoke `fixed inset-0 flex items-center justify-center` overlay. This mirrors the pattern from the sibling `biz-poa` project's `Drawer` component.

Pattern:

```tsx
<RightDrawer
  open={open}
  onClose={onClose}
  title="New goal"
  width="sm" // sm | md | lg | xl
  actions={<button onClick={...}>Add</button>} // optional: search input, "Add" button, etc. — sits between title and close button
>
  {/* form or list content */}
</RightDrawer>
```

Rules:
- `RightDrawer` is always mounted (not `{open && <RightDrawer/>}`) so open/close is a pure CSS `transform` transition, not a mount/unmount pop-in. Keep it that way — conditionally mounting it reintroduces the jank this was built to fix.
- When one `RightDrawer`-based flow can open another on top of it (e.g. an "Add" form opened from within a list drawer), pass `stackLevel` (parent's level + 1) so z-index and Escape-to-close stack correctly — see `client/components/drawerStack.ts`.
- New add/edit/detail/picker flows should use `RightDrawer`. `Dialog.tsx` (centered modal) still exists for short confirm/cancel prompts (e.g. delete confirmation) — don't migrate those without being asked, but don't add new centered dialogs for anything more than that either.
- List/search/filter controls for what the drawer shows go in the `actions` slot (header), not inside `children`, so they stay visible above the scrollable list.

### "More actions" (kebab) menus

Per-row/per-item actions (edit, delete, duplicate, etc.) use a small trigger button that opens a `fixed`-positioned dropdown built by hand (`getBoundingClientRect()` + a `useLayoutEffect`), not a UI-kit dropdown component — see `TimeEntryRowMenu` and `SubjectItemMenu` in `client/components/productivity/TimeTrackingPanel.tsx` for the reference implementation (position tracking, click-outside-to-close, Escape handling).

Icon: an inlined SVG combining three horizontal bars with a dot before each (Themify's `menu-alt` glyph, `viewBox="0 0 17 17"`) — matches the sibling `biz-poa` project's `CardMenuTrigger` (`react-icons/tfi`'s `TfiMenuAlt`), inlined here instead of adding `react-icons` as a dependency since this app inlines all its icons.

Positioning: **right-align the menu's right edge to the trigger's right edge, with a small gap below, plus an optional local `offset`** —

```ts
const r = triggerEl.getBoundingClientRect();
// offset follows biz-poa's DropdownMenu convention: negative x/y nudge the
// menu left/up from the default position; positive nudges right/down.
const offset = { x: 0, y: 0 };
setMenuFixed({
  top: r.bottom + 4 + offset.y,           // small gap below the trigger, plus offset
  right: window.innerWidth - r.right - offset.x, // right edge of menu = right edge of trigger, plus offset
});
```

This is the same alignment principle — and the same `offset` shape — as `biz-poa`'s `DropdownMenu` `align="right"` (its base formula, before any per-instance `offset`, is identical: `trigger.bottom + 4`, right-aligned). Do **not** copy `biz-poa`'s exact `offset` pixel values (e.g. `{ x: -60, y: -48 }`) into this project — those are corrections tuned to their `ResourceCard`'s specific trigger size/position and will misplace the menu here (our trigger buttons are much smaller, so a `-48` y-offset would push the menu above/behind the trigger instead of below it). If a specific menu needs a correction because its trigger sits near a viewport/container edge, tune `offset` locally for that trigger's actual geometry — see `TimeEntryRowMenu` (large offset, trigger near a table's edge) and `SubjectItemMenu` (small offset, just a nudge) for examples.

## Never run build/compile checks

Do not run `tsc`/`tsc --noEmit`, `next build`, `eslint`, or any other type-check/lint/build/compile command in this project — not even to "verify" an edit worked. Make the change and stop. If something is broken, the user will run their own checks/server and report back; fix it then, based on their report. This is a hard rule for this project, not just the general "don't reflexively re-verify after every edit" guidance — do not run these commands here even when that general guidance would otherwise allow it (e.g. "part of the task" or a build/test suite request) unless the user explicitly asks for that exact command in this project.

## Backend conventions

### Never touch Alembic migrations

**Never create, edit, or run Alembic migration files or commands** — no `alembic revision`, no `alembic upgrade`, no editing anything under `server/alembic/versions/`. The user generates, reviews, and runs migrations themselves.

### Reuse shared lookup models — don't spin up a new model/table per feature

Before adding a new model for a new feature, check whether an existing model already represents the same concept and can be reused instead of creating a parallel, near-duplicate one. This app should read like a small number of shared domain models (Django-app style: common building blocks reused across apps/features), not one bespoke model file per feature that happens to need "an author" or "a category."

**Concrete precedent**: AZW Books (writing/authoring books with chapters) needs an "Author" and a "Category" for its books. Rather than defining `AzwAuthor`/`AzwCategory` tables, it reuses the existing `ReadingAuthor`/`ReadingCategory` models from `models/reading_library.py` (originally built for the reading-tracker feature) — same tables, same rows, shared across both features. The only genuinely new models are `AzwBook`/`AzwBookChapter`, since a "book I'm writing with chapters" isn't represented anywhere else. The granular CRUD for the shared lookups (`GET/POST /reading-library/authors`, `GET/POST /reading-library/categories`) lives on the `reading_library` router precisely because that's where the models live — a new feature that needs the same concept calls those endpoints (or reuses the model class directly for FKs/joins) rather than growing its own copy.

**How to apply**: before writing a new model, search `server/models/*.py` for something that already represents the concept (a generic-sounding lookup like Author, Category, Tag, Stage, SpendingType, etc. is a strong signal it's reusable). If one exists and fits, import and reference it — add a new association table if the many-to-many needs differ, but don't duplicate the parent entity. Only create a new model when the thing being modeled is genuinely new domain data, not a second copy of an existing concept under a feature-specific name. This keeps the number of model files, schema files, and endpoint files from growing one-for-one with every feature request, which is what makes the backend hard to maintain over time.

You *may* freely edit SQLAlchemy models (`server/models/*.py`) and register new ones in `server/models/__init__.py` — that file's imports are what make `alembic revision --autogenerate` pick up new tables/columns (via `models/__init__.py` running as a side effect of `alembic/env.py`'s `from models.user import User`), so registering there is required, but it is not itself a migration file and is safe to edit. After model changes, tell the user what changed and that they need to run `alembic revision --autogenerate` + review + apply it themselves — do not attempt either step.
