# AutoTester.dev

First AI driven automatic test tool for webapps

![alt text](image.png)

# PROD

https://autotester.dev

## Overview

AutoTester.dev is pioneering the future of web application testing by leveraging cutting-edge
Artificial Intelligence. This platform aims to automate the tedious and complex process of creating,
executing, and analyzing web tests, allowing developers and QA engineers to focus on building better
products faster. By integrating various AI models, AutoTester.dev can intelligently interact with
web elements, generate test cases, and provide insightful reports, significantly reducing the time
and effort traditionally required for comprehensive testing.

## Key Features

- **AI-Powered Test Generation:** Automatically generate test scenarios based on application
  descriptions or user flows.
- **Intelligent Element Interaction:** Use AI to reliably identify and interact with web elements,
  adapting to minor UI changes.
- **Automated Test Execution:** Run tests across different browsers and environments seamlessly.
- **Comprehensive Reporting:** Generate detailed reports with insights into test results,
  performance, and potential issues.
- **User & Admin Management:** Secure user authentication and a dedicated admin panel for platform
  control.
- **Multiple AI Engine Integration:** Utilize various AI models (OpenAI, Claude, DeepSeek, Gemini,
  Grok, etc.) for diverse capabilities like natural language processing, semantic search, and
  content analysis.

## Project Architecture

The project follows a structured approach with clear separation between client, server, and static
assets, facilitating maintainability and scalability.

- **Root Files:**

    - Configuration & deployment scripts: `.dockerignore`, `.prettierrc`, `copy.cmd`, `deploy.cmd`
    - Docker configurations: `Dockerfile`, `docker-compose.yml`
    - Core application files: `index.html`, `package.json`, `vite.config.js`, `rest.http`,
      `playground-1.mongodb.js`

- **Client (src/):**

    - Main application and layout components: `App.jsx`, `Navbar.jsx`, `Landing.jsx`, `main.jsx`
    - User management and feedback: `Login.jsx`, `SignUp.jsx`, `Forgot.jsx`, `Reset.jsx`,
      `Profile.jsx`, `Feedback.jsx`
    - Admin interface: `Admin.jsx`
    - Informational pages and UI components: `Privacy.jsx`, `Terms.jsx`, `BottomNavigationBar.jsx`,
      `Docs.jsx`

- **Server (server/):**

    - Authentication & administration: `admin.js`, `middleware/auth.js`, `user.js`
    - AI and search integrations: `claude.js`, `deepseek.js`, `gemini.js`, `grok.js`, `openai.js`,
      `search.js`
    - Application entry point and schemata: `index.js`
    - Data Models: `models/Feedback.js`, `models/User.js`
    - Utility functions: `utils.js`
    - Server-specific package management: `package.json`

- **Public (public/):**
    - Static resources: `ads.txt`, `landing.html`, `robots.txt`, `styles.css`

This organized structure promotes modularity, simplifies development workflows, enhances security,
and supports independent scaling of different components.

## Design Ideas & Considerations

To further enhance AutoTester.dev and its capabilities, the following design ideas and
considerations are being explored:

- **Core AI Testing Workflow:**

    - **Intuitive Test Creation:** Design user interfaces that allow users to define test scenarios
      using natural language or visual flows, which are then translated into executable tests by AI.
    - **Adaptive Element Locators:** Implement AI models that can analyze page structure and visual
      cues to create more robust element locators that are less prone to breaking from minor HTML
      changes.
    - **Smart Assertion Generation:** Develop AI capabilities to suggest or automatically generate
      assertions based on expected outcomes or captured application states.
    - **Automated Test Healing:** Explore using AI to suggest fixes or automatically adjust test
      steps when elements or workflows change slightly.

- **Platform Enhancements:**

    - **Modern & Responsive UI:** Continue leveraging component-driven design
      (`BottomNavigationBar.jsx`, etc.) to ensure a seamless and responsive user experience across
      desktops and mobile devices, including dedicated interfaces for testing, reporting, admin, and
      documentation (`Docs.jsx`). Ensure consistent styling (`styles.css`).
    - **Enhanced Authentication & Security:** Strengthen existing authentication flows (`Login`,
      `SignUp`, `Forgot`/`Reset`) with multi-factor authentication options and continuous monitoring
      for suspicious activity. Ensure secure API communication and data storage.
    - **Advanced Admin & Monitoring:** Expand the Admin panel (`Admin.jsx`) with detailed dashboards
      for monitoring system health, test execution statistics, AI usage, and user activity.
      Implement comprehensive logging and alerting (`utils.js` for helpers).
    - **Scalable Backend & Diverse AI Integration:** Optimize server performance and scalability
      using containerization (`Dockerfile`, `docker-compose.yml`) and potentially orchestration.
      Fully integrate and utilize the diverse capabilities of AI models (`claude.js`, `deepseek.js`,
      `gemini.js`, `grok.js`, `openai.js`, `search.js`) for various aspects of the testing process.
    - **Robust Error Handling & Observability:** Implement centralized logging and monitoring across
      the entire application stack to quickly identify, diagnose, and resolve issues in test
      execution, AI interactions, and user management workflows.
    - **Continuous Integration/Delivery (CI/CD):** Establish robust CI/CD pipelines to automate
      builds, testing (of the platform itself), and deployment, ensuring high code quality and
      faster release cycles.

- **Documentation & Community:**
    - **Integrated Documentation:** Provide accessible in-app documentation and guides (`Docs.jsx`)
      to help users effectively utilize all features, alongside external comprehensive guides.
    - **API Documentation:** Generate and maintain clear documentation for the server API to
      facilitate potential integrations.

## TODO
