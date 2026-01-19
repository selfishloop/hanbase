-- System Schema to manage the platform itself
CREATE SCHEMA IF NOT EXISTS baas_system;

-- Projects table: Stores information about each project (tenant)
CREATE TABLE IF NOT EXISTS baas_system.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    db_schema TEXT NOT NULL UNIQUE, -- The PostgreSQL schema name for this project
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table: Platform admins/users (who manage projects)
CREATE TABLE IF NOT EXISTS baas_system.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects Users Junction: Who owns which project
CREATE TABLE IF NOT EXISTS baas_system.project_members (
    project_id UUID REFERENCES baas_system.projects(id),
    user_id UUID REFERENCES baas_system.users(id),
    role TEXT DEFAULT 'owner',
    PRIMARY KEY (project_id, user_id)
);
