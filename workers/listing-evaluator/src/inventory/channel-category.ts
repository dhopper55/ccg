// Which CCG category a sales channel (Reverb, Gear Exchange) should map from. In the admin form,
// "Category" is the top level (Guitar, Effects Pedals) and "Secondary Category" is its
// subcategory (Electric Guitars, Fuzz), so the subcategory is the specific one when it's set.
export function channelCategoryFor(record: Record<string, unknown>): { ccgCategoryId: number | null; path: string } {
  const subcategoryId = Number(record.secondaryCategoryId);
  const subcategoryPath = String(record.secondaryCategoryPath || '').trim();
  if (Number.isFinite(subcategoryId) && subcategoryId > 0 && subcategoryPath) {
    return { ccgCategoryId: subcategoryId, path: subcategoryPath };
  }
  const categoryId = Number(record.categoryId);
  return {
    ccgCategoryId: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null,
    path: String(record.categoryPath || record.categoryName || '').trim(),
  };
}
