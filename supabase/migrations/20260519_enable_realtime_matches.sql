alter publication supabase_realtime add table matches;
alter table matches replica identity full;
