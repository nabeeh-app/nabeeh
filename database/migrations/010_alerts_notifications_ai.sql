-- ============================================================
-- 1. ALERT RULES — per-teacher configurable thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('attendance_threshold', 'grade_threshold', 'trend_anomaly')),
  threshold_value NUMERIC NOT NULL,
  comparison TEXT NOT NULL CHECK (comparison IN ('gt', 'lt', 'gte', 'lte')),
  notification_method TEXT NOT NULL DEFAULT 'in_app' CHECK (notification_method IN ('in_app', 'whatsapp', 'both')),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ALERTS — generated when thresholds are breached
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. NOTIFICATIONS — in-app notification feed
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. REPORT DRAFTS — AI-generated report comments pending approval
-- ============================================================
CREATE TABLE IF NOT EXISTS report_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  draft_text TEXT NOT NULL,
  data_sources JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected', 'sent')),
  edited_text TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. WEEKLY DIGESTS — stored snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  digest_data JSONB NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, week_start)
);

-- ============================================================
-- 6. AI TOKEN BUDGET COLUMNS ON TEACHER_SETTINGS
-- ============================================================
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_token_budget INT DEFAULT 0;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_tokens_used_this_month INT DEFAULT 0;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_token_reset_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alert_rules_teacher_id ON alert_rules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alerts_teacher_id ON alerts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_teacher_id ON notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_report_drafts_teacher_id ON report_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_report_drafts_status ON report_drafts(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_teacher_id ON weekly_digests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_week ON weekly_digests(teacher_id, week_start);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_drafts_updated_at BEFORE UPDATE ON report_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- Alert rules: teacher owns their rules
CREATE POLICY "Teachers can manage own alert rules" ON alert_rules FOR ALL USING (teacher_id = auth.uid());
-- Alerts: teacher sees their own
CREATE POLICY "Teachers can view own alerts" ON alerts FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can update own alerts" ON alerts FOR UPDATE USING (teacher_id = auth.uid());
-- Notifications: teacher sees their own
CREATE POLICY "Teachers can view own notifications" ON notifications FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can update own notifications" ON notifications FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert own notifications" ON notifications FOR INSERT WITH CHECK (teacher_id = auth.uid());
-- Report drafts: teacher owns their drafts
CREATE POLICY "Teachers can manage own report drafts" ON report_drafts FOR ALL USING (teacher_id = auth.uid());
-- Weekly digests: teacher owns their digests
CREATE POLICY "Teachers can view own digests" ON weekly_digests FOR SELECT USING (teacher_id = auth.uid());
