import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { apiClient } from "@/lib/api-client";

interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  diff: any;
  at: string;
  actor: {
    id: string;
    email: string;
  };
}

export const Route = createFileRoute("/audit-logs")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    entity: "",
    action: "",
    actorId: "",
    startDate: "",
    endDate: "",
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entity) params.append("entity", filters.entity);
      if (filters.action) params.append("action", filters.action);
      if (filters.actorId) params.append("actorId", filters.actorId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const data = await apiClient.get(`/audit-logs?${params}`);
      setLogs(data.logs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-green-100 text-green-800";
      case "UPDATE":
        return "bg-blue-100 text-blue-800";
      case "DELETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin or manager privileges to view audit logs.</p>
          <a href="/" className="text-blue-600 hover:underline">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-sm text-gray-600 mt-1">
                System activity and change history
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto px-6 py-4 bg-white border-b">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
            <select
              value={filters.entity}
              onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="">All</option>
              <option value="users">Users</option>
              <option value="products">Products</option>
              <option value="sales">Sales</option>
              <option value="purchase_orders">Purchase Orders</option>
              <option value="price_rules">Price Rules</option>
              <option value="reorder_suggestions">Reorder Suggestions</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="">All</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ entity: "", action: "", actorId: "", startDate: "", endDate: "" })}
              className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entity ID
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.actor.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {log.entity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.entityId.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Audit Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedLog.at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Actor</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLog.actor.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Action</label>
                  <p className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(
                        selectedLog.action
                      )}`}
                    >
                      {selectedLog.action}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Entity</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedLog.entity}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Entity ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedLog.entityId}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Change Details
                </label>
                <pre className="bg-gray-50 p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.diff, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}