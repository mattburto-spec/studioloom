-- Migration 009: Add start_date to planning_tasks for Gantt chart
ALTER TABLE planning_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
