-- M&J CUP — tạo cơ sở dữ liệu.
-- Supabase → SQL Editor → New query → dán toàn bộ file này → Run. Chạy lại nhiều lần không sao.

-- Toàn bộ giải (đội, trận, tỉ số) nằm trong một dòng JSON: id = 'mj'.
create table if not exists public.cup (
  id text primary key,
  data jsonb not null,
  ver bigint not null default 1,          -- tăng 1 sau mỗi lần ghi
  updated_at timestamptz not null default now()
);

-- Mật khẩu BTC (chỉ lưu bản mã hoá bcrypt). Đặt bằng lệnh ở HUONG-DAN.md, bước 3.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.cup_secret (
  id int primary key default 1 check (id = 1),
  pw_hash text not null
);

alter table public.cup enable row level security;
alter table public.cup_secret enable row level security;

-- Ai cũng xem được tỉ số. Không có quyền ghi trực tiếp: mọi thay đổi đi qua các hàm bên dưới.
drop policy if exists "cup_public_read" on public.cup;
create policy "cup_public_read" on public.cup for select to anon, authenticated using (true);
grant select on public.cup to anon, authenticated;
revoke insert, update, delete on public.cup from anon, authenticated;
revoke all on public.cup_secret from anon, authenticated;

-- Bỏ cách đăng nhập bằng email cũ (nếu đã từng chạy bản trước).
drop function if exists public.cup_patch(jsonb);
drop function if exists public.cup_init(jsonb);
drop function if exists public.cup_is_admin();
drop table if exists public.admins;

-- Bật cập nhật trực tiếp (Realtime) cho bảng cup.
do $$ begin
  alter publication supabase_realtime add table public.cup;
exception when duplicate_object then null;
end $$;

-- Đúng mật khẩu BTC? Sai thì chờ 0,7 giây để chống dò mật khẩu.
create or replace function public.cup_check(pw text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
declare h text;
begin
  select pw_hash into h from public.cup_secret where id = 1;
  if h is not null and pw is not null and crypt(pw, h) = h then
    return true;
  end if;
  perform pg_sleep(0.7);
  return false;
end $$;

-- Tạo (hoặc ghi đè) dữ liệu giải. Cần mật khẩu BTC.
create or replace function public.cup_init(doc jsonb, pw text)
returns bigint language plpgsql security definer set search_path = public
as $$
declare nv bigint;
begin
  if not public.cup_check(pw) then
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
create or replace function public.cup_patch(ops jsonb, pw text)
returns bigint language plpgsql security definer set search_path = public
as $$
declare
  d jsonb; k text; v jsonb; p text[]; i int; nv bigint;
begin
  if not public.cup_check(pw) then
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

-- Ai cũng gọi được, nhưng không có mật khẩu đúng thì bị từ chối.
grant execute on function public.cup_check(text) to anon, authenticated;
grant execute on function public.cup_init(jsonb, text) to anon, authenticated;
grant execute on function public.cup_patch(jsonb, text) to anon, authenticated;
