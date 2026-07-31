import axios from "axios";

// Node environment ke hisab se automatic URL switch (Local vs Live)
const BASE_URL = process.env.NODE_ENV === "production"
  ? "https://rapidbill-f143.onrender.com"
  : "http://localhost:5000/api";

const API = axios.create({
  baseURL: BASE_URL,
});

// Automatic Bearer Token Interceptor
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- 1. Auth API Calls ---
export const loginUser = async (credentials) => {
  const response = await API.post("/auth/login", credentials);
  return response.data;
};

export const createEmployee = async (newEmpData) => {
  const response = await API.post("/auth/create-employee", newEmpData);
  return response.data;
};

// --- 2. Invoice Request API Calls ---
export const submitInvoiceRequest = async (formDataPayload) => {
  // Axios automatically handles 'multipart/form-data' boundary
  const response = await API.post("/invoices/request", formDataPayload);
  return response.data;
};

export const getPendingInvoices = async () => {
  const response = await API.get("/invoices/pending");
  return response.data;
};

export const approveInvoice = async (id) => {
  const response = await API.post(`/invoices/approve/${id}`);
  return response.data;
};

export const updateInvoice = async (id, updatedData) => {
  const response = await API.put(`/invoices/update/${id}`, updatedData);
  return response.data;
};

export const rejectInvoice = async (id, reason) => {
  const response = await API.post(`/invoices/reject/${id}`, { rejectionReason: reason });
  return response.data;
};

export default API;