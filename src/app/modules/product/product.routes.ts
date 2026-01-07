
import express from 'express';
import { ProductController } from './product.controller';

const router = express.Router();

router.post("/create", ProductController.createProduct);
router.get("/", ProductController.getAll);
router.delete("/:productId", ProductController.deleteProduct);

export const ProductRoutes = router;