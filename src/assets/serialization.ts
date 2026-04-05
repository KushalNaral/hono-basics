import type { AssetSelect } from "./asset.service";

export function serializeSingle(asset: AssetSelect): Record<string, unknown> {
  return {
    ...asset,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function serializeMany(assets: AssetSelect[]): Record<string, unknown>[] {
  return assets.map(serializeSingle);
}
