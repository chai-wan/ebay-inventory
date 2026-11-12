# eBay在庫・売上管理ツール — 説明書

このリポジトリは公開（public）。**パスワード、トークン、APIキーの値は絶対にここへ書かない。** 値はVercelの環境変数とPixelの `~/ebay-checker/.env` にだけある。

## 目的と今の使い方
- eBay輸出（ストア：kaikaido-japan）の在庫と売上を管理する、オーナー専用のツール。有料ツール「eShip」の必要な部分を自作したもの。
- 2026年11月時点：仕入れは止めていて、**手元の在庫を売り切る段階**。メルカリ在庫監視の対象は0件（テスト行は2026-11-03に削除済み。出品中の約27件を「有在庫」として取り込む予定）。売上の記録と利益計算が主な用途。
- 仕入れを再開するのは副業にあたるため、本人の会社への届出が先に必要。

## オーナーとの進め方
- 開発は初心者寄り。作業はスマホ（Pixel 7）中心。結論から短く、推測は推測と書く。
- Termuxで打ってもらうコマンドは1つずつ別のコードブロックにする（コピーボタンが全選択になるため）。
- eBayの出品に影響する操作（数量変更、取り下げ）は、実行前に影響を説明する。DBの削除は先にSELECTで中身を見せる。
- GitHub・Vercel・SupabaseはClaudeが直接操作できる（連携済み）。mainへのpushでVercelが自動で本番公開する。

## 構成
| 部分 | 中身 |
|---|---|
| 画面 | Next.js 16 + React 19 + Tailwind v4 + shadcn。Vercel：https://ebay-inventory-gamma.vercel.app |
| DB | Supabase（project id `taynokglupcedzslcqfv`） |
| 在庫監視 | Pixel 7 の Termux。毎朝3:00（JST）にcronで `termux/index.js` を実行 |
| eBay | Trading API（XML、Auth'n'Authトークン）と、Finances API（OAuth） |

### タブ
- **仕入れ設定**（`app/page.tsx`、`components/procurement-settings-*.tsx`）：商品の登録、在庫状態、eBay数量。「︙」→「出品数を変える（再出品）」で数量を変更。「eBayから出品中の商品を取り込む」で、出品中の商品を仕入れ先「有在庫」（表示名。2026-11-03に「手持ち在庫」から変更、`site_name='stock'`、仕入URLなし、`mercari_status='hold'`、`status='stopped'`）として一括登録（ItemIDで重複除外）。仕入れ値を入れておくと、売れたときに売上へ自動で入る。
- **売上**（`components/sales-page.tsx`）：毎朝5時ごろ（JST）に直近30日の注文を自動で取り込む。「eBayから取り込む」ボタンなら直近90日。最後の取り込み結果を画面上部に表示。「CSVで保存」で年ごとの確定申告用CSV（BOM付き）を出せる。年ごとの利益と、年20万円ラインまでの残りを表示。仕入れ値・国際送料は「直す」で手入力。
- **リサーチ**（`components/research-page.tsx`、2026-11-09〜）：自分用テラピーク。日本のセラーとカテゴリの出品（日本発送・$150〜400）を記録し、売れた数を調べて「型番ごと」（`research_candidates` ビュー、推定の月間販売数順）と「売れた出品（型番なしも）」で表示。仕入れ上限（目標利益を残せる仕入れ値、送料3,000円と仮定）と、メルカリ売り切れ・販売中、ヤフオク落札、eBay落札へのリンク付き。
- **サイトマスタ**：仕入れ先サイトの定義。

