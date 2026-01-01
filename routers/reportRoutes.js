import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getProductReports,
  getSupplierReports,
  getUserReports,
  getQuotationReports,
  getReservationReports,
  getDashboardOverview
} from '../controllers/reportController.js';

const router = express.Router();

// All report routes require authentication
router.use(protect);

// Dashboard overview
router.get('/dashboard', getDashboardOverview);

// Individual report routes
router.get('/products', getProductReports);
router.get('/suppliers', getSupplierReports);
router.get('/users', getUserReports);
router.get('/quotations', getQuotationReports);
router.get('/reservations', getReservationReports);

export default router;

