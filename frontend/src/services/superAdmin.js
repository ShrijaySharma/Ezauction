import api from './auth';

export const listAuctions = async () => {
  const response = await api.get('/super-admin/auctions');
  return response.data;
};

export const createAuction = async (id, name) => {
  const response = await api.post('/super-admin/auctions', { id, name });
  return response.data;
};

export const getAuction = async (auctionId) => {
  const response = await api.get(`/super-admin/auctions/${auctionId}`);
  return response.data;
};

export const updateAuctionStatus = async (auctionId, status) => {
  const response = await api.patch(`/super-admin/auctions/${auctionId}/status`, { status });
  return response.data;
};

export const resetAuction = async (auctionId) => {
  const response = await api.post(`/super-admin/auctions/${auctionId}/reset`);
  return response.data;
};

export const regenCreds = async (auctionId) => {
  const response = await api.post(`/super-admin/auctions/${auctionId}/regen-creds`);
  return response.data;
};

export const deleteAuction = async (auctionId) => {
  const response = await api.delete(`/super-admin/auctions/${auctionId}`);
  return response.data;
};
