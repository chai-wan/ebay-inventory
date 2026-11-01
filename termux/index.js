/**
 * Mercari → eBay 在庫同期バッチ（Pixel 7 / Termux）
 * 処理: Supabase → Puppeteer(メルカリ在庫判定) → eBay API(出品数を0) → Supabase更新
 *
 * 売り切れのとき、出品を「終了」せず「数量0」にする（③）。
 * eBayの「在庫切れでも出品を残す」設定がONなら、出品はItemIDのまま残り、
 * アプリの「出品数を変える」で1以上に戻せば再出品される。
 * ※ 設定がOFFだと、数量0で出品は終了する（以前のEndItemと同じ結果）。
 *
 * 参照テーブル: procurement_settings
 *   product_url        = メルカリURL（仕入URL）
 *   ebay_url           = eBay出品URL（ここからItemIDを抽出）
 *   ebay_product_name  = 商品名（ログ表示用）
 *   mercari_status     = 'active'(監視中) / 'sold_out'(売切) / 'hold'(手動で停止)
 *   mercari_checked_at = 最終チェック日時
 *   ebay_quantity      = eBayの出品数
 *
 * 秘密の値は ~/ebay-checker/.env に置く（このファイルには書かない）。
 */

const puppeteer = require("puppeteer-core");
const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const fs = require("fs");
const path = require("path");

// .env ファイルがあれば読み込み（dotenv不要の簡易実装）
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .forEach((l) => {
      const [key, ...val] = l.split("=");
      if (key && val.length) process.env[key.trim()] = val.join("=").trim();
    });
}

// ============================================================
// 設定
// ============================================================
const CONFIG = {
  supabase: {
    url: "https://taynokglupcedzslcqfv.supabase.co",
    anonKey: "sb_publishable_UDI6Y7g38CnYgTiurUO4OQ_Kjo5bAyD",
  },
  chromium: {
    executablePath: "/data/data/com.termux/files/usr/bin/chromium-browser",
  },
  ebay: {
    endpoint: "https://api.ebay.com/ws/api.dll",
    authToken: process.env.EBAY_AUTH_TOKEN || "",
    devId: process.env.EBAY_DEV_ID || "",
    appId: process.env.EBAY_APP_ID || "",
    certId: process.env.EBAY_CERT_ID || "",
  },
  pageTimeout: 30000,
  // 商品間のランダム待機(ms) — Bot検知対策
  minDelay: 3000,
  maxDelay: 7000,
};

// ============================================================
// ログ
// ============================================================
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logFile = path.join(LOG_DIR, `run_${new Date().toISOString().slice(0, 10)}.log`);

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + "\n");
}

// ============================================================
// Supabase
// ============================================================
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

async function fetchActiveListings() {
  const { data, error } = await supabase
    .from("procurement_settings")
    .select("id, product_url, ebay_url, ebay_product_name, mercari_status")
    .not("product_url", "is", null)
    .eq("mercari_status", "active");
  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return data || [];
}

async function updateRow(id, fields) {
  const { error } = await supabase.from("procurement_settings").update(fields).eq("id", id);
  if (error) throw new Error(`Supabase update error: ${error.message}`);
}

// ============================================================
// eBay URL から ItemID を抽出
// ============================================================
function extractItemId(ebayUrl) {
  if (!ebayUrl || typeof ebayUrl !== "string") return null;
  const m = ebayUrl.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/);
  if (m) return m[1];
  const nums = ebayUrl.match(/\d{9,15}/g);
  if (nums && nums.length) return nums.sort((a, b) => b.length - a.length)[0];
  return null;
}

// ============================================================
// メルカリ在庫判定 (Puppeteer)
// ============================================================
async function checkMercariStock(page, url) {
  try {
    // networkidle2はメルカリSPAでは永久に完了しないためdomcontentloadedを使用
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    try {
      await page.waitForFunction(
        () => {
          const body = document.body?.innerText || "";
          return (
            body.includes("購入手続きへ") ||
            body.includes("ログイン / 会員登録して購入") ||
            document.querySelector('[aria-label="売り切れ"]') !== null ||
            body.includes("売り切れ") ||
            body.includes("SOLD") ||
            body.includes("この商品は存在しません")
          );
        },
        { timeout: 20000 }
      );
    } catch {
      log("WARN", `waitForFunction timed out: ${url}`);
    }

    return await page.evaluate(() => {
      const body = document.body?.innerText || "";
      if (body.includes("購入手続きへ") || body.includes("ログイン / 会員登録して購入")) {
        return "in_stock";
      }
      if (
        document.querySelector('[aria-label="売り切れ"]') !== null ||
        body.includes("売り切れ") ||
        body.includes("SOLD")
      ) {
        return "sold_out";
      }
      if (body.includes("この商品は存在しません") || body.includes("ページが見つかりません")) {
        return "sold_out";
      }
      return "unknown";
    });
  } catch (err) {
    log("ERROR", `checkMercariStock failed for ${url}: ${err.message}`);
    return "error";
  }
}

