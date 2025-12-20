'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ name: '', email: '', phone: '', address: '' });
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  return (
    <Layout userRole="admin">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customers</h1>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm sm:text-base"
          >
            Add Customer
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{customer.email}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{customer.phone}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{customer.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {customers.map((customer) => (
                <div key={customer.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{customer.name}</h3>
                  <div className="space-y-2 text-sm">
                    {customer.email && (
                      <div>
                        <p className="text-gray-800">Email</p>
                        <p className="font-medium text-gray-900">{customer.email}</p>
                      </div>
                    )}
                    {customer.phone && (
                      <div>
                        <p className="text-gray-800">Phone</p>
                        <p className="font-medium text-gray-900">{customer.phone}</p>
                      </div>
                    )}
                    {customer.address && (
                      <div>
                        <p className="text-gray-800">Address</p>
                        <p className="font-medium text-gray-900">{customer.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {showModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowModal(false)}
            ></div>
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">Add New Customer</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-800 hover:text-gray-900 text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleCreateCustomer} className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

