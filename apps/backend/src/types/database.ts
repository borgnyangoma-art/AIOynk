export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  google_id: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'moderator';
  email_verified: boolean;
  email_verified_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_info: string | null;
  ip_address: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  tool_type: 'graphics' | 'web_designer' | 'ide' | 'cad' | 'video';
  data: any;
  status: 'draft' | 'active' | 'archived';
  thumbnail_url: string | null;
  last_edited_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Artifact {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  type: string;
  mime_type: string;
  file_size: number;
  file_path: string | null;
  storage_provider: 'local' | 'google_drive' | 'cdn';
  google_drive_id: string | null;
  metadata: any;
  version: number;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  user_id: string;
  project_id: string | null;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  context: any;
  tool_result: any;
  tool_name: string | null;
  token_count: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}
