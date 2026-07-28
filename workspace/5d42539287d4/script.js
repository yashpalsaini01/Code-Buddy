// script.js - Core module for the Todo app (vanilla JavaScript)

// ------------------------------------------------------------
// DOM element references (must match index.html)
// ------------------------------------------------------------
const todoInput = document.getElementById('todo-input');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const filterButtons = document.querySelectorAll('.filter-btn');

// ------------------------------------------------------------
// Global application state
// ------------------------------------------------------------
const state = {
  todos: [], // {id:string, text:string, completed:boolean}
  filter: 'all' // 'all' | 'active' | 'completed'
};

// ------------------------------------------------------------
// Helper: simple HTML escaping to avoid XSS in rendered todo text
// ------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ------------------------------------------------------------
// Persistence helpers (localStorage)
// ------------------------------------------------------------
function loadTodos() {
  const raw = localStorage.getItem('todos');
  state.todos = raw ? JSON.parse(raw) : [];
}

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(state.todos));
}

// ------------------------------------------------------------
// UI Rendering
// ------------------------------------------------------------
function render() {
  // Filter todos according to current filter state
  const filtered = state.todos.filter(todo => {
    if (state.filter === 'active') return !todo.completed;
    if (state.filter === 'completed') return todo.completed;
    return true; // 'all'
  });

  // Clear current list
  todoList.innerHTML = '';

  // Render each todo item
  filtered.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.id = todo.id;
    if (todo.completed) li.classList.add('completed');

    li.innerHTML = `
      <input type="checkbox" class="toggle" ${todo.completed ? 'checked' : ''}>
      <span class="text">${escapeHtml(todo.text)}</span>
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Delete</button>
    `;
    todoList.appendChild(li);
  });

  // Update filter button ARIA state
  filterButtons.forEach(btn => {
    const isPressed = btn.dataset.filter === state.filter;
    btn.setAttribute('aria-pressed', isPressed);
  });
}

// ------------------------------------------------------------
// CRUD operations
// ------------------------------------------------------------
function addTodo(text) {
  const newTodo = {
    id: crypto.randomUUID(),
    text,
    completed: false
  };
  state.todos.push(newTodo);
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    render();
  }
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  saveTodos();
  render();
}

function editTodo(id, newText) {
  const todo = state.todos.find(t => t.id === id);
  if (todo) {
    todo.text = newText;
    saveTodos();
    render();
  }
}

// ------------------------------------------------------------
// Filter handling
// ------------------------------------------------------------
function setFilter(filter) {
  state.filter = filter;
  render();
}

// ------------------------------------------------------------
// Edit mode helpers (inline editing)
// ------------------------------------------------------------
function startEditMode(li, id) {
  const span = li.querySelector('.text');
  const current = span.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = current;

  li.classList.add('editing');
  li.replaceChild(input, span);
  input.focus();

  // Commit on Enter
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      finishEditMode(li, id, input.value);
    }
  });
  // Commit on blur (focus loss)
  input.addEventListener('blur', () => {
    finishEditMode(li, id, input.value);
  });
}

function finishEditMode(li, id, newText) {
  li.classList.remove('editing');
  // Ensure we restore the original structure via render()
  editTodo(id, newText.trim() || 'Untitled');
}

// ------------------------------------------------------------
// Event listeners
// ------------------------------------------------------------
// Delegated listener for todo list actions (toggle, edit, delete)
if (todoList) {
  todoList.addEventListener('click', e => {
    const li = e.target.closest('li.todo-item');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.matches('.toggle')) {
      toggleTodo(id);
    } else if (e.target.matches('.delete-btn')) {
      deleteTodo(id);
    } else if (e.target.matches('.edit-btn')) {
      startEditMode(li, id);
    }
  });
}

// Add new todo via button click
if (addButton) {
  addButton.addEventListener('click', () => {
    const text = todoInput.value.trim();
    if (text) {
      addTodo(text);
      todoInput.value = '';
    }
  });
}

// Add new todo via Enter key in input field
if (todoInput) {
  todoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const text = todoInput.value.trim();
      if (text) {
        addTodo(text);
        todoInput.value = '';
      }
    }
  });
}

// Filter button listeners
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setFilter(btn.dataset.filter);
  });
});

// Initialize application after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadTodos();
  render();
});
