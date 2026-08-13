# Implementation Plan: Medallion UI & Global App Layout Overhaul

Refactor the application into a clean, professional **Global App Layout** with a 100% full-width top header, and update the game selection screen with overlapping notched ribbon medallion cards.

## User Review Required

> [!IMPORTANT]
> **Key Architectural & Design Changes (per user feedback):**
> 1. **Global App Layout ([App.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/App.tsx))**:
>    - Render `<Header />` at the top level in [App.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/App.tsx) inside `.app-shell`.
>    - Layout structure:
>      - Top fixed/sticky `<Header />` (100% full-width edge-to-edge).
>      - Main content body (`<main className="app-main">`) below rendering the active route ([GameSelectionPage](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/pages/GameSelectionPage.tsx#65-146), [HomePage](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/pages/HomePage.tsx#12-265), etc.).
>    - Remove redundant local `<Header />` imports inside individual page components ([GameSelectionPage.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/pages/GameSelectionPage.tsx)).
> 2. **Overlapping Notched Ribbon Banners & Player Info Chips**:
>    - Title banner (`BID CLUB`, `RUMMY`, `MINDI`) will **physically overlap the bottom of the circular gold medallion ring**.
>    - Attached directly underneath the title banner is the smaller player info chip (`3–7 PLAYERS`), physically stacked with notched ribbon shapes (`clip-path` / gold-framed bevels) matching the reference image.
> 3. **Clean Visuals & Metallic Shine**:
>    - Remove outer corner angle brackets and lock icons (`FiLock`).
>    - Add a metallic shine sweep (`@keyframes shine`) and warm gold halo glow on hover.
> 4. **Card Asset & Design Reuse**:
>    - Reuse standard `.card` and `.card--back` design tokens from Bid Club for mini-cards inside medallions.
> 5. **Direct Code Execution**:
>    - Code changes will be compiled and verified directly via TypeScript (`tsc`) without automated browser agent scripts.

---

## Proposed Changes

### Component & Layout Edits

#### [MODIFY] [App.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/App.tsx)
- Add `<Header />` inside `.app-shell` above `<main className="app-main">`.
- Pass current route context so Header displays appropriate links ([Home](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/pages/HomePage.tsx#12-265), `Guide`, [Scoreboard](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/shared/src/types.ts#116-117), [Leave](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/components/Header.tsx#30-37)).

#### [MODIFY] [index.css](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/index.css)
- Update `.app-shell` (`min-height: 100vh; display: flex; flex-direction: column; width: 100vw; overflow-x: hidden;`).
- Update `.app-header` (`width: 100%; flex-shrink: 0; position: sticky; top: 0; z-index: 100;`).
- Update `.app-main` (`flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%;`).

#### [MODIFY] [GameSelectionPage.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/pages/GameSelectionPage.tsx)
- Remove local `<Header />` component rendering (handled globally in [App.tsx](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/App.tsx)).
- Remove `FiLock` icon import and lock badge overlay.
- Reorganize medallion JSX structure so the title ribbon physically overlaps the circular gold medallion frame with the connected player count chip stacked underneath.

#### [MODIFY] [selection.css](file:///c:/Users/om/Desktop/CS-Office/MRM/time-pass/client/src/styles/selection.css)
- Refactor `.game-selection-screen` & `.selection-content` to occupy the page body below the header (`width: 100%; flex: 1; padding: 30px 20px;`).
- Implement overlapping notched ribbon banners (`.medallion__title-banner`) with custom polygon clipping / gold bevel borders.
- Implement attached player info chips (`.medallion__player-chip`) directly attached below the title banner.
- Remove outer corner angle brackets (`::before`, `::after`).
- Add metallic shine sweep animation (`@keyframes metallic-shine`) and subtle hover glow.

---

## Verification Plan

### Automated Build Tests
- Run `npx tsc --noEmit --project client/tsconfig.json` to verify zero TypeScript errors.
- Run `npm run build` to verify full workspace production build integrity.

