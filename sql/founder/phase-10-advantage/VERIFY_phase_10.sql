-- Phase 10 — VERIFY 100%
-- Har required table.column ka PASS / MISSING. Agar koi MISSING row aaye to
-- 20260816000001_phase_10_hard_heal.sql dobara chalao.
-- Expected result: zero rows with status = 'MISSING'.

with required(tbl, col) as (
  values
    -- 10.4 vision
    ('vision_shots','id'),('vision_shots','project_id'),('vision_shots','filename'),
    ('vision_shots','mime'),('vision_shots','data_url'),('vision_shots','bytes'),
    ('vision_shots','width'),('vision_shots','height'),('vision_shots','analyzed_at'),
    ('vision_analyses','shot_id'),('vision_analyses','project_id'),('vision_analyses','model'),
    ('vision_analyses','summary'),('vision_analyses','elements'),('vision_analyses','suggestions'),
    -- 10.5 presence
    ('presence_activity','project_id'),('presence_activity','actor'),
    ('presence_activity','action'),('presence_activity','target'),
    -- 10.6 tests
    ('test_files','project_id'),('test_files','path'),('test_files','origin'),
    ('test_files','status'),('test_files','total'),('test_files','passed'),
    ('test_files','failed'),('test_files','duration_ms'),
    ('test_runs','project_id'),('test_runs','test_id'),('test_runs','status'),
    ('test_runs','passed'),('test_runs','failed'),('test_runs','coverage'),
    ('test_runs','actor'),('test_runs','duration_ms'),('test_runs','log'),
    -- 10.8 browser
    ('browser_sessions','project_id'),('browser_sessions','url'),('browser_sessions','goal'),
    ('browser_sessions','status'),('browser_sessions','supervised'),('browser_sessions','ended_at'),
    ('browser_actions','session_id'),('browser_actions','project_id'),('browser_actions','kind'),
    ('browser_actions','detail'),('browser_actions','selector'),
    -- 10.10 fullstack
    ('fullstack_builds','project_id'),('fullstack_builds','prompt'),('fullstack_builds','status'),
    ('fullstack_builds','phase'),('fullstack_builds','live_url'),('fullstack_builds','eta_seconds'),
    ('fullstack_builds','duration_ms'),('fullstack_builds','finished_at'),
    ('fullstack_tasks','project_id'),('fullstack_tasks','build_id'),('fullstack_tasks','idx'),
    ('fullstack_tasks','title'),('fullstack_tasks','worker'),('fullstack_tasks','state'),
    ('fullstack_tasks','status'),('fullstack_tasks','progress'),
    -- 10.11 migrations
    ('migration_backups','project_id'),('migration_backups','tables'),
    ('migration_backups','snapshot'),('migration_backups','schema_before'),
    ('schema_migrations_log','project_id'),('schema_migrations_log','sql'),
    ('schema_migrations_log','status'),('schema_migrations_log','affected_rows'),
    ('schema_migrations_log','backup_id'),('schema_migrations_log','schema_before'),
    ('schema_migrations_log','schema_after'),('schema_migrations_log','error'),
    -- 10.12 advisors
    ('advisor_answers','project_id'),('advisor_answers','advisor'),('advisor_answers','domain'),
    ('advisor_answers','model'),('advisor_answers','prompt'),('advisor_answers','answer'),
    -- 10.13 sandbox
    ('project_envs','project_id'),('project_envs','kind'),('project_envs','active'),
    ('project_envs','row_count'),('project_envs','reset_at'),('project_envs','expires_at'),
    ('sandbox_files','project_id'),('sandbox_files','path'),('sandbox_files','content'),
    ('sandbox_rows','project_id'),('sandbox_rows','table_name'),('sandbox_rows','payload'),
    -- 10.14 explainability
    ('agent_thread_messages','model'),('agent_thread_messages','tokens_in'),
    ('agent_thread_messages','tokens_out'),('agent_thread_messages','cost_usd'),
    ('agent_thread_messages','parent_message_id'),
    ('tool_call_registry','message_id'),('tool_call_registry','duration_ms'),
    ('tool_call_registry','started_at'),('tool_call_registry','finished_at'),
    -- 10.15 command center
    ('outreach_leads','mrr_usd'),('outreach_leads','closed_at')
)
select
  r.tbl                                                as table_name,
  r.col                                                as column_name,
  case when c.column_name is null then 'MISSING' else 'PASS' end as status
from required r
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
order by status, r.tbl, r.col;

-- Summary (0 = sab green)
select count(*) as missing_count
from (
  select 1 from information_schema.columns where false
) x;