### API（`app/api/`）
| パス | 役割 |
|---|---|
| `import-sales` | POST＝画面のボタン、GET＝Vercelの定時実行（`vercel.json` の crons、UTC 20:00。`CRON_SECRET` で確認し、`proxy.ts` もこれだけ通す）。GetOrders（読み取り）で注文を `sales` に追加（既存の行は上書きしない）。続けて Finances API で手数料の実額を取り、推定値の行を置き換える。結果は `app_tokens` の `last_import` に残す |
| `ebay-quantity` | ReviseInventoryStatus で出品数を変える。0なら `mercari_status='hold'`、1以上なら `'active'`（監視再開） |
| `import-listings` | GetMyeBaySelling（ActiveList、読み取り）で出品中の商品を取得し、未登録のものだけ `procurement_settings` に追加 |
| `ebay-oos` | eBayの「在庫切れでも出品を残す」設定の確認（GET）とON（POST） |
| `ebay-oauth/start`, `callback` | Finances API用のeBayログイン許可。長期トークンは暗号化して `app_tokens` に保存。kaikaido-japan 以外で許可されたら保存しない |
| `research/step` | リサーチの1回分（`lib/research.ts`）。GET＝Supabaseのpg_cron（15分ごと、`research-step`、pg_netでCRON_SECRET付き。秘密はVaultの `research_cron_secret`）、POST＝画面の「今すぐ1回進める」。前半25秒で対象1つをBrowse APIで記録（続きは `cursor_offset`、セラーは最大5,000件、カテゴリは新しい順1,000件、一周は20時間ごと）、後半で最大40件をGetItemで確認（売れた数・出品日・状態）。セラーの一周で出てこなかった出品は `gone_since` を付けてGetItemで売れたか確かめる。1日のGetItemは約3,840回（上限5,000）。結果は `app_tokens` の `research_last` |
| `research/test`, `research/browse`, `research/sellers` | 検証用の入口（2026-11-09）。GetSellerListは他人を指定しても自分の出品を返す（他のセラーには使えない）。GetItemは他のセラーの売れた数・出品日を返す |
| `login` | パスワードログイン（Cookie 180日） |

### パスワード保護
- `proxy.ts`（Next.js 16 で middleware から改名）が、未ログインなら `/login` に移動させる（APIは401）。
- 対象外：`/login`、`/api/login`、`/api/ebay-oauth/callback`、`/privacy`、静的ファイル。
- `APP_PASSWORD` が未設定のときは保護しない（締め出し防止）。パスワードを変えたら、再デプロイが必要で、全端末がログアウトされる。

### 送料と利益の計算（2026-11-03）
- 発送は **eBay SpeedPAK Japan – Ship via FedEx**（Orange Connex。オーナーは「CPaSS」と呼ぶことがある）の International Connect Plus。
- `lib/shipping.ts`：料金表（RATE GUIDE 2026、発効 2026-10-23）のアメリカ西部（Zone E）と東部・カナダ（Zone F）の基本料金を0.5〜68kgで持つ。課金重量＝実重量と寸法重量（L×W×H÷5000、cmは切り上げ）の大きい方を、表の次の段に切り上げ。燃料割増金は率で上乗せ。料金表が改定されたら表を差し替える。
- `lib/pricing.ts`：利益＝(売値＋買い手送料)×(1−eBay手数料%)×(1−受取手数料%)×為替 − 売値×為替×関税% − 仕入れ − 送料 − その他。目標利益に必要な売値も計算。
- 送料の表は2026-11-03に料金表の画像と18行（0.5〜68kg、全3ページ）突き合わせて一致を確認済み。燃料割増金のほか、混雑時割増金・非標準梱包（770円/個）などは計算に入っていない。個人宅配達料と地域外配達料はConnect Plusでは無料（主要地域）。
- 設定（eBay手数料%、受取%、燃料%、関税%、地域、目標利益）は「仕入れ設定」の「計算の設定」で変更し、`app_tokens` の `pricing_settings` に保存。既定値：手数料18%（これまでの実額から）、燃料64%（2026-11-09変更。9月の請求でサーチャージ＝燃料＋混雑時割増金が運送料金の約64%。DBにも保存済み）、関税13%（2025-10-17から日本→米国$2,500未満はDDP必須でセラー負担。2026-07-24から日本原産品はMFN＋Section 301で合計12.5%、これに関税処理手数料2.1%。出典 ebay.co.jp/tariffs、ebay.co.jp/ddp-info）。
- 商品の登録・編集で重さとサイズを入れると、送料¥が自動で入り、利益と「目標利益に必要な売値」が出る。`procurement_settings` に `weight_kg`, `length_cm`, `width_cm`, `height_cm`。一覧の利益も同じ計算（以前はeBay手数料を引いていなかった）。

