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
- Sound effects with mute persistence
- Keyboard, pointer, and touch-friendly controls
- iPhone/iPad portrait and landscape layout support
- Local high score through `localStorage`
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

## Remaining Poki Prep

- Create final static and animated thumbnails.
- Run the build through Poki Inspector before review.
- Tune ad/reward pacing after playtesting.
