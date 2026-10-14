// Admin Component: Pricing Configuration Editor
// Used in product creation/editing forms

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { SizeOption, MaterialOption, ColorOption } from '@/types/pricing';

interface PricingConfigEditorProps {
  sizes: SizeOption[];
  materials: MaterialOption[];
  colors: ColorOption[];
  onSizesChange: (sizes: SizeOption[]) => void;
  onMaterialsChange: (materials: MaterialOption[]) => void;
  onColorsChange: (colors: ColorOption[]) => void;
}

export function PricingConfigEditor({
  sizes,
  materials,
  colors,
  onSizesChange,
  onMaterialsChange,
  onColorsChange,
}: PricingConfigEditorProps) {
  return (
    <div className="space-y-8">
      {/* Size Options */}
      <div className="bg-cream rounded-xl border-2 border-ink/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">Size Options</h3>
            <p className="text-sm text-ink/60">Define available sizes with their prices</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onSizesChange([...sizes, { name: '', dimensions: '', price: 0 }])
            }
          >
            + Add Size
          </Button>
        </div>

        <div className="space-y-3">
          {sizes.map((size, index) => (
            <div key={index} className="bg-white rounded-lg border border-ink/10 p-4">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={size.name}
                    onChange={(e) => {
                      const newSizes = [...sizes];
                      newSizes[index].name = e.target.value;
                      onSizesChange(newSizes);
                    }}
                    placeholder="e.g., Small"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={size.dimensions}
                    onChange={(e) => {
                      const newSizes = [...sizes];
                      newSizes[index].dimensions = e.target.value;
                      onSizesChange(newSizes);
                    }}
                    placeholder="e.g., 10x10x10cm"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={size.price || ''}
                    onChange={(e) => {
                      const newSizes = [...sizes];
                      newSizes[index].price = parseFloat(e.target.value) || 0;
                      onSizesChange(newSizes);
                    }}
                    placeholder="299"
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-2 flex gap-1 pt-6">
                  <button
                    onClick={() => {
                      if (index > 0) {
                        const newSizes = [...sizes];
                        [newSizes[index], newSizes[index - 1]] = [
                          newSizes[index - 1],
                          newSizes[index],
                        ];
                        onSizesChange(newSizes);
                      }
                    }}
                    disabled={index === 0}
                    className="px-2 py-1 text-ink/60 hover:text-ink disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => {
                      if (index < sizes.length - 1) {
                        const newSizes = [...sizes];
                        [newSizes[index], newSizes[index + 1]] = [
                          newSizes[index + 1],
                          newSizes[index],
                        ];
                        onSizesChange(newSizes);
                      }
                    }}
                    disabled={index === sizes.length - 1}
                    className="px-2 py-1 text-ink/60 hover:text-ink disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onSizesChange(sizes.filter((_, i) => i !== index))}
                    className="px-2 py-1 text-red-600 hover:text-red-700"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sizes.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-4">
              No sizes configured. Add at least one size option.
            </p>
          )}
        </div>
      </div>

      {/* Material Options */}
      <div className="bg-cream rounded-xl border-2 border-ink/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">Material Options</h3>
            <p className="text-sm text-ink/60">
              Materials add to the base or size price
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onMaterialsChange([...materials, { name: '', priceAdjustment: 0 }])
            }
          >
            + Add Material
          </Button>
        </div>

        <div className="space-y-3">
          {materials.map((material, index) => (
            <div key={index} className="bg-white rounded-lg border border-ink/10 p-4">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-6">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Material Name
                  </label>
                  <input
                    type="text"
                    value={material.name}
                    onChange={(e) => {
                      const newMaterials = [...materials];
                      newMaterials[index].name = e.target.value;
                      onMaterialsChange(newMaterials);
                    }}
                    placeholder="e.g., PLA, PETG, TPU"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Price Adjustment (₹)
                  </label>
                  <input
                    type="number"
                    value={material.priceAdjustment || ''}
                    onChange={(e) => {
                      const newMaterials = [...materials];
                      newMaterials[index].priceAdjustment =
                        parseFloat(e.target.value) || 0;
                      onMaterialsChange(newMaterials);
                    }}
                    placeholder="0 or +50"
                    step="1"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-2 flex gap-1 pt-6">
                  <button
                    onClick={() =>
                      onMaterialsChange(materials.filter((_, i) => i !== index))
                    }
                    className="px-2 py-1 text-red-600 hover:text-red-700"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {materials.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-4">
              No materials configured. Materials are optional.
            </p>
          )}
        </div>
      </div>

      {/* Color Options */}
      <div className="bg-cream rounded-xl border-2 border-ink/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">Color Options</h3>
            <p className="text-sm text-ink/60">
              Colors add an additional charge to the final price
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onColorsChange([...colors, { name: '', additionalCharge: 0 }])
            }
          >
            + Add Color
          </Button>
        </div>

        <div className="space-y-3">
          {colors.map((color, index) => (
            <div key={index} className="bg-white rounded-lg border border-ink/10 p-4">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-6">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Color Name
                  </label>
                  <input
                    type="text"
                    value={color.name}
                    onChange={(e) => {
                      const newColors = [...colors];
                      newColors[index].name = e.target.value;
                      onColorsChange(newColors);
                    }}
                    placeholder="e.g., Black, White, Custom"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Additional Charge (₹)
                  </label>
                  <input
                    type="number"
                    value={color.additionalCharge || ''}
                    onChange={(e) => {
                      const newColors = [...colors];
                      newColors[index].additionalCharge =
                        parseFloat(e.target.value) || 0;
                      onColorsChange(newColors);
                    }}
                    placeholder="0 or +30"
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-ink/20 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-2 flex gap-1 pt-6">
                  <button
                    onClick={() => onColorsChange(colors.filter((_, i) => i !== index))}
                    className="px-2 py-1 text-red-600 hover:text-red-700"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {colors.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-4">
              No colors configured. Colors are optional.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