## DB（Supabase）
- `procurement_settings`：商品1件ごと。`product_url`＝メルカリURL、`ebay_url`（ItemIDはここから `extractEbayItemId` で抽出）、仕入れ値・割引、`mercari_status`（`active`監視中／`sold_out`売切／`hold`手動停止）、`mercari_checked_at`、`ebay_quantity`、`search_keyword`（一覧の「安い順」リンク＝`https://www.ebay.com/sch/i.html?_nkw=検索語&_sop=15` 用。2026-11-10に27件をClaudeが作成。取り込み時と手入力時は `lib/model.ts` の `keywordFromTitle`＝先頭の語（Vintage等は飛ばす）＋型番で自動、型番が取れなければ空）。`lowest_*`（最安値。`lib/lowest.ts` がリサーチの15分ごとの処理の最初に6件ずつ、各商品20時間ごとに、Browse APIで検索語・即決・米国発送可を調べ、自分以外で部品取り等を除き、検索語に型番があればタイトルに型番を含むものだけから、本体＋送料の最安を記録。一覧に「最安 $◯◯」と自分との差を表示。2026-11-11〜、表示のみで価格は変えない）。
  - 画面の在庫バッジ：`site_name='stock'` は「有在庫」、それ以外は `active`＝「無在庫（監視中）」、`sold_out`＝「仕入れ先で売り切れ」、`hold`＝「監視停止」。
  - `status`（`monitoring`/`stopped`/`error`）は古い仕組みの名残りで、2026-11-03に画面から外した（列は残っているが、どこからも使っていない）。
  - 有在庫の行は監視しない：`ebay-quantity` は `hold` のまま、Pixelの処理も `site_name='stock'` と仕入URLが空の行を除外する。
- `site_masters`：サイト定義と在庫判定キーワード。
- `sales`：売れた明細ごと。`line_item_id`（＝ItemID-TransactionID）が重複防止のキー。`fee_estimated=true` は手数料が推定値（13.25%＋$0.40）。
- `app_tokens`：暗号化したeBayの長期トークンのほか、`last_import`、`pricing_settings`、`research_last` など。
- `research_sources`：リサーチの対象（2026-11-09時点：生きているセラー14人＝seller参考56人をBrowse APIで判定、＋カテゴリ 54968 ゲーム周辺機器・15230 フィルムカメラ・15052 ポータブルオーディオ。カテゴリは中古のみ）。
- `research_items`：記録した出品（型番は `extractModel` でタイトルから抜き出し。セラー88.japan.sellerは一点物の限定グッズが多く、型番が取れるのは4%ほど）。
- `kobutsu_ledger`：古物台帳（2026-11-11〜）。オーナーのExcel「古物台帳」シートと同じ25列（受入れ15・払出し10、定義は `lib/ledger.ts`）。Excelの228件を `origin='excel'`（`excel_row`＝元の行番号）で取り込み済み。**行は削除できない**（DELETE/TRUNCATEはトリガーで例外、RLSも削除ポリシーなし）。自動連携：`procurement_settings` に行が追加されると受入れ1行（`origin='auto'`、メモが「eBayから取り込み」の行と、仕入れ値0かつ仕入URLなしの行は除外）。`sales` に行が追加されると、同じItemIDで払出しのない一番古い受入れ行に売却を記入（`sale_line_item_id`）。画面は「台帳」タブ（`components/ledger-page.tsx`、直す・行を追加・Excelで保存）。Excel出力は `app/api/ledger/export`（exceljs）。**月1バックアップ**：非公開リポジトリ `chai-wan/ebay-ledger-backup` のGitHub Actions（`.github/workflows/backup.yml`、毎月1日 9:07 JST、`run-now.txt` を変えてpushしても実行）が、`LEDGER_BACKUP_SECRET` 付きで `/api/ledger/export` を取り、`backups/kobutsu-ledger-日付.xlsx` と `backups/log.md`（日付と行数）を保存。`proxy.ts` はこの合言葉のときだけ export を通す。オーナーが「台帳のバックアップ出して」と言ったら、そのリポジトリから最新のファイルを渡す。2026-11-12に動作確認済み（228行）。
- **DBの鍵（2026-11-11〜）**：どの表もRLSは `gate_all`＝`db_gate_ok()` が真のときだけ読み書き可。`db_gate_ok()` はリクエストの `x-db-gate` ヘッダーをVaultの `db_gate_secret` と照合する（値はVercelの `DB_GATE_SECRET` と同じ）。画面（`lib/supabase.ts`）は自サイトの `/api/sb/rest/v1/...`（`app/api/sb/[...path]/route.ts`、ログイン必須）経由で、サーバー側がヘッダーを付けて中継。APIや定時処理は `lib/supabase-server.ts` の `serverSupabase()`。合言葉なしのanonキーでは0件・書き込み不可。新しい表を作るときも同じ `gate_all` ポリシーを付けること。
- Termuxで在庫監視を再開するときは、Pixelの `~/ebay-checker/.env` に `DB_GATE_SECRET=（Vercelと同じ値）` を足す必要がある（ないとDBが0件に見える）。

