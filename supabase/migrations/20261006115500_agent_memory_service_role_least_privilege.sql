-- Restrict durable memory/skills tables to the operations used by the Edge runtime.
revoke all on table public.agent_memory from service_role;
grant select, insert, update on table public.agent_memory to service_role;

revoke all on table public.agent_skills from service_role;
grant select on table public.agent_skills to service_role;
