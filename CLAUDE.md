# eBay在庫・売上管理ツール — 説明書

このリポジトリは公開（public）。**パスワード、トークン、APIキーの値は絶対にここへ書かない。** 値はVercelの環境変数とPixelの `~/ebay-checker/.env` にだけある。

## 目的と今の使い方
- eBay輸出（ストア：kaikaido-japan）の在庫と売上を管理する、オーナー専用のツール。有料ツール「eShip」の必要な部分を自作したもの。
- 2026年11月時点：仕入れは止めていて、**手元の在庫を売り切る段階**。メルカリ在庫監視の対象は0件（商品の登録も0件。テスト行は2026-11-03に削除済み）。売上の記録と利益計算が主な用途。
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
- **仕入れ設定**（`app/page.tsx`、`components/procurement-settings-*.tsx`）：商品の登録、在庫状態、eBay数量。「︙」→「出品数を変える（再出品）」で数量を変更。
- **売上**（`components/sales-page.tsx`）：「eBayから取り込む」で直近90日の売れた注文を記録。年ごとの利益と、年20万円ラインまでの残りを表示。仕入れ値・国際送料は「直す」で手入力。
- **サイトマスタ**：仕入れ先サイトの定義。

### API（`app/api/`）
| パス | 役割 |
|---|---|
| `import-sales` | GetOrders（読み取り）で注文を `sales` に追加（既存の行は上書きしない）。続けて Finances API で手数料の実額を取り、推定値の行を置き換える |
| `ebay-quantity` | ReviseInventoryStatus で出品数を変える。0なら `mercari_status='hold'`、1以上なら `'active'`（監視再開） |
| `ebay-oos` | eBayの「在庫切れでも出品を残す」設定の確認（GET）とON（POST） |
| `ebay-oauth/start`, `callback` | Finances API用のeBayログイン許可。長期トークンは暗号化して `app_tokens` に保存。kaikaido-japan 以外で許可されたら保存しない |
| `login` | パスワードログイン（Cookie 180日） |

### パスワード保護
- `proxy.ts`（Next.js 16 で middleware から改名）が、未ログインなら `/login` に移動させる（APIは401）。
- 対象外：`/login`、`/api/login`、`/api/ebay-oauth/callback`、`/privacy`、静的ファイル。
- `APP_PASSWORD` が未設定のときは保護しない（締め出し防止）。パスワードを変えたら、再デプロイが必要で、全端末がログアウトされる。

## DB（Supabase）
- `procurement_settings`：商品1件ごと。`product_url`＝メルカリURL、`ebay_url`（ItemIDはここから `extractEbayItemId` で抽出）、仕入れ値・割引、`mercari_status`（`active`監視中／`sold_out`売切／`hold`手動停止）、`mercari_checked_at`、`ebay_quantity`。
  - `status`（`monitoring`/`stopped`/`error`）は画面用の別物。`mercari_status` と混同しない。
- `site_masters`：サイト定義と在庫判定キーワード。
- `sales`：売れた明細ごと。`line_item_id`（＝ItemID-TransactionID）が重複防止のキー。`fee_estimated=true` は手数料が推定値（13.25%＋$0.40）。
- `app_tokens`：暗号化したeBayの長期トークン。
- どの表もRLSは「誰でも読み書き可」のポリシー。anonキーは公開済みなので、DBは実質だれでも読み書きできる（既知の弱点。塞ぐならRLSを認証付きにする）。

## Vercelの環境変数（値はVercelにだけある）
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EBAY_USER_TOKEN`（Trading API用、2027年11月ごろ期限）, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RUNAME`, `TOKEN_ENC_KEY`（`app_tokens` の暗号鍵。変えると再連携が必要）, `APP_PASSWORD`。
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
- 売上3件（2026年8〜9月）の仕入れ値と国際送料が未入力。
- 「今すぐチェック」メニューは見た目だけで、中身は未実装。
- 今後の候補：ItemIDから商品情報を自動入力（GetItem）、送料の設定、CSVの入出力。
