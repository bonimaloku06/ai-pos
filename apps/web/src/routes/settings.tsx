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
import { Users, Percent, Edit, Trash2 } from "lucide-react";

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

interface TaxClass {
  id: string;
  name: string;
  rate: number;
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
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingTaxClass, setEditingTaxClass] = useState<TaxClass | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: "",
    password: "",
    role: "CASHIER" as "ADMIN" | "MANAGER" | "CASHIER",
    storeId: "",
  });
  const [taxFormData, setTaxFormData] = useState({
    name: "",
    rate: 0,
  });

  useEffect(() => {
    fetchUsers();
    fetchStores();
    fetchTaxClasses();
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

  const fetchTaxClasses = async () => {
    try {
      const data = await apiClient.get("/tax-classes");
      setTaxClasses(data.taxClasses || []);
    } catch (error) {
      console.error("Failed to fetch tax classes:", error);
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

  // Tax Class Management
  const handleTaxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: taxFormData.name,
        rate: taxFormData.rate / 100, // Convert percentage to decimal
      };

      if (editingTaxClass) {
        await apiClient.patch(`/tax-classes/${editingTaxClass.id}`, payload);
      } else {
        await apiClient.post("/tax-classes", payload);
      }

      await fetchTaxClasses();
      resetTaxForm();
    } catch (error: any) {
      console.error("Failed to save tax class:", error);
      alert(error.message || "Failed to save tax class");
    }
  };

  const handleDeleteTaxClass = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax class? Products using this tax class will no longer have tax applied.")) return;

    try {
      await apiClient.delete(`/tax-classes/${id}`);
      await fetchTaxClasses();
    } catch (error: any) {
      console.error("Failed to delete tax class:", error);
      alert(error.message || "Failed to delete tax class");
    }
  };

  const resetTaxForm = () => {
    setTaxFormData({
      name: "",
      rate: 0,
    });
    setEditingTaxClass(null);
    setShowTaxModal(false);
  };

  const handleEditTaxClass = (taxClass: TaxClass) => {
    setEditingTaxClass(taxClass);
    setTaxFormData({
      name: taxClass.name,
      rate: taxClass.rate * 100, // Convert decimal to percentage for display
    });
    setShowTaxModal(true);
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
          <p className="text-gray-600 mt-1">Manage users, tax classes, and system configuration</p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="taxes" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Tax Classes
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

          {/* Tax Classes Tab */}
          <TabsContent value="taxes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tax Classes</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage VAT/tax rates for products (e.g., 0%, 8%, 18%)
                    </p>
                  </div>
                  <Button onClick={() => setShowTaxModal(true)}>+ Add Tax Class</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tax Rate</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxClasses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No tax classes found. Add one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxClasses.map((taxClass) => (
                        <TableRow key={taxClass.id}>
                          <TableCell className="font-medium">{taxClass.name}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                              {(taxClass.rate * 100).toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(taxClass.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTaxClass(taxClass)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTaxClass(taxClass.id)}
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

      {/* Tax Class Modal */}
      <Dialog open={showTaxModal} onOpenChange={setShowTaxModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTaxClass ? "Edit Tax Class" : "Add Tax Class"}</DialogTitle>
            <DialogDescription>
              {editingTaxClass
                ? "Update tax class information"
                : "Create a new tax class (e.g., Standard VAT 18%)"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTaxSubmit} className="space-y-4">
            <div>
              <Label htmlFor="taxName">Tax Class Name</Label>
              <Input
                id="taxName"
                type="text"
                value={taxFormData.name}
                onChange={(e) => setTaxFormData({ ...taxFormData, name: e.target.value })}
                placeholder="e.g., Standard VAT, Reduced VAT, Zero-rated"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                A descriptive name for this tax rate
              </p>
            </div>

            <div>
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxFormData.rate}
                onChange={(e) =>
                  setTaxFormData({ ...taxFormData, rate: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g., 18, 8, 0"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter as percentage (e.g., 18 for 18% VAT)
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-medium mb-1">Preview</div>
              <div className="text-lg font-bold text-blue-600">
                {taxFormData.name || "Tax Class"}: {taxFormData.rate.toFixed(2)}%
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTaxForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTaxClass ? "Update Tax Class" : "Create Tax Class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
