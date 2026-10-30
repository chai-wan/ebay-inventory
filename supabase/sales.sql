-- 売上記録テーブル（Supabase の SQL Editor で1回だけ実行）
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  line_item_id text unique not null,      -- eBayの注文明細ID（重複取り込み防止）
  order_id text,
  item_id text,
  title text,
  sold_at timestamptz,
  quantity integer default 1,
  sale_usd numeric default 0,             -- 商品代金（数量分）
  shipping_income_usd numeric default 0,  -- 買い手が払った送料
  ebay_fee_usd numeric default 0,         -- eBay手数料
  fee_estimated boolean default false,    -- true = eBayから取れず推定値
  exchange_rate numeric default 150,      -- 取り込み時の為替
  purchase_cost_jpy numeric default 0,    -- 仕入れ値（登録商品から自動、あとで修正可）
  shipping_cost_jpy numeric default 0,    -- 実際に払った国際送料
  other_cost_jpy numeric default 0,       -- 関税・梱包材など
  memo text,
  created_at timestamptz default now()
);

alter table sales enable row level security;
drop policy if exists "sales_anon_all" on sales;
create policy "sales_anon_all" on sales for all using (true) with check (true);
