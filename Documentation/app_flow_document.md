# App Flow Document for FlowSupport CRM

## Introduction

FlowSupport is an AI-powered Customer Relationship Management platform designed to automate and streamline support interactions. Its main goal is to minimize manual workload by integrating advanced AI capabilities to manage customer queries across various channels such as tickets, chats, and a comprehensive knowledge base. It aims to provide a modern, efficient alternative to other CRM solutions by enhancing self-service features and utilizing AI for automated ticket resolution.

## Onboarding and Sign-In/Sign-Up

New users typically discover FlowSupport through direct recommendations or promotional channels. Once interested, they are guided to the sign-up page where they can create an account either using an email address or via social login options such as Google or LinkedIn. The onboarding process is comprehensive, offering a tutorial that walks users through the creation of their organization, role assignments, and the configuration of initial ticket workflows. On subsequent visits, users can sign in using their credentials or social login, with options available for password recovery through email-verification. After signing in, users are taken to their main dashboard.

## Main Dashboard or Home Page

Once logged in, users are greeted by the main dashboard which embodies a dark-themed UI, reflecting modern design trends akin to platforms like Slack. This dashboard is central to the FlowSupport experience, displaying key metrics and pending tasks through a collapsible sidebar and a three-column layout. The sidebar offers navigation to different sections like tickets, knowledge base, or organizational settings. The central column shows ticket details, and the rightmost section provides quick access to knowledge base articles or AI suggestions, facilitating seamless navigation across different functionalities of the platform.

## Detailed Feature Flows and Page Transitions

Each core feature of FlowSupport offers a distinct user journey. For example, the ticket management system allows users to create, assign, and track support tickets, with a visually intuitive interface that categorizes tickets by statuses such as open, pending, solved, etc. When a user opens a ticket, they can utilize AI-autoresponder to automatically generate responses or receive suggestions for relevant articles from the knowledge base. The RAG approach intelligently pulls data from the stored articles and proposes actions.

For role and organizational management, users can create roles such as customer, agent, admin, and super_admin, enabled by row-level security to ensure data segregation and security. The org-switcher feature is accessible from the dashboard, allowing users to switch contexts between different organizations they are associated with, thus updating visible data and settings dynamically.

In terms of collaboration, the system allows public or private comments on tickets, and teams can work together using skills-based assignments or round-robin auto-assignments. There's also an option for agents to add internal notes that remain hidden from customers.

The knowledge base supports content creation with options for public or internal articles, offering version control and localizations for multi-language support. This is managed via a dedicated section accessible from the dashboard. Article revisions and localizations enhance the robustness and accessibility of the company's support resources.

## Settings and Account Management

Users can manage personal data and preferences through the Account Settings page accessible from the main dashboard. Here, users can update their profile details, change passwords, and configure notification settings. Administrative users have the additional ability to manage billing, subscriptions, and organizational settings, including SLA policies and advanced analytics configurations. From the settings, users are directed back to their previous activities or the main dashboard without any disruption.

## Error States and Alternate Paths

FlowSupport is designed to handle error states gracefully. If a user inputs invalid data or loses connectivity, the system provides clear error messages and fallback options to correct the problems and continue their tasks. For example, if login attempts fail, the user is prompted to verify credentials or reset their password. Similarly, if an attempt is made to access restricted features, an appropriate message will explain the issue and any potential resolution steps. Once these issues are resolved, users can seamlessly return to their workflow.

## Gmail Integration

### Watch Management
The system maintains Gmail API watches to receive real-time notifications when new emails arrive. This is implemented through the following components:

1. **Database Schema**
   - Organizations and profiles tables include:
     - `gmail_watch_expiration`: Timestamp when the current watch expires
     - `gmail_watch_resource_id`: Unique identifier for the watch
     - `gmail_watch_status`: Current status ('active', 'expired', 'failed', 'pending')

2. **Watch Setup**
   - When a new Gmail connection is established, a watch is automatically set up
   - The watch is configured to monitor the INBOX label
   - Watch information is stored in the database

3. **Automatic Refresh**
   - A scheduled job runs every 12 hours to check for expiring watches
   - Watches that expire within 24 hours are automatically renewed
   - Failed watches are logged and marked for review

4. **Error Handling**
   - Watch setup/refresh failures are logged to audit_logs
   - The system maintains the last known good state
   - Automatic retry mechanism for failed watch operations

5. **Monitoring**
   - Watch status is tracked in the database
   - Audit logs provide visibility into watch operations
   - Error notifications for failed watch operations

### Implementation Details

The Gmail watch management system consists of:

1. **Database Changes**
   - New columns added to organizations and profiles tables
   - Indexes on watch expiration for performance

2. **Utility Functions**
   - `setupOrRefreshWatch`: Sets up or refreshes a Gmail watch
   - `stopWatch`: Gracefully stops an active watch
   - `checkAndRefreshWatches`: Manages watch lifecycle

3. **Scheduled Job**
   - Runs every 12 hours via cron
   - Checks for expiring watches
   - Handles watch renewal

4. **Error Handling**
   - Comprehensive error logging
   - Automatic status updates
   - Retry mechanism for transient failures

### Best Practices

1. **Watch Management**
   - Always check watch status before operations
   - Handle token refresh during watch operations
   - Log all watch-related activities

2. **Error Recovery**
   - Implement graceful degradation
   - Maintain audit trail
   - Alert on persistent failures

3. **Performance**
   - Use database indexes for efficient queries
   - Batch watch operations when possible
   - Monitor API quota usage

## Conclusion and Overall App Journey

From the initial sign-up through everyday usage, FlowSupport is engineered to deliver an efficient and intuitive CRM experience. Users begin with a comprehensive onboarding process that establishes their organization's structure and priorities, which then leads to a seamlessly integrated dashboard where day-to-day tasks are managed and resolved. Key goals like reducing manual intervention and improving ticket resolution times are achieved through AI-driven suggestions and an easily navigable platform. Whether managing tickets or accessing analytics, FlowSupport offers a streamlined, cohesive experience designed to enhance productivity and customer satisfaction.
