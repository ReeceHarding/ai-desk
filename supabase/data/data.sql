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

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
00000000-0000-0000-0000-000000000000	2e38b22b-25da-4a97-8d30-5641bb5700dc	{"action":"user_confirmation_requested","actor_id":"861bcdf6-02b4-4a58-b29c-7f4390b12a35","actor_username":"luke11@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-01-27 02:46:31.335356+00	
00000000-0000-0000-0000-000000000000	285f8509-fda7-48e7-89f2-c1ff9e9e07a4	{"action":"user_confirmation_requested","actor_id":"061436b2-d42a-4133-9df3-a86a21717fb4","actor_username":"skywalker12@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-01-27 05:17:04.449277+00	
00000000-0000-0000-0000-000000000000	88ca4e49-c57b-4a77-bc34-977325e8df39	{"action":"user_confirmation_requested","actor_id":"7aadab74-5c14-4258-ac2f-1f57a56aff84","actor_username":"rieboysspam22@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-01-27 05:28:41.469523+00	
00000000-0000-0000-0000-000000000000	b8339888-6289-497a-9d5e-d8a1f087c50a	{"action":"user_signedup","actor_id":"061436b2-d42a-4133-9df3-a86a21717fb4","actor_username":"skywalker12@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-01-27 05:30:40.610126+00	
00000000-0000-0000-0000-000000000000	d4f4087f-528b-48e8-b0f8-09f64ddd729d	{"action":"login","actor_id":"061436b2-d42a-4133-9df3-a86a21717fb4","actor_username":"skywalker12@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:30:40.618485+00	
00000000-0000-0000-0000-000000000000	1aa22697-a33b-479f-ad8c-6d19149c1029	{"action":"user_signedup","actor_id":"d578134d-b98b-4665-8026-59a6a6e67241","actor_username":"skywalker121@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-01-27 05:30:46.951605+00	
00000000-0000-0000-0000-000000000000	5143ce67-5c4f-4d62-88bf-bfe7bf295205	{"action":"login","actor_id":"d578134d-b98b-4665-8026-59a6a6e67241","actor_username":"skywalker121@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:30:46.958121+00	
00000000-0000-0000-0000-000000000000	9a51db3d-73c6-449e-96e9-1d04625bf3e4	{"action":"user_signedup","actor_id":"6574caa6-4aed-4c01-8b62-06b60cbdfb0d","actor_username":"rieboysspam1@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-01-27 05:37:22.482153+00	
00000000-0000-0000-0000-000000000000	6ec6341b-f277-450d-9635-7a0d739d3c34	{"action":"login","actor_id":"6574caa6-4aed-4c01-8b62-06b60cbdfb0d","actor_username":"rieboysspam1@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:37:22.487274+00	
00000000-0000-0000-0000-000000000000	d574ab61-47fa-400d-95a7-811efaf6a3c1	{"action":"login","actor_id":"6574caa6-4aed-4c01-8b62-06b60cbdfb0d","actor_username":"rieboysspam1@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:37:22.868041+00	
00000000-0000-0000-0000-000000000000	d490429e-87a2-4ba5-9186-0f0b82c4e645	{"action":"user_signedup","actor_id":"25e8686e-68e1-49d1-be1d-5f0936e937c4","actor_username":"luke@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-01-27 05:40:56.32284+00	
00000000-0000-0000-0000-000000000000	01a34ff2-f948-4282-837c-609e2d0b89ae	{"action":"login","actor_id":"25e8686e-68e1-49d1-be1d-5f0936e937c4","actor_username":"luke@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:40:56.327362+00	
00000000-0000-0000-0000-000000000000	eb2d467f-df1a-4b87-b64f-30a52f8792bb	{"action":"login","actor_id":"25e8686e-68e1-49d1-be1d-5f0936e937c4","actor_username":"luke@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:40:56.702205+00	
00000000-0000-0000-0000-000000000000	8fd868c0-0877-407d-8f9f-c6c39ae02ad2	{"action":"user_signedup","actor_id":"d1ba06e0-aca8-4ca5-ab23-aead3256363c","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-01-27 05:43:01.51233+00	
00000000-0000-0000-0000-000000000000	6d7a5fb9-d05a-4dfb-b376-37c3e7aac8fc	{"action":"login","actor_id":"d1ba06e0-aca8-4ca5-ab23-aead3256363c","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:43:01.516794+00	
00000000-0000-0000-0000-000000000000	c9c45713-eae7-4e35-a332-4fd502736ce0	{"action":"login","actor_id":"d1ba06e0-aca8-4ca5-ab23-aead3256363c","actor_username":"rieboysspam@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-01-27 05:43:01.891893+00	
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	061436b2-d42a-4133-9df3-a86a21717fb4	authenticated	authenticated	skywalker12@gmail.com	$2a$10$qMXdff8UKyc5ELgwwK/n7uQJkOny/9f4xhpHnEm5RB6Lg3DdxMmxW	2025-01-27 05:30:40.611554+00	\N		2025-01-27 05:17:04.450428+00		\N			\N	2025-01-27 05:30:40.619706+00	{"provider": "email", "providers": ["email"]}	{"sub": "061436b2-d42a-4133-9df3-a86a21717fb4", "email": "skywalker12@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-01-27 05:17:04.438921+00	2025-01-27 05:30:40.631006+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	d1ba06e0-aca8-4ca5-ab23-aead3256363c	authenticated	authenticated	rieboysspam@gmail.com	$2a$10$YB69WEo4X1meu4jjFCAky.olPhvGoc2Fr5PXhEsqGVcEQZWR1DF6q	2025-01-27 05:43:01.512963+00	\N		\N		\N			\N	2025-01-27 05:43:01.892692+00	{"provider": "email", "providers": ["email"]}	{"sub": "d1ba06e0-aca8-4ca5-ab23-aead3256363c", "email": "rieboysspam@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-01-27 05:43:01.504196+00	2025-01-27 05:43:01.894552+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	861bcdf6-02b4-4a58-b29c-7f4390b12a35	authenticated	authenticated	luke11@gmail.com	$2a$10$kYjUCVGqugW2cUG5ZtaAced/5kRn9gIGrSOre3OBQa41z9IB.DLK2	\N	\N	e2b101e5bf77d69269e32460e3183a433dc4ec78255fa8f85b067f29	2025-01-27 02:46:31.335945+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"sub": "861bcdf6-02b4-4a58-b29c-7f4390b12a35", "email": "luke11@gmail.com", "email_verified": false, "phone_verified": false}	\N	2025-01-27 02:46:31.327588+00	2025-01-27 02:46:32.774346+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	d578134d-b98b-4665-8026-59a6a6e67241	authenticated	authenticated	skywalker121@gmail.com	$2a$10$Qd5oIfyMfxF3/7mtqhvvducGE7uZq/KKInloTMKl4xD9rCghWMut.	2025-01-27 05:30:46.952914+00	\N		\N		\N			\N	2025-01-27 05:30:46.958669+00	{"provider": "email", "providers": ["email"]}	{"sub": "d578134d-b98b-4665-8026-59a6a6e67241", "email": "skywalker121@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-01-27 05:30:46.942461+00	2025-01-27 05:30:46.963587+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	25e8686e-68e1-49d1-be1d-5f0936e937c4	authenticated	authenticated	luke@gmail.com	$2a$10$fH2prlBMGjiz/BGOWI74/udJ9rwgbJLz8Gg.nmd.DpEzP0clUzYeS	2025-01-27 05:40:56.324044+00	\N		\N		\N			\N	2025-01-27 05:40:56.702874+00	{"provider": "email", "providers": ["email"]}	{"sub": "25e8686e-68e1-49d1-be1d-5f0936e937c4", "email": "luke@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-01-27 05:40:56.31311+00	2025-01-27 05:40:56.704516+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	7aadab74-5c14-4258-ac2f-1f57a56aff84	authenticated	authenticated	rieboysspam22@gmail.com	$2a$10$C4gZjb6disXBLrc4HLSvBu7TPMHw3OCn/TTSTwKqZBcRn.p/JVrz6	\N	\N	76aad997945968cf9d6a2e64369303ca05286893d19543c7e6154c95	2025-01-27 05:28:41.47025+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"sub": "7aadab74-5c14-4258-ac2f-1f57a56aff84", "email": "rieboysspam22@gmail.com", "email_verified": false, "phone_verified": false}	\N	2025-01-27 05:28:41.453538+00	2025-01-27 05:28:42.725538+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	authenticated	authenticated	rieboysspam1@gmail.com	$2a$10$K72yVXdhVYwLZxH0s3NoNuq2cBvVyvYs7Dfe.7/SG.TiHkeSgUYjW	2025-01-27 05:37:22.482845+00	\N		\N		\N			\N	2025-01-27 05:37:22.869578+00	{"provider": "email", "providers": ["email"]}	{"sub": "6574caa6-4aed-4c01-8b62-06b60cbdfb0d", "email": "rieboysspam1@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-01-27 05:37:22.472724+00	2025-01-27 05:37:22.871498+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
861bcdf6-02b4-4a58-b29c-7f4390b12a35	861bcdf6-02b4-4a58-b29c-7f4390b12a35	{"sub": "861bcdf6-02b4-4a58-b29c-7f4390b12a35", "email": "luke11@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 02:46:31.33219+00	2025-01-27 02:46:31.332239+00	2025-01-27 02:46:31.332239+00	b7bc2a34-0d52-44e3-9a79-db13ee2a6f19
061436b2-d42a-4133-9df3-a86a21717fb4	061436b2-d42a-4133-9df3-a86a21717fb4	{"sub": "061436b2-d42a-4133-9df3-a86a21717fb4", "email": "skywalker12@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:17:04.446619+00	2025-01-27 05:17:04.446667+00	2025-01-27 05:17:04.446667+00	17b530fe-a06d-4b78-8a3f-1106c4e5a561
7aadab74-5c14-4258-ac2f-1f57a56aff84	7aadab74-5c14-4258-ac2f-1f57a56aff84	{"sub": "7aadab74-5c14-4258-ac2f-1f57a56aff84", "email": "rieboysspam22@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:28:41.459255+00	2025-01-27 05:28:41.459303+00	2025-01-27 05:28:41.459303+00	92dba6d1-c238-4354-b5d0-7dad86078141
d578134d-b98b-4665-8026-59a6a6e67241	d578134d-b98b-4665-8026-59a6a6e67241	{"sub": "d578134d-b98b-4665-8026-59a6a6e67241", "email": "skywalker121@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:30:46.946902+00	2025-01-27 05:30:46.946975+00	2025-01-27 05:30:46.946975+00	2f6d7b9c-9ce1-4cf5-811e-181fd9850430
6574caa6-4aed-4c01-8b62-06b60cbdfb0d	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	{"sub": "6574caa6-4aed-4c01-8b62-06b60cbdfb0d", "email": "rieboysspam1@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:37:22.478683+00	2025-01-27 05:37:22.478739+00	2025-01-27 05:37:22.478739+00	f84c46b8-f470-42f6-a222-a7caab4c159d
25e8686e-68e1-49d1-be1d-5f0936e937c4	25e8686e-68e1-49d1-be1d-5f0936e937c4	{"sub": "25e8686e-68e1-49d1-be1d-5f0936e937c4", "email": "luke@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:40:56.31974+00	2025-01-27 05:40:56.319787+00	2025-01-27 05:40:56.319787+00	76f22094-6561-4b4d-ae35-b1e57a1ac4bc
d1ba06e0-aca8-4ca5-ab23-aead3256363c	d1ba06e0-aca8-4ca5-ab23-aead3256363c	{"sub": "d1ba06e0-aca8-4ca5-ab23-aead3256363c", "email": "rieboysspam@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-01-27 05:43:01.509104+00	2025-01-27 05:43:01.509152+00	2025-01-27 05:43:01.509152+00	306003e3-0d66-4d61-8cd9-9d698ab85580
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") FROM stdin;
c1063646-b8a5-4242-a297-92adb7d2863d	061436b2-d42a-4133-9df3-a86a21717fb4	2025-01-27 05:30:40.620358+00	2025-01-27 05:30:40.620358+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
1fbf1d43-4946-4155-9865-de06734c242b	d578134d-b98b-4665-8026-59a6a6e67241	2025-01-27 05:30:46.958749+00	2025-01-27 05:30:46.958749+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
2e66d7fb-81ec-4f16-8b4a-bc5f15e18dff	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	2025-01-27 05:37:22.490936+00	2025-01-27 05:37:22.490936+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
4af183dc-a257-44f3-846d-4526e45ff22b	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	2025-01-27 05:37:22.869657+00	2025-01-27 05:37:22.869657+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
fb9f6193-3f18-4ebc-ae01-a7fd7aa83fe0	25e8686e-68e1-49d1-be1d-5f0936e937c4	2025-01-27 05:40:56.327968+00	2025-01-27 05:40:56.327968+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
358cc70b-9d1a-46e4-94f7-1db338eaecc7	25e8686e-68e1-49d1-be1d-5f0936e937c4	2025-01-27 05:40:56.702942+00	2025-01-27 05:40:56.702942+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
a6194af9-bdb9-4603-b1bf-7461beb9412e	d1ba06e0-aca8-4ca5-ab23-aead3256363c	2025-01-27 05:43:01.517362+00	2025-01-27 05:43:01.517362+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
5219ae02-443f-4cb9-b2f2-11ca3007d8bf	d1ba06e0-aca8-4ca5-ab23-aead3256363c	2025-01-27 05:43:01.892763+00	2025-01-27 05:43:01.892763+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36	107.3.66.9	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
c1063646-b8a5-4242-a297-92adb7d2863d	2025-01-27 05:30:40.631457+00	2025-01-27 05:30:40.631457+00	password	1b5ac631-483c-4626-8692-d2f3eadc834a
1fbf1d43-4946-4155-9865-de06734c242b	2025-01-27 05:30:46.964043+00	2025-01-27 05:30:46.964043+00	password	32911f78-28ca-46c9-be2b-b4ae46b1d3ba
2e66d7fb-81ec-4f16-8b4a-bc5f15e18dff	2025-01-27 05:37:22.494028+00	2025-01-27 05:37:22.494028+00	password	03799aed-e64c-405b-bc15-4bd0bc7c6736
4af183dc-a257-44f3-846d-4526e45ff22b	2025-01-27 05:37:22.871819+00	2025-01-27 05:37:22.871819+00	password	f96d2c96-8b5b-4bc5-9a3b-27ba63014257
fb9f6193-3f18-4ebc-ae01-a7fd7aa83fe0	2025-01-27 05:40:56.330704+00	2025-01-27 05:40:56.330704+00	password	59760adc-5dc6-414a-be95-913ecf9c0a01
358cc70b-9d1a-46e4-94f7-1db338eaecc7	2025-01-27 05:40:56.704807+00	2025-01-27 05:40:56.704807+00	password	689f8aea-b4a5-4fdf-8053-2c7b880dc9d2
a6194af9-bdb9-4603-b1bf-7461beb9412e	2025-01-27 05:43:01.520207+00	2025-01-27 05:43:01.520207+00	password	3e08fdb8-9fae-4b15-9532-ed95084aa660
5219ae02-443f-4cb9-b2f2-11ca3007d8bf	2025-01-27 05:43:01.895547+00	2025-01-27 05:43:01.895547+00	password	48b57c1a-88df-42e3-baf6-732b44023d80
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") FROM stdin;
a4ec9112-0159-4f47-8f6e-a26f15a90126	861bcdf6-02b4-4a58-b29c-7f4390b12a35	confirmation_token	e2b101e5bf77d69269e32460e3183a433dc4ec78255fa8f85b067f29	luke11@gmail.com	2025-01-27 02:46:32.779502	2025-01-27 02:46:32.779502
527dde0d-3846-41aa-9f2b-a07688f4d7c4	7aadab74-5c14-4258-ac2f-1f57a56aff84	confirmation_token	76aad997945968cf9d6a2e64369303ca05286893d19543c7e6154c95	rieboysspam22@gmail.com	2025-01-27 05:28:42.727369	2025-01-27 05:28:42.727369
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	1	-BfPlCsgEtJs7LFeXSsYEQ	061436b2-d42a-4133-9df3-a86a21717fb4	f	2025-01-27 05:30:40.623526+00	2025-01-27 05:30:40.623526+00	\N	c1063646-b8a5-4242-a297-92adb7d2863d
00000000-0000-0000-0000-000000000000	2	-9q4Z3nrWC-YvlWCir20mw	d578134d-b98b-4665-8026-59a6a6e67241	f	2025-01-27 05:30:46.959463+00	2025-01-27 05:30:46.959463+00	\N	1fbf1d43-4946-4155-9865-de06734c242b
00000000-0000-0000-0000-000000000000	3	ymv0bNspHa2Hg4OI8vbdvQ	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	f	2025-01-27 05:37:22.492118+00	2025-01-27 05:37:22.492118+00	\N	2e66d7fb-81ec-4f16-8b4a-bc5f15e18dff
00000000-0000-0000-0000-000000000000	4	D_IUZRQSWg4Xcncmp7KMPg	6574caa6-4aed-4c01-8b62-06b60cbdfb0d	f	2025-01-27 05:37:22.870564+00	2025-01-27 05:37:22.870564+00	\N	4af183dc-a257-44f3-846d-4526e45ff22b
00000000-0000-0000-0000-000000000000	5	m62nvuUbsoC3P8oPmT_Q7w	25e8686e-68e1-49d1-be1d-5f0936e937c4	f	2025-01-27 05:40:56.328974+00	2025-01-27 05:40:56.328974+00	\N	fb9f6193-3f18-4ebc-ae01-a7fd7aa83fe0
00000000-0000-0000-0000-000000000000	6	IvqmMnuIxzP82HRIUfU3tQ	25e8686e-68e1-49d1-be1d-5f0936e937c4	f	2025-01-27 05:40:56.703644+00	2025-01-27 05:40:56.703644+00	\N	358cc70b-9d1a-46e4-94f7-1db338eaecc7
00000000-0000-0000-0000-000000000000	7	UbdMKFeWDTKDPtuAyQIKxA	d1ba06e0-aca8-4ca5-ab23-aead3256363c	f	2025-01-27 05:43:01.518411+00	2025-01-27 05:43:01.518411+00	\N	a6194af9-bdb9-4603-b1bf-7461beb9412e
00000000-0000-0000-0000-000000000000	8	kfyp3qMAaUf9zwNIs063BA	d1ba06e0-aca8-4ca5-ab23-aead3256363c	f	2025-01-27 05:43:01.893628+00	2025-01-27 05:43:01.893628+00	\N	5219ae02-443f-4cb9-b2f2-11ca3007d8bf
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: key; Type: TABLE DATA; Schema: pgsodium; Owner: supabase_admin
--

COPY "pgsodium"."key" ("id", "status", "created", "expires", "key_type", "key_id", "key_context", "name", "associated_data", "raw_key", "raw_key_nonce", "parent_key", "comment", "user_data") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."organizations" ("id", "name", "logo_url", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: advanced_automations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."advanced_automations" ("id", "org_id", "name", "description", "is_active", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."users" ("id", "role", "org_id", "email", "display_name", "google_refresh_token", "google_access_token", "skills", "metadata", "created_at", "updated_at") FROM stdin;
861bcdf6-02b4-4a58-b29c-7f4390b12a35	admin	\N	luke11@gmail.com	\N	\N	\N	{}	{}	2025-01-27 02:46:33.152669+00	2025-01-27 02:46:33.152669+00
061436b2-d42a-4133-9df3-a86a21717fb4	admin	\N	skywalker12@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:17:05.879033+00	2025-01-27 05:17:05.879033+00
7aadab74-5c14-4258-ac2f-1f57a56aff84	admin	\N	rieboysspam22@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:28:42.886017+00	2025-01-27 05:28:42.886017+00
d578134d-b98b-4665-8026-59a6a6e67241	admin	\N	skywalker121@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:30:47.046772+00	2025-01-27 05:30:47.046772+00
6574caa6-4aed-4c01-8b62-06b60cbdfb0d	admin	\N	rieboysspam1@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:37:22.637507+00	2025-01-27 05:37:22.637507+00
25e8686e-68e1-49d1-be1d-5f0936e937c4	admin	\N	luke@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:40:56.484539+00	2025-01-27 05:40:56.484539+00
d1ba06e0-aca8-4ca5-ab23-aead3256363c	admin	\N	rieboysspam@gmail.com	\N	\N	\N	{}	{}	2025-01-27 05:43:01.674743+00	2025-01-27 05:43:01.674743+00
\.


--
-- Data for Name: advanced_user_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."advanced_user_preferences" ("user_id", "preferences", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: agent_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."agent_schedules" ("id", "agent_id", "day_of_week", "start_time", "end_time", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: agent_shift_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."agent_shift_logs" ("id", "agent_id", "shift_start", "shift_end", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."audit_logs" ("id", "actor_id", "action", "entity_name", "entity_id", "changes", "description", "created_at") FROM stdin;
\.


--
-- Data for Name: automation_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."automation_actions" ("id", "automation_id", "action_type", "action_config", "created_at") FROM stdin;
\.


--
-- Data for Name: automation_conditions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."automation_conditions" ("id", "automation_id", "condition_type", "condition_config", "created_at") FROM stdin;
\.


--
-- Data for Name: automation_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."automation_logs" ("id", "automation_id", "executed_at", "details") FROM stdin;
\.


--
-- Data for Name: automation_scripts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."automation_scripts" ("id", "org_id", "script_name", "condition", "action", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."channels" ("id", "org_id", "channel_type", "external_id", "display_name", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."comments" ("id", "entity_name", "entity_id", "author_id", "body", "is_private", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: custom_field_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."custom_field_definitions" ("id", "org_id", "field_name", "field_type", "field_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: custom_field_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."custom_field_values" ("id", "field_id", "entity_id", "field_value", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."deals" ("id", "org_id", "name", "stage", "value", "close_date", "owner_id", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: deal_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."deal_attachments" ("id", "deal_id", "file_path", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: scraped_sites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."scraped_sites" ("id", "org_id", "url", "status", "scraped_data", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: discovered_emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."discovered_emails" ("id", "site_id", "email", "context", "created_at") FROM stdin;
\.


--
-- Data for Name: sla_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."sla_policies" ("id", "org_id", "name", "description", "response_time_minutes", "resolution_time_minutes", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tickets" ("id", "org_id", "status", "subject", "description", "customer_id", "assigned_agent_id", "category_tag", "metadata", "created_at", "updated_at", "sla_policy_id", "channel_id") FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."messages" ("id", "ticket_id", "channel_id", "direction", "status", "subject", "body", "from_email", "to_email", "cc_email", "bcc_email", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: email_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."email_events" ("id", "message_id", "event_type", "event_metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: email_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."email_usage" ("org_id", "usage_date", "emails_sent", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: escalation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."escalation_rules" ("id", "org_id", "rule_name", "condition", "action", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."forms" ("id", "org_id", "form_name", "form_fields", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: form_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."form_fields" ("id", "form_id", "field_name", "field_type", "field_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."form_submissions" ("id", "form_id", "submitted_by", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: form_submission_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."form_submission_answers" ("id", "submission_id", "field_id", "answer", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."invitations" ("id", "organization_id", "email", "role", "token", "expires_at", "used_at", "metadata") FROM stdin;
\.


--
-- Data for Name: ip_restrictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ip_restrictions" ("id", "org_id", "allowed_ip", "description", "created_at") FROM stdin;
\.


--
-- Data for Name: knowledge_doc_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_doc_categories" ("id", "org_id", "name", "description", "parent_id", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: knowledge_docs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_docs" ("id", "org_id", "title", "content", "author_id", "status", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: knowledge_doc_category_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_doc_category_links" ("doc_id", "category_id") FROM stdin;
\.


--
-- Data for Name: knowledge_doc_chunks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_doc_chunks" ("id", "doc_id", "chunk_index", "content", "embedding", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: knowledge_doc_localizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_doc_localizations" ("id", "doc_id", "language_code", "title", "content", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: knowledge_doc_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."knowledge_doc_versions" ("id", "doc_id", "version_label", "content_snapshot", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: macros; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."macros" ("id", "org_id", "name", "body", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: macro_usages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."macro_usages" ("id", "macro_id", "ticket_id", "applied_by", "applied_at", "metadata") FROM stdin;
\.


--
-- Data for Name: marketing_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_campaigns" ("id", "org_id", "name", "description", "start_date", "end_date", "status", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_campaign_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_campaign_members" ("id", "campaign_id", "user_id", "status", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_email_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_email_templates" ("id", "org_id", "name", "subject", "body", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_leads" ("id", "org_id", "email", "name", "phone", "source", "status", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_lead_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_lead_activity" ("id", "lead_id", "activity_type", "details", "occurred_at") FROM stdin;
\.


--
-- Data for Name: marketing_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_segments" ("id", "org_id", "segment_name", "filter_condition", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_workflows" ("id", "org_id", "workflow_name", "is_active", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: marketing_workflow_steps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."marketing_workflow_steps" ("id", "workflow_id", "step_name", "step_type", "step_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: message_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."message_attachments" ("id", "message_id", "file_path", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."notifications" ("id", "user_id", "notification_type", "title", "body", "read_at", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."plans" ("id", "plan_name", "monthly_price", "features", "created_at") FROM stdin;
\.


--
-- Data for Name: org_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."org_subscriptions" ("id", "org_id", "plan_id", "status", "started_at", "ends_at", "metadata") FROM stdin;
\.


--
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."organization_members" ("id", "organization_id", "user_id", "role_in_org", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: outreach_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."outreach_campaigns" ("id", "org_id", "name", "status", "daily_email_limit", "follow_up_mode", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: outreach_companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."outreach_companies" ("id", "org_id", "campaign_id", "domain", "status", "scraped_data", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: outreach_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."outreach_contacts" ("id", "company_id", "email", "name", "phone", "social_links", "do_not_contact", "unsubscribed_at", "metadata", "status", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."permissions" ("id", "permission_name", "description", "created_at") FROM stdin;
\.


--
-- Data for Name: phone_call_recordings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."phone_call_recordings" ("id", "org_id", "call_id", "file_path", "created_at") FROM stdin;
\.


--
-- Data for Name: phone_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."phone_calls" ("id", "org_id", "ticket_id", "caller_id", "call_duration", "transcript", "metadata", "started_at", "ended_at") FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."reports" ("id", "org_id", "report_type", "data", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."role_permissions" ("role_name", "permission_id", "created_at") FROM stdin;
\.


--
-- Data for Name: sla_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."sla_violations" ("id", "ticket_id", "policy_id", "type", "occurred_at", "metadata") FROM stdin;
\.


--
-- Data for Name: subscription_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."subscription_usage" ("id", "org_id", "usage_key", "usage_value", "period_start", "period_end") FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tags" ("id", "org_id", "name", "description", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."teams" ("id", "org_id", "name", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."team_members" ("team_id", "user_id", "role_in_team", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: third_party_integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."third_party_integrations" ("id", "org_id", "integration_type", "config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: ticket_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_attachments" ("id", "ticket_id", "file_path", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: ticket_classifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_classifications" ("id", "ticket_id", "classification", "confidence", "assigned_agent_id", "created_at") FROM stdin;
\.


--
-- Data for Name: ticket_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_embeddings" ("ticket_id", "embedding", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: ticket_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_history" ("id", "ticket_id", "changed_by", "old_status", "new_status", "old_assigned_agent_id", "new_assigned_agent_id", "changed_at") FROM stdin;
\.


--
-- Data for Name: ticket_summaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_summaries" ("ticket_id", "summary", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: ticket_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_tags" ("ticket_id", "tag_id", "created_at") FROM stdin;
\.


--
-- Data for Name: to_do_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."to_do_tasks" ("id", "org_id", "assigned_to", "title", "description", "due_date", "status", "priority", "metadata", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: to_do_task_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."to_do_task_comments" ("id", "task_id", "commenter_id", "body", "created_at") FROM stdin;
\.


--
-- Data for Name: user_api_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."user_api_tokens" ("id", "user_id", "token", "metadata", "created_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: postgres
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id") FROM stdin;
avatars	avatars	\N	2025-01-26 22:14:38.494132+00	2025-01-26 22:14:38.494132+00	t	f	\N	\N	\N
doc_attachments	doc_attachments	\N	2025-01-26 22:14:38.554183+00	2025-01-26 22:14:38.554183+00	f	f	\N	\N	\N
ticket_exports	ticket_exports	\N	2025-01-26 22:14:38.603691+00	2025-01-26 22:14:38.603691+00	f	f	\N	\N	\N
branding_assets	branding_assets	\N	2025-01-26 22:14:38.655269+00	2025-01-26 22:14:38.655269+00	f	f	\N	\N	\N
misc_files	misc_files	\N	2025-01-26 22:14:38.709467+00	2025-01-26 22:14:38.709467+00	f	f	\N	\N	\N
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: postgres
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY "vault"."secrets" ("id", "name", "description", "secret", "key_id", "nonce", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 8, true);


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
