# ✅ VAT Settings Feature - Complete

## 🎯 Feature Overview

You can now manage VAT (Value Added Tax) rates and automatically apply them to supplier purchases!

---

## 📋 What Was Implemented

### **1. Database Schema** ✅
- **New Table**: `vat_rates`
  - `id` - Unique identifier
  - `name` - VAT rate name (e.g., "Standard VAT - 8%")
  - `rate` - VAT percentage (e.g., 8.00 for 8%)
  - `isDefault` - Mark as default VAT rate
  - `isActive` - Enable/disable VAT rate
  - `description` - Optional description

### **2. Updated Models** ✅
- **PurchaseOrder** - Added VAT fields:
  - `vatRateId` - Link to VAT rate
  - `vatAmount` - Calculated VAT amount
  - `totalWithVat` - Total including VAT

- **GoodsReceipt** - Added VAT fields:
  - `vatRateId` - Link to VAT rate
  - `vatAmount` - Calculated VAT amount  
  - `totalCost` - Total before VAT
  - `totalWithVat` - Total including VAT

### **3. API Endpoints** ✅

#### **GET `/vat-rates`**
Get all VAT rates (sorted by default first, then by rate)
```json
[
  {
    "id": "...",
    "name": "Standard VAT - 8%",
    "rate": 8.0,
    "isDefault": true,
    "isActive": true,
    "description": "Standard VAT rate for most goods"
  }
]
```

#### **GET `/vat-rates/default`**
Get the default VAT rate
```json
{
  "id": "...",
  "name": "Standard VAT - 8%",
  "rate": 8.0,
  "isDefault": true,
  "isActive": true
}
```

#### **GET `/vat-rates/:id`**
Get a single VAT rate by ID

#### **POST `/vat-rates`**
Create a new VAT rate (Admin/Manager only)
```json
{
  "name": "Reduced VAT - 5%",
  "rate": 5.0,
  "isDefault": false,
  "description": "Reduced rate for essential medicines"
}
```

#### **PATCH `/vat-rates/:id`**
Update a VAT rate (Admin/Manager only)
```json
{
  "name": "Updated VAT",
  "rate": 10.0,
  "isActive": true
}
```

#### **DELETE `/vat-rates/:id`**
Delete a VAT rate (Admin only)
- Cannot delete the default VAT rate

#### **POST `/vat-rates/:id/set-default`**
Set a VAT rate as default (Admin/Manager only)

---

## 🌱 Pre-seeded VAT Rates

Your database now has these default VAT rates:

| Name | Rate | Default | Active | Description |
|------|------|---------|--------|-------------|
| **Standard VAT - 8%** | 8% | ✅ Yes | ✅ Yes | Standard VAT rate for most goods |
| **Reduced VAT - 5%** | 5% | ❌ No | ✅ Yes | Reduced VAT rate for essential medicines |
| **Zero VAT - 0%** | 0% | ❌ No | ✅ Yes | Zero-rated items (no VAT) |
| **Higher VAT - 18%** | 18% | ❌ No | ❌ No | Higher VAT rate for luxury items |

---

## 🛒 How VAT Works in Purchases

### **Automatic VAT Application**
When creating a **Goods Receipt Note (GRN)**, the system:

1. **Uses default VAT rate** if you don't specify one
2. **Calculates VAT amount** automatically
3. **Shows breakdown**:
   - Total Cost (before VAT)
   - VAT Amount (calculated)
   - Total with VAT (final amount)

### **Example GRN Response**
```json
{
  "grnNumber": "GRN-000123",
  "batches": [...],
  "totalItems": 50,
  "totalCost": 1000.00,
  "vatRate": {
    "id": "...",
    "name": "Standard VAT - 8%",
    "rate": 8.0
  },
  "vatAmount": 80.00,
  "totalWithVat": 1080.00
}
```

### **Calculation Example**
```
Scenario: Purchasing products worth $1,000
VAT Rate: 8% (default)

Total Cost (before VAT): $1,000.00
VAT Amount (8%):         $   80.00
                         ----------
Total with VAT:          $1,080.00
```

---

## 🔧 How to Use

