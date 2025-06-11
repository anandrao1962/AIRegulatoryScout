-- Initialize the database with required extensions and optimizations
-- Enable vector extension for embeddings (if using pgvector)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Set optimal PostgreSQL configuration for the application
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;

-- Create application user with limited privileges
-- CREATE USER app_user WITH ENCRYPTED PASSWORD 'app_password';
-- GRANT CONNECT ON DATABASE agentic_rag TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT CREATE ON SCHEMA public TO app_user;