# Documentation for `server/models/TestCase.js`

## Overview

This file defines the Mongoose schemas and the main model used for storing AI-generated test plans
within the application's MongoDB database. It is located in the `server/models` directory, which is
responsible for defining the data structures used by the server-side application logic to interact
with the database.

Specifically, this file defines:

1.  A schema for a single step within a test case (`TestStepSchema`).
2.  A schema for an individual AI-generated test case, which contains a sequence of steps
    (`AiTestCaseContentSchema`).
3.  The main `TestCaseSchema`, which represents a saved _test plan document_. This document
    typically contains metadata about the generation process (user, application URL, model used,
    documentation link) and an _array_ of the AI-generated test cases (`plan`).

The exported `TestCase` model is used throughout the server-side code (e.g., in API routes) to
perform CRUD (Create, Read, Update, Delete) operations on these saved test plans.

## Schemas

### `TestStepSchema`

Represents a single, atomic step within a larger test case. These steps are embedded within
`AiTestCaseContentSchema` documents.
