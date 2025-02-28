# NotePlus Backend API
## Overview
This is the backend API for the NotePlus application, which allows users to create, manage, and update notes.

## API Documentation
For complete API documentation, including request/response examples, please visit our Postman Documentation.

https://documenter.getpostman.com/view/36300872/2sAYdhKADe

## Endpoints
1. POST /notes
2. 
- Description: Create a new note.
```
Request Body:
json
 
{
  "title": "string",
  "content": "string"
}
```
- Response: 200 - Note created successfully.

3. GET /notes
- Description: Retrieve all notes.
  ```
Response:
200: List of all notes.
```
4. GET /notes/:id
- Description: Retrieve a specific note by ID.
``Response:
200: Retrieved note.
```
5. PUT /notes/:id
- Description: Update a note.
``Request Body:
json
 
{
  "title": "string",
  "content": "string"
}
```
- Response: 200 - Note updated
6. DELETE /notes/:id

- Description: Delete a note.
```Response: 200 - Note deleted
```
## Installation

- Clone the repository.
Install dependencies:
``` npm install
```
- Start the server: 
```npm start
```
## Requirements
Node.js
Express
Postman (for testing the API)
