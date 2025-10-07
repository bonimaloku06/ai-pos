import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Edit, Trash2, Receipt } from "lucide-react";

interface User {
  id: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  storeId?: string;
  isActive: boolean;
  createdAt: string;
  store?: {
    id: string;
    name: string;
  };
}

interface Store {
  id: string;
  name: string;
}

interface VatRate {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showVatModal, setShowVatModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingVatRate, setEditingVatRate] = useState<VatRate | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: "",
    password: "",
    role: "CASHIER" as "ADMIN" | "MANAGER" | "CASHIER",
    storeId: "",
  });
  const [vatFormData, setVatFormData] = useState({
    name: "",
    rate: 0,
    description: "",
  });

  useEffect(() => {
    fetchUsers();
    fetchStores();
    fetchVatRates();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiClient.get("/users");
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const data = await apiClient.get("/stores");
      setStores(data.stores || []);
    } catch (error) {
      console.error("Failed to fetch stores:", error);
    }
  };

  const fetchVatRates = async () => {
    try {
      const data = await apiClient.get("/vat-rates");
      // Ensure rate is a number
      const normalizedData = (data || []).map((vr: VatRate) => ({
        ...vr,
        rate: Number(vr.rate)
      }));
      setVatRates(normalizedData);
    } catch (error) {
      console.error("Failed to fetch VAT rates:", error);
    }
  };

  // User Management
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        email: userFormData.email,
        role: userFormData.role,
        storeId: userFormData.storeId || null,
      };

      if (!editingUser || userFormData.password) {
        payload.password = userFormData.password;
      }

      if (editingUser) {
        await apiClient.patch(`/users/${editingUser.id}`, payload);
      } else {
        await apiClient.post("/users", payload);
      }

      await fetchUsers();
      resetUserForm();
    } catch (error: any) {
      console.error("Failed to save user:", error);
      alert(error.message || "Failed to save user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await apiClient.delete(`/users/${id}`);
      await fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      alert(error.message || "Failed to delete user");
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiClient.patch(`/users/${user.id}`, { isActive: !user.isActive });
      await fetchUsers();
    } catch (error) {
      console.error("Failed to toggle user:", error);
    }
  };

  const resetUserForm = () => {
    setUserFormData({
      email: "",
      password: "",
      role: "CASHIER",
      storeId: "",
    });
    setEditingUser(null);
    setShowUserModal(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      password: "",
      role: user.role,
      storeId: user.storeId || "",
    });
    setShowUserModal(true);
  };

  // VAT Rate Management
  const handleVatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: vatFormData.name,
        rate: vatFormData.rate,
        description: vatFormData.description || null,
      };

      if (editingVatRate) {
        await apiClient.patch(`/vat-rates/${editingVatRate.id}`, payload);
      } else {
        await apiClient.post("/vat-rates", payload);
      }

      await fetchVatRates();
      resetVatForm();
    } catch (error: any) {
      console.error("Failed to save VAT rate:", error);
      alert(error.message || "Failed to save VAT rate");
    }
  };

  const handleDeleteVatRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this VAT rate?")) return;

    try {
      await apiClient.delete(`/vat-rates/${id}`);
      await fetchVatRates();
    } catch (error: any) {
      console.error("Failed to delete VAT rate:", error);
      alert(error.message || "Failed to delete VAT rate. It might be set as default.");
    }
  };

  const handleToggleDefault = async (vatRate: VatRate) => {
    if (vatRate.isDefault) {
      alert("This is already the default VAT rate. Set another rate as default to change.");
      return;
    }

    try {
      await apiClient.patch(`/vat-rates/${vatRate.id}/toggle-default`, {});
      await fetchVatRates();
    } catch (error: any) {
      console.error("Failed to set default VAT:", error);
      alert(error.message || "Failed to set default VAT rate");
    }
  };

  const handleToggleVatActive = async (vatRate: VatRate) => {
    try {
      await apiClient.patch(`/vat-rates/${vatRate.id}`, { isActive: !vatRate.isActive });
      await fetchVatRates();
    } catch (error) {
      console.error("Failed to toggle VAT rate:", error);
    }
  };

  const resetVatForm = () => {
    setVatFormData({
      name: "",
      rate: 0,
      description: "",
    });
    setEditingVatRate(null);
    setShowVatModal(false);
  };

  const handleEditVatRate = (vatRate: VatRate) => {
    setEditingVatRate(vatRate);
    setVatFormData({
      name: vatRate.name,
      rate: vatRate.rate,
      description: vatRate.description || "",
    });
    setShowVatModal(true);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin privileges to access settings.</p>
          <a href="/" className="text-blue-600 hover:underline">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage users, VAT/tax rates, and system configuration</p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="vat" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              VAT/Tax Rates
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage user accounts and permissions
                    </p>
                  </div>
                  <Button onClick={() => setShowUserModal(true)}>+ Add User</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="font-medium">{user.email}</div>
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-blue-600">(You)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                user.role === "ADMIN"
                                  ? "bg-red-100 text-red-800"
                                  : user.role === "MANAGER"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell>{user.store ? user.store.name : "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              disabled={user.id === currentUser?.id}
                              className={`${
                                user.isActive
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-gray-600 hover:text-gray-700"
                              }`}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === currentUser?.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VAT Rates Tab */}
          <TabsContent value="vat" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>VAT/Tax Rates</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage VAT/tax rates for purchases and sales (e.g., 0%, 8%, 18%)
                    </p>
                  </div>
                  <Button onClick={() => setShowVatModal(true)}>+ Add VAT Rate</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Default</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatRates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No VAT rates found. Add one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      vatRates.map((vatRate) => (
                        <TableRow key={vatRate.id}>
                          <TableCell>
                            <Checkbox
                              checked={vatRate.isDefault}
                              onCheckedChange={() => handleToggleDefault(vatRate)}
                              disabled={vatRate.isDefault}
                              title={vatRate.isDefault ? "Currently default" : "Set as default"}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {vatRate.name}
                            {vatRate.isDefault && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                DEFAULT
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                              {Number(vatRate.rate).toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleVatActive(vatRate)}
                              className={`${
                                vatRate.isActive
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-gray-600 hover:text-gray-700"
                              }`}
                            >
                              {vatRate.isActive ? "Active" : "Inactive"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {vatRate.description || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditVatRate(vatRate)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVatRate(vatRate.id)}
                              disabled={vatRate.isDefault}
                              className="text-destructive hover:text-destructive"
                              title={vatRate.isDefault ? "Cannot delete default rate" : "Delete"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user information" : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">
                Password {editingUser && "(leave blank to keep unchanged)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                required={!editingUser}
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={userFormData.role}
                onValueChange={(value: any) => setUserFormData({ ...userFormData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="store">Store (optional)</Label>
              <Select
                value={userFormData.storeId}
                onValueChange={(value) => setUserFormData({ ...userFormData, storeId: value })}
              >
                <SelectTrigger id="store">
                  <SelectValue placeholder="No store assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No store assigned</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetUserForm}>
                Cancel
              </Button>
              <Button type="submit">{editingUser ? "Update User" : "Create User"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VAT Rate Modal */}
      <Dialog open={showVatModal} onOpenChange={setShowVatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVatRate ? "Edit VAT Rate" : "Add VAT Rate"}</DialogTitle>
            <DialogDescription>
              {editingVatRate
                ? "Update VAT/tax rate information"
                : "Create a new VAT/tax rate for purchases and sales (e.g., 8%, 18%)"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVatSubmit} className="space-y-4">
            <div>
              <Label htmlFor="vatName">VAT Rate Name</Label>
              <Input
                id="vatName"
                type="text"
                value={vatFormData.name}
                onChange={(e) => setVatFormData({ ...vatFormData, name: e.target.value })}
                placeholder="e.g., Standard VAT - 8%, Reduced VAT - 5%"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                A descriptive name for this VAT rate
              </p>
            </div>

            <div>
              <Label htmlFor="vatRateValue">VAT Rate (%)</Label>
              <Input
                id="vatRateValue"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={vatFormData.rate}
                onChange={(e) =>
                  setVatFormData({ ...vatFormData, rate: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g., 8, 18, 5"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter as percentage (e.g., 8 for 8% VAT)
              </p>
            </div>

            <div>
              <Label htmlFor="vatDescription">Description (optional)</Label>
              <Input
                id="vatDescription"
                type="text"
                value={vatFormData.description}
                onChange={(e) => setVatFormData({ ...vatFormData, description: e.target.value })}
                placeholder="e.g., Standard rate for most goods"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional description for this VAT rate
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm font-medium mb-1">Preview</div>
              <div className="text-lg font-bold text-green-600">
                {vatFormData.name || "VAT Rate"}: {Number(vatFormData.rate).toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {vatFormData.description || "No description"}
              </div>
              <div className="text-xs text-blue-600 mt-2">
                💡 Example: $100 purchase + {Number(vatFormData.rate).toFixed(2)}% VAT = $
                {(100 + (100 * Number(vatFormData.rate)) / 100).toFixed(2)}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetVatForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingVatRate ? "Update VAT Rate" : "Create VAT Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
