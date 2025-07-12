# AutoTester.dev

First AI driven automatic test tool for webapps

![alt text](public/image.jpg)

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
  descriptions or user flows (any link from JIRA or Confluence for example).
- **Intelligent Element Interaction:** Use AI to reliably identify and interact with web elements,
  adapting to minor UI changes.
- **Automated Test Execution:** Run tests across different browsers and environments seamlessly.
- **Comprehensive Reporting:** Generate detailed reports with insights into test results,
  performance, and potential issues.
- **User & Admin Management:** Secure user authentication and a dedicated admin panel for platform
  control.

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
    - AI and search integrations: `gemini.js`, `search.js`
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
considerations are being explored, focusing on the core AI-driven test generation and execution
workflow:

- **Core AI Testing Workflow:**

    - **Input Handling:** Design the main user interface (`Landing.jsx` or similar) to prominently
      accept inputs like links to test/ticket documentation (JIRA, Confluence, etc.) and the URL of
      the web application to be tested.
    - **Intelligent Test Case Generation (via Gemini):** Develop server-side logic
      (`server/index.js`, potentially new files) leveraging the integrated Gemini model
      (`server/gemini.js`) to parse the provided documentation and web application URL. The AI
      should analyze the content and structure to intelligently generate relevant test scenarios and
      steps.
    - **Adaptive Element Locators:** Implement AI models (potentially part of the Gemini interaction
      or a separate module) that can analyze the target web application's DOM and visual structure
      to create robust and resilient element locators, minimizing test fragility due to minor UI
      changes.
    - **Automated Test Execution:** Develop server-side components to execute the generated test
      cases against the target web application URL. This involves simulating user interactions based
      on the generated steps.
    - **Smart Assertion Generation:** Enhance the AI's capability to suggest or automatically
      generate assertions based on expected outcomes derived from the documentation or analysis of
      the application state during test execution.
    - **Automated Test Healing:** Explore using AI to suggest fixes or automatically adjust test
      steps when elements or workflows change slightly, potentially analyzing test failure logs.

- **Platform Enhancements:**

    - **Modern & Responsive UI:** Continue leveraging component-driven design
      (`BottomNavigationBar.jsx`, `Navbar.jsx`, etc.) to ensure a seamless and responsive user
      experience across devices. The main UI (`Landing.jsx` or `App.jsx`) will prioritize the core
      input mechanism. Ensure consistent styling (`public/styles.css`) and dedicated interfaces for
      documentation (`Docs.jsx`), admin (`Admin.jsx`), etc.
    - **Enhanced Authentication & Security:** Strengthen existing authentication flows (`Login.jsx`,
      `SignUp.jsx`, `Forgot.jsx`, `Reset.jsx`, `server/user.js`, `server/middleware/auth.js`) with
      multi-factor authentication options and continuous monitoring. Ensure secure API communication
      and data storage (`server/models/User.js`, `server/index.js`).
    - **Advanced Admin & Monitoring:** Expand the Admin panel (`Admin.jsx`, `server/admin.js`) with
      detailed dashboards for monitoring system health, test execution statistics, AI usage
      (specifically Gemini), and user activity. Implement comprehensive logging and alerting
      (`server/utils.js`).
    - **Scalable Backend & Gemini Integration:** Optimize server performance and scalability using
      containerization (`Dockerfile`, `docker-compose.yml`). Focus backend development
      (`server/index.js`, `server/gemini.js`, `server/search.js`) on fully integrating and utilizing
      the Gemini model for the core test generation and execution logic, while preparing for
      potential future scaling needs.
    - **Robust Error Handling & Observability:** Implement centralized logging and monitoring across
      the entire application stack (`server/utils.js`) to quickly identify, diagnose, and resolve
      issues in test execution, AI interactions, and user management workflows.
    - **Continuous Integration/Delivery (CI/CD):** Establish robust CI/CD pipelines (`deploy.cmd`,
      `copy.cmd`, Docker files) to automate builds, testing (of the platform itself), and
      deployment, ensuring high code quality and faster release cycles.

- **Documentation & Community:**
    - **Integrated Documentation:** Provide accessible in-app documentation and guides (`Docs.jsx`)
      to help users effectively utilize the core test generation and execution features, alongside
      external comprehensive guides.
    - **API Documentation:** Generate and maintain clear documentation for the server API
      (`server/index.js`, `rest.http`) to facilitate potential integrations.

## TODO

- remove all models except Gemini
- remove all models from server code, leave only Gemini
- add to main UI starter page two links:
    - link to the test/ticket documentation
    - link to the actual web app URL to test on
- add server code to parse test/ticket description, parse webapp url for inputs/buttons and generate
  test cases
- add server code to execute test cases
