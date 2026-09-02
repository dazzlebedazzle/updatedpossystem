'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import LoadingButton from '@/components/LoadingButton';
import { toast } from '@/lib/toast';

const initialFormData = {
  shopId: '',
  targetAmount: '',
  minimumTargetAmount: '',
  isActive: true
};

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return (value._id || value.id || '').toString();
  }
  return value.toString();
}

export default function SuperAdminTargets() {
  const [targets, setTargets] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [targetsRes, shopsRes] = await Promise.all([
        fetch('/api/targets', { cache: 'no-store' }),
        fetch('/api/shops', { cache: 'default' })
      ]);

      const [targetsData, shopsData] = await Promise.all([
        targetsRes.json(),
        shopsRes.json()
      ]);

      setTargets(targetsData.targets || []);
      setShops(shopsData.shops || []);
    } catch (error) {
      console.error('Error loading targets:', error);
      toast.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const targetByShopId = useMemo(() => {
    const map = new Map();
    targets.forEach((target) => {
      map.set(getId(target.shopId), target);
    });
    return map;
  }, [targets]);

  const openCreateModal = () => {
    setEditingTarget(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  const openEditModal = (target) => {
    setEditingTarget(target);
    setFormData({
      shopId: getId(target.shopId),
      targetAmount: target.targetAmount || '',
      minimumTargetAmount: target.minimumTargetAmount || '',
      isActive: target.isActive !== false
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTarget(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        shopId: formData.shopId,
        targetAmount: Number(formData.targetAmount),
        minimumTargetAmount: Number(formData.minimumTargetAmount || 0),
        isActive: formData.isActive
      };

      const targetId = editingTarget?._id || editingTarget?.id;
      const response = await fetch(targetId ? `/api/targets/${targetId}` : '/api/targets', {
        method: targetId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(targetId ? 'Target updated successfully' : 'Target saved successfully');
        closeModal();
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to save target');
      }
    } catch (error) {
      console.error('Error saving target:', error);
      toast.error('Failed to save target');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (target) => {
    if (!confirm('Delete this target?')) return;

    try {
      const targetId = target._id || target.id;
      const response = await fetch(`/api/targets/${targetId}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Target deleted successfully');
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to delete target');
      }
    } catch (error) {
      console.error('Error deleting target:', error);
      toast.error('Failed to delete target');
    }
  };

  if (loading) {
    return (
      <Layout userRole="superadmin">
        <PageLoader message="Loading targets..." />
      </Layout>
    );
  }

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Targets</h1>
            <p className="text-sm text-gray-700 mt-1">Set monthly revenue targets and minimum thresholds for each store.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
          >
            Add Target
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Monthly Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Minimum Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {targets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-700">
                      No store targets configured
                    </td>
                  </tr>
                ) : (
                  targets.map((target) => (
                    <tr key={target._id || target.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{target.shopName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">Rs {Number(target.targetAmount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">Rs {Number(target.minimumTargetAmount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${target.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {target.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(target)}
                            className="text-indigo-600 hover:text-indigo-900 hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDelete(target)}
                            className="text-red-600 hover:text-red-900 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-lg bg-white">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">{editingTarget ? 'Edit Target' : 'Add Target'}</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light"
                  aria-label="Close modal"
                >
                  x
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Store *</label>
                  <select
                    value={formData.shopId}
                    onChange={(event) => setFormData({ ...formData, shopId: event.target.value })}
                    required
                    disabled={Boolean(editingTarget)}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50"
                  >
                    <option value="">Select Store</option>
                    {shops.map((shop) => {
                      const shopId = getId(shop._id || shop.id);
                      const existingTarget = targetByShopId.get(shopId);
                      const disabled = Boolean(existingTarget) && !editingTarget;

                      return (
                        <option key={shopId} value={shopId} disabled={disabled}>
                          {shop.name}{shop.location ? ` - ${shop.location}` : ''}{disabled ? ' (target exists)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Monthly Target *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.targetAmount}
                    onChange={(event) => setFormData({ ...formData, targetAmount: event.target.value })}
                    required
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Minimum Target</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minimumTargetAmount}
                    onChange={(event) => setFormData({ ...formData, minimumTargetAmount: event.target.value })}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(event) => setFormData({ ...formData, isActive: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Active
                </label>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={submitting}
                    loadingText="Saving..."
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Save Target
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
