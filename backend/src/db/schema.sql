

create extension if not exists "uuid-ossp";

create table if not exists products (
  id                 uuid primary key default uuid_generate_v4(),
  store_product_id   text not null,
  product_url        text not null,
  name               text not null,
  image_url          text,
  category           text,
  last_price         numeric(12,2),
  last_stock         text,
  last_scraped_at    timestamptz,
  scrape_frequency_hours integer not null default 2,
  is_active          boolean not null default true,
  dom_structure_hash text,
  created_at         timestamptz not null default now(),
  unique (store_product_id)
);

create table if not exists price_history (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references products(id) on delete cascade,
  price         numeric(12,2) not null,
  stock_status  text not null,
  scraped_at    timestamptz not null default now()
);

create table if not exists scrape_logs (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid not null references products(id) on delete cascade,
  status          text not null check (status in ('success', 'retried', 'failed')),
  attempt_number  integer not null default 1,
  duration_ms     integer,
  method          text,
  structure_changed boolean default false,
  error_message   text,
  started_at      timestamptz not null default now()
);

create table if not exists alerts_sent (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references products(id) on delete cascade,
  alert_type    text not null check (alert_type in ('price_drop', 'back_in_stock')),
  old_value     text,
  new_value     text,
  sent_at       timestamptz not null default now()
);

create index if not exists idx_price_history_product_time on price_history (product_id, scraped_at desc);
create index if not exists idx_scrape_logs_product_time on scrape_logs (product_id, started_at desc);

create or replace view product_reliability as
select
  p.id as product_id,
  p.name,
  count(sl.*) filter (where sl.status = 'success') as success_count,
  count(sl.*) filter (where sl.status = 'failed')  as failed_count,
  count(sl.*) as total_attempts,
  round(
    100.0 * count(sl.*) filter (where sl.status = 'success') / nullif(count(sl.*), 0), 1
  ) as success_rate_pct
from products p
left join scrape_logs sl on sl.product_id = p.id
group by p.id, p.name;
