import apiClient from "./api";

export const userService = {
  // Get current user profile
  async getCurrentUser() {
    const response = await apiClient.get("/user/me");
    return response.data.user;
  },

  // Update user profile
  async updateProfile(data) {
    const response = await apiClient.put("/user/update", data);
    return response.data.user;
  },

  // Delete user account
  async deleteAccount() {
    const response = await apiClient.delete("/user/delete");
    return response.data;
  },
};

export default userService;
