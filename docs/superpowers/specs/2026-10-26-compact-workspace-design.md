# Compact photo workspace and concise Help

The user finds both desktop and mobile interfaces too tall, difficult and unattractive. Make the photograph the primary working surface and simplify Help. Preserve license/source/build information exactly. Model alternatives are a separate research answer; do not change inference or model assets in this UI release.

## Approach

CSS spacing reductions alone leave seven stacked sections before the photograph. Full-screen modal settings would complicate nested native dialogs and detection guards. The chosen implementation approach is a bounded canvas workspace with one nonmodal inspector: Photos / Detection / Project. This is the builder's design choice under the user's request to improve the UI, not a separate user selection.

- Desktop: compact app header, photograph toolbar and status, large canvas, 300px inspector at the right. Inspector content scrolls independently; panels switch rather than stack. Support closing/reopening the inspector.
- Mobile: the same photo-first canvas with compact controls. Opening the inspector temporarily replaces the canvas working area, with an obvious Return to photo action and three panel selectors. It must not expand a settings stack above the photo. Keep it nonmodal so existing native dialogs and quick detection guards retain their behavior.
- Preserve the deep-green identity; reduce nested cards, strong borders, unnecessary labels and repeated status. Keep legible type, comfortable touch targets and accessible labels. Do not solve density by shrinking everything.
- Photos inspector owns the status filter, matched count, list-only detection, thumbnails and photo-add/remove/next-incomplete controls. Previous/Next remain accessible beside the current photo. The excluded-current notice remains visible in canvas mode too.
- Detection inspector owns pinned-example setup, region selection, rerun behavior and current/all detection. Current-photo detection must also be a direct canvas-toolbar action, visibly unavailable without a reference. Setup remains discoverable from the same area.
- Project inspector owns title, totals, type management, display/storage settings. Save remains directly reachable outside the inspector. Preserve canvas category dock, memo, marker popovers and review selection. Ordinary Complete and Review complete & next retain their distinct semantics.
- Review has one compact context row; selection actions are visible when meaningful. Brief mode guidance may be visually secondary/collapsed, with full instructions in Help. Keep all operations available in both languages.

## State and accessibility

Inspector open/selected panel is transient, project-owned and never serialized. Reset on accepted project replacement; keep ordinary same-project edits and language changes stable. Cancel unfinished marker gestures before any layout transition or responsive change, so transforms cannot shift mid-edit. Do not recreate the cached canvas/stage or duplicate IDs. Keep quick progress and Stop outside inert workspace roots. New controls obey busy/import/modal guards. Repair focus only when its old owner becomes hidden, without stealing focus from another modal/control. Native dialogs launched inside an inspector must be able to close back to visible controls after resize; save stays reachable. Escape closes the inspector only when no native dialog/editor/input owns Escape. Keyboard tabs and panel selector keys must work.

## Acceptance

- In a normal photo project at 1360×900, canvas begins within approximately the top 220 CSS pixels and occupies at least 55% of viewport height. No document-level vertical scroll is needed for the normal counting workspace; inspector scroll is allowed.
- At 390×844 and 320×740, canvas begins within approximately the top 260 CSS pixels, remains usefully tall, and all essential controls fit without horizontal document overflow. Inspector view and memo may scroll within their bounded surfaces; short/landscape screens may scroll where necessary to preserve usable controls.
- Switching modes, filters, photos, inspection panels, desktop/mobile widths and languages must retain correct photo/marker state, Undo, gestures and focus. Current/list/all detection, region editing and export/restore must keep their existing scope.
- Help initially shows three clear steps and four short essential cautions. Optional practical tips are collapsed. License/source markup and dynamic build section remain byte-for-byte intact; preserve existing responsive behavior.
- Keep offline single-readable/self-extract HTML, restrictive CSP, embedded model and dependencies, schema 4 and all existing safeguards. Verify actual layouts/screenshots and relevant behavior, then the required repository matrix and Pages deployment. Report physical Android and file-origin limits honestly.