## Vercelの環境変数（値はVercelにだけある）
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EBAY_USER_TOKEN`（Trading API用、2027年11月ごろ期限）, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RUNAME`, `TOKEN_ENC_KEY`（`app_tokens` の暗号鍵。変えると再連携が必要）, `APP_PASSWORD`, `CRON_SECRET`（定時実行の合言葉）, `DB_GATE_SECRET`（DBの合言葉。SupabaseのVault `db_gate_secret` と同じ値。変えるなら両方）, `LEDGER_BACKUP_SECRET`（台帳バックアップの合言葉。`ebay-ledger-backup` のActionsのSecretsと同じ値。変えるなら両方）。
Vercelは無料（Hobby）プラン。定時実行は1日1回・アカウント全体で2つまで、実行時刻は指定した1時間のどこかになる。
環境変数を変えたら、空コミットのpushなどで再デプロイしないと反映されない。

## Pixel（Termux）側
- 場所：`~/ebay-checker`（`index.js`、`.env`、`logs/`）。`.env` に `EBAY_AUTH_TOKEN` などがある。
- 更新方法：リポジトリの `termux/index.js` を直接取ってくる。
  `curl -fsSL -o ~/ebay-checker/index.js https://raw.githubusercontent.com/chai-wan/ebay-inventory/main/termux/index.js`
  前に `cp index.js index.js.bak2` でバックアップ。`node --check` で確認。
- cron：`0 3 * * * cd ~/ebay-checker && node index.js >> logs/cron.log 2>&1`（run.sh 経由ではないので完了通知は出ない）。
- `~/.bashrc` で、Termuxを開くと crond と wake-lock が自動でかかる。**Termuxが落とされると止まる**（2026年6月20日〜11月3日は止まっていた）。再起動後はTermuxを1回開く必要がある（Termux:Bootは未導入）。
- 処理：`mercari_status='active'` の商品をPuppeteerで開いて判定 → 売り切れなら eBay数量を0（出品は残る）→ DB更新。
- メルカリの知見：SPAなので fetch では判定できない。`waitUntil: "domcontentloaded"` 必須（networkidle2 は終わらない）。ブロックは image と media だけ（CSSやフォントを止めると描画されない）。Chromiumは `/data/data/com.termux/files/usr/bin/chromium-browser`。米国のサーバーからはメルカリに弾かれるので、Pixel（日本のモバイル回線）で動かしている。

