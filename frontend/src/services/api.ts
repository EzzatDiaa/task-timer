// Base API URL
const API_URL = "http://localhost:3000";

// Helper function for making authenticated requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // Get the token from localStorage
  const token = localStorage.getItem("token");

  // Set up headers with authentication
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Make the request
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Parse the JSON response
  const data = await response.json();

  // If the response is not OK, throw an error
  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  // Return the data
  return data;
}

// Auth API functions
export const authAPI = {
  login: async (email: string, password: string) => {
    return fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => {
    return fetchWithAuth("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
  },

  getProfile: async () => {
    return fetchWithAuth("/auth/profile");
  },
};

// Task API functions
export const taskAPI = {
  getAllTasks: async () => {
    return fetchWithAuth("/tasks");
  },

  getTask: async (id: string) => {
    return fetchWithAuth(`/tasks/${id}`);
  },

  createTask: async (taskData: any) => {
    return fetchWithAuth("/tasks", {
      method: "POST",
      body: JSON.stringify(taskData),
    });
  },

  updateTask: async (id: string, taskData: any) => {
    return fetchWithAuth(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(taskData),
    });
  },

  deleteTask: async (id: string) => {
    return fetchWithAuth(`/tasks/${id}`, {
      method: "DELETE",
    });
  },

  // Timer operations
  timerOperation: async (
    taskId: string,
    operation: "start" | "pause" | "resume" | "stop" | "reset",
  ) => {
    return fetchWithAuth("/tasks/timer", {
      method: "POST",
      body: JSON.stringify({ taskId, operation }),
    });
  },

  checkTimerStatus: async (taskId: string) => {
    return fetchWithAuth(`/tasks/timer/${taskId}`);
  },
};
