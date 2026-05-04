-- Rollback for: phase_3_4e_classes_class_members_read_policy
-- Pairs with: 20260501141142_phase_3_4e_classes_class_members_read_policy.sql
--
-- Drops the SELECT policy that grants classes read access to active
-- class_members. After rollback, only classes.teacher_id (legacy
-- "Teachers manage own classes") + class_students chain
-- ("Students read own enrolled classes" from Phase 1.4 CS-1) grant
-- classes SELECT. Co-teachers / dept_heads / mentors / lab_techs /
-- observers lose dashboard visibility on shared classes.

DROP POLICY IF EXISTS "Class members read their classes" ON classes;
