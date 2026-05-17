ALTER TABLE ai_call_logs ADD COLUMN response_status INTEGER;
ALTER TABLE ai_call_logs ADD COLUMN request_url TEXT;
ALTER TABLE ai_call_logs ADD COLUMN request_path TEXT;
ALTER TABLE ai_call_logs ADD COLUMN response_summary_prefix TEXT;
ALTER TABLE ai_call_logs ADD COLUMN has_gateway_auth INTEGER CHECK (has_gateway_auth IN (0, 1) OR has_gateway_auth IS NULL);
ALTER TABLE ai_call_logs ADD COLUMN has_byok_alias INTEGER CHECK (has_byok_alias IN (0, 1) OR has_byok_alias IS NULL);
