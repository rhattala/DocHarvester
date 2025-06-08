-- DocHarvester Progress Tracking Database Setup
-- This script creates the processing_tasks table for progress tracking functionality

-- Create processing_tasks table
CREATE TABLE IF NOT EXISTS processing_tasks (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    progress_percentage FLOAT DEFAULT 0.0 NOT NULL,
    current_step VARCHAR(100),
    total_steps INTEGER,
    completed_steps INTEGER DEFAULT 0 NOT NULL,
    estimated_duration_seconds INTEGER,
    elapsed_time_seconds FLOAT DEFAULT 0.0 NOT NULL,
    remaining_time_seconds INTEGER,
    project_id INTEGER,
    user_id INTEGER,
    result_data JSON,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign key constraints (uncomment if projects and users tables exist)
    CONSTRAINT fk_processing_tasks_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_processing_tasks_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        
    -- Check constraints
    CONSTRAINT chk_progress_percentage 
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT chk_status_values 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_task_type_values 
        CHECK (task_type IN ('wiki_generation', 'entity_extraction', 'knowledge_graph_refresh', 'document_processing'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_processing_tasks_project_id ON processing_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_user_id ON processing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_status ON processing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_task_type ON processing_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_processing_tasks_created_at ON processing_tasks(created_at);

-- Create updated_at trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_processing_tasks_updated_at ON processing_tasks;
CREATE TRIGGER update_processing_tasks_updated_at
    BEFORE UPDATE ON processing_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- Uncomment the following lines if you want to test with sample data
/*
INSERT INTO processing_tasks (task_type, status, progress_percentage, current_step, project_id, user_id)
VALUES 
    ('wiki_generation', 'completed', 100.0, 'finalizing', 1, 1),
    ('entity_extraction', 'running', 65.0, 'processing_chunks', 1, 1),
    ('knowledge_graph_refresh', 'pending', 0.0, 'initializing', 2, 1);
*/

-- Verify the table was created successfully
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'processing_tasks'
ORDER BY ordinal_position;