// SimpleTodoApp - Data Model and Persistence Layer

// Exported storage key used for localStorage
export const STORAGE_KEY = 'simpleTodoTasks';

/**
 * Represents a single todo task.
 */
export class Task {
  /**
   * @param {string|number} id - Unique identifier for the task.
   * @param {string} text - The description of the task.
   * @param {boolean} [completed=false] - Completion status.
   */
  constructor(id, text, completed = false) {
    this.id = id;
    this.text = text;
    this.completed = completed;
  }
}

/**
 * Load tasks from localStorage.
 * @returns {Task[]} Array of Task instances; empty array if none stored.
 */
export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Ensure we return Task instances
    if (Array.isArray(parsed)) {
      return parsed.map(item => new Task(item.id, item.text, item.completed));
    }
    return [];
  } catch (e) {
    console.error('Failed to load tasks:', e);
    return [];
  }
}

/**
 * Save an array of Task objects to localStorage.
 * @param {Task[]} tasks - The tasks to persist.
 */
export function saveTasks(tasks) {
  try {
    const serialized = JSON.stringify(tasks);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

// ---------------------------------------------------------------------------
// UI Rendering Utilities
// ---------------------------------------------------------------------------

// Global state
let tasks = loadTasks();
let currentFilter = 'all'; // possible values: 'all', 'active', 'completed'

/**
 * Create a DOM element representing a single task.
 * @param {Task} task - The task to render.
 * @returns {HTMLLIElement} The <li> element for the task.
 */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.classList.add('task-item');
  if (task.completed) {
    li.classList.add('completed');
  }
  li.dataset.id = task.id;

  // Checkbox for completion
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!task.completed;
  checkbox.classList.add('task-checkbox');
  // Event listener will be handled via delegation.

  // Span for task text
  const span = document.createElement('span');
  span.classList.add('task-text');
  span.textContent = task.text;

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.classList.add('edit-btn');
  editBtn.textContent = 'Edit';

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.classList.add('delete-btn');
  deleteBtn.textContent = 'Delete';

  // Assemble the <li>
  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(editBtn);
  li.appendChild(deleteBtn);

  return li;
}

/**
 * Render the task list according to the current filter.
 */
function renderTasks() {
  const listContainer = document.querySelector('#task-list');
  if (!listContainer) {
    console.warn('No element with id "task-list" found in DOM.');
    return;
  }

  // Clear existing tasks
  listContainer.innerHTML = '';

  // Determine which tasks to display based on the filter
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true; // 'all'
  });

  // Append each task element
  filteredTasks.forEach(task => {
    const taskEl = createTaskElement(task);
    listContainer.appendChild(taskEl);
  });
}

/**
 * Add a new task with the given text.
 * @param {string} text - The task description.
 */
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return; // Do not add empty tasks
  const newTask = new Task(Date.now().toString(), trimmed);
  tasks.push(newTask);
  saveTasks(tasks);
  renderTasks();
}

/**
 * Delete a task by its id.
 * @param {string|number} id - The identifier of the task to delete.
 */
function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks(tasks);
  renderTasks();
}

/**
 * Toggle the completed state of a task.
 * @param {string|number} id - The identifier of the task to toggle.
 */
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks(tasks);
  renderTasks();
}

/**
 * Edit the text of a task.
 * @param {string|number} id - The identifier of the task to edit.
 * @param {string} newText - The new task description.
 */
function editTask(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return; // Avoid empty task text
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.text = trimmed;
  saveTasks(tasks);
  renderTasks();
}

/**
 * Update the current filter and adjust UI accordingly.
 * @param {'all' | 'active' | 'completed'} filter - Desired filter.
 */
function setFilter(filter) {
  // Update global filter state
  currentFilter = filter;

  // Update active class on filter buttons
  const btnAll = document.getElementById('filter-all');
  const btnActive = document.getElementById('filter-active');
  const btnCompleted = document.getElementById('filter-completed');

  // Helper to clear active class
  const clearActive = () => {
    btnAll?.classList.remove('active');
    btnActive?.classList.remove('active');
    btnCompleted?.classList.remove('active');
  };

  clearActive();
  if (filter === 'all') btnAll?.classList.add('active');
  else if (filter === 'active') btnActive?.classList.add('active');
  else if (filter === 'completed') btnCompleted?.classList.add('active');

  // Re‑render the list based on the new filter
  renderTasks();
}

// Initialise UI on script load (tasks may be rendered before DOM ready, but that's fine)
renderTasks();

// ---------------------------------------------------------------------------
// Event Handlers & Delegation (registered after DOM is ready)
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Add task via button click
  const addBtn = document.getElementById('add-task-btn');
  const inputField = document.getElementById('new-task');
  const taskList = document.getElementById('task-list');

  if (addBtn && inputField) {
    const handleAdd = () => {
      const text = inputField.value;
      if (text.trim()) {
        addTask(text);
        inputField.value = '';
        inputField.focus();
      }
    };

    addBtn.addEventListener('click', handleAdd);

    // Add task on Enter key within the input field
    inputField.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    });
  }

  // Event delegation for task actions (edit, delete, toggle)
  if (taskList) {
    taskList.addEventListener('click', e => {
      const target = e.target;
      const taskItem = target.closest('.task-item');
      if (!taskItem) return;
      const id = taskItem.dataset.id;

      if (target.matches('.task-checkbox')) {
        toggleComplete(id);
      } else if (target.matches('.edit-btn')) {
        // Use a prompt for editing – simple and accessible
        const currentText = taskItem.querySelector('.task-text')?.textContent || '';
        const newText = prompt('Edit task', currentText);
        if (newText !== null) {
          editTask(id, newText);
        }
      } else if (target.matches('.delete-btn')) {
        // Confirm deletion for safety (optional)
        if (confirm('Delete this task?')) {
          deleteTask(id);
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Filter button handling
  // ---------------------------------------------------------------------
  const filterAllBtn = document.getElementById('filter-all');
  const filterActiveBtn = document.getElementById('filter-active');
  const filterCompletedBtn = document.getElementById('filter-completed');

  if (filterAllBtn && filterActiveBtn && filterCompletedBtn) {
    filterAllBtn.addEventListener('click', () => setFilter('all'));
    filterActiveBtn.addEventListener('click', () => setFilter('active'));
    filterCompletedBtn.addEventListener('click', () => setFilter('completed'));

    // Initialise the active filter UI based on the default filter
    setFilter(currentFilter);
  }
});
