# Documentation for server/models/Project.js

## File Path

`server/models/Project.js`

## Overview

This file defines the Mongoose schema and model for a `Project`. In the context of this application,
a Project represents a specific application or system that a user wants to manage or test. It links
the project to the user who owns it and stores basic information about the application being
targeted. This file is part of the backend's data modeling layer, responsible for defining the
structure of documents stored in the MongoDB database.

## Dependencies

- `mongoose`: Used to define schemas, models, and interact with MongoDB.

## Schema Definition: `ProjectSchema`

The `ProjectSchema` defines the structure and constraints for documents stored in the `projects`
collection in MongoDB.
