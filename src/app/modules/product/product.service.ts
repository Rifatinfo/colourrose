import prisma from "../../../shared/prisma";
import { CreateProductInput } from "./product.validation"

const createProduct = async (data: CreateProductInput) => {
    return prisma.product.create({
        data: {
            name: data.name,
            slug: data.slug,
            sku: data.sku,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            stockQuantity: data.stockQuantity,
            stockStatus: data.stockStatus,
            shortDescription: data.shortDescription,
            fullDescription: data.fullDescription,

            // ===== Categories =====
            categories: data.categories
                ? {
                    create: data.categories.map((category) => ({
                        category: {
                            connectOrCreate: {
                                where: { id: category },
                                create: { id: category, name: category },
                            },
                        },
                    })),
                }
                : undefined,

            // ===== SubCategories =====
            subCategories: data.subCategories
                ? {
                    create: data.subCategories.map((subCategory: any) => {
                        if (typeof subCategory === "string") {
                            return {
                                subCategory: {
                                    connectOrCreate: {
                                        where: { id: subCategory },
                                        create: { id: subCategory, name: subCategory },
                                    },
                                },
                            };
                        } else {
                            // it's an object with id, name, parentId
                            return {
                                subCategory: {
                                    connectOrCreate: {
                                        where: { id: subCategory.id },
                                        create: {
                                            id: subCategory.id,
                                            name: subCategory.name,
                                            parentId: subCategory.parentId || null,
                                        },
                                    },
                                },
                            };
                        }
                    }),
                }
                : undefined,


            // ===== Variants =====
            variants: data.variants
                ? {
                    create: data.variants.map((variant) => ({
                        color: variant.color,
                        size: variant.size,
                        quantity: variant.quantity ?? 0,
                    })),
                }
                : undefined,

            // ===== Images =====
            images: data.images
                ? {
                    create: data.images.map((url) => ({
                        url,
                    })),
                }
                : undefined,

            // ===== Tags =====
            tags: data.tags
                ? {
                    connectOrCreate: data.tags.map((tagName) => ({
                        where: { name: tagName },
                        create: { name: tagName },
                    })),
                }
                : undefined,

            // ===== Additional Info =====
            additionalInformation: data.additionalInformation
                ? {
                    create: data.additionalInformation.map((info) => ({
                        label: info.label,
                        value: info.value,
                    })),
                }
                : undefined,
        },
        include: {
            categories: true,
            subCategories: true,
            variants: true,
            images: true,
            additionalInformation: true,
            tags: true,
        }
    });
};

const getProducts = async () => {
    return prisma.product.findMany({
        include: {
            categories: true,
            subCategories: true,
            variants: true,
            images: true,
            additionalInformation: true,
            tags: true,
        }
    })
}

const deleteProduct = async (productId: string) => {
    // 1. Delete related categories
    await prisma.productCategory.deleteMany({ where: { productId } });

    // 2. Delete related subcategories
    await prisma.productSubCategory.deleteMany({ where: { productId } });

    // 3. Delete variants
    await prisma.variant.deleteMany({ where: { productId } });

    // 4. Delete product images
    await prisma.productImage.deleteMany({ where: { productId } });

    // 5. Delete additional info
    await prisma.additionalInfo.deleteMany({ where: { productId } });

    // 6. Disconnect product from tags
    await prisma.product.update({
        where: { id: productId },
        data: {
            tags: {
                set: [], // remove all tag associations for this product
            },
        },
    });

    // 7. Delete the product itself
    return prisma.product.delete({
        where: { id: productId },
    });
};

export const ProductService = {
    createProduct,
    getProducts,
    deleteProduct
}
