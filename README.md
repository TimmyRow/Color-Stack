# Color Stack

A quick static color stacking game aimed at fast web play and future Poki packaging.

## Play

Open `index.html` in a browser. Press Space, Enter, ArrowDown, or tap/click the playfield to drop each slab.

## Current Features

- One-button stacking loop with shrinking slabs
- Runs only end when a block misses the stack completely
- Rainbow blocks widen the whole tower when landed
- Perfect-drop combo scoring
- Height goals and best tower tracking
- Sound effects with mute persistence
- Keyboard, pointer, and touch-friendly controls
- Local high score through `localStorage`
- Static HTML/CSS/JS with no build step
- Poki SDK hook points for loading, gameplay, pause, game-over, and replay breaks

## Later Poki Prep

- Add Poki SDK loading according to Poki's current integration guide.
- Add rewarded/ad break moments between runs once the core loop is tuned.
- Add a 16:9 and portrait QA pass for Poki embed sizes.
- Add sound settings and mute persistence before publishing.
