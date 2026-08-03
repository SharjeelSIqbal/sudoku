/**
 * Index combinations, used by the subset and fish techniques.
 *
 * Sizes here are always 2-4 over at most 9 items, so the naive recursive walk
 * is both fast enough and far easier to read than a bitmask trick.
 */
export function combinationsOfSize<ItemType>(
  items: readonly ItemType[],
  size: number,
): ItemType[][] {
  const results: ItemType[][] = [];

  if (size <= 0 || size > items.length) {
    return results;
  }

  const current: ItemType[] = [];

  const walk = (startIndex: number): void => {
    if (current.length === size) {
      results.push([...current]);
      return;
    }
    for (let itemIndex = startIndex; itemIndex < items.length; itemIndex += 1) {
      current.push(items[itemIndex]);
      walk(itemIndex + 1);
      current.pop();
    }
  };

  walk(0);
  return results;
}
