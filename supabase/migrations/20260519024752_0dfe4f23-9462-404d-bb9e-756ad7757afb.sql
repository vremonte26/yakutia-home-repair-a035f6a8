
REVOKE EXECUTE ON FUNCTION public.upsert_client_data(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_master_profile(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_master_changes(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.switch_active_role(app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_master_changes(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_master_changes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_client_data(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_master_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_master_changes(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_role(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_master_changes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_master_changes(uuid, text) TO authenticated;
