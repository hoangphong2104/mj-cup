-- M&J CUP — tạo cơ sở dữ liệu.
-- Supabase → SQL Editor → New query → dán toàn bộ file này → Run. Chạy lại nhiều lần không sao.

-- Toàn bộ giải (đội, trận, tỉ số) nằm trong một dòng JSON: id = 'mj'.
create table if not exists public.cup (
  id text primary key,
  data jsonb not null,
  ver bigint not null default 1,          -- tăng 1 sau mỗi lần ghi
  updated_at timestamptz not null default now()
);

-- Tài khoản được nhập điểm (BTC).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.cup enable row level security;
alter table public.admins enable row level security;

-- Ai cũng xem được tỉ số. Không có quyền ghi trực tiếp: mọi thay đổi đi qua các hàm bên dưới.
drop policy if exists "cup_public_read" on public.cup;
create policy "cup_public_read" on public.cup for select to anon, authenticated using (true);
grant select on public.cup to anon, authenticated;
revoke insert, update, delete on public.cup from anon, authenticated;
revoke all on public.admins from anon, authenticated;

-- Bật cập nhật trực tiếp (Realtime) cho bảng cup.
do $$ begin
  alter publication supabase_realtime add table public.cup;
exception when duplicate_object then null;
end $$;

create or replace function public.cup_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- Tạo (hoặc ghi đè) dữ liệu giải. Chỉ BTC.
create or replace function public.cup_init(doc jsonb)
returns bigint language plpgsql security definer set search_path = public
as $$
declare nv bigint;
begin
  if not public.cup_is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.cup (id, data) values ('mj', doc)
  on conflict (id) do update set data = excluded.data, ver = public.cup.ver + 1, updated_at = now()
  returning ver into nv;
  return nv;
end $$;

-- Ghi một bản vá dạng {"matches/N01/sa": {"__inc": 1}, "matches/N01/st": "live", "tb": null}.
--   {"__inc": n} cộng n vào số hiện có (an toàn khi 2 người cùng bấm)
--   {"__now": 1} giờ máy chủ, tính bằng mili giây
--   null         xoá khoá
-- Khoá trong lệnh khoá dòng (for update) nên các lần ghi đồng thời xếp hàng, không mất điểm.
create or replace function public.cup_patch(ops jsonb)
returns bigint language plpgsql security definer set search_path = public
as $$
declare
  d jsonb; k text; v jsonb; p text[]; i int; nv bigint;
begin
  if not public.cup_is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select data into d from public.cup where id = 'mj' for update;
  if d is null then
    raise exception 'Giải chưa được khởi tạo';
  end if;
  for k, v in select * from jsonb_each(ops) loop
    p := string_to_array(k, '/');
    if jsonb_typeof(v) = 'object' and v ? '__inc' then
      v := to_jsonb(coalesce((d #>> p)::numeric, 0) + (v ->> '__inc')::numeric);
    elsif jsonb_typeof(v) = 'object' and v ? '__now' then
      v := to_jsonb((extract(epoch from clock_timestamp()) * 1000)::bigint);
    end if;
    if jsonb_typeof(v) = 'null' then
      d := d #- p;
    else
      for i in 1 .. coalesce(array_length(p, 1), 1) - 1 loop  -- tạo nhánh cha còn thiếu
        if jsonb_typeof(d #> p[1:i]) is distinct from 'object' then
          d := jsonb_set(d, p[1:i], '{}'::jsonb, true);
        end if;
      end loop;
      d := jsonb_set(d, p, v, true);
    end if;
  end loop;
  update public.cup set data = d, ver = ver + 1, updated_at = now() where id = 'mj'
  returning ver into nv;
  return nv;
end $$;

revoke all on function public.cup_init(jsonb) from public, anon;
revoke all on function public.cup_patch(jsonb) from public, anon;
grant execute on function public.cup_init(jsonb) to authenticated;
grant execute on function public.cup_patch(jsonb) to authenticated;
grant execute on function public.cup_is_admin() to anon, authenticated;
