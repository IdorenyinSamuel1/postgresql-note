import express from 'express';
import dotenv from 'dotenv';
import productRoutes from './routes/productRoutes.js';
import {errorHandler} from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(errorHandler);

app.use('/api/products', productRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});