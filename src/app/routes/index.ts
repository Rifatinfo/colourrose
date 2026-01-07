import { Router } from "express";
import { ProductRoutes } from "../modules/product/product.routes";


export const router = Router();

const moduleRouters = [
    {
        path : "/product",
        route : ProductRoutes
    },
    
]

moduleRouters.forEach((route) => {
    router.use(route.path, route.route)
})