# R39 Phase 4D — OpenPageFlip evaluation

Open `/openpageflip-prototype` alongside `/page-flip-prototype`.
The existing prototype, `page-flip@2.0.7`, production book, editor and saving
code are unchanged by this phase.

## Versions and verified API

Installed with **npm**, pinned exactly:

- `@openpageflip/core@0.4.2`
- `@openpageflip/react@0.7.0`

The React package declares core `^0.4.2` and React `^19.2.8` peer ranges. This
project's installed React 19.3.1 and Next.js 16.4.2 are compatible; the route
server-renders and hydrates successfully. These are pre-1.0 packages.

Read the official package documentation first, then inspected the **installed
published implementations**, not just upstream claims:

- `node_modules/@openpageflip/react/dist/index.js`: `FlipBook` uses a layout
  effect to create the core book and calls `book.destroy()` in its cleanup.
  It owns the page wrappers, exposes a `Book` handle, and rebuilds on option
  changes. The retained React handle throws after unmount instead of forwarding
  calls to a destroyed instance.
- `node_modules/@openpageflip/core/dist/index.d.ts`: options are `layout`,
  `cover`, `flipDuration`, `shadowOpacity`, `click`, `drag`, `swipe`, `hover`.
  Events carry `{ page }` and `{ state }`, not StPageFlip's `{ data }` envelope.
  `Book.page` / `.state` are properties; `flipNext` / `flipPrev` return promises.
- Imported the required `@openpageflip/core/styles.css`. Every direct child of
  `FlipBook` is an official `Page` with explicit soft density.

## Fair visual comparison

The four sample pages have exactly the same student names, story titles, text,
drawing descriptions and page numbers as the StPageFlip prototype. The palette,
paper, typography, 440×540 base page ratio, 540px maximum single-page width and
`min(62svh, 660px)` stage height are copied into independently scoped CSS.

`layout="spread"`, `cover={false}`, `binding="left"` give:

| State | Left | Right |
| --- | --- | --- |
| Initial | Student 1 drawing, page 1 | Student 1 writing, page 2 |
| Next | Student 2 drawing, page 3 | Student 2 writing, page 4 |
| Previous | Student 1 drawing, page 1 | Student 1 writing, page 2 |

Both prototypes default to 1000ms with 0.35 shadow opacity and bottom-corner
programmatic turns. OpenPageFlip owns all folding and animation. No custom
segments, overlays, scheduling or easing were added. Pointer-driven turns are
disabled to match the existing experiment. Reduced motion is handled natively.

Duration and shadow controls use the official option props. `startPage` retains
the current spread when a setting causes a library rebuild. The extra
Unmount/Remount button genuinely removes and recreates the React book subtree;
it can be used during a turn. Remount intentionally starts at Student 1.

Chrome inspection covered the original StPageFlip narrow baseline and the new
book at approximately 1920px, 720px and 520px window widths. Forward and reverse
turns landed with the correct pages. The sample text remained readable and no
horizontal scrollbar or text clipping was seen. At smaller phone widths the
writing region permits native vertical scrolling rather than cutting off text.

**Visual result:** the native curl, shading and landing appear comparable to
StPageFlip, consistent with their shared fold geometry. This is a qualitative
Chrome check, not proof of improved frame rate or cross-browser parity. The
main verified advantage here is lifecycle behavior, not a different effect.

## Lifecycle findings from implementation

In the installed core bundle:

- `startTween()` keeps one pending frame handle, schedules frames only while
  the animation runs, and cancels that handle through its cancellation method.
  A done flag also rejects a callback already dequeued before cancellation.
- `createBook().destroy()` disconnects its ResizeObserver, cancels a pending
  resize frame, detaches input, destroys the controller and renderer, and clears
  the event emitter. Controller destruction cancels the tween; renderer
  destruction removes shadows/clones and restores page styles/classes.
- A cancelled flip promise resolves `false`. The prototype intentionally does
  not attach a state-updating promise continuation that could outlive the book.
- Cancellation can synchronously report a progress reset **inside** destroy;
  no further events should execute after cleanup returns. The tests distinguish
  this expected cancellation notification from late destroyed-instance events.

This addresses the mechanism in [StPageFlip issue #71](https://github.com/Nodlik/StPageFlip/issues/71)
without monkey-patching global RAF in production.

## Reproducible checks

```sh
node node_modules/jest/bin/jest.js --config jest.openpageflip.config.mjs --runInBand
node node_modules/eslint/bin/eslint.js src/app/openpageflip-prototype __tests__/openPageFlipPrototype.test.tsx jest.openpageflip.config.mjs
```

The isolated Jest config transforms the official ESM packages using the existing
Next/Jest toolchain. No test-only dependency or existing config was changed.

Seven tests use the real packages:

1. Server rendering performs no frame requests or observer initialization.
2. Strict Mode replay leaves one live engine/observer; mid-turn unmount cancels
   its pending frame and disconnects the observer. Even manually invoking a
   previously queued callback produces no new events or frame requests.
3. Six Strict Mode mount/unmount cycles leave zero pending frames/observers
   after every cycle. Advancing synthetic frames after cleanup
   does not resume destroyed animations or emit late callbacks.
4. Unmount before the queued init microtask suppresses its callback.
5. The core's public injectable `Clock` independently proves destroy cancels
   its frame, settles the promise false, and restores the original page nodes.
6. Three consecutive forward/back pairs, duplicate clicks, setting changes on
   Student 2, and the prototype's Unmount/Remount controls behave correctly.
7. Reduced motion lands immediately with no animation frame requests.

The frame tracker replaces RAF **only inside tests**. It does not mask a leak
by clearing pending frames before asserting the count is zero. Browser checks
also verified unmount and remount using the visible controls.

Lint and source TypeScript checks pass. The normal full TypeScript check still
finds the existing stale `.next/types/validator.ts` imports; excluding generated
`.next` inputs verifies the current application/test sources.

## Recommendation and limits

**Recommend OpenPageFlip as the preferred candidate for the next integration
phase.** It keeps the familiar effect, provides the official React 19 ownership
model, and passes the cleanup checks that motivated this evaluation. This is
not authorization to replace the production book yet.

Before production integration, validate controlled textarea updates, focus and
selection, ownership, save timing, accessibility of hidden/animated pages,
large stories, touch input, Safari/Firefox and low-end device performance. Both
packages remain pre-1.0; keep exact pins and rerun these tests before upgrades.

New files: this route's component, page, stylesheet and report;
`__tests__/openPageFlipPrototype.test.tsx`; `jest.openpageflip.config.mjs`.
Modified files: `package.json`, `package-lock.json` (two new dependencies only
relative to the start of Phase 4D). No integration or commit/push was performed.

Official references:

- [React integration documentation](https://github.com/benhonda/openpageflip/blob/main/packages/react/README.md)
- [Core documentation](https://github.com/benhonda/openpageflip/blob/main/packages/core/README.md)
- [React wrapper implementation](https://github.com/benhonda/openpageflip/blob/main/packages/react/src/FlipBook.tsx)

The versioned installed bundles named above were the source of lifecycle/API
verification; these upstream links can change after this evaluation.
