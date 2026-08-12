import api from '../api';

export const getRequests = async () => {
  const response = await api.get('/requests');
  return response.data;
};

export const createRequest = async (data) => {
  const response = await api.post('/requests', data);
  return response.data;
};

export const cancelRequest = async (id) => {
  const response = await api.delete(`/requests/${id}`);
  return response.data;
};

export const updateRequestStatus = async (id, data) => {
  const response = await api.put(`/requests/${id}/status`, data);
  return response.data;
};
