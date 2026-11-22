"use client";

import ProductEditor from "@/components/modules/productEditor/ProductEditor";

type Props = {
    // The product exactly as GET /product/slug/:slug returns it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product: any;
    slug: string;
};

const ProductUpdateClient = ({ product, slug }: Props) => (
    <ProductEditor mode="update" product={product} slug={slug} />
);

export default ProductUpdateClient;
