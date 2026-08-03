# Color Stack

A quick static color stacking game aimed at fast web play and future Poki packaging.

## Play

Open `index.html` in a browser. Press Space, Enter, ArrowDown, or tap/click the playfield to drop each slab.

## Current Features

- One-button stacking loop with shrinking slabs
- Runs only end when a block misses the stack completely
- Random rainbow blocks widen the whole tower when landed
- Perfect-drop combo scoring
- Height goals and best tower tracking
- Persistent missions, run rewards, and coins
- Coin shop with unlockable backgrounds and block color sets
- QR code share button for the public game link
- Sound effects with mute persistence
- Keyboard, pointer, and touch-friendly controls
- iPhone/iPad portrait and landscape layout support
- Device-only progress through `localStorage`
- Static HTML/CSS/JS with no build step
- Poki SDK hook points for loading, gameplay, pause, game-over, and replay breaks

## Poki Prep

- Loads the Poki HTML5 SDK in `index.html`.
- Calls `gameLoadingFinished()` after SDK init resolves.
- Calls `gameplayStart()` only when gameplay begins or resumes.
- Calls `gameplayStop()` when gameplay pauses or ends.
- Uses `commercialBreak()` before starting/restarting runs.
- Locks input and suspends game audio during ad breaks.
- Prevents game-key and wheel page scrolling for embedded review pages.
- Does not call Poki account, token, or cloud-save APIs; progress stays on the player's device.

## Testing

Run `npm run playtest` to launch automated Playwright checks for desktop, iPhone, and iPad layouts, touch drops, Poki lifecycle hooks, shop persistence, and localStorage-unavailable fallback behavior.

## Remaining Poki Prep

- Create final static and animated thumbnails.
- Run the build through Poki Inspector before review.
- Tune ad/reward pacing after playtesting.
