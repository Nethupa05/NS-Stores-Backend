// controllers/productController.js
import mongoose from 'mongoose';
import Product from '../models/Product.js';

// Simple admin check: assumes you use `protect` middleware to set req.user
function isAdmin(req) {
  return !!(req.user && req.user.role === 'admin');
}

// Get all products with optional filtering & pagination
export async function getProducts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, parseInt(req.query.limit || '50'));
    const skip = (page - 1) * limit;

    const filter = {};
    if (!isAdmin(req)) {
      filter.isActive = true;
    }

    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('supplier', 'name email phone')
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      products
    });
  } catch (err) {
    console.error('getProducts error:', err);
    res.status(500).json({
      message: 'Failed to get products',
      error: err.message
    });
  }
}

// Get a single product by ObjectId or SKU
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).populate('supplier', 'name email phone');
    } else {
      product = await Product.findOne({ sku: id })
        .collation({ locale: 'en', strength: 2 })
        .populate('supplier', 'name email phone');
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // If non-admins shouldn't see inactive products:
    if (!isAdmin(req) && !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Server error while fetching product' });
  }
};

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const productData = req.body || {};

    if (!productData.sku && productData.category) {
      const categoryAbbr = String(productData.category).substring(0, 3).toUpperCase();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      productData.sku = `${categoryAbbr}-${randomNum}`;
    }

    // Handle image upload
    if (req.file) {
      // File upload - save file path
      productData.image = `/uploads/products/${req.file.filename}`;
      console.log('File uploaded:', req.file.filename);
    } else if (productData.image && productData.image.trim() !== '') {
      // URL input - use URL as-is
      productData.image = productData.image.trim();
      console.log('Using image URL:', productData.image);
    }

    console.log('Product data before save:', productData);

    const product = new Product(productData);
    const savedProduct = await product.save();

    // Re-query to reliably populate (avoids some mongoose version differences)
    const populated = await Product.findById(savedProduct._id).populate('supplier', 'name email phone');

    if (populated.isLowStock) {
      console.log('Low stock alert would be sent for:', populated.name);
    }

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'SKU must be unique' });
    } else if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      res.status(400).json({ message: errors.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while creating product' });
    }
  }
};

// Update a product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // disallow SKU changes
    if (req.body && req.body.sku) delete req.body.sku;

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Handle image upload
    if (req.file) {
      // File upload - save file path
      req.body.image = `/uploads/products/${req.file.filename}`;
      console.log('File uploaded for update:', req.file.filename);
    } else if (req.body.image && req.body.image.trim() !== '') {
      // URL input - use URL as-is
      req.body.image = req.body.image.trim();
      console.log('Using image URL for update:', req.body.image);
    } else if (req.body.removeImage === 'true') {
      // Explicitly remove image
      req.body.image = '';
      console.log('Removing image from product');
    }

    console.log('Update data:', req.body);

    // merge fields
    Object.assign(existingProduct, req.body || {});

    const updatedProduct = await existingProduct.save();

    // Re-query to populate safely
    const populated = await Product.findById(updatedProduct._id).populate('supplier', 'name email phone');

    if (populated.isLowStock) {
      console.log('Low stock alert would be sent for:', populated.name);
    }

    res.json(populated);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      res.status(400).json({ message: errors.join(', ') });
    } else if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    } else {
      res.status(500).json({ message: 'Server error while updating product' });
    }
  }
};

// Delete a product (permanent deletion)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to permanently delete product ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      console.log('Product not found for deletion');
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Product to be permanently deleted:', product.name);

    // Permanent deletion: remove from database
    await Product.findByIdAndDelete(id);

    console.log('Product permanently deleted:', product.name);

    res.json({ message: 'Product permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

// Check for low stock products
export const checkLowStock = async (req, res) => {
  try {
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true,
      stock: { $gt: 0 }
    }).populate('supplier');

    lowStockProducts.forEach(product => {
      console.log('Low stock alert would be sent for:', product.name);
    });

    res.json({
      count: lowStockProducts.length,
      products: lowStockProducts
    });
  } catch (error) {
    console.error('Error checking low stock:', error);
    res.status(500).json({ message: 'Server error while checking low stock' });
  }
};

// Update product stock
export const updateStock = async (req, res) => {
  try {
    const { operation, quantity } = req.body;

    if (!operation || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Valid operation and quantity are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (operation === 'add') {
      product.stock += Number(quantity);
    } else if (operation === 'subtract') {
      if (product.stock < Number(quantity)) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      product.stock -= Number(quantity);
    } else {
      return res.status(400).json({ message: 'Invalid operation. Use "add" or "subtract"' });
    }

    const updatedProduct = await product.save();
    const populated = await Product.findById(updatedProduct._id).populate('supplier', 'name email phone');

    if (populated.isLowStock) {
      console.log('Low stock alert would be sent for:', populated.name);
    }

    res.json(populated);
  } catch (error) {
    console.error('Error updating stock:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error while updating stock' });
  }
};

// Get product categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
};
