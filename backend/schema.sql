-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> Run

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  username    text not null unique,
  email       text not null unique,
  password    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists files (
  id            uuid primary key default gen_random_uuid(),
  path          text not null,
  originalname  text not null,
  user_id       uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists files_user_id_idx on files(user_id);
