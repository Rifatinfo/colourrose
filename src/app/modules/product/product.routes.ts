
import express, { NextFunction, Request, Response } from 'express';
import { ProductController } from './product.controller';
import { fileUploader } from '../../../utiles/fileUploader';
import { createProductSchema } from './product.validation';

const router = express.Router();


// router.post(
//     "/create",
//     fileUploader.upload.array("file", 4),
//     (req, res, next) => {
//         try {
//             if (!req.body?.data) {
//                 throw new Error("Product data missing");
//             }

//             const parsed = JSON.parse(req.body.data);
//             req.body = createProductSchema.parse(parsed);

//             next();
//         } catch (error) {
//             next(error);
//         }
//     },
//     ProductController.createProduct
// );
router.post(
    "/create",
    fileUploader.upload.array("file", 4),
    (req: Request, _res: Response, next: NextFunction) => {
        try {
            if (!req.body?.data) {
                throw new Error("Product data missing");
            }

            const parsed = JSON.parse(req.body.data);
            const validated = createProductSchema.parse(parsed);

            // 🔥 overwrite safely
            req.body = validated;

            next();
        } catch (error) {
            next(error);
        }
    },
    ProductController.createProduct
);



router.get("/", ProductController.getAll);
router.delete("/:productId", ProductController.deleteProduct);

export const ProductRoutes = router;