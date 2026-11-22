/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, Save } from "lucide-react";

import Spinner from "@/components/shared/Spinner";
import { Toast } from "@/components/shared/Toast/Toast";
import { serverFetch } from "@/lib/server-fetch";
import { hasMeaningfulHtmlContent } from "@/lib/sanitizeHtml";
import { buildSku, DEFAULT_SKU_FORMAT, type SkuFormatConfig } from "@/lib/sku";
import ImageUploadSection from "@/components/modules/addProduct/ImageUploadSection";
import ImageUploadUpdate from "@/components/modules/addProduct/ImageUploadUpdate";
import CategoriesSection from "@/components/modules/addProduct/CategoriesSection";
import type { InfoItem } from "@/components/modules/addProduct/AdditionalInfoSection";

import { BasicInfoSection, NAME_INPUT_ID, type BasicInfo, type FieldErrors } from "./BasicInfoSection";
import { VariantsSection, type UpdateVariants } from "./VariantsSection";
import { PreviewDialog } from "./PreviewDialog";
import { AdditionalInfoCard, TagsCard } from "./ExtraCards";
import {
  clean,
  colourOpt,
  dupInfo,
  enabledOpts,
  hydrateVariantState,
  initialVariantState,
  isNone,
  plural,
  suggestedStatus,
  syncSkus,
  totalStock,
  variantPayload,
  type ProductType,
  type SkuRules,
  type StockStatus,
  type VariantState,
} from "./model";
import { btn, toast } from "./ui";

type CategoryPayload = {
  categories: { categoryId: string }[];
  subCategories: { subCategoryId: string }[];
};

const resolveUrl = (url: unknown): string | null => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

const toPriceString = (n: unknown) => (n == null || n === "" ? "" : String(Number(n)));

const EMPTY_BASIC: BasicInfo = {
  name: "",
  colourName: "",
  regularPrice: "",
  salePrice: "",
  sku: "",
  shortDescription: "",
  fullDescription: "",
  fitAndSizing: "",
  shippingInfo: "",
  singleStock: 0,
  lowStockThreshold: 10,
  stockStatusAuto: true,
  manualStatus: "IN_STOCK",
};

function basicFromProduct(p: any): BasicInfo {
  return {
    name: p.name ?? "",
    colourName: p.colourName ?? "",
    regularPrice: toPriceString(p.regularPrice),
    salePrice: p.salePrice && Number(p.salePrice) > 0 ? toPriceString(p.salePrice) : "",
    sku: p.sku ?? "",
    shortDescription: p.shortDescription ?? "",
    fullDescription: p.fullDescription ?? "",
    fitAndSizing: p.fitAndSizing ?? "",
    shippingInfo: p.shippingInfo ?? "",
    singleStock: Number(p.stockQuantity ?? 0),
    lowStockThreshold: p.lowStockThreshold ?? 10,
    stockStatusAuto: p.stockStatusAuto ?? true,
    manualStatus: p.stockStatus ?? "IN_STOCK",
  };
}

type Props = { mode: "add" } | { mode: "update"; product: any; slug: string };

