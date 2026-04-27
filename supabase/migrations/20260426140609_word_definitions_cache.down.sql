-- Rollback for: word_definitions_cache
-- Pairs with: 20260426140609_word_definitions_cache.sql

DROP POLICY IF EXISTS word_definitions_read ON word_definitions;
DROP TABLE IF EXISTS word_definitions;