### **1. View Available VAT Rates**
```bash
GET http://localhost:4000/vat-rates
Authorization: Bearer <your-token>
```

### **2. Create a New VAT Rate**
```bash
POST http://localhost:4000/vat-rates
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Special VAT - 10%",
  "rate": 10.0,
  "isDefault": false,
  "description": "Special rate for specific items"
}
```

### **3. Set a VAT Rate as Default**
```bash
POST http://localhost:4000/vat-rates/{id}/set-default
Authorization: Bearer <your-token>
```

### **4. Create GRN with Default VAT**
```bash
POST http://localhost:4000/grn
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "storeId": "...",
  "supplierId": "...",
  "lines": [
    {
      "productId": "...",
      "qty": 10,
      "unitCost": 100.00
    }
  ]
}
```
**Result**: VAT automatically applied using default 8% rate

### **5. Create GRN with Specific VAT Rate**
```bash
POST http://localhost:4000/grn
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "storeId": "...",
  "supplierId": "...",
  "vatRateId": "...",  // Specify a different VAT rate
  "lines": [...]
}
```

---

## 📝 Business Logic

### **Default VAT Behavior**
- ✅ When creating a GRN without specifying `vatRateId`, the system uses the **default VAT rate**
- ✅ You can override by providing a specific `vatRateId`
- ✅ If no VAT rate exists, VAT amount will be 0

### **Setting Default VAT**
- ✅ Only **one VAT rate** can be default at a time
- ✅ Setting a new default automatically unsets the previous one
- ✅ Default VAT must be **active**

### **Deleting VAT Rates**
- ❌ Cannot delete the default VAT rate
- ✅ Must set another rate as default first
- ❌ Cannot delete VAT rates used in existing purchases

---

## 🔐 Permissions

| Action | Required Role |
|--------|--------------|
| View VAT rates | Any authenticated user |
| Create VAT rate | Admin, Manager |
| Update VAT rate | Admin, Manager |
| Delete VAT rate | Admin only |
| Set as default | Admin, Manager |

---

## 🎨 Frontend Integration

### **Display VAT on Purchase Forms**
```typescript
// 1. Fetch available VAT rates
const vatRates = await fetch('/vat-rates');

// 2. Get default VAT rate
const defaultVat = await fetch('/vat-rates/default');

// 3. Show VAT dropdown in purchase form
<select name="vatRateId">
  <option value="">Use Default ({defaultVat.name})</option>
  {vatRates.map(vat => (
    <option value={vat.id}>{vat.name} - {vat.rate}%</option>
  ))}
</select>

// 4. Calculate and show VAT preview
const totalCost = items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
const vatAmount = (totalCost * selectedVatRate.rate) / 100;
const totalWithVat = totalCost + vatAmount;
```

---

## 📊 Database Files

### **Schema Updated**
- ✅ `apps/api-core/prisma/schema.prisma` - Added VatRate model

### **Seed Script**
- ✅ `apps/api-core/prisma/seed-vat-rates.ts` - Seeded default VAT rates

### **API Routes**
- ✅ `apps/api-core/src/routes/vat-rates.ts` - VAT management endpoints
- ✅ `apps/api-core/src/routes/grn.ts` - Updated to use VAT
- ✅ `apps/api-core/src/index.ts` - Registered VAT routes

---

## ✨ Features Included

✅ Create multiple VAT rates (8%, 5%, 18%, custom)
✅ Set one VAT rate as default
✅ Automatic VAT calculation in purchases
✅ Override default VAT per purchase
✅ Enable/disable VAT rates
✅ View VAT breakdown in purchase receipts
✅ Audit logging for all VAT changes
✅ Role-based access control
✅ Cannot delete default VAT rate (safety)

---

## 🚀 Next Steps

1. **Test the API endpoints** using Swagger docs: http://localhost:4000/docs
2. **Update frontend** to show VAT rates in purchase forms
3. **Add VAT reports** (optional) - total VAT paid by period
4. **Configure tax rates** for your country's requirements

---

## 📞 API Documentation

Full API documentation available at: **http://localhost:4000/docs**

Look for the **"VAT Rates"** section in Swagger UI!

---

**🎉 You now have a complete VAT management system with automatic calculation on all supplier purchases!**
