/**
 * Squarified Treemap layout algorithm
 * Based on Mark Bruls, Kees Huizing, and Jarke J. van Wijk (Squarified Treemaps)
 * Generates optimal aspect ratios (closest to 1:1 squares) for visual hierarchy.
 */

export interface TreemapInputItem<T = any> {
  id: string
  value: number // Used for rectangle sizing (must be >= 0)
  data: T
}

export interface TreemapLayoutRect<T = any> {
  id: string
  x: number
  y: number
  width: number
  height: number
  value: number
  percent: number // % of total treemap
  data: T
}

interface InternalNode<T> {
  item: TreemapInputItem<T>
  area: number
}

function worstAspect(row: InternalNode<any>[], side: number): number {
  const sumArea = row.reduce((acc, curr) => acc + curr.area, 0)
  if (sumArea === 0 || side === 0) return Infinity
  let maxAspect = 0
  for (const node of row) {
    const r = (side * side * node.area) / (sumArea * sumArea)
    const aspect = Math.max(r, 1 / r)
    if (aspect > maxAspect) maxAspect = aspect
  }
  return maxAspect
}

export function computeSquarifiedTreemap<T = any>(
  items: TreemapInputItem<T>[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapLayoutRect<T>[] {
  if (!items || items.length === 0 || width <= 0 || height <= 0) return []

  // Filter and sort items descending by value
  const validItems = items
    .filter((it) => typeof it.value === 'number' && it.value > 0)
    .sort((a, b) => b.value - a.value)

  if (validItems.length === 0) return []

  const totalValue = validItems.reduce((acc, it) => acc + it.value, 0)
  if (totalValue <= 0) return []

  const totalArea = width * height
  const nodes: InternalNode<T>[] = validItems.map((item) => ({
    item,
    area: (item.value / totalValue) * totalArea,
  }))

  const results: TreemapLayoutRect<T>[] = []

  let curX = x
  let curY = y
  let curW = width
  let curH = height
  let currentRow: InternalNode<T>[] = []

  function layoutRow(row: InternalNode<T>[], rx: number, ry: number, rw: number, rh: number, isVertical: boolean) {
    const sumArea = row.reduce((acc, n) => acc + n.area, 0)
    if (sumArea === 0) return { rx, ry, rw, rh }
    let offset = 0

    if (isVertical) {
      const rowWidth = sumArea / rh
      for (const node of row) {
        const itemHeight = node.area / rowWidth
        results.push({
          id: node.item.id,
          x: rx,
          y: ry + offset,
          width: rowWidth,
          height: itemHeight,
          value: node.item.value,
          percent: (node.item.value / totalValue) * 100,
          data: node.item.data,
        })
        offset += itemHeight
      }
      return { rx: rx + rowWidth, ry, rw: Math.max(0, rw - rowWidth), rh }
    } else {
      const rowHeight = sumArea / rw
      for (const node of row) {
        const itemWidth = node.area / rowHeight
        results.push({
          id: node.item.id,
          x: rx + offset,
          y: ry,
          width: itemWidth,
          height: rowHeight,
          value: node.item.value,
          percent: (node.item.value / totalValue) * 100,
          data: node.item.data,
        })
        offset += itemWidth
      }
      return { rx, ry: ry + rowHeight, rw, rh: Math.max(0, rh - rowHeight) }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const side = Math.min(curW, curH)
    const isVertical = curW >= curH

    if (currentRow.length === 0) {
      currentRow.push(node)
    } else {
      const currentWorst = worstAspect(currentRow, side)
      const nextWorst = worstAspect([...currentRow, node], side)

      if (nextWorst <= currentWorst) {
        currentRow.push(node)
      } else {
        const nextRect = layoutRow(currentRow, curX, curY, curW, curH, isVertical)
        curX = nextRect.rx
        curY = nextRect.ry
        curW = nextRect.rw
        curH = nextRect.rh
        currentRow = [node]
      }
    }
  }

  if (currentRow.length > 0) {
    layoutRow(currentRow, curX, curY, curW, curH, curW >= curH)
  }

  return results
}
