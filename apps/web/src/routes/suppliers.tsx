import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/suppliers")({
  component: SuppliersScreen,
});

function SuppliersScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [calendar, setCalendar] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && user) {
      loadSuppliers();
    }
  }, [authLoading, user]);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getSuppliers({ isActive: true, limit: 100 });
      setSuppliers(data.suppliers || []);
    } catch (error: any) {
      console.error("Failed to load suppliers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendar = async (supplierId: string) => {
    try {
      const data = await apiClient.getSupplierCalendar(supplierId);
      setCalendar(data);
    } catch (error: any) {
      console.error("Failed to load calendar:", error);
    }
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleViewCalendar = async (supplier: any) => {
    setSelectedSupplier(supplier);
    await loadCalendar(supplier.id);
  };

  const handleDelete = async (supplier: any) => {
    if (!confirm(`Deactivate supplier "${supplier.name}"?`)) return;

    try {
      await apiClient.deleteSupplier(supplier.id);
      alert("Supplier deactivated successfully");
      loadSuppliers();
    } catch (error: any) {
      alert(`Failed to deactivate supplier: ${error.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role === "CASHIER") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <a
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Add Supplier
              </button>
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showForm ? (
          <SupplierForm
            supplier={editingSupplier}
            onSave={() => {
              setShowForm(false);
              loadSuppliers();
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : selectedSupplier && calendar ? (
          <CalendarView
            supplier={selectedSupplier}
            calendar={calendar}
            onBack={() => {
              setSelectedSupplier(null);
              setCalendar(null);
            }}
          />
        ) : (
          <SuppliersList
            suppliers={suppliers}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewCalendar={handleViewCalendar}
          />
        )}
      </div>
    </div>
  );
}

function SuppliersList({
  suppliers,
  isLoading,
  onEdit,
  onDelete,
  onViewCalendar,
}: {
  suppliers: any[];
  isLoading: boolean;
  onEdit: (supplier: any) => void;
  onDelete: (supplier: any) => void;
  onViewCalendar: (supplier: any) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Supplier
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lead Time
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              MOQ
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Payment Terms
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                No suppliers found. Click "Add Supplier" to create one.
              </td>
            </tr>
          ) : (
            suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{supplier.name}</div>
                  {supplier.deliveryDays.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Delivers: {supplier.deliveryDays.join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="text-gray-900">{supplier.contactPerson || "-"}</div>
                  <div className="text-gray-500">{supplier.email || "-"}</div>
                  <div className="text-gray-500">{supplier.phone || "-"}</div>
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {supplier.leadTimeDays} days
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {supplier.moq}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {supplier.paymentTerms}
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onViewCalendar(supplier)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Calendar
                    </button>
                    <button
                      onClick={() => onEdit(supplier)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(supplier)}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SupplierForm({
  supplier,
  onSave,
  onCancel,
}: {
  supplier: any;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    contactPerson: supplier?.contactPerson || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    address: supplier?.address || "",
    leadTimeDays: supplier?.leadTimeDays || 7,
    deliveryDays: supplier?.deliveryDays || [],
    moq: supplier?.moq || 1,
    currency: supplier?.currency || "USD",
    paymentTerms: supplier?.paymentTerms || "NET 30",
    notes: supplier?.notes || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weekDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const toggleDeliveryDay = (day: string) => {
    if (formData.deliveryDays.includes(day)) {
      setFormData({
        ...formData,
        deliveryDays: formData.deliveryDays.filter((d: string) => d !== day),
      });
    } else {
      setFormData({
        ...formData,
        deliveryDays: [...formData.deliveryDays, day],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert("Supplier name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (supplier) {
        await apiClient.updateSupplier(supplier.id, formData);
        alert("Supplier updated successfully");
      } else {
        await apiClient.createSupplier(formData);
        alert("Supplier created successfully");
      }
      onSave();
    } catch (error: any) {
      alert(`Failed to save supplier: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-bold text-gray-900">
          {supplier ? "Edit Supplier" : "Create Supplier"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Person
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lead Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Time (Days)
            </label>
            <input
              type="number"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: Number(e.target.value) })
              }
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* MOQ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Order Quantity
            </label>
            <input
              type="number"
              value={formData.moq}
              onChange={(e) =>
                setFormData({ ...formData, moq: Number(e.target.value) })
              }
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Terms
            </label>
            <input
              type="text"
              value={formData.paymentTerms}
              onChange={(e) =>
                setFormData({ ...formData, paymentTerms: e.target.value })
              }
              placeholder="NET 30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Delivery Days */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Days
            </label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDeliveryDay(day)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    formData.deliveryDays.includes(day)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {isSubmitting ? "Saving..." : "Save Supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CalendarView({
  supplier,
  calendar,
  onBack,
}: {
  supplier: any;
  calendar: any;
  onBack: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {supplier.name} - Delivery Calendar
          </h2>
          <p className="text-sm text-gray-600">
            Lead time: {calendar.leadTimeDays} days • Delivers on:{" "}
            {calendar.deliveryDays.join(", ")}
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Back
        </button>
      </div>

      <div className="p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">
          Next 10 Delivery Dates
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {calendar.nextDeliveries.map((delivery: any, idx: number) => (
            <div
              key={idx}
              className="p-4 border border-blue-200 bg-blue-50 rounded-lg text-center"
            >
              <div className="text-sm font-medium text-blue-900">
                {delivery.dayName}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {new Date(delivery.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}