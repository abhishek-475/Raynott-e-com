const Product = require('../models/Product');

// Get all products
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single product by ID
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new product
const createProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, images } = req.body;
        const product = await Product.create({
            name,
            description,
            price,
            category,
            stock,
            images,
        });
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a product
const updateProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, images } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Only update fields if provided
        if (name) product.name = name;
        if (description) product.description = description;
        if (price) product.price = price;
        if (category) product.category = category;
        if (stock) product.stock = stock;
        if (images) product.images = images;

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a product
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        await product.remove();
        res.json({ message: 'Product removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const searchProducts = async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, sort } = req.query;
        
        // Build query
        let query = {};
        
        // Text search
        if (q) {
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } }
            ];
        }
        
        // Category filter
        if (category) {
            query.category = { $regex: category, $options: 'i' };
        }
        
        // Price range filter
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        
        // Build sort
        let sortQuery = {};
        switch (sort) {
            case 'price-low':
                sortQuery.price = 1;
                break;
            case 'price-high':
                sortQuery.price = -1;
                break;
            case 'rating':
                sortQuery.rating = -1;
                break;
            case 'newest':
                sortQuery.createdAt = -1;
                break;
            default:
                // If there's a search query, sort by relevance
                if (q) {
                    // This is a simple relevance sort - you might want to improve this
                    sortQuery = { name: 1 };
                }
        }
        
        const products = await Product.find(query).sort(sortQuery);
        res.json(products);
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const products = await Product.find({ 
            category: { $regex: category, $options: 'i' } 
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get featured products
const getFeaturedProducts = async (req, res) => {
    try {
        const products = await Product.find({ featured: true }).limit(10);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get trending products
const getTrendingProducts = async (req, res) => {
    try {
        // You might want to add a 'views' or 'popularity' field to your model
        const products = await Product.find().sort({ createdAt: -1 }).limit(10);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get categories
const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct('category');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update your module.exports to include all functions
module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    getProductsByCategory,
    getFeaturedProducts,
    getTrendingProducts,
    getCategories
};


