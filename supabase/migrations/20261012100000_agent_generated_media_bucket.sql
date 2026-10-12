-- Private, service-role-only generated media. No public bucket access or anonymous policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-generated', 'agent-generated', false, 8388608, array['image/png'])
on conflict (id) do nothing;
