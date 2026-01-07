import { Request, Response } from "express";
import { catchAsync } from "../../middlewares/catchAsync";
import { createProductSchema } from "./product.validation";
import { StatusCodes } from "http-status-codes";
import { ProductService } from "./product.service";
import sendResponse from "../../middlewares/sendResponse";

const createProduct = catchAsync(async (req: Request, res: Response) => {
    const productParsed = createProductSchema.parse(req.body);
    const product = await ProductService.createProduct(productParsed);

    sendResponse(res , {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Product created successfully',
        data: product
    });
})

 const getAll = catchAsync(async (req: Request, res: Response) => {
    const products = await ProductService.getProducts();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Products retrieved successfully',
        data: products
    });
})

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;
    await ProductService.deleteProduct(productId);  

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Product deleted successfully',
        data : null
    });
});

export const ProductController = {
    createProduct,
    getAll,
    deleteProduct
}