# Project Title

## Short Description
A simple, client‑side Todo application built with vanilla HTML, CSS, and JavaScript. It allows users to add, edit, delete, and filter tasks, with state persisted in `localStorage`.

![Screenshot Placeholder](path/to/screenshot.png)

---

## Tech Stack
- **HTML** – Structure of the application
- **CSS** – Layout, styling, and responsive design
- **JavaScript** – Application logic and state management

---

## Features
- Add new todo items
- Edit existing todo items
- Delete todo items
- Mark items as completed / toggle completion
- Filter view: All / Active / Completed
- Persist todo list across page reloads using `localStorage`

---

## Installation / Usage
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```
2. Open `index.html` in any modern web browser. No build step or server is required.

---

## File Structure
```
project-root/
├─ index.html          # Main HTML file containing the DOM structure
├─ styles.css          # CSS file for layout, styling and responsiveness
├─ script.js           # JavaScript file handling state, persistence and DOM manipulation
└─ README.md           # Project documentation (this file)
```
- **index.html** – Sets up the page layout, includes the input field, filter buttons, and a container for the todo list.
- **styles.css** – Provides visual styling, flexbox layout, and media queries for a responsive UI.
- **script.js** – Contains the core application logic:
  - A `state` object that holds the list of todos and the current filter.
  - Persistence via `localStorage` (load on start, save on change).
  - Functions `addTodo`, `editTodo`, `deleteTodo`, `toggleTodo`, `setFilter`, and `render` that manipulate the DOM based on the state.

---

## Architecture
The application follows a straightforward, component‑free architecture:
1. **HTML** provides the static DOM elements (input, list container, filter controls).
2. **CSS** handles the visual layout, ensuring the UI works on both desktop and mobile screens.
3. **JavaScript** (`script.js`) maintains a single source of truth – the `state` object:
   ```js
   const state = {
     todos: [],          // Array of { id, text, completed }
     filter: "all"      // "all" | "active" | "completed"
   };
   ```
   - On page load, the script reads any saved todos from `localStorage` and populates `state.todos`.
   - User interactions (adding, editing, deleting, toggling, changing filter) update `state` and immediately call `render()` to reflect changes in the DOM.
   - After each state mutation, the updated `state.todos` array is serialized back to `localStorage` to persist data across sessions.
   - The helper functions (`addTodo`, `editTodo`, `deleteTodo`, `toggleTodo`, `setFilter`, `render`) are pure in the sense that they only operate on the `state` object and the DOM, keeping the logic easy to follow and test.

---

## Future Improvements
- Add unit tests for the core functions using a testing framework like Jest.
- Implement drag‑and‑drop reordering of todo items.
- Add support for due dates and reminders.
- Provide a dark‑mode theme toggle.
- Refactor to a modular architecture (e.g., using ES modules) for better scalability.
- Persist filter selection in `localStorage` so the UI remembers the last view.

---

*This README is intended for developers who wish to understand, run, or extend the Todo application.*