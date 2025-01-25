SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', '4131eccf-7245-457a-aeb9-7b8a532e339e', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"reeceharding225@gmail.com","user_id":"49e6508f-13ec-450b-860d-98e9e813352b","user_phone":""}}', '2025-01-21 23:28:57.617327+00', ''),
	('00000000-0000-0000-0000-000000000000', '2ecd3a95-1283-4a21-a873-c48086ab1d18', '{"action":"user_signedup","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}', '2025-01-24 21:48:10.676453+00', ''),
	('00000000-0000-0000-0000-000000000000', '4393127a-41e5-485a-8ee2-134c49f75b2c', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:03:12.960877+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bc74f46a-d603-4018-b82b-0bfaa07eb1c2', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:06:07.295879+00', ''),
	('00000000-0000-0000-0000-000000000000', '30f9c5f9-4f45-404e-b203-9944b02a3cac', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:13:42.000308+00', ''),
	('00000000-0000-0000-0000-000000000000', '7a8efe9e-2a01-4cb3-9ad7-a3463d6948b7', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 22:13:42.770636+00', ''),
	('00000000-0000-0000-0000-000000000000', '2ea26853-2b5a-4456-9b86-6617fc47a48a', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:15:39.585676+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ff73b172-c5cb-442c-b07d-f748687a7bfc', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:25:02.973879+00', ''),
	('00000000-0000-0000-0000-000000000000', '8ddc0a39-88ea-42b4-8920-2f8173310a0d', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 22:36:47.689781+00', ''),
	('00000000-0000-0000-0000-000000000000', '7908da46-2859-4dc2-be9d-a6b1a85933cd', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:00:03.592247+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a888ef08-74da-45ba-b5a4-3541cbae476f', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:00:04.632752+00', ''),
	('00000000-0000-0000-0000-000000000000', '0f69a7c2-0b60-4c6c-8405-b0a714c5c2ca', '{"action":"user_signedup","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}', '2025-01-24 23:08:08.202384+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a106ba49-45c5-4d5c-8137-d8b3940fef7a', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:08:09.905074+00', ''),
	('00000000-0000-0000-0000-000000000000', '57b5bef1-b3fb-4772-ac9b-4be6e40966eb', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:12:16.432697+00', ''),
	('00000000-0000-0000-0000-000000000000', '170d3bad-c5d7-4669-b6ca-971ab3ee2fa3', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:12:17.81859+00', ''),
	('00000000-0000-0000-0000-000000000000', '09600828-9810-471a-824d-f539fc5e880f', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:16:24.358955+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd57fecea-56e5-454a-bd42-d831e2926dd0', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:16:25.236801+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dc3a1e6f-9f69-4007-beba-04a240163355', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:21:29.38732+00', ''),
	('00000000-0000-0000-0000-000000000000', '71a74eea-6de1-4cb9-bb9b-71607725db39', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:21:31.505952+00', ''),
	('00000000-0000-0000-0000-000000000000', '4080b0a3-b108-4f19-98aa-930c4f0acb18', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:26:08.162265+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd6002462-5d8d-4f29-a2dd-1d20d79e8f62', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:26:09.422662+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b254ee15-3288-4f41-bee3-6a7b3037ebf9', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:33:00.893426+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cad60e68-4b6b-4e1a-b4be-5697ce726cb6', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:33:02.829009+00', ''),
	('00000000-0000-0000-0000-000000000000', '21846ea6-df0f-4b1d-8977-93280eeced11', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:36:07.624432+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f76aef1b-dfac-4b7f-8ea4-c06be9b1f8b8', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:36:17.219823+00', ''),
	('00000000-0000-0000-0000-000000000000', '645ccba4-bfee-4cca-99e2-3927076f9209', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:38:22.741539+00', ''),
	('00000000-0000-0000-0000-000000000000', '2c4d68a5-0e82-423c-ac35-9d4b667182d1', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:38:33.278847+00', ''),
	('00000000-0000-0000-0000-000000000000', '39f80060-f414-4d3a-bf75-bc4e7c15f2eb', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:41:14.546341+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c75db55e-f856-457f-a902-eb553f059553', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-24 23:41:17.539886+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f39fecf9-65b3-456e-9428-f3806a013f79', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:47:45.385304+00', ''),
	('00000000-0000-0000-0000-000000000000', '6d47632b-b5a7-4ebb-a059-3bf451295114', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:49:23.12291+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dc37c063-7a6f-46bc-b4d5-0ac7294207c5', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:50:46.920966+00', ''),
	('00000000-0000-0000-0000-000000000000', '45003d80-0f91-4404-bd25-67fc095933ed', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:54:51.657838+00', ''),
	('00000000-0000-0000-0000-000000000000', '8b08a97d-2eea-4f2f-b273-81d8dc76cc7e', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:56:41.085363+00', ''),
	('00000000-0000-0000-0000-000000000000', '4e74d3a6-1904-4fff-a25b-80bc5480fb24', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-24 23:58:21.792962+00', ''),
	('00000000-0000-0000-0000-000000000000', '31c64070-cea9-4034-84c4-ea01f608325d', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 00:03:36.768452+00', ''),
	('00000000-0000-0000-0000-000000000000', '2ece9b9a-ab4e-4f97-bdc9-733d8018ecec', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 00:03:42.406588+00', ''),
	('00000000-0000-0000-0000-000000000000', '8225efce-b83d-469c-9e6a-4291112350ab', '{"action":"user_signedup","actor_id":"4a7af137-09b5-4f8d-ab25-27392e9dd81d","actor_name":"Reece Harding","actor_username":"reeceharding@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}', '2025-01-25 00:52:57.870727+00', ''),
	('00000000-0000-0000-0000-000000000000', '1dda0c7d-0f20-4747-aaa7-c6c248002e64', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 01:40:56.567055+00', ''),
	('00000000-0000-0000-0000-000000000000', '7b9e23f6-3b18-4e88-a0d7-1a0b6a80bdae', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 01:41:10.858162+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f93f66c0-c6fb-4f6e-84db-5e0672ec4e46', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 01:48:07.642179+00', ''),
	('00000000-0000-0000-0000-000000000000', '7957e680-13e5-4efd-ae8c-c4db425161cf', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 01:48:08.983303+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a3fc9345-d6ed-47c1-919b-1b75f357dbe3', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 01:49:09.24705+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f989ad4f-85c0-40e8-9879-f474a38e206a', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 01:49:10.095403+00', ''),
	('00000000-0000-0000-0000-000000000000', '70c14029-ca0f-41cd-b8c2-4d6d5b76accd', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 01:59:05.656897+00', ''),
	('00000000-0000-0000-0000-000000000000', '927cb7d1-1032-40ce-a945-0feaf8f728d0', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 01:59:07.054643+00', ''),
	('00000000-0000-0000-0000-000000000000', '4d9d6465-9468-4c8b-aa30-3777b28aeac6', '{"action":"user_signedup","actor_id":"f8760260-c522-4ee3-b964-c902eb6f062d","actor_username":"auto-admin-collegeforreece33-339743983@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 02:10:47.311634+00', ''),
	('00000000-0000-0000-0000-000000000000', '06191ded-583d-4676-a286-c273cb739464', '{"action":"login","actor_id":"f8760260-c522-4ee3-b964-c902eb6f062d","actor_username":"auto-admin-collegeforreece33-339743983@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 02:10:47.316571+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd29e4c6f-8dd7-4486-bc6e-0aa93e499397', '{"action":"user_signedup","actor_id":"7aa2fe34-91a4-4ef0-b885-f4b522213a8f","actor_username":"auto-admin-collegeforreece3-3339743983@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 02:17:28.604257+00', ''),
	('00000000-0000-0000-0000-000000000000', '2bbe7ea8-c6ef-41a7-90c9-761b0f9d2347', '{"action":"login","actor_id":"7aa2fe34-91a4-4ef0-b885-f4b522213a8f","actor_username":"auto-admin-collegeforreece3-3339743983@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 02:17:28.611128+00', ''),
	('00000000-0000-0000-0000-000000000000', '0774e57d-a7a1-474a-a69a-c66ee93a6779', '{"action":"user_signedup","actor_id":"4911537d-8301-492a-bfb3-1ff294b640ca","actor_username":"auto-admin-collegeforreece-333383@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 02:20:18.166711+00', ''),
	('00000000-0000-0000-0000-000000000000', '75b3ca1b-edc2-44cb-ac4e-bd97cb229bc4', '{"action":"login","actor_id":"4911537d-8301-492a-bfb3-1ff294b640ca","actor_username":"auto-admin-collegeforreece-333383@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 02:20:18.172671+00', ''),
	('00000000-0000-0000-0000-000000000000', '789c66e2-3471-47e0-9956-2ecec37917b3', '{"action":"user_signedup","actor_id":"c76a8dfd-ce07-41d6-83c5-dc56a61cfb90","actor_username":"auto-admin-collegeforreece-3331383@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 02:20:21.017616+00', ''),
	('00000000-0000-0000-0000-000000000000', '95991de1-4395-482f-8ccd-bd4aeb0b9fe7', '{"action":"login","actor_id":"c76a8dfd-ce07-41d6-83c5-dc56a61cfb90","actor_username":"auto-admin-collegeforreece-3331383@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 02:20:21.020486+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dca0e7a1-4400-4f64-95ac-0f88861a17b5', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:26:56.663294+00', ''),
	('00000000-0000-0000-0000-000000000000', '4a8befe3-d184-44f2-b5df-016ccf24baec', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:26:58.068966+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a8acb6a4-32ec-4dc4-9f8b-4f1d53bfb189', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:38:50.940741+00', ''),
	('00000000-0000-0000-0000-000000000000', '0572d1ef-7c11-429d-881d-5db667dd0687', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:38:51.926722+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f1a6f31b-93be-47d1-b3cb-26e871e11c18', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:39:42.642999+00', ''),
	('00000000-0000-0000-0000-000000000000', '944daf45-1bb6-47c0-8616-b0917c02647a', '{"action":"login","actor_id":"0c0df787-052b-4a90-982b-fe17146c8aae","actor_name":"Reece Harding","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:39:43.717812+00', ''),
	('00000000-0000-0000-0000-000000000000', '30502821-8acf-44be-9088-a8ded3058623', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:46:01.636304+00', ''),
	('00000000-0000-0000-0000-000000000000', '0a90a8dc-c37d-466d-81df-6b191012d5f2', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:46:02.74692+00', ''),
	('00000000-0000-0000-0000-000000000000', '3e032b31-b447-41da-bb2a-163cdd9883d2', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:52:04.987913+00', ''),
	('00000000-0000-0000-0000-000000000000', '72a4dd4d-0947-4e4d-9a20-4a530ccc5fac', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:52:06.363926+00', ''),
	('00000000-0000-0000-0000-000000000000', '5352ae98-e4d1-43b8-b87c-2d2ab71abf92', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 02:56:09.773852+00', ''),
	('00000000-0000-0000-0000-000000000000', '2f725fd0-94a3-4416-8019-0beca1bb3d37', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider_type":"google"}}', '2025-01-25 02:56:10.820782+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e2a64629-f444-4d80-8ea5-7219f62672f5', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 03:11:17.990461+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd4390199-ed71-43ad-ab7f-f1e5d74b4033', '{"action":"login","actor_id":"12220aab-8ecd-4650-99a4-6375f03f9291","actor_name":"Reece Harding","actor_username":"collegeforreece@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}', '2025-01-25 03:11:56.376457+00', ''),
	('00000000-0000-0000-0000-000000000000', '1215b7a5-d6c8-446a-a2c3-7f74fcfe6608', '{"action":"user_repeated_signup","actor_id":"7aa2fe34-91a4-4ef0-b885-f4b522213a8f","actor_username":"auto-admin-collegeforreece3-3339743983@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2025-01-25 03:12:06.569603+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e7c410e3-3753-44d1-baf1-9eee9d962ea2', '{"action":"user_signedup","actor_id":"85ec2f98-7858-470c-8a0b-ef9e04afcb7c","actor_username":"auto-admin-collegeforreece3-33319743983@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 03:12:09.168354+00', ''),
	('00000000-0000-0000-0000-000000000000', '6c5d2143-923d-43f6-af50-2f1bc7329bc2', '{"action":"login","actor_id":"85ec2f98-7858-470c-8a0b-ef9e04afcb7c","actor_username":"auto-admin-collegeforreece3-33319743983@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 03:12:09.171986+00', ''),
	('00000000-0000-0000-0000-000000000000', '488f6e81-f323-4c74-8b26-d83fd7e11b1b', '{"action":"user_signedup","actor_id":"e1e8f9b3-096f-4501-86e6-637ba8119957","actor_username":"auto-admin-collegeforreece-313383@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 03:13:45.890382+00', ''),
	('00000000-0000-0000-0000-000000000000', '9846b563-0c1f-44af-943a-c439116ec0a9', '{"action":"login","actor_id":"e1e8f9b3-096f-4501-86e6-637ba8119957","actor_username":"auto-admin-collegeforreece-313383@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 03:13:45.894582+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f01649aa-61fb-433c-b60f-ce74daddc306', '{"action":"user_signedup","actor_id":"e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9","actor_username":"auto-admin-collegeforree3ce-33383@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-01-25 03:35:13.676509+00', ''),
	('00000000-0000-0000-0000-000000000000', '63e1dcf5-c6a9-4e10-b236-16a376f0a59a', '{"action":"login","actor_id":"e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9","actor_username":"auto-admin-collegeforree3ce-33383@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-01-25 03:35:13.681039+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at") VALUES
	('5a8d5095-ff2f-4985-ab83-09740f8e787c', '0c0df787-052b-4a90-982b-fe17146c8aae', 'af0b99e5-c907-4015-b4fa-c3cd6506c267', 's256', 'T57ibJnAwtBCjdvXwyzNYd-BxJnhojBgFZBA3R8hJSs', 'google', 'ya29.a0AXeO80QFT-5PR00WHeQSFoP7CI1YffBLWIMtm5iJE6H51tmFBrWPiCKIq9VHn-V1Bf5AJaCrt5d-6adnpw_UXFxQpiJWamvLxN0C9j734gtxXnwTLYLSdCYaN9ko0Cetr3TICOjXI_iCnosMmK9gcs_n-TM8UgN2wXmI2o2eaCgYKAV0SARESFQHGX2MiPA4gRCZ_Z8G6XKVqU5EqDw0175', '1//06Vg3q8a-c3kXCgYIARAAGAYSNwF-L9IrBJboH5fj2yZWXxuitr5fzqBa2DH2a0FWP19Qygt7uDhe9U66tIYnHLPiRmWtOReXuC8', '2025-01-24 21:48:00.665169+00', '2025-01-24 21:48:10.683155+00', 'oauth', '2025-01-24 21:48:10.683098+00'),
	('2b19995b-c7c4-4d7f-b99d-bf80d79ad983', '0c0df787-052b-4a90-982b-fe17146c8aae', 'dbcb30a7-df3d-4f54-b5ae-f2a60b76ff56', 's256', 'sQfW1Rp9M62HqxJDOWgjnCzVKpbs4XWKYN3wzuayAzo', 'google', 'ya29.a0AXeO80TDDf2ghpDMdXiEO0SZjy7vrbFgIbxZraodz_oKs-fw3971V7kcUmADaheqs3ylPMgEkJpKafywBpbysEGeHdJQNeeuXBZkSfSE3Y4wo9Ay6eoRGRlXib55T6b_OizWI5hCsE263Fq9XfUPfT_pdRaLEnch7qYYOcafaCgYKAaISARESFQHGX2MiPVWUr7Ofms2b48a-7pUhEQ0175', '1//061iOvKbROzkZCgYIARAAGAYSNwF-L9IrjrO25if0Y-ivkQFLJZrVzGCav5r6zjt1RTLToX9JLGRl4nzPN8UvlAT5QmXKhq-5i-E', '2025-01-24 22:03:05.924036+00', '2025-01-24 22:03:12.962565+00', 'oauth', '2025-01-24 22:03:12.96252+00'),
	('00a7d20f-55ed-4ed8-9f83-cd48e123c255', '0c0df787-052b-4a90-982b-fe17146c8aae', '49f40a8f-8b0b-41dd-8768-1a45528bce14', 's256', 'QxMC62JXLvmetoyBqZ1tPQCXkMtVASN85RJRnLrgXnM', 'google', 'ya29.a0AXeO80TwJeavWFP7xDmDYqu7Jz7iVDeP2Utm8yFsPyHInfUB2JmomUV6Jzku7jh4MAuWiGB5V5_eR2uCG5LsMN-1Ix28qrjnqNvWzPC7eGv1oPWB4pB4R_3IaIcVh-6Cyfz_Vatcl40O19-y0dtVkVNWQkrJ1OIwUePlHF99aCgYKAU4SARESFQHGX2MiWRpCnW1LTFtUmdDBM9vIEw0175', '1//06wNiiR7PXxhYCgYIARAAGAYSNwF-L9IruxvRjNUFS-15oZ360lLVjVilbtxAgSvktUoSSpYb3OukshGKdtlMqtvPKuWgqtxaur4', '2025-01-24 22:05:58.653445+00', '2025-01-24 22:06:07.296627+00', 'oauth', '2025-01-24 22:06:07.296586+00'),
	('4418b2b6-e4ae-4f2f-a567-a46a1fec14b8', '0c0df787-052b-4a90-982b-fe17146c8aae', 'fcbce4dc-dc58-4fe4-adac-f476cfb986ed', 's256', 'aeQCsfBaUQY44gg8uW-xG2U9c0r_6BoCDSfhOMm4EAE', 'google', 'ya29.a0AXeO80SDjC7rbnCcyDwPKmWrnhPT6W0_DXtGiytZ_pegCwUqkn8oYTGBIcjvBzdfv87DSNhhMzh4RCaj4LOaV7wnLx6yc78DOEysi01CB_NNw1Qp_QxWbYH9qFUJhz1-0M-1cjUL8ITPgj9tlPtOg4NJYygYAyXXQl73ilyMUwaCgYKARcSARESFQHGX2MieaJvCh3zMCBM-RzhRtgrXw0177', '', '2025-01-24 22:15:14.250201+00', '2025-01-24 22:15:39.587844+00', 'oauth', '2025-01-24 22:15:39.587802+00'),
	('194c4d64-3b34-4180-b115-6d499a9120d2', '0c0df787-052b-4a90-982b-fe17146c8aae', '7ed9bf40-12b8-4dd4-91ad-d6d84cb156d5', 's256', 'z70xLMwbyn-KePFD1zLAnl3FzP1fN2WYBJ_n2-SUzhQ', 'google', 'ya29.a0AXeO80T60qHf8SYH6DqXOVlElcEUL1qvxOeC8SQoGsGYWFLRdxzXCrP_Fwk3uQpCVL-K-Xi-IA8PSqOyIaoA88v5aZ8gFKMiyI38-re07FEcKw357YRj8fd0or_DsRtYZaEi-YGdAm482AGAMS0FvdLZzZbmtPu2GVpA5orPaCgYKARISARESFQHGX2Miyqgv4qG718Ffz4UvLcMX3w0175', '1//06JvTK4peh5zBCgYIARAAGAYSNwF-L9IreMd9yUuOL3frwY61NfOAdZglMA11FgTq2M403gde6PGV-sGDDjTDVfU_ZTkJqcY7u2M', '2025-01-24 22:24:55.512176+00', '2025-01-24 22:25:02.975188+00', 'oauth', '2025-01-24 22:25:02.975144+00'),
	('8f2fb8c0-a7d2-4276-8a83-e2118d1464cb', '0c0df787-052b-4a90-982b-fe17146c8aae', '20986990-3f0f-4632-82d7-913d4100256e', 's256', '4oQ6EV3Zz1qzG1G6OLdYr2axSWZA8s5ZL_NuBwW0TBQ', 'google', 'ya29.a0AXeO80RNbh5XZicMzT91SFJBFbe3Pf39t80R0wNkpkd0JQZqJOriMDCZwOPL4prqb_gg17A9V40w-zZXz-YWtLVyQaeptg63ikj_0Ifzp9OKAAY0U21oyQ6iju5Sux09TUtTlQ9rnBfFDa1ZyTFMt7ieQwJh0irXnWxVBJHaaCgYKATISARESFQHGX2Mie-fIMoPcWrvs5sllGr2e3w0175', '1//06x-6SFR1AfwcCgYIARAAGAYSNwF-L9IrkDTm48gdnW-BxHK4KRWaVG4Wm1daVjMpqaCgg-P7o8uTJG53g_SCHj4sTRtmsmPiTIM', '2025-01-24 22:36:28.725644+00', '2025-01-24 22:36:47.691139+00', 'oauth', '2025-01-24 22:36:47.691099+00'),
	('a65af7f0-b903-45a2-a75a-5a6961ffa970', NULL, '57296b64-bbb9-4d05-8a96-8f1735fe4247', 's256', '3CksG_vQEl68IZH6jikEE0YVq3EhHMjjpF0RZlCovIA', 'google', '', '', '2025-01-24 23:29:34.655289+00', '2025-01-24 23:29:34.655289+00', 'oauth', NULL),
	('412a343b-5b46-4e1f-8143-6f7fb92cc44c', NULL, '16c273f7-69ae-4a2a-b567-77237ec6e868', 's256', 'ruLd1i9KlqRF8wIg3UHn6SM-2UnE2fBMPmCZZYaen0I', 'google', '', '', '2025-01-24 23:29:41.854772+00', '2025-01-24 23:29:41.854772+00', 'oauth', NULL),
	('141b351f-2600-4cb2-b76b-421dedc6a055', NULL, 'f7aee340-b70a-4d58-93b1-5869053e7fae', 's256', '1OMmIjuKZWekjafqpSSePifiRk195VvVDC4hzO96dZE', 'google', '', '', '2025-01-24 23:29:51.583271+00', '2025-01-24 23:29:51.583271+00', 'oauth', NULL),
	('5a5e76c5-278e-4306-8359-bdbc7fcdb0d2', NULL, '0a84fdde-88fa-4eef-b449-15827a5a1a8b', 's256', 'DJlc0xc5wEnDsLmfnO4X42yaen1lzcAONP8rvemdm5w', 'google', '', '', '2025-01-24 23:30:00.777696+00', '2025-01-24 23:30:00.777696+00', 'oauth', NULL),
	('c5a228b7-9f00-48a3-8061-75756c1887eb', NULL, '7f0b5caa-d576-4872-a3cc-2e01d0c42387', 's256', 'wsAlkBOcivhRXP5Z_aG2v2tAoo7uvgsR1Z0_UiYzayo', 'google', '', '', '2025-01-24 23:30:07.578029+00', '2025-01-24 23:30:07.578029+00', 'oauth', NULL),
	('66d2f485-8549-4680-92b3-fc60b676acf4', NULL, 'b64e7ee6-9b97-4ed4-ac67-49de406fd46f', 's256', 'C_3Z7sxRBKwTnwtyRuaAZKDoc5yhW_U_6wytO_5B9aY', 'google', '', '', '2025-01-24 23:41:23.106562+00', '2025-01-24 23:41:23.106562+00', 'oauth', NULL),
	('6833c192-9443-4a87-920c-dde78920bb22', NULL, '85b55f36-aa0a-4afe-b645-64153dc67f44', 's256', 'XEgrb9W0l_FEJepsTFjvMbI9fHuDSzH4r5ImPAueq74', 'google', '', '', '2025-01-24 23:41:30.14446+00', '2025-01-24 23:41:30.14446+00', 'oauth', NULL),
	('25c15a03-ecef-4c4c-b328-f7b0a6a24851', NULL, 'dbdf85a2-42cb-49c0-8bf9-0fee451daeb4', 's256', '_gJxf9nNDUDbepxSXKM2w0KhO-7zv8D2-YUWZO9WsRQ', 'google', '', '', '2025-01-24 23:41:37.595811+00', '2025-01-24 23:41:37.595811+00', 'oauth', NULL),
	('135b59cc-d62a-47a4-a2f1-71ef1e52bad7', '12220aab-8ecd-4650-99a4-6375f03f9291', '767c51a8-eff1-460e-813a-e44f2d630c81', 's256', 'n7Rqa9k_78DZWb4nJAO7ywQ-JzSP5CEIGB449a4lWk8', 'google', 'ya29.a0AXeO80TOTxNgBWoWZDOlP3SU682OXbCtcEQbw0r6faYK58Zi0DtZJWna2ombnGvhaqw54Mnq5NtB-ZxzZ5a4bWaTWv3QhyKKwRlvL7N3g_iuk5CK8Gar8H5FmVoyDQi8INmdXYawfYe1NfxbqDZ39kT41tXFMoRp_ujY0I4daCgYKAaUSARMSFQHGX2MiwRp_OjeD16FkbBcQY98XUw0175', '1//067fb3VzrZBmsCgYIARAAGAYSNwF-L9IrFBqb_-Er3GIzlz-U2CNgr7CVeZOwD6K-kwsY8FsvrJXfGEZrkSyO4Lrvb6gOMyqrbEM', '2025-01-24 23:46:48.831669+00', '2025-01-24 23:47:45.386597+00', 'oauth', '2025-01-24 23:47:45.386555+00'),
	('e224d432-1950-4f7b-a3ef-680ccc6a2b97', '12220aab-8ecd-4650-99a4-6375f03f9291', 'a6f65aec-5036-4859-ab5b-17007afb97ed', 's256', 'j2FHKr8fIVE-N1kUuR6EylZgP-G9z3CG8MVPv-AS3GE', 'google', 'ya29.a0AXeO80TRkrM08O7r9bD2VJUVnZanpgzdmGMr93Ke3i_lJugMY_jJuuvDsCQG5vKd_rbOssP0addvZ7Vw1PGvHe8TXgT5oKB5j-3VArPFiRdllBaJC369Fg9pQ1f3Lqf5tBvqWDnamwIs-lv_dSna8I3bv69QeZ3AgoUXFZZ5aCgYKAf8SARMSFQHGX2Mi_bYmG7hYjsx-YpnXgh4d8g0175', '1//06xLqCG-llBEHCgYIARAAGAYSNwF-L9IrTFd6MCbK5tB6Rv6b9FQ-r3ITOwHLgJsTOsRFNN-q408abOycSuoDI9Lv1x-bIZL9AgQ', '2025-01-24 23:49:17.960573+00', '2025-01-24 23:49:23.124241+00', 'oauth', '2025-01-24 23:49:23.124191+00'),
	('97432be2-354c-4717-9c5c-560d4f1e822b', '12220aab-8ecd-4650-99a4-6375f03f9291', 'fa267738-0c9e-4b91-a5c1-da3cd2a354d8', 's256', '_ZzlltjlPb9XE-Vl4T-ZDcVafLxZ2sbDdNK3hwJGUbA', 'google', 'ya29.a0AXeO80T7JnZGZp5z_5-IPToWSotflEJ0JBf-WdM465nlIhfzk51YVTkMxtJHPog4I6UVEucfI3Bk9-iAtWNxvMaudc9CT2zqIO8FeYS1ygGk2GTlwmjerpd3TnJmKcVN_fQJZBUUq0voJ7wByCqLz23GoFFMfcwRmDTvcCa4aCgYKAasSARMSFQHGX2MioH3KzcglTjImAKyiNg2lcg0175', '1//06LaB3r2if_sXCgYIARAAGAYSNwF-L9IrwRYfxNuWsF6tl2r1KbkGaJzsloxM01qre6cmpiSblHBT2pRGM1PzoSCxipkyVjhx-uc', '2025-01-24 23:50:42.976634+00', '2025-01-24 23:50:46.921675+00', 'oauth', '2025-01-24 23:50:46.921624+00'),
	('f737a32e-da38-4420-9ad7-9ca71ff3f29d', '12220aab-8ecd-4650-99a4-6375f03f9291', 'f906d016-bafd-4909-90b2-09b0765e6f11', 's256', 'rTpe4ehFs3vO_xPrLqWYAw3Wa_32beSXNWytUMqGn70', 'google', 'ya29.a0AXeO80QzyIOSvqvKGr_iwywp55q_run9pFT5y-wO9W05zJEiIMKi7mGgTiX5NMOvEzyY1S6clsjDQ8LxiIp2EZfKpScEBjyXl7vGl33xzVP0xFR4hqx-P9jrzLuEiurcpFrYvb7_qFLQgo-a1YwGxLGe9dgHND_7KBLyeMqmaCgYKAWESARMSFQHGX2Mij4Cl4vch1RM6hfRayEWn1w0175', '1//06EJZiiSe4V4wCgYIARAAGAYSNwF-L9IrrIUdkbMe9SeAh53kRAIJiU-oBTHsGRSM0eX7dxO1zsjr48xfWyUWI1pOzqi0aXBWtz8', '2025-01-24 23:54:47.551502+00', '2025-01-24 23:54:51.659103+00', 'oauth', '2025-01-24 23:54:51.659055+00'),
	('5c587a28-6b97-4413-8d9c-89a396d3fabc', '12220aab-8ecd-4650-99a4-6375f03f9291', '6370169f-b630-46d2-aa9c-2c404f3d5b02', 's256', 'M0erq-mKCnZ-Y09F9mqLegxipIEjX8tnAFuUQ_Odf_s', 'google', 'ya29.a0AXeO80T5vIaQUMp1EEzj-qPMhbbBu-ucKS0BA4BYWlj2kHqAJbVzSkyLggNv2kC1f9FvxjiiPQvlAdjjs2s_-gykmjS01yIijQTnb_X0k5OBd4jP0S5riJspXui4em7QZ8nDY8mWDU-MDZ7undOgsFJWkrB2Px6LJKBjtpnlaCgYKAQASARMSFQHGX2MiHLSFr0cDoiFxEBdZHkDY4Q0175', '1//06ywIcLx87P3JCgYIARAAGAYSNwF-L9IrSJIKGoTutbIAnQ3JaWHIzLu-C2ZnsLU-W6X8SmjT7ut8yKiZDVbrNCatlJs7jWaSq0I', '2025-01-24 23:56:36.137236+00', '2025-01-24 23:56:41.086047+00', 'oauth', '2025-01-24 23:56:41.086003+00'),
	('dd949811-be3a-4d9f-bb07-05726c68ca43', '12220aab-8ecd-4650-99a4-6375f03f9291', '4f244442-9bb2-4832-be81-8b7e6791a18b', 's256', 'jSe7sy3nhP7I5A80VEMYjAnU-Sw3nX2nu2H9B5vl4EU', 'google', 'ya29.a0AXeO80R_mxyKnQyvO4Cr1u2z8uMh7ha0g3VUXTpiAu0kHPiLfI424rJV8Au_gJzKYmfMitSC6b9Q_ELtFcslSI-NuZgMO2_1MCpb-qIMMxLJr9jPsYhx6X33FMSkFQ6jNoD2TwPokGlNPONqS8YlZONavUFjWhX6s6j-7Yb6aCgYKAekSARMSFQHGX2MicPbY-dWALVtKkuNpht6JaQ0175', '1//06C_l0rWqtm8OCgYIARAAGAYSNwF-L9IriGWgpxvZwC5G8tv9pfA2cTKqdMgTTho9CBzl_AhBqKDXkyIIPYgMSd6F0MYAztM5rAc', '2025-01-24 23:58:16.79097+00', '2025-01-24 23:58:21.79426+00', 'oauth', '2025-01-24 23:58:21.794212+00'),
	('d81a130b-5512-47cb-8f56-6e29940d00d5', '12220aab-8ecd-4650-99a4-6375f03f9291', '6a48d005-e663-4da0-9c7b-e75571627eed', 's256', 'L9wVIy_mSrkxuHNzhI05mSbO6CqOG7icCYWJsB-AVT8', 'google', 'ya29.a0AXeO80QvD7oWtuB5SvAd1Y5BIiUlTJZDGPWFbvxdREuHAVjdSTp7g_b2EKWrAL4u6HWC-UdZpir8hN817bkaSlP5XArl4_TiQmHtOWv0X8L171fDNwLiJd5yfX8z7t_mSq5Ec3WkQbJFUHuUr4JFVKqUV5eIvYOJ-FPfTt-qaCgYKAcUSARMSFQHGX2MinLbu-XTanQXYlqd2DcsU6Q0175', '1//06pj6fDtyB1AMCgYIARAAGAYSNwF-L9Ir0CwalTdGHyKXvl135oe4SC1h253kCDbLaXlCxH0T3NfrfVKVI1vlPbhiKGH1LDud0Qg', '2025-01-25 03:11:07.112901+00', '2025-01-25 03:11:17.99115+00', 'oauth', '2025-01-25 03:11:17.991111+00'),
	('1d49112c-3aab-4117-b2b7-144063b91f64', '12220aab-8ecd-4650-99a4-6375f03f9291', '2bcd4443-d0f2-49b5-a100-268e21c5299c', 's256', '_vliVhoMZmQxJJAEi47tEV3HY795m8E86c3pBCdrLF4', 'google', 'ya29.a0AXeO80R-Wp2UMntMhUZmyxsE3IbTNEPaXHUdBpuiut9D4Ik1prWH4P2OC-rW2aU4qwAWI7yoUCGC1lbo_-5BJVI_cyyOb2IwfnNCIb3GWnjzTBehNpMgwIrPBECWRh_1bdfIIdcwoAP7XOdnErpCpTDaiadLsrGl7FZ9KQYUaCgYKAdESARMSFQHGX2MiPjvreal9XUCWybNr-GCbVg0175', '1//06A9WQQQvsAdnCgYIARAAGAYSNwF-L9IrYn6vu6mYKffw5PTrYSEJeIheeTtNLVbPSVHJiVdJTPQ6R2q-qvOuQClNUkkM73mSTEU', '2025-01-25 03:11:51.754199+00', '2025-01-25 03:11:56.376966+00', 'oauth', '2025-01-25 03:11:56.376923+00'),
	('ef713d9e-aed1-4478-80ed-12fb98ac4728', NULL, '8541fe2e-0b03-4131-8cd3-d828fb91da23', 's256', 'Ao7Z4qVAXhchlkjnojBJtaDSVYicV4e2XEXuwrSdJf4', 'google', '', '', '2025-01-25 01:58:31.095473+00', '2025-01-25 01:58:31.095473+00', 'oauth', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	(NULL, 'd0d8c19c-3b73-4c20-8a30-136b8888c042', NULL, NULL, 'admin@acme.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', NULL, NULL, 'agent@acme.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', NULL, NULL, 'customer@acme.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '49e6508f-13ec-450b-860d-98e9e813352b', 'authenticated', 'authenticated', 'reeceharding225@gmail.com', '$2a$10$yJTkXKAfMByOdSzioTKCP..2OwnVKaaqZvK/B39QPnx5bfbYTP17C', '2025-01-21 23:28:57.621333+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"name": "reeceharding225", "email_verified": true}', NULL, '2025-01-21 23:28:57.595342+00', '2025-01-21 23:28:57.622199+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '85ec2f98-7858-470c-8a0b-ef9e04afcb7c', 'authenticated', 'authenticated', 'auto-admin-collegeforreece3-33319743983@gmail.com', '$2a$10$p30MeP4EPZuKv9qUSGalyeGMeKmsAAS25JS/4xd3exXT7QJg0EYQ6', '2025-01-25 03:12:09.168801+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 03:12:09.172483+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "85ec2f98-7858-470c-8a0b-ef9e04afcb7c", "email": "auto-admin-collegeforreece3-33319743983@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2025-01-25 03:12:09.161278+00', '2025-01-25 03:12:09.174734+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '7aa2fe34-91a4-4ef0-b885-f4b522213a8f', 'authenticated', 'authenticated', 'auto-admin-collegeforreece3-3339743983@gmail.com', '$2a$10$lRsD/xVNJRf5DLc55ew67OSBxhedgGONqBP95O9g0UASKdjfOWVk2', '2025-01-25 02:17:28.606755+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:17:28.611651+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "7aa2fe34-91a4-4ef0-b885-f4b522213a8f", "email": "auto-admin-collegeforreece3-3339743983@gmail.com", "email_verified": true, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:17:28.360Z"}', NULL, '2025-01-25 02:17:28.591835+00', '2025-01-25 02:17:28.61535+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'e1e8f9b3-096f-4501-86e6-637ba8119957', 'authenticated', 'authenticated', 'auto-admin-collegeforreece-313383@gmail.com', '$2a$10$1jUbWIJXA2HyWCDPje/YR.bt8DSYoCn8b66TnDlfFmRXLk.x.1Mwe', '2025-01-25 03:13:45.891006+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 03:13:45.895066+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "e1e8f9b3-096f-4501-86e6-637ba8119957", "email": "auto-admin-collegeforreece-313383@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2025-01-25 03:13:45.882445+00', '2025-01-25 03:13:45.897253+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '0c0df787-052b-4a90-982b-fe17146c8aae', 'authenticated', 'authenticated', 'rieboysspam@gmail.com', NULL, '2025-01-24 21:48:10.680732+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:39:43.718374+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "103350329671192118537", "name": "Reece Harding", "email": "rieboysspam@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLjp7YTHXHfPzE1ITmiNqqNn8bLSJpxMXqQxNy7a1szpb2lrh4=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLjp7YTHXHfPzE1ITmiNqqNn8bLSJpxMXqQxNy7a1szpb2lrh4=s96-c", "provider_id": "103350329671192118537", "email_verified": true, "phone_verified": false}', NULL, '2025-01-24 21:48:10.639335+00', '2025-01-25 02:39:43.720718+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', 'authenticated', 'authenticated', 'reeceharding@gmail.com', NULL, '2025-01-25 00:52:57.873326+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 00:52:57.87554+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "110461674898900232034", "name": "Reece Harding", "email": "reeceharding@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIZGEImAG0X5Tq9LCpulPx1-3YLEN8fTi-ceqhVV-xwTmlO_pFpOA=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIZGEImAG0X5Tq9LCpulPx1-3YLEN8fTi-ceqhVV-xwTmlO_pFpOA=s96-c", "provider_id": "110461674898900232034", "email_verified": true, "phone_verified": false}', NULL, '2025-01-25 00:52:57.85256+00', '2025-01-25 00:52:57.879087+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f8760260-c522-4ee3-b964-c902eb6f062d', 'authenticated', 'authenticated', 'auto-admin-collegeforreece33-339743983@gmail.com', '$2a$10$Vafrhux2NBFAD7RbFVGS.OeuF5rRGXUvA1xOKr02FlzVLPZmF/CN6', '2025-01-25 02:10:47.313256+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:10:47.317003+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "f8760260-c522-4ee3-b964-c902eb6f062d", "email": "auto-admin-collegeforreece33-339743983@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2025-01-25 02:10:47.298487+00', '2025-01-25 02:10:47.321457+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '12220aab-8ecd-4650-99a4-6375f03f9291', 'authenticated', 'authenticated', 'collegeforreece@gmail.com', NULL, '2025-01-24 23:08:08.203645+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:56:10.821332+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "105385674953487670529", "name": "Reece Harding", "email": "collegeforreece@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIHxNjouZx_w6Nlh0uxjnJ14e-y0VmnDrJIFVlwBjpW9KtbN3k3=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIHxNjouZx_w6Nlh0uxjnJ14e-y0VmnDrJIFVlwBjpW9KtbN3k3=s96-c", "provider_id": "105385674953487670529", "email_verified": true, "phone_verified": false}', NULL, '2025-01-24 23:08:08.188287+00', '2025-01-25 03:11:56.376164+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4911537d-8301-492a-bfb3-1ff294b640ca', 'authenticated', 'authenticated', 'auto-admin-collegeforreece-333383@gmail.com', '$2a$10$XvYXGaywUz1lnXpyE8hIhO7XjVPXSX91c7Gn0tCMAcgj3jv.bv2a.', '2025-01-25 02:20:18.16936+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:20:18.173166+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "4911537d-8301-492a-bfb3-1ff294b640ca", "email": "auto-admin-collegeforreece-333383@gmail.com", "email_verified": true, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:20:17.947Z"}', NULL, '2025-01-25 02:20:18.155373+00', '2025-01-25 02:20:18.177684+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', 'authenticated', 'authenticated', 'auto-admin-collegeforreece-3331383@gmail.com', '$2a$10$bYaX5rA3/HofOy9s99DwheVqzml4ZSZ1fj0MkvZardc00sib0gdKq', '2025-01-25 02:20:21.018083+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 02:20:21.020914+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "c76a8dfd-ce07-41d6-83c5-dc56a61cfb90", "email": "auto-admin-collegeforreece-3331383@gmail.com", "email_verified": true, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:20:20.830Z"}', NULL, '2025-01-25 02:20:21.012887+00', '2025-01-25 02:20:21.023149+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', 'authenticated', 'authenticated', 'auto-admin-collegeforree3ce-33383@gmail.com', '$2a$10$CLiJ2GAWUhqmevi6.caA/edQf/bC06KtRMPzJLYZZbuWROnrNHArC', '2025-01-25 03:35:13.677123+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-01-25 03:35:13.681531+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9", "email": "auto-admin-collegeforree3ce-33383@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2025-01-25 03:35:13.668643+00', '2025-01-25 03:35:13.683562+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('49e6508f-13ec-450b-860d-98e9e813352b', '49e6508f-13ec-450b-860d-98e9e813352b', '{"sub": "49e6508f-13ec-450b-860d-98e9e813352b", "email": "reeceharding225@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-01-21 23:28:57.613084+00', '2025-01-21 23:28:57.613141+00', '2025-01-21 23:28:57.613141+00', '8042840f-8006-42e6-a57e-d8664343d1b6'),
	('7aa2fe34-91a4-4ef0-b885-f4b522213a8f', '7aa2fe34-91a4-4ef0-b885-f4b522213a8f', '{"sub": "7aa2fe34-91a4-4ef0-b885-f4b522213a8f", "email": "auto-admin-collegeforreece3-3339743983@gmail.com", "email_verified": false, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:17:28.360Z"}', 'email', '2025-01-25 02:17:28.601288+00', '2025-01-25 02:17:28.601336+00', '2025-01-25 02:17:28.601336+00', '8e30f806-18ec-4de6-becd-30e4adb84bde'),
	('4911537d-8301-492a-bfb3-1ff294b640ca', '4911537d-8301-492a-bfb3-1ff294b640ca', '{"sub": "4911537d-8301-492a-bfb3-1ff294b640ca", "email": "auto-admin-collegeforreece-333383@gmail.com", "email_verified": false, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:20:17.947Z"}', 'email', '2025-01-25 02:20:18.162666+00', '2025-01-25 02:20:18.162709+00', '2025-01-25 02:20:18.162709+00', '6b54ee42-b62c-47a9-918f-8e99e62abd1f'),
	('c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', 'c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', '{"sub": "c76a8dfd-ce07-41d6-83c5-dc56a61cfb90", "email": "auto-admin-collegeforreece-3331383@gmail.com", "email_verified": false, "phone_verified": false, "email_confirmed_at": "2025-01-25T02:20:20.830Z"}', 'email', '2025-01-25 02:20:21.015748+00', '2025-01-25 02:20:21.015795+00', '2025-01-25 02:20:21.015795+00', 'c9b5a547-4c56-44d9-9a99-c981b575ae04'),
	('110461674898900232034', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', '{"iss": "https://accounts.google.com", "sub": "110461674898900232034", "name": "Reece Harding", "email": "reeceharding@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIZGEImAG0X5Tq9LCpulPx1-3YLEN8fTi-ceqhVV-xwTmlO_pFpOA=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIZGEImAG0X5Tq9LCpulPx1-3YLEN8fTi-ceqhVV-xwTmlO_pFpOA=s96-c", "provider_id": "110461674898900232034", "email_verified": true, "phone_verified": false}', 'google', '2025-01-25 00:52:57.865386+00', '2025-01-25 00:52:57.865435+00', '2025-01-25 00:52:57.865435+00', '7574b77c-393b-4388-ace3-485b191df406'),
	('105385674953487670529', '12220aab-8ecd-4650-99a4-6375f03f9291', '{"iss": "https://accounts.google.com", "sub": "105385674953487670529", "name": "Reece Harding", "email": "collegeforreece@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIHxNjouZx_w6Nlh0uxjnJ14e-y0VmnDrJIFVlwBjpW9KtbN3k3=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIHxNjouZx_w6Nlh0uxjnJ14e-y0VmnDrJIFVlwBjpW9KtbN3k3=s96-c", "provider_id": "105385674953487670529", "email_verified": true, "phone_verified": false}', 'google', '2025-01-24 23:08:08.198+00', '2025-01-24 23:08:08.198055+00', '2025-01-25 03:11:56.374858+00', '72c34431-bd66-4794-a445-c7267ba972d4'),
	('85ec2f98-7858-470c-8a0b-ef9e04afcb7c', '85ec2f98-7858-470c-8a0b-ef9e04afcb7c', '{"sub": "85ec2f98-7858-470c-8a0b-ef9e04afcb7c", "email": "auto-admin-collegeforreece3-33319743983@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-01-25 03:12:09.166384+00', '2025-01-25 03:12:09.166429+00', '2025-01-25 03:12:09.166429+00', '74370524-7450-4d33-a72e-0f60852cbe97'),
	('103350329671192118537', '0c0df787-052b-4a90-982b-fe17146c8aae', '{"iss": "https://accounts.google.com", "sub": "103350329671192118537", "name": "Reece Harding", "email": "rieboysspam@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLjp7YTHXHfPzE1ITmiNqqNn8bLSJpxMXqQxNy7a1szpb2lrh4=s96-c", "full_name": "Reece Harding", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLjp7YTHXHfPzE1ITmiNqqNn8bLSJpxMXqQxNy7a1szpb2lrh4=s96-c", "provider_id": "103350329671192118537", "email_verified": true, "phone_verified": false}', 'google', '2025-01-24 21:48:10.670127+00', '2025-01-24 21:48:10.670405+00', '2025-01-25 02:39:42.640772+00', '19be06f2-7628-48b6-b398-449815decd07'),
	('e1e8f9b3-096f-4501-86e6-637ba8119957', 'e1e8f9b3-096f-4501-86e6-637ba8119957', '{"sub": "e1e8f9b3-096f-4501-86e6-637ba8119957", "email": "auto-admin-collegeforreece-313383@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-01-25 03:13:45.887951+00', '2025-01-25 03:13:45.888017+00', '2025-01-25 03:13:45.888017+00', 'd5fe1b5b-4d19-4ed4-b474-9decaa39c453'),
	('f8760260-c522-4ee3-b964-c902eb6f062d', 'f8760260-c522-4ee3-b964-c902eb6f062d', '{"sub": "f8760260-c522-4ee3-b964-c902eb6f062d", "email": "auto-admin-collegeforreece33-339743983@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-01-25 02:10:47.307505+00', '2025-01-25 02:10:47.307552+00', '2025-01-25 02:10:47.307552+00', 'afb7f060-6826-4ff2-966d-9faff2f2f5e2'),
	('e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', 'e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', '{"sub": "e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9", "email": "auto-admin-collegeforree3ce-33383@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-01-25 03:35:13.674151+00', '2025-01-25 03:35:13.674194+00', '2025-01-25 03:35:13.674194+00', '54d367a9-1a10-42e2-9448-2c686893139a');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") VALUES
	('375c35ba-ab20-4e9c-ac34-6bd7f4448d73', '0c0df787-052b-4a90-982b-fe17146c8aae', '2025-01-24 22:13:42.771221+00', '2025-01-24 22:13:42.771221+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('9b93d405-75c6-4133-b802-216ecc5be5b9', '0c0df787-052b-4a90-982b-fe17146c8aae', '2025-01-24 23:00:04.633317+00', '2025-01-24 23:00:04.633317+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('49eae1db-a43a-43c0-a3b6-549c55571fb9', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:08:09.905662+00', '2025-01-24 23:08:09.905662+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('6840bac5-f7bf-4148-84d2-9142ebb24918', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:12:17.819205+00', '2025-01-24 23:12:17.819205+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('9cf733bf-cd5f-4ed3-a7a8-51c2370138af', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:16:25.237401+00', '2025-01-24 23:16:25.237401+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('fe799ed1-eac6-4116-8da9-a5d1dd981e82', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:21:31.506546+00', '2025-01-24 23:21:31.506546+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('6578fd03-aadd-40b8-aaca-e2091965886c', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:26:09.423237+00', '2025-01-24 23:26:09.423237+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('3a38d070-9c7a-483e-a05a-42e0e2353777', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:33:02.829587+00', '2025-01-24 23:33:02.829587+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('c2d13c89-97ba-45a0-824a-edf67980f360', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:36:17.221066+00', '2025-01-24 23:36:17.221066+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('3c47660c-7c2c-4c77-8ae4-02289b202eb8', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:38:33.279467+00', '2025-01-24 23:38:33.279467+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('9f925c1c-c2fb-4ac1-bcc3-da1861b45c9e', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-24 23:41:17.540427+00', '2025-01-24 23:41:17.540427+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('31c36565-d9ed-408f-b0b0-150a8cf7a492', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 00:03:42.407557+00', '2025-01-25 00:03:42.407557+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('7277927c-7e84-4878-80bc-720d254458f6', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', '2025-01-25 00:52:57.87561+00', '2025-01-25 00:52:57.87561+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('894091c9-b635-4297-935f-1144c910f22e', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 01:41:10.858745+00', '2025-01-25 01:41:10.858745+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('0c5b780a-0666-4f30-8494-7c299b2e1b58', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 01:48:08.983943+00', '2025-01-25 01:48:08.983943+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('ae9dd3b6-c121-4034-85b4-a61c0f933493', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 01:49:10.09597+00', '2025-01-25 01:49:10.09597+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('84903970-77cc-4325-bc7f-f2abff19d8f3', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 01:59:07.055198+00', '2025-01-25 01:59:07.055198+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('545420d0-911e-484c-abfa-f8e52eed9ed0', 'f8760260-c522-4ee3-b964-c902eb6f062d', '2025-01-25 02:10:47.317067+00', '2025-01-25 02:10:47.317067+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('7bc5d1f4-708c-4f73-acf5-c659c92bd240', '7aa2fe34-91a4-4ef0-b885-f4b522213a8f', '2025-01-25 02:17:28.611728+00', '2025-01-25 02:17:28.611728+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('691c0176-dc2c-4591-8e79-6c6c9bba1d1b', '4911537d-8301-492a-bfb3-1ff294b640ca', '2025-01-25 02:20:18.173239+00', '2025-01-25 02:20:18.173239+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('63acf360-1786-4488-8bbf-af57fe4aadd7', 'c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', '2025-01-25 02:20:21.020996+00', '2025-01-25 02:20:21.020996+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('4dd54cea-d3ca-46dd-94d2-c4bd4e06a4dc', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 02:26:58.069557+00', '2025-01-25 02:26:58.069557+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('4ac6efc3-8dee-455f-be7d-6d0b47cd7f3a', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 02:38:51.92798+00', '2025-01-25 02:38:51.92798+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('be8fa8b8-808f-4072-b6ac-3c5f6481aa69', '0c0df787-052b-4a90-982b-fe17146c8aae', '2025-01-25 02:39:43.718455+00', '2025-01-25 02:39:43.718455+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('d0c01a9e-601c-4b40-bfcc-d1f239c6d936', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 02:46:02.747502+00', '2025-01-25 02:46:02.747502+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('73ff6b76-2698-40e6-8cdc-94d9392cbfcb', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 02:52:06.364498+00', '2025-01-25 02:52:06.364498+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('bff5272f-72b2-44c3-8272-6fe37f8f3714', '12220aab-8ecd-4650-99a4-6375f03f9291', '2025-01-25 02:56:10.821404+00', '2025-01-25 02:56:10.821404+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('86f6b032-c2ca-4bdc-94a5-a98a121527c3', '85ec2f98-7858-470c-8a0b-ef9e04afcb7c', '2025-01-25 03:12:09.172555+00', '2025-01-25 03:12:09.172555+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', '107.3.66.9', NULL),
	('21c99567-a00c-43c1-9cf5-4b0f5d44e0fd', 'e1e8f9b3-096f-4501-86e6-637ba8119957', '2025-01-25 03:13:45.895133+00', '2025-01-25 03:13:45.895133+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL),
	('ff134023-4490-421f-bbe2-d5bd5d4237ed', 'e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', '2025-01-25 03:35:13.681601+00', '2025-01-25 03:35:13.681601+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', '107.3.66.9', NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('375c35ba-ab20-4e9c-ac34-6bd7f4448d73', '2025-01-24 22:13:42.783536+00', '2025-01-24 22:13:42.783536+00', 'oauth', '1364ed07-9e3b-4a57-98ac-d60e0b3295b3'),
	('9b93d405-75c6-4133-b802-216ecc5be5b9', '2025-01-24 23:00:04.636777+00', '2025-01-24 23:00:04.636777+00', 'oauth', 'd655e7fd-77ea-4fc9-8ee8-67c2d7ff0342'),
	('49eae1db-a43a-43c0-a3b6-549c55571fb9', '2025-01-24 23:08:09.908248+00', '2025-01-24 23:08:09.908248+00', 'oauth', '5aaace8a-be21-4382-8013-7acd7bb76d2e'),
	('6840bac5-f7bf-4148-84d2-9142ebb24918', '2025-01-24 23:12:17.821993+00', '2025-01-24 23:12:17.821993+00', 'oauth', '2ff39074-7ab4-4107-bb82-a501695b3471'),
	('9cf733bf-cd5f-4ed3-a7a8-51c2370138af', '2025-01-24 23:16:25.240948+00', '2025-01-24 23:16:25.240948+00', 'oauth', '5cf9ef53-8168-4594-872c-2103f7d857dc'),
	('fe799ed1-eac6-4116-8da9-a5d1dd981e82', '2025-01-24 23:21:31.509399+00', '2025-01-24 23:21:31.509399+00', 'oauth', '0615922c-7b92-4c62-855b-bc643c81f4fe'),
	('6578fd03-aadd-40b8-aaca-e2091965886c', '2025-01-24 23:26:09.427474+00', '2025-01-24 23:26:09.427474+00', 'oauth', 'f47ebf82-208a-4f29-91d4-f77f928ea73b'),
	('3a38d070-9c7a-483e-a05a-42e0e2353777', '2025-01-24 23:33:02.83314+00', '2025-01-24 23:33:02.83314+00', 'oauth', 'f7781033-44e5-4460-9058-4bf85e5f31f1'),
	('c2d13c89-97ba-45a0-824a-edf67980f360', '2025-01-24 23:36:17.223768+00', '2025-01-24 23:36:17.223768+00', 'oauth', 'bbef1854-8975-499d-8c83-10eeb3cfed35'),
	('3c47660c-7c2c-4c77-8ae4-02289b202eb8', '2025-01-24 23:38:33.283554+00', '2025-01-24 23:38:33.283554+00', 'oauth', '8332edde-8052-430e-a678-663171ac8053'),
	('9f925c1c-c2fb-4ac1-bcc3-da1861b45c9e', '2025-01-24 23:41:17.544206+00', '2025-01-24 23:41:17.544206+00', 'oauth', '1e9ede69-0edc-4d37-aa1f-c2a0f12cf7aa'),
	('31c36565-d9ed-408f-b0b0-150a8cf7a492', '2025-01-25 00:03:42.411092+00', '2025-01-25 00:03:42.411092+00', 'oauth', 'ba1a3583-149d-4c04-9347-c8cb3a7917cc'),
	('7277927c-7e84-4878-80bc-720d254458f6', '2025-01-25 00:52:57.87948+00', '2025-01-25 00:52:57.87948+00', 'oauth', '2431a561-012d-48ec-abd4-4e46017c39ff'),
	('894091c9-b635-4297-935f-1144c910f22e', '2025-01-25 01:41:10.86568+00', '2025-01-25 01:41:10.86568+00', 'oauth', 'e36ee747-77ae-488c-87ce-57a7168b9cc7'),
	('0c5b780a-0666-4f30-8494-7c299b2e1b58', '2025-01-25 01:48:08.98861+00', '2025-01-25 01:48:08.98861+00', 'oauth', '5d398ab7-1fcc-4450-8bad-cce72c5782e0'),
	('ae9dd3b6-c121-4034-85b4-a61c0f933493', '2025-01-25 01:49:10.098488+00', '2025-01-25 01:49:10.098488+00', 'oauth', '0d7955db-eb2d-4d8a-ae14-5f1150fcd704'),
	('84903970-77cc-4325-bc7f-f2abff19d8f3', '2025-01-25 01:59:07.059386+00', '2025-01-25 01:59:07.059386+00', 'oauth', 'f2ac54b7-e661-40d3-b114-0e56a535fea0'),
	('545420d0-911e-484c-abfa-f8e52eed9ed0', '2025-01-25 02:10:47.321856+00', '2025-01-25 02:10:47.321856+00', 'password', 'ace36134-b6a2-457a-915f-5516ca248636'),
	('7bc5d1f4-708c-4f73-acf5-c659c92bd240', '2025-01-25 02:17:28.615736+00', '2025-01-25 02:17:28.615736+00', 'password', 'c65b9c28-8b50-4c2a-9af1-ecdcf84146c2'),
	('691c0176-dc2c-4591-8e79-6c6c9bba1d1b', '2025-01-25 02:20:18.178084+00', '2025-01-25 02:20:18.178084+00', 'password', 'fd244524-cfde-4b33-955a-c689aca98999'),
	('63acf360-1786-4488-8bbf-af57fe4aadd7', '2025-01-25 02:20:21.023457+00', '2025-01-25 02:20:21.023457+00', 'password', '2a6d8b0c-5c29-43bf-9fc7-652fd767b3a3'),
	('4dd54cea-d3ca-46dd-94d2-c4bd4e06a4dc', '2025-01-25 02:26:58.073585+00', '2025-01-25 02:26:58.073585+00', 'oauth', '9395a044-d426-42b4-b5f0-e7d5b19c228b'),
	('4ac6efc3-8dee-455f-be7d-6d0b47cd7f3a', '2025-01-25 02:38:51.932847+00', '2025-01-25 02:38:51.932847+00', 'oauth', 'ec6f5d35-b92c-43ae-8021-a9c0110e475c'),
	('be8fa8b8-808f-4072-b6ac-3c5f6481aa69', '2025-01-25 02:39:43.721011+00', '2025-01-25 02:39:43.721011+00', 'oauth', '6c528643-a2c0-4866-bdd6-2a7c2a12cd75'),
	('d0c01a9e-601c-4b40-bfcc-d1f239c6d936', '2025-01-25 02:46:02.750932+00', '2025-01-25 02:46:02.750932+00', 'oauth', '1f042716-91e1-45e9-874d-4351f547ecd2'),
	('73ff6b76-2698-40e6-8cdc-94d9392cbfcb', '2025-01-25 02:52:06.369652+00', '2025-01-25 02:52:06.369652+00', 'oauth', '3a367d73-f0b5-4bf1-894b-24f294787df8'),
	('bff5272f-72b2-44c3-8272-6fe37f8f3714', '2025-01-25 02:56:10.824157+00', '2025-01-25 02:56:10.824157+00', 'oauth', 'd157c850-161c-4f11-828c-d6485b53cc99'),
	('86f6b032-c2ca-4bdc-94a5-a98a121527c3', '2025-01-25 03:12:09.175158+00', '2025-01-25 03:12:09.175158+00', 'password', '60bb9797-310f-4831-8ee9-47e0d97c3b13'),
	('21c99567-a00c-43c1-9cf5-4b0f5d44e0fd', '2025-01-25 03:13:45.89769+00', '2025-01-25 03:13:45.89769+00', 'password', 'be9ea361-8400-4405-a102-95eed2517ad7'),
	('ff134023-4490-421f-bbe2-d5bd5d4237ed', '2025-01-25 03:35:13.683916+00', '2025-01-25 03:35:13.683916+00', 'password', '1d032f8e-2a66-4ac8-afd3-47822f5bb9ff');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 1, 'P953NmppaTbGqOxbnGMeSg', '0c0df787-052b-4a90-982b-fe17146c8aae', false, '2025-01-24 22:13:42.77432+00', '2025-01-24 22:13:42.77432+00', NULL, '375c35ba-ab20-4e9c-ac34-6bd7f4448d73'),
	('00000000-0000-0000-0000-000000000000', 2, 'U8svj7jE1QHIZIOKmtHnsA', '0c0df787-052b-4a90-982b-fe17146c8aae', false, '2025-01-24 23:00:04.634986+00', '2025-01-24 23:00:04.634986+00', NULL, '9b93d405-75c6-4133-b802-216ecc5be5b9'),
	('00000000-0000-0000-0000-000000000000', 3, '4tmAsFGpXHEQn0Rsxxm83g', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:08:09.906557+00', '2025-01-24 23:08:09.906557+00', NULL, '49eae1db-a43a-43c0-a3b6-549c55571fb9'),
	('00000000-0000-0000-0000-000000000000', 4, 'h9MpdhN_ZeCRIpEKJDwiNg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:12:17.820273+00', '2025-01-24 23:12:17.820273+00', NULL, '6840bac5-f7bf-4148-84d2-9142ebb24918'),
	('00000000-0000-0000-0000-000000000000', 5, 'r2U6Rv-aFvKTbfb937y2kg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:16:25.238439+00', '2025-01-24 23:16:25.238439+00', NULL, '9cf733bf-cd5f-4ed3-a7a8-51c2370138af'),
	('00000000-0000-0000-0000-000000000000', 6, 'KQb3QnnI8YpKSFj6_zV-UA', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:21:31.507567+00', '2025-01-24 23:21:31.507567+00', NULL, 'fe799ed1-eac6-4116-8da9-a5d1dd981e82'),
	('00000000-0000-0000-0000-000000000000', 7, 'sQCBvUCO-JOkoOplyVVJ5Q', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:26:09.424201+00', '2025-01-24 23:26:09.424201+00', NULL, '6578fd03-aadd-40b8-aaca-e2091965886c'),
	('00000000-0000-0000-0000-000000000000', 8, 'MsBTRcWxP5Xmwi8e1FD8Jw', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:33:02.830557+00', '2025-01-24 23:33:02.830557+00', NULL, '3a38d070-9c7a-483e-a05a-42e0e2353777'),
	('00000000-0000-0000-0000-000000000000', 9, 'Ext-WSlHA2PiT0LfuNOM0Q', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:36:17.222019+00', '2025-01-24 23:36:17.222019+00', NULL, 'c2d13c89-97ba-45a0-824a-edf67980f360'),
	('00000000-0000-0000-0000-000000000000', 10, 'vclqwO0FkD455JNTAWnSSg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:38:33.280482+00', '2025-01-24 23:38:33.280482+00', NULL, '3c47660c-7c2c-4c77-8ae4-02289b202eb8'),
	('00000000-0000-0000-0000-000000000000', 11, 'LHGvhBvl5GGxPotqCHiXGg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-24 23:41:17.541376+00', '2025-01-24 23:41:17.541376+00', NULL, '9f925c1c-c2fb-4ac1-bcc3-da1861b45c9e'),
	('00000000-0000-0000-0000-000000000000', 12, '49ia7mK5CYIN9eKaZV-WVQ', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 00:03:42.408796+00', '2025-01-25 00:03:42.408796+00', NULL, '31c36565-d9ed-408f-b0b0-150a8cf7a492'),
	('00000000-0000-0000-0000-000000000000', 13, 'ti0F1O6n6hLtaWQvbjLbaw', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', false, '2025-01-25 00:52:57.87787+00', '2025-01-25 00:52:57.87787+00', NULL, '7277927c-7e84-4878-80bc-720d254458f6'),
	('00000000-0000-0000-0000-000000000000', 14, 'JF6FTLYpIQfzBYKOes7yxg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 01:41:10.860493+00', '2025-01-25 01:41:10.860493+00', NULL, '894091c9-b635-4297-935f-1144c910f22e'),
	('00000000-0000-0000-0000-000000000000', 15, 'JtPpO62yxFBiIw65ExBKcw', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 01:48:08.985628+00', '2025-01-25 01:48:08.985628+00', NULL, '0c5b780a-0666-4f30-8494-7c299b2e1b58'),
	('00000000-0000-0000-0000-000000000000', 16, 'wx0_VkAtXaFYom7FQMplqg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 01:49:10.09731+00', '2025-01-25 01:49:10.09731+00', NULL, 'ae9dd3b6-c121-4034-85b4-a61c0f933493'),
	('00000000-0000-0000-0000-000000000000', 17, 'JOdl9f8fhFCqSdcYE1hElA', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 01:59:07.056729+00', '2025-01-25 01:59:07.056729+00', NULL, '84903970-77cc-4325-bc7f-f2abff19d8f3'),
	('00000000-0000-0000-0000-000000000000', 18, 'X8SXgjoUnhswP_12m-tISw', 'f8760260-c522-4ee3-b964-c902eb6f062d', false, '2025-01-25 02:10:47.31907+00', '2025-01-25 02:10:47.31907+00', NULL, '545420d0-911e-484c-abfa-f8e52eed9ed0'),
	('00000000-0000-0000-0000-000000000000', 19, 'qJmk6iUGciop0gXzei3h2Q', '7aa2fe34-91a4-4ef0-b885-f4b522213a8f', false, '2025-01-25 02:17:28.613069+00', '2025-01-25 02:17:28.613069+00', NULL, '7bc5d1f4-708c-4f73-acf5-c659c92bd240'),
	('00000000-0000-0000-0000-000000000000', 20, 'N3qSzFLu-VWXCr7bZLWKQw', '4911537d-8301-492a-bfb3-1ff294b640ca', false, '2025-01-25 02:20:18.175382+00', '2025-01-25 02:20:18.175382+00', NULL, '691c0176-dc2c-4591-8e79-6c6c9bba1d1b'),
	('00000000-0000-0000-0000-000000000000', 21, 'yOvLRLpy2vS2Tbinv0Gqmw', 'c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', false, '2025-01-25 02:20:21.022349+00', '2025-01-25 02:20:21.022349+00', NULL, '63acf360-1786-4488-8bbf-af57fe4aadd7'),
	('00000000-0000-0000-0000-000000000000', 22, 'FXWZ4371XynRNaKgZjgMjw', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 02:26:58.071181+00', '2025-01-25 02:26:58.071181+00', NULL, '4dd54cea-d3ca-46dd-94d2-c4bd4e06a4dc'),
	('00000000-0000-0000-0000-000000000000', 23, 'sYPqOW2lbMPokvUOUZ99Mw', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 02:38:51.930282+00', '2025-01-25 02:38:51.930282+00', NULL, '4ac6efc3-8dee-455f-be7d-6d0b47cd7f3a'),
	('00000000-0000-0000-0000-000000000000', 24, 'D1qkHTtfzkbuBEH7QUdQ-g', '0c0df787-052b-4a90-982b-fe17146c8aae', false, '2025-01-25 02:39:43.719117+00', '2025-01-25 02:39:43.719117+00', NULL, 'be8fa8b8-808f-4072-b6ac-3c5f6481aa69'),
	('00000000-0000-0000-0000-000000000000', 25, 'xjjIdGjnNNYv7Car4hveaQ', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 02:46:02.748474+00', '2025-01-25 02:46:02.748474+00', NULL, 'd0c01a9e-601c-4b40-bfcc-d1f239c6d936'),
	('00000000-0000-0000-0000-000000000000', 26, 'fbBGp3U6o6lb-Kg1JxXj2w', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 02:52:06.366147+00', '2025-01-25 02:52:06.366147+00', NULL, '73ff6b76-2698-40e6-8cdc-94d9392cbfcb'),
	('00000000-0000-0000-0000-000000000000', 27, 'Ft7CQLQ8FUbmlCvJAFRpHg', '12220aab-8ecd-4650-99a4-6375f03f9291', false, '2025-01-25 02:56:10.822456+00', '2025-01-25 02:56:10.822456+00', NULL, 'bff5272f-72b2-44c3-8272-6fe37f8f3714'),
	('00000000-0000-0000-0000-000000000000', 28, 'hEjmw_dEqb-PolcV0X9SKA', '85ec2f98-7858-470c-8a0b-ef9e04afcb7c', false, '2025-01-25 03:12:09.173447+00', '2025-01-25 03:12:09.173447+00', NULL, '86f6b032-c2ca-4bdc-94a5-a98a121527c3'),
	('00000000-0000-0000-0000-000000000000', 29, 'EDuV8TrV8PpjNAAWpJgWwA', 'e1e8f9b3-096f-4501-86e6-637ba8119957', false, '2025-01-25 03:13:45.896032+00', '2025-01-25 03:13:45.896032+00', NULL, '21c99567-a00c-43c1-9cf5-4b0f5d44e0fd'),
	('00000000-0000-0000-0000-000000000000', 30, '8SUhhSWzS4DemzIHouQKbg', 'e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', false, '2025-01-25 03:35:13.682316+00', '2025-01-25 03:35:13.682316+00', NULL, 'ff134023-4490-421f-bbe2-d5bd5d4237ed');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: key; Type: TABLE DATA; Schema: pgsodium; Owner: supabase_admin
--



--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."organizations" ("id", "name", "sla_tier", "config", "created_at", "updated_at", "gmail_refresh_token", "gmail_access_token", "gmail_watch_expiration", "gmail_history_id") VALUES
	('123e4567-e89b-12d3-a456-426614174000', 'Acme Corp', 'premium', '{}', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00', NULL, NULL, NULL, NULL),
	('33b311a0-b110-454e-b7de-3dff655869cb', 'gmail', 'basic', '{}', '2025-01-21 23:35:43.391+00', '2025-01-21 23:35:43.392+00', NULL, NULL, NULL, NULL),
	('ee0f56a0-4130-4398-bc2d-27529f82efb1', 'Default Organization', 'basic', '{}', '2025-01-21 04:36:19.740948+00', '2025-01-25 03:35:13.668292+00', NULL, NULL, NULL, '2180684');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "role", "display_name", "email", "phone", "avatar_url", "metadata", "extra_text_1", "extra_json_1", "org_id", "created_at", "updated_at", "gmail_refresh_token", "gmail_access_token") VALUES
	('d0d8c19c-3b73-4c20-8a30-136b8888c042', 'admin', 'Admin User', 'admin@acme.com', NULL, NULL, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00', NULL, NULL),
	('8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'agent', 'Agent User', 'agent@acme.com', NULL, NULL, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00', NULL, NULL),
	('f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'customer', 'Customer User', 'customer@acme.com', NULL, NULL, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00', NULL, NULL),
	('49e6508f-13ec-450b-860d-98e9e813352b', 'super_admin', 'reeceharding225', 'reeceharding225@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-21 23:28:57.590597+00', '2025-01-21 23:28:57.81661+00', NULL, NULL),
	('0c0df787-052b-4a90-982b-fe17146c8aae', 'customer', 'rieboysspam', 'rieboysspam@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-24 21:48:10.627884+00', '2025-01-24 21:48:10.627884+00', NULL, NULL),
	('4a7af137-09b5-4f8d-ab25-27392e9dd81d', 'admin', 'reeceharding', 'reeceharding@gmail.com', '', '', '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 00:52:57.839058+00', '2025-01-25 01:08:13.198183+00', NULL, NULL),
	('f8760260-c522-4ee3-b964-c902eb6f062d', 'customer', 'auto-admin-collegeforreece33-339743983', 'auto-admin-collegeforreece33-339743983@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 02:10:47.29812+00', '2025-01-25 02:10:47.29812+00', NULL, NULL),
	('7aa2fe34-91a4-4ef0-b885-f4b522213a8f', 'customer', 'auto-admin-collegeforreece3-3339743983', 'auto-admin-collegeforreece3-3339743983@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 02:17:28.591518+00', '2025-01-25 02:17:28.591518+00', NULL, NULL),
	('4911537d-8301-492a-bfb3-1ff294b640ca', 'customer', 'auto-admin-collegeforreece-333383', 'auto-admin-collegeforreece-333383@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 02:20:18.155015+00', '2025-01-25 02:20:18.155015+00', NULL, NULL),
	('c76a8dfd-ce07-41d6-83c5-dc56a61cfb90', 'customer', 'auto-admin-collegeforreece-3331383', 'auto-admin-collegeforreece-3331383@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 02:20:21.012566+00', '2025-01-25 02:20:21.012566+00', NULL, NULL),
	('12220aab-8ecd-4650-99a4-6375f03f9291', 'customer', 'aa', 'collegeforreece@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-24 23:08:08.184081+00', '2025-01-25 03:09:15.844438+00', NULL, NULL),
	('85ec2f98-7858-470c-8a0b-ef9e04afcb7c', 'customer', 'auto-admin-collegeforreece3-33319743983', 'auto-admin-collegeforreece3-33319743983@gmail.com', NULL, NULL, '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', '2025-01-25 03:12:09.160952+00', '2025-01-25 03:12:09.160952+00', NULL, NULL),
	('e1e8f9b3-096f-4501-86e6-637ba8119957', 'customer', 'Reece', 'auto-admin-collegeforreece-313383@gmail.com', NULL, NULL, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-25 03:13:45.88212+00', '2025-01-25 03:23:24.720182+00', NULL, NULL),
	('e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', 'customer', 'auto-admin-collegeforree3ce-33383', 'auto-admin-collegeforree3ce-33383@gmail.com', NULL, NULL, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-25 03:35:13.668292+00', '2025-01-25 03:37:59.717059+00', NULL, NULL);


--
-- Data for Name: knowledge_base_articles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: article_localizations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: article_revisions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: article_watchers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tickets" ("id", "subject", "description", "status", "priority", "customer_id", "assigned_agent_id", "escalation_level", "due_at", "custom_fields", "metadata", "extra_text_1", "extra_json_1", "org_id", "deleted_at", "created_at", "updated_at") VALUES
	('33333333-3333-3333-3333-333333333333', 'Login Issue', 'Unable to login to the application', 'open', 'high', 'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 0, NULL, '{}', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00'),
	('44444444-4444-4444-4444-444444444444', 'Feature Request', 'Need dark mode support', 'pending', 'low', 'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'd0d8c19c-3b73-4c20-8a30-136b8888c042', 0, NULL, '{}', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00'),
	('4512d5d2-e172-455a-a84e-db98fea65614', 'i need someone to get my bed', 'get my bed please', 'open', 'medium', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', NULL, 0, NULL, '{}', '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', NULL, '2025-01-25 00:54:03.20487+00', '2025-01-25 00:54:03.20487+00'),
	('52c9bc34-25a2-4d08-9880-dd7a41727edf', 'aa', 'aaa', 'open', 'low', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', NULL, 0, NULL, '{}', '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', NULL, '2025-01-25 01:05:47.383733+00', '2025-01-25 01:05:47.383733+00'),
	('9285a662-b252-46e1-bc64-1ca66e96b771', 'ff', 'fff', 'open', 'low', '4a7af137-09b5-4f8d-ab25-27392e9dd81d', NULL, 0, NULL, '{}', '{}', NULL, '{}', 'ee0f56a0-4130-4398-bc2d-27529f82efb1', NULL, '2025-01-25 01:29:09.910749+00', '2025-01-25 01:29:09.910749+00'),
	('970acb40-3eed-48c8-a771-e301ab7f63d2', 'aa', 'aaaa', 'open', 'medium', 'e1e8f9b3-096f-4501-86e6-637ba8119957', NULL, 0, NULL, '{}', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-25 03:25:16.749485+00', '2025-01-25 03:25:16.749485+00'),
	('ac677d87-148f-445d-b6d8-124dab84cc8c', 'll', 'lll', 'open', 'medium', 'e25c4f0a-1e7d-4e8a-a61b-4d81fa610ec9', NULL, 0, NULL, '{}', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-25 03:38:03.676996+00', '2025-01-25 03:38:03.676996+00');


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."comments" ("id", "ticket_id", "author_id", "body", "is_private", "metadata", "extra_text_1", "extra_json_1", "org_id", "deleted_at", "created_at", "updated_at") VALUES
	('65e1bb5e-fd62-4e4d-849d-404f405a7bbf', '33333333-3333-3333-3333-333333333333', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'Looking into this issue', false, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00'),
	('b34177d0-c305-4754-85aa-8e8b3a815af4', '33333333-3333-3333-3333-333333333333', 'f8b4c46b-9c2d-4d21-8c2d-b5c8e3f3d2a1', 'Thank you for the quick response', false, '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', NULL, '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00');


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: comment_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."teams" ("id", "name", "description", "config", "extra_text_1", "extra_json_1", "org_id", "created_at", "updated_at") VALUES
	('11111111-1111-1111-1111-111111111111', 'Technical Support', 'Main support team', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00'),
	('22222222-2222-2222-2222-222222222222', 'Customer Success', 'Customer success team', '{}', NULL, '{}', '123e4567-e89b-12d3-a456-426614174000', '2025-01-21 04:36:19.740948+00', '2025-01-21 04:36:19.740948+00');


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."team_members" ("team_id", "user_id", "role_in_team", "metadata", "created_at") VALUES
	('11111111-1111-1111-1111-111111111111', 'd0d8c19c-3b73-4c20-8a30-136b8888c042', 'team_lead', '{}', '2025-01-21 04:36:19.740948+00'),
	('11111111-1111-1111-1111-111111111111', '8a37a557-4c7c-4e5c-a4a4-8f0e8d4d4a9a', 'member', '{}', '2025-01-21 04:36:19.740948+00');


--
-- Data for Name: ticket_co_assignees; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ticket_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ticket_watchers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id") VALUES
	('avatars', 'avatars', NULL, '2025-01-21 04:36:18.926581+00', '2025-01-21 04:36:18.926581+00', true, false, 50000000, '{image/*}', NULL);


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('13ee9ae1-702a-452c-a437-843a4e691d0f', 'avatars', 'profile-circle-icon-256x256-cm91gqm2.png', NULL, '2025-01-21 07:12:28.937003+00', '2025-01-21 07:12:28.937003+00', '2025-01-21 07:12:28.937003+00', '{"eTag": "\"0077931d0af74b0ca2d53cfc3ddbfb6e-1\"", "size": 11259, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-01-21T07:12:29.000Z", "contentLength": 11259, "httpStatusCode": 200}', '76891599-9bae-4b38-aac6-a500fa2fe91e', NULL, NULL);


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 30, true);


--
-- Name: key_key_id_seq; Type: SEQUENCE SET; Schema: pgsodium; Owner: supabase_admin
--

SELECT pg_catalog.setval('"pgsodium"."key_key_id_seq"', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."audit_logs_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

RESET ALL;
