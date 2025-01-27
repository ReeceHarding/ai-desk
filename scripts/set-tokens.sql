
DO $$
BEGIN
  PERFORM set_config('app.settings.seed_gmail_access_token', 'ya29.a0AXeO80QZX9gLAxu0q_MJ0S6JvafS4Iom5Z8La58rkfjXugbWtGJmZ9isQpjcJ63ULBRNB4h6TbebRI38MgB3cdV9S7fgAaB-Ag7NdupgoIWC7KzIJFMWdM2waZx7JUmqDEwyKF6dh9km2ttlJwv7LxpgN1t7AizrE08W5iTMaCgYKAVASARMSFQHGX2MiuTdgo_MlwZzk1UYwJ_Niww0175', false);
  PERFORM set_config('app.settings.seed_gmail_refresh_token', '1//065GDR7pbRvj-CgYIARAAGAYSNwF-L9Ir26-dbyFTQFr5M54SoJIeuP34_3bpDdu6qzMK5a6oEN_Ds7qVzpUkt69AJoqb8FS6P2I', false);
  PERFORM set_config('app.settings.seed_gmail_history_id', '2180684', false);
END $$;