export default function ProductEditor(props: Props) {
  const isUpdate = props.mode === "update";
  const product = isUpdate ? props.product : null;

  /* ------------------------------------------------------------ state */

  const [basic, setBasic] = useState<BasicInfo>(() => (product ? basicFromProduct(product) : EMPTY_BASIC));
  const [skuFormat, setSkuFormat] = useState<SkuFormatConfig>(DEFAULT_SKU_FORMAT);
  // An existing product's SKU is its own: renaming must not rewrite it.
  const [skuManual, setSkuManual] = useState(isUpdate);

  const rules: SkuRules = useMemo(() => ({ mainSku: basic.sku, separator: skuFormat.separator || "-" }), [basic.sku, skuFormat.separator]);

  const [productType, setProductType] = useState<ProductType>(() =>
    product ? hydrateVariantState(product, { mainSku: product.sku ?? "", separator: "-" }).type : "VARIANTS",
  );
  const [vs, setVs] = useState<VariantState>(() =>
    product ? hydrateVariantState(product, { mainSku: product.sku ?? "", separator: "-" }).state : initialVariantState(),
  );

  const [additionalInfo, setAdditionalInfo] = useState<InfoItem[]>(() => product?.additionalInformation ?? []);
  const [tags, setTags] = useState<string[]>(() =>
    (product?.tags ?? []).map((t: string | { name?: string }) => (typeof t === "string" ? t : t?.name ?? "")).filter(Boolean),
  );
  const [categoryPayload, setCategoryPayload] = useState<CategoryPayload>(() => ({
    categories: product?.categories?.map((c: any) => ({ categoryId: c.categoryId || c.category?.id })) ?? [],
    subCategories: product?.subCategories?.map((s: any) => ({ subCategoryId: s.subCategoryId || s.subCategory?.id })) ?? [],
  }));

  // Images: new files, plus (on update) the saved images being kept.
  const [thumbnailImage, setThumbnailImage] = useState<File | null>(null);
  const [sizeGuideImage, setSizeGuideImage] = useState<File | null>(null);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(() => resolveUrl(product?.thumbnailImage));
  const [sizeGuidePreview, setSizeGuidePreview] = useState<string | null>(() => resolveUrl(product?.sizeGuideImage ?? product?.sizeGuidImage));
  const rawGalleryUrls = useMemo(
    () =>
      ((product?.images ?? []) as any[])
        .map((img) => (typeof img === "string" ? img : img?.url ?? null))
        .filter(Boolean) as string[],
    [product],
  );
  const [galleryPreview, setGalleryPreview] = useState<string[]>(() => rawGalleryUrls.map((u) => resolveUrl(u)).filter(Boolean) as string[]);
  const [keptGallery, setKeptGallery] = useState<string[]>(rawGalleryUrls);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  /* ---------------------------------------------------------- derived */

  const variantsMode = productType === "VARIANTS";
  const total = totalStock(vs, productType, basic.singleStock);
  const suggested = suggestedStatus(total, basic.lowStockThreshold);
  const status: StockStatus = basic.stockStatusAuto ? suggested : basic.manualStatus;

  const colourHint = useMemo(() => {
    if (basic.colourName.trim()) return "Shown under the product name, whichever variant is chosen.";
    const co = colourOpt(vs);
    if (!variantsMode) {
      const v = co && vs.singleAttrs[co.id];
      return v && !isNone(v)
        ? `Blank: the product page shows the ${co!.name} attribute, “${clean(v)}”.`
        : "Blank: nothing is shown under the product name.";
    }
    const example = co?.values[0];
    return example
      ? `Blank: the product page shows the colour of the selected variant, for example “${example}”.`
      : "Blank: the product page shows the colour of the selected variant.";
  }, [basic.colourName, vs, variantsMode]);

  /* ---------------------------------------------------------- setters */

  const update: UpdateVariants = (next, opts) => {
    const prev = vs;
    setVs(syncSkus(next, rules));
    setErrors((e) => (e.variants ? { ...e, variants: undefined } : e));
    if (opts?.toast) toast(opts.toast, opts.undo ? () => setVs(prev) : undefined);
  };

  const set = <K extends keyof BasicInfo>(field: K, value: BasicInfo[K]) => {
    const next = { ...basic, [field]: value };
    // Renaming keeps a generated main SKU in step, never a hand-typed one.
    if (field === "name" && !skuManual && basic.sku && String(value).trim()) next.sku = buildSku(String(value).trim(), skuFormat);
    setBasic(next);
    // Generated variant SKUs follow the main SKU.
    if (next.sku !== basic.sku) setVs((s) => syncSkus(s, { mainSku: next.sku, separator: rules.separator }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const changeSkuFormat = (f: SkuFormatConfig) => {
    setSkuFormat(f);
    setVs((s) => syncSkus(s, { mainSku: basic.sku, separator: f.separator || "-" }));
  };

  /* ---------------------------------------------------------- payload */

  const buildPayload = () => {
    const sale = basic.salePrice === "" ? null : Number(basic.salePrice);
    return {
      name: basic.name.trim(),
      colourName: basic.colourName.trim(),
      sku: basic.sku.trim(),
      regularPrice: Number(basic.regularPrice || 0),
      salePrice: sale,
      stockQuantity: total,
      stockStatus: status,
      stockStatusAuto: basic.stockStatusAuto,
      lowStockThreshold: basic.lowStockThreshold,
      shortDescription: basic.shortDescription.trim(),
      fullDescription: basic.fullDescription,
      fitAndSizing: basic.fitAndSizing,
      shippingInfo: basic.shippingInfo,
      ...variantPayload(vs, productType),
      categories: categoryPayload.categories.map((c) => c.categoryId),
      subCategories: categoryPayload.subCategories.map((s) => s.subCategoryId),
      tags,
      additionalInformation: additionalInfo
        .filter((i) => i.label.trim() && i.value.trim())
        .map((i) => ({ label: i.label.trim(), value: i.value.trim() })),
    };
  };

  /* ------------------------------------------------------- validation */

  const validate = () => {
    const e: FieldErrors = {};
    if (!basic.name.trim()) e.name = "Enter a product name.";
    if (!(Number(basic.regularPrice) > 0)) e.regularPrice = "Enter a regular price above 0.";
    if (basic.salePrice !== "" && Number(basic.salePrice) >= Number(basic.regularPrice)) e.salePrice = "Sale price must be lower than the regular price.";
    if (!basic.sku.trim()) e.sku = "Generate or enter a main SKU.";
    if (!basic.shortDescription.trim()) e.shortDescription = "Enter a short description.";
    if (!hasMeaningfulHtmlContent(basic.fullDescription)) e.fullDescription = "Write a product description.";

    if (variantsMode) {
      const d = dupInfo(vs);
      if (!enabledOpts(vs).length) e.variants = "Turn on at least one option, or switch to Single product.";
      else if (!vs.variants.length) e.variants = "Add at least one variant, or switch to Single product.";
      else if (d.comboRows) e.variants = `${plural(d.comboRows, "variant")} share a combination. Fix them before saving.`;
      else if (d.skuRows) e.variants = `${plural(d.skuRows, "variant")} share a SKU. Fix them before saving.`;
      else if (vs.variants.some((v) => !clean(v.sku))) e.variants = "Every variant needs a SKU.";
    }

    const hasThumb = !!thumbnailImage || (isUpdate && !!thumbnailPreview);
    const hasGallery = galleryImages.length > 0 || (isUpdate && galleryPreview.length > 0);
    if (!hasThumb) e.images = "Upload a thumbnail image.";
    else if (!hasGallery) e.images = "Upload at least one gallery image.";
    if (!categoryPayload.categories.length) e.categories = "Select at least one category.";
    else if (!categoryPayload.subCategories.length) e.categories = "Select at least one sub category.";

    setErrors(e);
    const messages = Object.values(e).filter(Boolean) as string[];
    if (messages.length) {
      Toast.fire({ icon: "error", title: messages.length === 1 ? messages[0] : `Fix ${messages.length} things before saving: ${messages[0]}` });
      window.setTimeout(() => {
        const first = document.querySelector('[aria-invalid="true"], [role="alert"]');
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (e.name) document.getElementById(NAME_INPUT_ID)?.focus();
      }, 0);
      return false;
    }
    return true;
  };

  /* ------------------------------------------------------------- save */

  const resetAdd = () => {
    setBasic(EMPTY_BASIC);
    setSkuManual(false);
    setProductType("VARIANTS");
    setVs(initialVariantState());
    setAdditionalInfo([]);
    setTags([]);
    setThumbnailImage(null);
    setSizeGuideImage(null);
    setGalleryImages([]);
    setCategoryPayload({ categories: [], subCategories: [] });
    setErrors({});
    // Remounts sections that keep their own state (categories, rich text).
    setFormKey((k) => k + 1);
  };

  const handleSave = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    setSavingMessage(isUpdate ? "Updating…" : "Saving…");
    try {
      const payload: Record<string, any> = buildPayload();

      if (isUpdate) {
        payload.existingGalleryImages = keptGallery;
        if (product?.thumbnailImage) payload.existingThumbnail = product.thumbnailImage;
        const originalSizeGuide = product?.sizeGuideImage || product?.sizeGuidImage;
        if (originalSizeGuide) payload.existingSizeGuide = originalSizeGuide;
        if (!thumbnailImage && !thumbnailPreview && product?.thumbnailImage) payload.removeThumbnail = true;
        if (!sizeGuideImage && !sizeGuidePreview && originalSizeGuide) payload.removeSizeGuide = true;
      }

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      if (thumbnailImage) formData.append("thumbnailImage", thumbnailImage);
      if (sizeGuideImage) formData.append("sizeGuidImage", sizeGuideImage);
      galleryImages.forEach((img) => formData.append("file", img));

      const files = (thumbnailImage ? 1 : 0) + (sizeGuideImage ? 1 : 0) + galleryImages.length;
      if (files) setSavingMessage(`Processing ${plural(files, "image")}…`);

      const res = isUpdate
        ? await serverFetch.patch(`/api/v1/product/${props.slug}`, { credentials: "include", body: formData })
        : await serverFetch.post("/api/v1/product/create", { credentials: "include", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Save failed");

      if (isUpdate) {
        // New variants now have database ids; load them so the next save keeps them.
        const saved = data?.data;
        if (saved?.variants) {
          const h = hydrateVariantState(saved, rules);
          setVs(h.state);
          setProductType(h.type);
        }
        setThumbnailImage(null);
        setSizeGuideImage(null);
        setGalleryImages([]);
        Toast.fire({ icon: "success", title: "Product updated." });
      } else {
        Toast.fire({ icon: "success", title: "Product saved." });
        resetAdd();
      }
    } catch (err: any) {
      console.error(err);
      Toast.fire({ icon: "error", title: err?.message ? `Couldn't save: ${err.message}` : "Couldn't save the product." });
    } finally {
      setSaving(false);
      setSavingMessage("");
    }
  };

  /* ---------------------------------------------------------- preview */

  const previewImage = useMemo(() => {
    if (thumbnailImage) return URL.createObjectURL(thumbnailImage);
    return thumbnailPreview;
  }, [thumbnailImage, thumbnailPreview]);
  useEffect(() => () => {
    if (previewImage?.startsWith("blob:")) URL.revokeObjectURL(previewImage);
  }, [previewImage]);

  // Ctrl/Cmd+S saves from anywhere on the page.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = isUpdate ? "Update Product" : "Add Product";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Link href="/admin/all-product" className="hover:text-foreground">
                Products
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{title}</span>
            </nav>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-[13px] text-muted-foreground">
              {isUpdate ? "Edit product details, variants, images and other information." : "Add product details, variants, images and other information."}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn.outline} onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button type="button" className={btn.primary} onClick={handleSave} disabled={saving} title="Save (Ctrl+S)">
              {saving ? (
                <>
                  <Spinner />
                  <span className="text-xs">{savingMessage}</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isUpdate ? "Update" : "Save Product"}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main key={formKey} className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <BasicInfoSection
              data={basic}
              set={set}
              errors={errors}
              variantsMode={variantsMode}
              total={total}
              status={status}
              suggested={suggested}
              colourHint={colourHint}
              skuFormat={skuFormat}
              onSkuFormatChange={changeSkuFormat}
              skuManual={skuManual}
              onSkuManualChange={setSkuManual}
            />
            <VariantsSection
              type={productType}
              onTypeChange={(t) => {
                setProductType(t);
                setErrors((e) => ({ ...e, variants: undefined }));
              }}
              state={vs}
              update={update}
              rules={rules}
              error={errors.variants}
              singleStock={basic.singleStock}
              onSingleStockChange={(n) => set("singleStock", n)}
            />
            <AdditionalInfoCard items={additionalInfo} onChange={setAdditionalInfo} />
          </div>

          <aside className="min-w-0 space-y-6">
            {errors.images && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {errors.images}
              </p>
            )}
            {isUpdate ? (
              <ImageUploadUpdate
                thumbnailImage={thumbnailImage}
                setThumbnailImage={setThumbnailImage}
                sizeGuideImage={sizeGuideImage}
                setSizeGuideImage={setSizeGuideImage}
                galleryImages={galleryImages}
                setGalleryImages={setGalleryImages}
                thumbnailPreview={thumbnailPreview}
                setThumbnailPreview={setThumbnailPreview}
                sizeGuidePreview={sizeGuidePreview}
                setSizeGuidePreview={setSizeGuidePreview}
                galleryPreview={galleryPreview}
                setGalleryPreview={setGalleryPreview}
                originalGalleryUrls={keptGallery}
                onGalleryPreviewChange={setKeptGallery}
              />
            ) : (
              <ImageUploadSection
                sizeGuideImage={sizeGuideImage}
                setSizeGuideImage={setSizeGuideImage}
                thumbnailImage={thumbnailImage}
                setThumbnailImage={(v) => {
                  setThumbnailImage(v);
                  setErrors((e) => ({ ...e, images: undefined }));
                }}
                galleryImages={galleryImages}
                setGalleryImages={(v) => {
                  setGalleryImages(v);
                  setErrors((e) => ({ ...e, images: undefined }));
                }}
              />
            )}
            {errors.categories && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {errors.categories}
              </p>
            )}
            <CategoriesSection
              onChange={(p) => {
                setCategoryPayload(p);
                setErrors((e) => (e.categories ? { ...e, categories: undefined } : e));
              }}
              defaultCategories={product?.categories?.map((c: any) => c.categoryId || c.category?.id) ?? []}
              defaultSubcategories={product?.subCategories?.map((s: any) => s.subCategoryId || s.subCategory?.id) ?? []}
            />
            <TagsCard tags={tags} onChange={setTags} />
          </aside>
        </div>
      </main>

      {previewOpen && (
        <PreviewDialog
          name={basic.name}
          colourName={basic.colourName}
          regularPrice={Number(basic.regularPrice || 0)}
          salePrice={basic.salePrice === "" ? null : Number(basic.salePrice)}
          mainSku={basic.sku}
          type={productType}
          state={vs}
          status={status}
          total={total}
          image={previewImage}
          payload={buildPayload()}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
