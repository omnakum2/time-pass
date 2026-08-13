# Multi-Game Lounge Platform — Detailed Handoff Document

Yeh handoff document hamaari conversation, saare architecture decision, lounge UI redesign plan, completed features, aur updated file tracker ko **Simple Roman Hindi** me explain karta hai taaki agla developer ya AI agent bina kisi confusion ke kaam pick-up kar sake.

---

## 📌 1. Project Objective (Hum Kya Bana Rahe Hai)
Humare paas pehle ek single card game tha: **Bid Club**. 
Humne is project ko **Multi-Game Lounge Platform** me redesign kiya hai jo future me **Rummy**, **Mindi**, etc. support karega bina poora code rewrite kiye.

---

## 📋 2. Step-by-Step Plan aur Kitna Work Complete Hua (Status)

### Point-by-Point Progress:

1. **Architecture & Multi-Game Workspace Setup** — `[COMPLETED ✅]`
   - **Plan**: Codebase ko standard workspace pattern me segment karna (Approach 2 — Per-Game Workspaces).
   - **Implementation**:
     - `shared/src/registry.ts`: Central game metadata registry banayi (`GAMES` list: Bid Club, Rummy, Mindi).
     - `server/src/rooms/base.ts`: Generic `BaseRoom` state pattern introduce kiya jo har naye game ke liye reuse hoga.
     - `server/src/rooms/BidClubRoom.ts`: Bid Club specific server logic isolate kiya.

2. **Global App Layout Shell (`App.tsx`)** — `[COMPLETED ✅]`
   - **Plan**: Landing page aur baki pages ke liye professional 100% full-width header app layout setup karna.
   - **Implementation**:
     - `<Header />` ko `App.tsx` me top level `.app-shell` par render kiya (`position: sticky; top: 0; width: 100%; z-index: 100;`).
     - Main content container `<main className="app-main">` niche routes render karta hai bina header ko duplicate kiye.

3. **3D Medallion Game Selection Cards (Lounge Menu)** — `[COMPLETED ✅]`
   - **Plan**: Single horizontal list hatakar premium 3D casino-style medallion cards banana.
   - **Implementation**:
     - **Circular Gold Ring Frame**: `210px` conic-gradient gold medallion ring with felt background (`.medallion__inner--wine`, `--green`, `--blue`).
     - **Fanned Mini Cards**: Medallion ke andar Bid Club, Rummy aur Mindi ke fanned mini playing cards show kiye.
     - **Card Asset Reuse**: Mini cards ne Bid Club ke `.card` aur `.card--back` design tokens ko react components me reuse kiya.

4. **Overlapping Angled Ribbon & Player Count Chip** — `[COMPLETED ✅]`
   - **Plan**: Medallion ring ke niche overlapping angled notched title banner aur connected player count chip lagana.
   - **Implementation**:
     - **Angled Notched Ribbon Badge**: Ribbon banner ko custom polygon `clip-path` ke sath `filter: drop-shadow(...)` continuous gold border diya gaya hai taaki notched polygon shape 100% sharp and unbroken rahe.
     - **Overlapping Placement**: Title banner (`BID CLUB`, `RUMMY`, `MINDI`) physically medallion bottom ring ko overlap karta hai (`margin-top: -36px`).
     - **Connected Player Chip**: Directly niche connected `👥 2–7 PLAYERS` chip with gold border and dark-gold gradient fill.
     - **Gemstone Clasps**: Bottom ring par Ruby (Bid Club), Emerald (Rummy), aur Sapphire (Mindi) gemstones.

5. **Synchronized Ring & Title Banner Sweep Shine** — `[COMPLETED ✅]`
   - **Plan**: Grayscale aur lock icons hatana, aur ring + title chip me synchronized linear sweep shine lagana.
   - **Implementation**:
     - Lock badge (`FiLock`) aur outer corner brackets completely remove kar diye.
     - **Title Banner Sweep Shine**: Restored `@keyframes banner-shine-sweep` animation across the title chip on hover (`.medallion__title-banner::after`).
     - **Gold Ring Donut Sweep Shine**: Applied linear metallic sweep shine animation (`@keyframes ring-sweep-shine`) with a donut mask (`-webkit-mask-image: radial-gradient(circle, transparent 96px, #000 97px)`). Isse metallic linear shine sweep strictly outer gold ring border par hi ghoomti hai aur inner cards/felt 100% clean rehte hai!

---

## 🧠 3. Major Architecture & Design Decisions (Chat Highlights)

1. **Approach 2 — Per-Game Workspaces (Incremental Approach)**:
   - Abhi ke liye overhead kam rakhne ke liye 2–3 games (Bid Club, Rummy, Mindi) ka Lightweight Workspace banaya. Future me Jab 5–6 games honge to koi mushkil refactoring nahi hogi.

2. **Global App Shell Header Layout**:
   - Local `<Header />` calls ko individual pages se hatakar `App.tsx` me global wrapper me dala taaki poori application edge-to-edge full width dikhe.

3. **Pure CSS 3D Medallion Cards**:
   - Koi heavy 3D assets/images download karne ke bajaye pure CSS gradients, conic rings, and fanned mini-cards use kiye jo lightning fast load hote hai.

4. **Lock Icon Ki Jagah Interactive Toast Notifications**:
   - Lock icon visual clutter create kar raha tha, isliye coming-soon games par click karne par active `ErrorToast` notification trigger hoti hai ("Rummy is under development. Stay tuned!").

---

## 🛠 4. Current Code Diff & Modified Files Tracker (Excluding `.md` files)

Niche di gayi table me current session ke modified code files ka diff and summary hai:

| Modified File Path | Change Type | Detailed Summary of Changes |
| :--- | :---: | :--- |
| `client/src/App.tsx` | **MODIFY** | `<Header />` component ko globally `.app-shell` layout me mount kiya above `<main className="app-main">`. |
| `client/src/index.css` | **MODIFY** | `.app-shell`, `.app-main`, aur `.app-header` ko update kiya for 100% full-width edge-to-edge sticky layout (`height: 60px; padding: 0 24px`). |
| `client/src/components/Header.tsx` | **MODIFY** | Route-aware Navigation update (`isLoungeHome` check to hide redundant Lounge link on homepage). |
| `client/src/pages/GameSelectionPage.tsx` | **MODIFY** | Added `<div className="medallion__ring-shine" />` container inside medallion ring and wrapped title banner in `medallion__title-banner-wrapper`. |
| `client/src/styles/selection.css` | **MODIFY** | Restored polygon notched ribbon shape with `filter: drop-shadow(...)` gold border, title banner sweep shine, and donut-masked gold ring sweep shine (`mask-image`). |
| `client/src/components/ErrorToast.tsx` | **MODIFY** | Toast component me manual custom message pass karne and close handler ka support add kiya. |
| `shared/src/registry.ts` | **NEW** | Central `GAMES` registry file for Bid Club, Rummy, and Mindi game metadata. |
| `server/src/rooms/base.ts` | **NEW** | Multi-game support ke liye generic `BaseRoom` lifecycle class. |
| `server/src/rooms/BidClubRoom.ts` | **NEW** | Bid Club room logic extracted into per-game room module. |

---

## ⚡ 5. How to Run & Validate
- **Start Dev Mode**: `npm run dev`
- **Build Full Project**: `npm run build`
- **Typecheck Client**: `npx tsc --noEmit --project client/tsconfig.json`
