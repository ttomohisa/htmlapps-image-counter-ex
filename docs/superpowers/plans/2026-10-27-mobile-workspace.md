# Mobile workspace polish implementation plan

**Goal:** Fix overlapping Project controls and make the phone inspector easier to navigate and scan.

**Architecture:** Keep the single canvas and existing inspector state. Group Project controls, use explicit text-button sizing instead of obsolete icon-only rules, and give the phone inspector a contextual bottom bar. The existing green palette, desktop split view, data model, model assets and offline packaging stay intact.

**Scope:** The user asked for mobile UI/UX improvement and supplied a screenshot. Implementation choices below are the agent's decisions within the user's standing authorization to proceed and deploy.

- [x] Reproduce the 32 px correction-button overflow at 390 px and measure the label bounds.
- [x] Add tests for the mobile inspector return action, guards, focus and unchanged saved data; implement them in the existing shell.
- [x] Give the inspector full-width tabs and a bottom Return to photo / Undo / Redo / Save bar. Keep counting/review actions in photo view.
- [x] Group current-photo review with its filename, totals, work name, collapsed display/correction and storage. Use 44 px minimum touch targets, readable text and safe wrapping.
- [x] Verify actual Japanese/English views at 320, 390 and 480 px, desktop 1360 px, short landscape, keyboard focus, modal close, photo switching, history and save access.
- [x] Update help and relevant documentation, build both single-HTML variants, run the repository check, review; deploy to GitHub Pages after the passing checks.

**Review focus:** Old selector specificity; focused controls becoming hidden on responsive transitions; active photo changing while the inspector is open; disabled controls during detection/import; collapsed sections remaining accessible at scroll end. Physical Android touch and direct-file-origin behavior require separate checks and must not be claimed from viewport tests.
