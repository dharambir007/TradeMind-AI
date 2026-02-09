import apiClient from './api';

export const getMarketStatus = async () => {
  const response = await apiClient.get('/market/status');
  return response.data;
};
