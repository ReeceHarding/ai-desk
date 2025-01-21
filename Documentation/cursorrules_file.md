# Cursor Rules for Project

## Project Overview

**Project Name:** FlowSupport

**Description:** FlowSupport is an AI-powered customer relationship management (CRM) platform designed to automate and streamline support interactions, delivering a modern, Zendesk-like experience by unifying customer interactions into a single, AI-driven system.

**Tech Stack:**

*   Frontend: Modern JavaScript framework with a dark-themed UI
*   Backend: AI-driven RAG system for autoresponder and chatbot capabilities
*   Database: Supabase with JSONB for custom fields and TRGM/vector embeddings for advanced search
*   Storage: Cloud-based storage solutions
*   Authentication: Multi-tenancy with row-level security
*   IDE: Cursor for coding assistance
*   Integration: Email providers, messaging platforms like text and WhatsApp

**Key Features:**

1.  Ticket Management
2.  AI Autoresponder & Chatbot
3.  Knowledge Base Management
4.  Org & Role Management
5.  Comments & Collaboration
6.  Team Features
7.  Advanced Search & Indexing
8.  Reporting & Dashboards
9.  Scalability & Extensibility

## Project Structure

### Root Directory:

Contains the main configuration files and documentation.

### /frontend:

Contains all frontend-related code, including components, styles, and assets.

*   **/components:**

    *   TicketList
    *   ChatbotInterface
    *   KnowledgeBase

*   **/assets:**

    *   Icons
    *   Images

*   **/styles:**

    *   main.css
    *   theme-dark.css

### /backend:

Contains all backend-related code, including API routes and database models.

*   **/controllers:**

    *   TicketController.js
    *   UserController.js

*   **/models:**

    *   UserModel.js
    *   TicketModel.js

*   **/routes:**

    *   ticketRoutes.js
    *   userRoutes.js

*   **/config:**

    *   envConfig.js

### /tests:

Contains unit and integration tests for both frontend and backend.

## Development Guidelines

**Coding Standards:** Follow industry best practices with consistent formatting, meaningful naming conventions, and comprehensive documentation.

**Component Organization:** Each component should reside in its own directory containing component logic, styles, and test files for modularity and ease of maintenance.

## Cursor IDE Integration

**Setup Instructions:**

1.  Clone the repository.
2.  Open the project in Cursor IDE.
3.  Configure project-specific settings based on the `.env` file and `envConfig.js`.

**Key Commands:**

*   Build: `npm run build`
*   Test: `npm test`
*   Lint: `npm run lint`

## Additional Context

**User Roles:**

*   Customer
*   Agent
*   Admin
*   Super Admin

**Accessibility Considerations:** Ensure that all UI components adhere to WCAG guidelines for seamless accessibility across diverse user groups.
