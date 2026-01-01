import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import User from '../models/User.js';
import Quotation from '../models/Quotation.js';
import Reservation from '../models/reservation.js';

// Product Reports
export const getProductReports = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic statistics
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    });
    const outOfStockProducts = await Product.countDocuments({
      stock: 0,
      isActive: true
    });

    // Category distribution
    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 }, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } },
      { $sort: { count: -1 } }
    ]);

    // Stock value analysis
    const stockValueStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalStockValue: { $sum: { $multiply: ['$price', '$stock'] } },
          avgPrice: { $avg: '$price' },
          maxPrice: { $max: '$price' },
          minPrice: { $min: '$price' }
        }
      }
    ]);

    // Recent products (last 30 days)
    const recentProducts = await Product.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Supplier performance
    const supplierStats = await Product.aggregate([
      { $match: { isActive: true, supplier: { $exists: true } } },
      {
        $group: {
          _id: '$supplier',
          productCount: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$price', '$stock'] } }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      { $unwind: '$supplierInfo' },
      { $sort: { productCount: -1 } },
      { $limit: 10 }
    ]);

    // Get detailed low stock products (excluding out of stock)
    const lowStockProductsList = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      stock: { $gt: 0 },
      isActive: true
    }).select('name sku stock minStock image category price').sort({ stock: 1 });

    // Get detailed out of stock products
    const outOfStockProductsList = await Product.find({
      stock: 0,
      isActive: true
    }).select('name sku stock image category price updatedAt').sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          activeProducts,
          lowStockProducts,
          outOfStockProducts,
          recentProducts
        },
        categoryDistribution: categoryStats,
        stockValue: stockValueStats[0] || {},
        topSuppliers: supplierStats,
        lowStockProducts: lowStockProductsList,
        outOfStockProducts: outOfStockProductsList
      }
    });
  } catch (error) {
    console.error('Error generating product reports:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Supplier Reports
export const getSupplierReports = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic statistics
    const totalSuppliers = await Supplier.countDocuments();
    const activeSuppliers = await Supplier.countDocuments({ isActive: true });
    const inactiveSuppliers = await Supplier.countDocuments({ isActive: false });

    // Agreement status
    const currentDate = new Date();
    const expiredAgreements = await Supplier.countDocuments({
      agreementEndDate: { $lt: currentDate }
    });
    const expiringSoon = await Supplier.countDocuments({
      agreementEndDate: { 
        $gte: currentDate, 
        $lte: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) 
      }
    });

    // Products per supplier
    const supplierProductStats = await Product.aggregate([
      { $match: { isActive: true, supplier: { $exists: true } } },
      {
        $group: {
          _id: '$supplier',
          productCount: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$price', '$stock'] } },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      { $unwind: '$supplierInfo' },
      { $sort: { productCount: -1 } }
    ]);

    // Recent suppliers
    const recentSuppliers = await Supplier.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Location distribution
    const locationStats = await Supplier.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalSuppliers,
          activeSuppliers,
          inactiveSuppliers,
          expiredAgreements,
          expiringSoon,
          recentSuppliers
        },
        supplierProductStats,
        locationDistribution: locationStats
      }
    });
  } catch (error) {
    console.error('Error generating supplier reports:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// User Reports
export const getUserReports = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic statistics
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const customerUsers = await User.countDocuments({ role: 'customer' });

    // Recent registrations
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Registration trends (last 7 days)
    const registrationTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      registrationTrends.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    // Active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo }
    });

    // Top 5 most active users by login count
    const topActiveUsers = await User.find({ role: 'customer' })
      .select('fullName email loginCount lastLogin')
      .sort({ loginCount: -1 })
      .limit(5);

    // User activity levels
    const activityStats = await User.aggregate([
      {
        $group: {
          _id: null,
          avgLastLogin: { $avg: '$lastLogin' },
          maxLastLogin: { $max: '$lastLogin' },
          minLastLogin: { $min: '$lastLogin' },
          avgLoginCount: { $avg: '$loginCount' },
          maxLoginCount: { $max: '$loginCount' },
          totalLogins: { $sum: '$loginCount' }
        }
      }
    ]);

    // Login count distribution for chart
    const loginDistribution = await User.aggregate([
      {
        $bucket: {
          groupBy: '$loginCount',
          boundaries: [0, 1, 5, 10, 20, 50, 100],
          default: '100+',
          output: {
            count: { $sum: 1 },
            users: { $push: { name: '$fullName', email: '$email', loginCount: '$loginCount' } }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // User activity over time (last 7 days)
    const activityTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const activeCount = await User.countDocuments({
        lastLogin: { $gte: date, $lt: nextDate }
      });
      
      activityTrends.push({
        date: date.toISOString().split('T')[0],
        activeUsers: activeCount
      });
    }

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          adminUsers,
          customerUsers,
          recentRegistrations,
          activeUsers
        },
        registrationTrends,
        activityStats: activityStats[0] || {},
        topActiveUsers,
        loginDistribution,
        activityTrends
      }
    });
  } catch (error) {
    console.error('Error generating user reports:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Quotation Reports
export const getQuotationReports = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic statistics
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'pending' });
    const processingQuotations = await Quotation.countDocuments({ status: 'processing' });
    const completedQuotations = await Quotation.countDocuments({ status: 'completed' });
    const rejectedQuotations = await Quotation.countDocuments({ status: 'rejected' });

    // Recent quotations
    const recentQuotations = await Quotation.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Revenue analysis
    const revenueStats = await Quotation.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          avgQuotationValue: { $avg: '$totalAmount' },
          maxQuotationValue: { $max: '$totalAmount' },
          minQuotationValue: { $min: '$totalAmount' }
        }
      }
    ]);

    // Category analysis
    const categoryStats = await Quotation.aggregate([
      { $group: { _id: '$productCategory', count: { $sum: 1 }, totalValue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } }
    ]);

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const count = await Quotation.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      });
      
      const revenue = await Quotation.aggregate([
        { 
          $match: { 
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'completed'
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      
      monthlyTrends.push({
        month: startOfMonth.toISOString().substring(0, 7),
        count,
        revenue: revenue[0]?.total || 0
      });
    }

    // Response time analysis
    const responseTimeStats = await Quotation.aggregate([
      { $match: { status: { $in: ['completed', 'rejected'] } } },
      {
        $addFields: {
          responseTime: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          minResponseTime: { $min: '$responseTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalQuotations,
          pendingQuotations,
          processingQuotations,
          completedQuotations,
          rejectedQuotations,
          recentQuotations
        },
        revenueStats: revenueStats[0] || {},
        categoryStats,
        monthlyTrends,
        responseTimeStats: responseTimeStats[0] || {}
      }
    });
  } catch (error) {
    console.error('Error generating quotation reports:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reservation Reports
export const getReservationReports = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic statistics
    const totalReservations = await Reservation.countDocuments();
    const pendingReservations = await Reservation.countDocuments({ status: 'pending' });
    const confirmedReservations = await Reservation.countDocuments({ status: 'confirmed' });
    const completedReservations = await Reservation.countDocuments({ status: 'completed' });
    const cancelledReservations = await Reservation.countDocuments({ status: 'cancelled' });

    // Recent reservations
    const recentReservations = await Reservation.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const count = await Reservation.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      });
      
      monthlyTrends.push({
        month: startOfMonth.toISOString().substring(0, 7),
        count
      });
    }

    // Customer analysis
    const customerStats = await Reservation.aggregate([
      { $group: { _id: '$email', reservationCount: { $sum: 1 } } },
      { $sort: { reservationCount: -1 } },
      { $limit: 10 }
    ]);

    // Status distribution
    const statusDistribution = await Reservation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Response time analysis
    const responseTimeStats = await Reservation.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed', 'cancelled'] } } },
      {
        $addFields: {
          responseTime: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          minResponseTime: { $min: '$responseTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalReservations,
          pendingReservations,
          confirmedReservations,
          completedReservations,
          cancelledReservations,
          recentReservations
        },
        monthlyTrends,
        topCustomers: customerStats,
        statusDistribution,
        responseTimeStats: responseTimeStats[0] || {}
      }
    });
  } catch (error) {
    console.error('Error generating reservation reports:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Dashboard Overview Report
export const getDashboardOverview = async (req, res) => {
  try {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all key metrics
    const [
      totalProducts,
      totalSuppliers,
      totalUsers,
      totalQuotations,
      totalReservations,
      lowStockProducts,
      pendingQuotations,
      pendingReservations,
      recentQuotations,
      recentReservations
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Supplier.countDocuments({ isActive: true }),
      User.countDocuments(),
      Quotation.countDocuments(),
      Reservation.countDocuments(),
      Product.countDocuments({
        $expr: { $lte: ['$stock', '$minStock'] },
        isActive: true
      }),
      Quotation.countDocuments({ status: 'pending' }),
      Reservation.countDocuments({ status: 'pending' }),
      Quotation.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Reservation.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    // Revenue calculation
    const revenueData = await Quotation.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          totalSuppliers,
          totalUsers,
          totalQuotations,
          totalReservations,
          totalRevenue
        },
        alerts: {
          lowStockProducts,
          pendingQuotations,
          pendingReservations
        },
        recentActivity: {
          recentQuotations,
          recentReservations
        }
      }
    });
  } catch (error) {
    console.error('Error generating dashboard overview:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

