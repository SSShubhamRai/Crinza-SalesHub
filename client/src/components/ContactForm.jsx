import React, { useState } from 'react';
import axios from 'axios';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    sendTo: '',
    message: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setAttachment(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', text: '' });

    const data = new FormData();
    data.append('sendTo', formData.sendTo);
    data.append('message', formData.message);
    if (attachment) {
      data.append('attachments', attachment);
    }

    try {
      const response = await axios.post('http://localhost:5000/api/v1/contact/message', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Origin': 'https://crinza.com'
        }
      });
      setStatus({ type: 'success', text: response.data.message || 'Email sent successfully!' });
      setFormData({ sendTo: '', message: '' });
      setAttachment(null);
    } catch (err) {
      setStatus({ 
        type: 'error', 
        text: err.response?.data?.error || 'Failed to send message. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Send Contact Message</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email (Send To)</label>
          <input 
            type="email" 
            name="sendTo"
            value={formData.sendTo} 
            onChange={handleChange} 
            required 
            placeholder="client@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message (HTML Supported)</label>
          <textarea 
            name="message"
            value={formData.message} 
            onChange={handleChange} 
            required 
            rows="5"
            placeholder="<h1>Hello World</h1><p>Your message here...</p>"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attachment File</label>
          <input 
            type="file" 
            onChange={handleFileChange} 
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Sending Email...' : 'Send Message'}
        </button>
      </form>

      {status.text && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {status.text}
        </div>
      )}
    </div>
  );
};

export default ContactForm;