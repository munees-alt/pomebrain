---
name: recursive-task-resolution-loop
description: Run the App Factory master execution loop by scanning project graph tasks, ordering dependencies, dispatching approved agents, evaluating outputs, logging evidence, notifying humans on blocked states, and resuming from the last valid checkpoint after disconnects or token exhaustion.
---

# Recursive Task Resolution Loop

Purpose: Provide the master controller procedure for explicit completion across major App Factory builds.

## Inputs

- `project_id`
- `app_specifications`
- `task_list`
- `active_execution_logs`
- `graph_health_state`

## Outputs

- `agent_assignment_tickets`
- `subtask_status_loop`
- `system_run_logs`
- `blocked_state_notifications`

## Procedure

1. Scan the graph registry.
   - Query the Pomegranate Graph for the current project.
   - Identify child task nodes with `pending`, `failed`, or `unverified` status.
   - Ignore tasks already marked `approved`.

2. Build dependency order.
   - Parse typed `REQUIRES` and `DEPENDS_TO` fibres.
   - Prioritize database tables, RLS, scaffolding, and shared contracts before user-facing views.
   - Select the first dependency-ready uncompleted task.

3. Dispatch work teams.
   - Locate the approved agent manifest for the task.
   - Provision a local workspace boundary.
   - Dispatch the task with only the required context, capabilities, and approval rules.

4. Evaluate and log state.
   - Run the task evaluation suite.
   - If it passes, mark the task as approved.
   - If it fails, write structural traces into an Evidence seed, notify the human supervisor through governed Slack/Gmail capability paths, and block downstream steps.

5. Apply the continuity lock.
   - On disconnect, quota exhaustion, or runner restart, read execution logs from the database.
   - Recreate dependency state from the last valid checkpoint.
   - Resume without repeating successful approved tasks.

## Guardrails

- Do not loop indefinitely.
- Respect Token Throttle Controller limits.
- Do not execute external builds without approval.
- Do not mark failed or unverified work as approved.
- Do not use raw credentials; request named capabilities only.

