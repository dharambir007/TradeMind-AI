import apiClient from "./api";

export const userService = {
  async getCurrentUser() {
    const response = await apiClient.get("/user/me");
    return response.data.user;
  },

  async updateProfile(data) {
    const response = await apiClient.put("/user/update", data);
    return response.data.user;
  },

  async deleteAccount() {
    const response = await apiClient.delete("/user/delete");
    return response.data;
  },
};

export default userService;