// ============================================================
// eBay 出品数を0にする (Trading API / ReviseInventoryStatus)
// ============================================================
function setEbayQuantityZero(itemId) {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${CONFIG.ebay.authToken}</eBayAuthToken>
  </RequesterCredentials>
  <InventoryStatus>
    <ItemID>${itemId}</ItemID>
    <Quantity>0</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.ebay.endpoint);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
          "X-EBAY-API-CALL-NAME": "ReviseInventoryStatus",
          "X-EBAY-API-SITEID": "0",
          "X-EBAY-API-DEV-NAME": CONFIG.ebay.devId,
          "X-EBAY-API-APP-NAME": CONFIG.ebay.appId,
          "X-EBAY-API-CERT-NAME": CONFIG.ebay.certId,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (body.includes("<Ack>Success</Ack>") || body.includes("<Ack>Warning</Ack>")) {
            resolve({ success: true });
          } else if (body.includes("1047") || body.includes("already been closed")) {
            log("WARN", `eBay item ${itemId} already ended`);
            resolve({ success: true, alreadyEnded: true });
          } else {
            reject(new Error(`ReviseInventoryStatus failed: ${body.slice(0, 500)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(xmlBody);
    req.end();
  });
}

// ============================================================
// ユーティリティ
// ============================================================
function randomDelay() {
  const ms = Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay)) + CONFIG.minDelay;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// メイン処理
// ============================================================
async function main() {
  log("INFO", "=== バッチ開始 ===");
  let browser = null;

  try {
    const listings = await fetchActiveListings();
    log("INFO", `監視対象: ${listings.length} 件`);
    if (listings.length === 0) {
      log("INFO", "結果: 全0件 / 売切0件 / エラー0件");
      process.exit(0);
    }

    browser = await puppeteer.launch({
      executablePath: CONFIG.chromium.executablePath,
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-extensions",
        "--user-agent=Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915, isMobile: true });

    // 画像と動画のみブロック（stylesheet/fontをブロックするとSPAが描画されない）
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media"].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    let soldOutCount = 0;
    let errorCount = 0;

    for (const item of listings) {
      const name = item.ebay_product_name || item.id;
      log("INFO", `チェック中: ${name} → ${item.product_url}`);

      const status = await checkMercariStock(page, item.product_url);
      const now = new Date().toISOString();

      if (status === "sold_out") {
        log("INFO", `★ 売り切れ検知: ${name}`);
        soldOutCount++;

        const itemId = extractItemId(item.ebay_url);
        let zeroed = false;
        if (itemId) {
          try {
            await setEbayQuantityZero(itemId);
            zeroed = true;
            log("INFO", `eBay出品数を0にしました: ${itemId}`);
          } catch (err) {
            log("ERROR", `eBay出品数の変更に失敗: ${itemId} — ${err.message}`);
            errorCount++;
          }
        } else {
          log("WARN", `eBay ItemID を抽出できません(ebay_url=${item.ebay_url}): ${item.id}`);
        }

        await updateRow(item.id, {
          mercari_status: "sold_out",
          mercari_checked_at: now,
          ...(zeroed ? { ebay_quantity: 0 } : {}),
        });
      } else if (status === "in_stock") {
        log("INFO", `在庫あり: ${name}`);
        await updateRow(item.id, { mercari_status: "active", mercari_checked_at: now });
      } else {
        // 判定不能 — ステータスは変えず、チェック日時だけ更新
        log("WARN", `判定不能(${status}): ${name}`);
        errorCount++;
        await updateRow(item.id, { mercari_checked_at: now });
      }

      await randomDelay();
    }

    log("INFO", "=== バッチ完了 ===");
    log("INFO", `結果: 全${listings.length}件 / 売切${soldOutCount}件 / エラー${errorCount}件`);
  } catch (err) {
    log("ERROR", `致命的エラー: ${err.message}`);
    log("ERROR", err.stack);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    process.exit(0);
  }
}

main();
