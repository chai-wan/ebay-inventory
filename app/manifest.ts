import type { MetadataRoute } from "next"

// ホーム画面に追加したとき、アプリとして開くための設定
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eBay在庫管理",
    short_name: "在庫管理",
    description: "メルカリ等の仕入れ先とeBay出品の在庫を管理するツール",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111111",
    lang: "ja",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
