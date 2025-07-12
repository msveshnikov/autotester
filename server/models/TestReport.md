# File: server\models\TestReport.js

## Overview

This file defines the Mongoose schema and model for `TestReport` documents. A `TestReport`
represents a specific execution run of a `TestPlan`. It tracks the status, timing, and results of
the test run, linking it back to the `TestPlan` being executed and the `User` who initiated the run.

## Role in Project Structure

Located within the `server/models` directory, this file is part of the server-side data layer
responsible for defining the structure of data stored in the MongoDB database. It works in
conjunction with other models in the `models` directory (`TestPlan`, `User`, etc.) to provide a
structured representation of application data. Server-side logic (e.g., in routes or background
processing scripts) will interact with the `TestReport` model to create, update, query, and manage
test execution reports.

## Schema Definition: `testReportSchema`

The `testReportSchema` defines the structure of a single test report document in the `testreports`
collection.
