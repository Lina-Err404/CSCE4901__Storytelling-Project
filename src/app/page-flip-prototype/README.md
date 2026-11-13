# Phase 4C: StPageFlip experiment

Open `/page-flip-prototype` using the existing Next.js dev server. This route has
no connection to Firestore, student drafts, saving, or the production book.

## Compatibility and integration

- Project manifests: Next.js 16.4.2 and React/React DOM 19.3.1.
- Installed only `page-flip`, pinned to 2.0.7 (MIT; no runtime dependencies or
  React peer dependencies). No React wrapper.
- The core is dynamically imported inside `useEffect`; it is never initialized
  during server rendering. The route loaded successfully in the running app.
- React owns an empty mount and a hidden source of four sample HTML pages. Each
  effect clones those pages into a disposable library-owned host. This avoids
  React reconciling nodes that the library moves or removes. A cancellation
  flag prevents an import resolving after cleanup from initializing an instance.
- Cleanup disconnects the ResizeObserver, cancels the adapter's resize frame,
  and calls the real `destroy()` method. Strict Mode initialization was tested.

Verified APIs in the installed source: `new PageFlip`, `loadFromHTML` (capital
HTML), `flipNext`, `flipPrev`, `turnToPage`, `getCurrentPageIndex`, `getState`,
`getSettings`, `update`, `destroy`; events `init`, `flip`, `changeState`.

## Spread mapping and appearance

The existing application stores a writing/drawing pair per student and navigates
by student index. This prototype flattens the same ordering into individual HTML
pages: Student 1 drawing/writing, then Student 2 drawing/writing.

`showCover: false`, `usePortrait: false`, and `startPage: 0` produce pages 1–2
initially and pages 3–4 after one forward turn. The library owns all folding,
clipping, lighting, and animation. No custom segments or extra animation layer.

Base page size is 440 × 540, with stretch sizing and a responsive stage capped
at 660px high. Default duration is 1000ms; shadow opacity is 0.35. The controls
allow 700/1000/1400ms and 0.2/0.35/0.5 shadow comparisons without reinitializing.
Soft density is explicit on every page. The native bottom-corner fold is used;
there is no separate perspective or curl-strength API, so none was invented.
Reduced-motion users get immediate spread changes. Buttons are locked until
the library reports its read state. Mouse-driven flips are disabled to isolate
the animation test from future editor interactions.

## Validation

- Browser: initial Student 1 spread, native forward curl, Student 2 spread and
  correct page numbers, reverse landing, and another turn at approximately
  720px window width. Content stayed readable and the spread stayed landscape.
- Visual impression: the native corner curl and clean resting surfaces are a
  promising improvement over the custom segmented implementation. This is a
  limited Chrome inspection, not a cross-browser or frame-time benchmark.
- Three tests using the actual package cover Strict Mode host ownership and
  cleanup, three forward/back cycles with repeated-click protection, and
  reduced-motion navigation. Existing book tests remain separate and unchanged.
- Lint passes. Source TypeScript passes when stale generated `.next/types`
  validators are excluded; the normal full check still reports their existing
  missing `app/page.js`, `app/layout.js`, and suggestions route imports.

## Limitations before production adoption

1. **Render-loop cleanup:** installed 2.0.7's `PageFlip.destroy()` removes the
   UI/root and listeners, but `Render.start()` schedules a continuous RAF loop
   without retaining a cancellation ID or exposing a stop method. Calling the
   documented cleanup does not fully release that loop. Repeated mounting can
   accumulate background loops. Resolve upstream, use a maintained patched
   version, or isolate the engine in a disposable browsing context before
   production integration. The prototype does not monkey-patch global RAF.
2. Real controlled editors, focus, selection, live updates, saving, ownership,
   accessibility of hidden pages, and long-story overflow are not validated.
   Cloned pages here intentionally contain static samples only.
3. Keeping two pages on very narrow screens necessarily reduces their size.
   Mobile editor usability needs a separate layout decision.
4. No claim of Safari/Firefox compatibility or low-end GPU performance has
   been established by this experiment.

Sources: [official documentation](https://nodlik.github.io/StPageFlip/),
[PageFlip lifecycle](https://github.com/Nodlik/StPageFlip/blob/master/src/PageFlip.ts),
[render loop](https://github.com/Nodlik/StPageFlip/blob/master/src/Render/Render.ts).

Created: this route, component, stylesheet, report, and
`__tests__/pageFlipPrototype.test.ts`. Modified dependency manifests:
`package.json` and `package-lock.json`. The existing book, editor, and backend
were not modified by Phase 4C and remain the fallback.
