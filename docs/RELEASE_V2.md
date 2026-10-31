# v2.0.0 リリース確認

リリース番号は2.0.0。バージョン更新と正式リリースの受け入れ確認を区別する。

## 確認済み

- dev.22の全体回帰テスト4,466件、単一HTMLの生成、Pages公開。
- ブラウザー上で見本登録、検出、確認解除、Undo、ブラウザー内の自動保存からの再開。
- PCおよび320/390px幅の表示。通常版と自己展開版のHTTP起動。
- ライセンス・ソースコード・ビルド情報の保護チェック。

## 正式公開前の受け入れ確認

- [ ] Android Chromeで実際の写真を2〜3枚追加。見本登録、ピンチ、枠の移動・サイズ変更・選択削除、見本保存を試す。
- [ ] 同じ見本で全写真を検出し、停止、再実行、要確認の解除、修正、Undoを確認する。
- [ ] 作業をHTMLとして保存し、アプリの「作業を開く」で再開。写真、見本、個数、要確認の状態が戻ることを確認する。自動保存からの再開とは別に確認する。
- [ ] 配布する通常版・自己展開版をダウンロードし、PCとAndroidで通信を切って起動・検出する。HTTP上の動作確認をfile://の確認として扱わない。端末で開けない場合は再現条件を記録し、修正または対応範囲を明記してから公開する。
- [ ] 確認したコミットから最終ビルド・必須チェックを実行し、v2.0.0タグ、GitHub Release、配布HTML2種類とSHA-256を公開する。Releaseノートに対応環境と確認できていない制限を書く。

不具合が出なければ、追加機能を増やす必要はない。配布内容と同じv2.0.0のファイルで確認する。

## English

Version 2.0.0 is prepared; the formal release tag is pending acceptance. Validate current workflows on physical Android Chrome, exported-work HTML reimport, and disconnected direct-file startup/detection of both distributable variants on PC and Android. Then build and verify the accepted commit, publish tag v2.0.0 and a GitHub Release with both HTML files and SHA-256 checksums. Existing viewport and HTTP tests do not establish physical touch or file-origin behavior.

## バージョン更新後の検証記録（2026-11-01）

- 2.0.0への更新後、通常ビルドと必須リポジトリチェックが終了コード0。4,466件成功、失敗0。ヘルプと単一HTMLの検証も成功。
- `dist/index.html`、`dist/index.self-extract.html`、`dist/SHA256SUMS.txt`を用意。公開ページはdev.22を維持し、リリースタグとGitHub Releaseはまだ発行していない。
