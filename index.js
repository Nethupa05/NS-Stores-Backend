import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';

import productRouter from './routers/productRoutes.js';
import userRouter from './routers/userRoutes.js';
import quotationRouter from './routers/quotationRoutes.js';
import reservationRouter from './routers/reservationRoutes.js';
import supplierRouter from './routers/supplierRoutes.js';
import reportRouter from './routers/reportRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
// app.use(cors({
//   origin: process.env.CLIENT_URL,
//   credentials: true
// }));

const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to the database"))
  .catch(err => console.error("Database connection failed:", err));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'NS Stores API is working!' });
});

app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/quotations", quotationRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/reports", reportRouter);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