## つまずいた点
- eBayの「アカウント明細」（GetAccount）には手数料の本体が載らず、実額より大幅に少なくなる。手数料は Finances API で取る。
- GetOrders は手数料（FinalValueFee）を返さなかった。
- eBay開発者サイトは、VercelのURLをプライバシーポリシーとして受け付けない。GitHub Pages（`docs/privacy.html` → https://chai-wan.github.io/ebay-inventory/privacy.html）で登録済み。
- Vercel Hobbyのランタイムログは1時間しか残らない。
- この作業環境からは vercel.app・supabase.co・ebay.com に直接アクセスできない。確認は Vercel／Supabase の連携ツールか、オーナーの画面で行う。
- 2026年6月まであった Vercel側の古い在庫チェック（毎朝9時、fetchで誤判定してEndItem）は削除済み。

## 残っていること
- 2026-11-07：オーナーの古物台帳（Excel、2023-02〜2026-02の仕入れ228件、2026年5月ごろから更新停止）から、出品中26件と売上2件（TASCAM GB-10 11,000円、Victor JX-53 4,350円）の仕入れ値を入れた（メモ欄に「古物台帳から」）。ガンダムの画集は台帳になく未入力。国際送料はまだ全件未入力。
- 実際のSpeedPAK（オーナーは「CPaSS」と呼ぶ）の請求は、関税込みで1件6,000〜9,000円の印象（オーナー談、主にオーディオ機器のころ）。請求の内訳（重さ・サイズ・基本料金・燃料・関税）で計算の答え合わせが必要。
- **2026-11-09 進行中**：Victor JX-53（追跡番号 877812689444、注文番号 EM1013104056108FE06020103A0N、eBay注文 06-15224-18397）の関税22,158円（推定2,125円、差額20,453円が請求書 OCLUSTAXJPY0205182 で追加請求）について、オーナーが cs.jp@orangeconnex.com へ再確認のメールを送信済み。返事が来たら続きを対応する。電話は 0800-100-3671（月〜土 9〜18時）。
- **2026-11-09**：燃料割増金の設定を64%に（DBの `pricing_settings` とコードの既定値の両方）。リサーチは結果がたまるのを待つ段階。定期タスク「在庫ツール リサーチ報告」（水・日 19:47 JST、通知あり）で報告が届く。
- 2026-11-09にオーナーから2026年10月分の請求ファイル2つ（InvoiceDetails、DutyTax_DETAILS）を受領。どちらも調整分のみで、元の請求は入っていなかった。分かったこと：関税は「推定関税（12.5%）＋推定関税処理手数料（その2.1%）」をラベル作成時に引き、あとで実額に調整される。ガンダムの画集（$60）は推定1,181円→実額1,207円（約12.7%）で設定の13%と合う。Victor JX-53（$108）は推定2,125円→実額22,158円＋手数料465円（売値の約130%。申告額の桁違いなどの誤りの可能性、推測）。送料の調整1件で、運送料金−239円に対し燃料割増金−192円・混雑時割増金−121円（基本料金に対して燃料約80%・混雑約51%の比率の可能性。元の請求で要確認）。
- 「今すぐチェック」メニューは見た目だけで、中身は未実装。
- 無在庫のおすすめリスト（検討中）：eBayの売れた履歴はAPIで取れない（Finding API は2025-02に終了、Marketplace Insights は審査制）。アメリカ向けの最安値（Browse API）とメルカリの価格（Pixelで取得）、SpeedPAKの送料で利益を比べる案。
- 目利きの自動化：2026-11-09に「リサーチ」タブとして実装済み（上記）。残り：メルカリの売り切れ価格をPixelで自動取得して利益順に並べる、対象カテゴリの見直し（オーナーは軽くて小さい中古・日本限定の未使用品が狙い。量販の新品は狙わない）。
- 値下げ案の表示は、2026-11-11にオーナーが「一旦不要」と判断（一覧の最安値と利益を目で見れば足りるため）。
- 今後の候補：ItemIDから商品情報を自動入力（GetItem）、送料の設定。
