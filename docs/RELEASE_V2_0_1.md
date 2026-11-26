# Image Counter EX / 画像カウンター EX v2.0.1

## 日本語

- 作業の保存前にデータを検証し、読み込み時は全写真のデコードを確認してから現在の作業を置き換えるようにしました。
- 任意の画像圧縮が失敗するか容量が増える場合、元画像を残します。ページが非表示になった際に保留中の自動保存を開始しますが、ブラウザー終了時の保存完了は保証できません。
- 矩形リサイズ時の反対側の角のずれ、強調表示の多重描画、マーカー番号計算、画像キャッシュを改善しました。
- 手動追加時のマーカー表示、種類削除後の完了状態、キーボード操作のUndoと自動保存、閲覧HTMLの要確認表示を修正しました。

## English

- Validate saved data and decode every imported photo before replacing existing work.
- Retain original images when optional compression fails or increases size. Start pending autosave on page hide; browser shutdown can still interrupt it.
- Preserve the opposite rectangle corner during resizing, prevent duplicate highlight frames, and improve numbering and image-cache handling.
- Fix visibility of newly added manual markers, completion after type deletion, keyboard Undo/autosave, and pending-review status in exported viewers.

## 配布 / Downloads

- `index.html`: 通常版 / readable standalone
- `index.self-extract.html`: 自己展開版 / self-extracting standalone
- `SHA256SUMS.txt`: SHA-256 checksums

## 検証状況 / Verification

- 2026-11-25: commit `8a8153254747f3ef24fa6a77697bef907601bd8e` passed the existing full repository check (4,502 test executions, 0 failures, 0 skips), preview build and release asset preparation. [CI log](https://github.com/ttomohisa/htmlapps-image-counter-ex/actions/runs/45622424226).
- 上記コミットで既存の全検査4,502件、プレビュービルド、リリース成果物の準備が成功。追加したオフラインChromiumテストについては下記の追調査結果を参照してください。
- New headless Chromium direct-file smoke checks run in the release preparation workflow; physical-device checks remain separate.

公開ワークフローは配布HTMLの整合性を含む既存の全リポジトリ検査に成功したコミットだけを公開します。物理端末のタッチ操作、手動で通信を切った状態での直接ファイル起動とAI検出、端末間の作業HTML再読み込みは未確認です。自動テストは実機確認の代わりではありません。

The publication workflow requires the existing full repository check, including standalone parity. Physical touch, manual disconnected file-origin startup and detection on physical devices, and cross-device work-file reimport have not been verified. Automated tests do not replace device checks.

- [ ] PC / smartphone and Japanese / English UI
- [ ] Physical Android Chrome: add photos, reference boxes, pinch, resize, detection, review and Undo
- [ ] Save and reopen work HTML; restore autosaved work
- [ ] Open both release HTML variants directly with networking disabled; run detection
- [ ] Monitor runtime network activity

モデル、依存ライブラリ、保存スキーマ、CSP、ライセンスは変更していません。GNU AGPL v3。対応するソースはリリースタグから取得できます。AI検出結果は目視で確認し、大切な作業はHTMLにも保存してください。

Model, dependencies, saved-project schema, CSP and license are unchanged. GNU AGPL v3; corresponding source is available from the release tag. Review AI results and save important work as HTML.


### Direct-file inference follow-up / ローカルHTMLのAI検出

- The previous Windows Chromium smoke check reproduced a bootstrap Worker error (no Worker message before the error). A classic Blob Worker now imports the embedded runtime from a Worker-owned Blob URL; the embedded model, WASM, versions and CSP are unchanged. Both regenerated HTML variants passed actual offline file-origin detection on Windows Chromium 141: 20 markers added and zero errors in 2.1 s / 2.2 s respectively. Autosave, export/import, and 320/390px JA/EN checks passed.
- Windows Chromiumの直接ファイル検査でWorker起動時のエラーを再現。通常のBlob Workerに変更し、Worker内で内蔵ランタイムを読み込みます。モデル・WASM・バージョン・CSPは変更なし。再生成した両HTML版でWindows Chromium 141のオフライン直接起動・AI検出に成功（通常版2.1秒、自己展開版2.2秒、各20件追加・エラー0件）。自動保存、書き出し・再読み込み、320/390pxの日英表示も成功しました。

[2026-11-26 offline browser verification / 実ブラウザー検証](https://github.com/ttomohisa/htmlapps-image-counter-ex/actions/runs/45763590088) (generated alias commit `9310433def13a29d213f711de615a02054d626c6`; browser check commit `82f3e14dc36f213047b4fdc4431d6d9e46666b00`). Timings are observations from one CI sample, not performance guarantees. 物理端末での検証は別途必要です。
