import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import productRouter from './routers/productRoutes.js';
import userRouter from './routers/userRoutes.js';
import quotationRouter from './routers/quotationRoutes.js';
import reservationRouter from './routers/reservationRoutes.js';
import dotenv from 'dotenv';
import supplierRouter from './routers/supplierRoutes.js';
import reportRouter from './routers/reportRoutes.js';

dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// EDITED: Added CORS support for frontend communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect("mongodb+srv://nethupa:1234@cluster01.e3dgkeq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01")
.then(()=>{
    console.log("Connected to the database")
}).catch(()=>{
    console.log("Database connection failed")
});

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'NS Stores API is working!' });
});


app.use("/api/products", productRouter)
app.use("/api/users", userRouter)
app.use("/api/quotations", quotationRouter)
app.use("/api/suppliers", supplierRouter) // Add this line
app.use("/api/reservations", reservationRouter);
app.use("/api/reports", reportRouter);


app.listen( 5000, 
    ()=>{
        console.log('Server is running on port 5000');
    }
)

