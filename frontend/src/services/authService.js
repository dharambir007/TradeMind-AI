import apiClient from "./api";

export const authService = {
  // Login user
  async login(email, password) {
    const response = await apiClient.post("/auth/login", { email, password });
    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }
    return response.data;
  },

  // Signup user
  async signup(name, email, password) {
    const response = await apiClient.post("/auth/signup", { name, email, password });
    return response.data;
  },

  // Logout user
  logout() {
    localStorage.removeItem("token");
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem("token");
  },

  // Get token
  getToken() {
    return localStorage.getItem("token");
  },
};

export default authService;
