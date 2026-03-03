import apiClient from "./api";

export const authService = {
  async login(email, password) {
    const response = await apiClient.post("/auth/login", { email, password });
    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }
    return response.data;
  },

  async signup(name, email, password) {
    const response = await apiClient.post("/auth/signup", { name, email, password });
    return response.data;
  },

  logout() {
    localStorage.removeItem("token");
  },

  isAuthenticated() {
    return !!localStorage.getItem("token");
  },

  getToken() {
    return localStorage.getItem("token");
  },
};

export default authService;
