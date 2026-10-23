# Batch reuse and work saving implementation plan

> **For agentic workers:** Use subagent-driven-development for the two independent implementation tasks.

**Goal:** Reuse detection setup within a photo batch and make portable work saving/reopening clear.
**Architecture:** Keep one worker, model session and visual prompt per quick run, then dispose them. Keep schema 4 HTML work exports and browser autosave, clarify their scope and add opening during editing.
**Tech Stack:** Single HTML, vanilla JavaScript, embedded ONNX Runtime, Node tests, PowerShell build.
**Spec:** APP_SPEC.md; approved request for recommendations ③ and ④.

## Global constraints
- One HTML release; no runtime network, new model, dependency or saved schema.
- Japanese/English, keyboard focus, 320/390 px support.
- Preserve atomic replacement, whole-batch Undo, stale-result ownership and user edits.

## Review focus
- Cancel during initialization/bitmap decode releases late resources; new run cannot receive old results.
- Invalid target is skipped without compromising reusable setup; runtime failure stops safely.
- Invalid model outputs never erase prior detections.
- Invalid/cancelled work opening retains current work, and delayed imports cannot replace a newer project.
- Saving captures a consistent snapshot and filename; viewer and editable-app behavior remain clear.

## Tasks
- [x] Runtime: extend production-bound tests in test-auto-detection.cjs and test-quick-detection.cjs for setup reuse and disposal. Observe failures, implement AUTO engine helpers and QUICK runner, run focused tests.
- [x] Save/open: extend focused import/export tests for current-work protection and snapshot behavior. Implement HTML/I18N/handlers/help; run focused tests.
- [x] Integration: compare identical six-photo input on baseline and revised build, including marker geometry and elapsed UI report. Update spec/architecture/readmes/changelog/version and validation notes.
- [x] Release preparation: run build and check-repository.ps1; verify desktop/mobile UI, save/reopen, cancellation, language and browser logs; complete independent review.

Publish the verified commit to the user-authorized main/Pages destination, then confirm workflow success and the live version.
