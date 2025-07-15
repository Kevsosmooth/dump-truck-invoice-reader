import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  DollarSign, 
  Package,
  GripVertical,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { adminAPI } from '@/config/api';
import { toast } from 'sonner';

export default function PackageManager() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPackage, setEditingPackage] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credits: '',
    price: '',
    isActive: true,
    displayOrder: 0
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await adminAPI.get('/packages');
      setPackages(response.data);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.credits || parseInt(formData.credits) <= 0) {
      newErrors.credits = 'Credits must be a positive number';
    }
    
    if (formData.price === '' || parseFloat(formData.price) < 0) {
      newErrors.price = 'Price must be 0 or greater';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      if (editingPackage) {
        // Update existing package
        await adminAPI.put(`/packages/${editingPackage.id}`, {
          ...formData,
          credits: parseInt(formData.credits),
          price: parseFloat(formData.price)
        });
        toast.success('Package updated successfully');
      } else {
        // Create new package
        await adminAPI.post('/packages', {
          ...formData,
          credits: parseInt(formData.credits),
          price: parseFloat(formData.price)
        });
        toast.success('Package created successfully');
      }
      
      resetForm();
      fetchPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error(error.response?.data?.error || 'Failed to save package');
    }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      credits: pkg.credits.toString(),
      price: (pkg.price / 100).toString(), // Convert from cents
      isActive: pkg.isActive,
      displayOrder: pkg.displayOrder
    });
    setShowNewForm(false);
    setErrors({});
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this package?')) {
      return;
    }

    try {
      await adminAPI.delete(`/packages/${id}`);
      toast.success('Package deleted successfully');
      fetchPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error(error.response?.data?.error || 'Failed to delete package');
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      await adminAPI.put(`/packages/${pkg.id}`, {
        isActive: !pkg.isActive
      });
      toast.success(`Package ${!pkg.isActive ? 'activated' : 'deactivated'}`);
      fetchPackages();
    } catch (error) {
      console.error('Error toggling package:', error);
      toast.error('Failed to update package status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      credits: '',
      price: '',
      isActive: true,
      displayOrder: 0
    });
    setEditingPackage(null);
    setShowNewForm(false);
    setErrors({});
  };

  const formatPrice = (priceInCents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(priceInCents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Credit Packages</h2>
          <p className="text-muted-foreground">Manage pricing and credit packages</p>
        </div>
        {!showNewForm && !editingPackage && (
          <Button onClick={() => setShowNewForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Package
          </Button>
        )}
      </div>

      {/* New/Edit Form */}
      {(showNewForm || editingPackage) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingPackage ? 'Edit Package' : 'New Package'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Basic, Pro, Enterprise"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    placeholder="e.g., 100"
                    className={errors.credits ? 'border-red-500' : ''}
                  />
                  {errors.credits && (
                    <p className="text-sm text-red-500">{errors.credits}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className={`pl-8 ${errors.price ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-sm text-red-500">{errors.price}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Perfect for small businesses"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  {editingPackage ? 'Update' : 'Create'} Package
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Packages List */}
      <div className="grid gap-4">
        {packages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No packages configured</p>
              <Button 
                onClick={() => setShowNewForm(true)} 
                className="mt-4"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Package
              </Button>
            </CardContent>
          </Card>
        ) : (
          packages.map((pkg) => (
            <Card key={pkg.id} className={!pkg.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">{pkg.name}</h3>
                        {!pkg.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-sm font-medium">
                          {pkg.credits.toLocaleString()} credits
                        </span>
                        <span className="text-sm font-medium">
                          {formatPrice(pkg.price)}
                        </span>
                        {pkg._count?.Transaction > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {pkg._count.Transaction} purchases
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(pkg)}
                    >
                      {pkg.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(pkg)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {pkg._count?.Transaction === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pkg.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Changes to packages will automatically sync with Stripe. Active packages 
          will be available for purchase immediately. Packages with transaction history 
          cannot be deleted, only deactivated.
        </AlertDescription>
      </Alert>
    </div>
  );
}