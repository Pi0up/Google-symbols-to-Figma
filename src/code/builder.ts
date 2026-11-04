import { IconBatchItem, SvgVariantData, StyleKey } from '../types';

export class LibraryBuilder {
  private categoryFrames = new Map<string, FrameNode>();
  private nextCategoryX = 0;
  private targetColorVariable: Variable | null = null;
  private targetPaintStyle: PaintStyle | null = null;

  constructor(targetColorVariable?: Variable | null, targetPaintStyle?: PaintStyle | null) {
    this.targetColorVariable = targetColorVariable || null;
    this.targetPaintStyle = targetPaintStyle || null;
    this.discoverExistingCategories();
  }

  private discoverExistingCategories() {
    // 1. Discover existing FrameNode categories on the page
    const frames = figma.currentPage.children.filter(
      (node) => node.type === 'FRAME' && !node.name.startsWith('[')
    ) as FrameNode[];

    for (const frame of frames) {
      this.categoryFrames.set(frame.name, frame);
      const right = frame.x + frame.width;
      if (right > this.nextCategoryX) {
        this.nextCategoryX = right + 120; // 120px gap between category frames
      }
    }

    // 2. Discover any existing legacy SectionNodes to align X
    const sections = figma.currentPage.children.filter(
      (node) => node.type === 'SECTION'
    ) as SectionNode[];

    for (const sec of sections) {
      const right = sec.x + sec.width;
      if (right > this.nextCategoryX) {
        this.nextCategoryX = right + 120;
      }
    }
  }

  private setupCategoryFrameLayout(frame: FrameNode, compSetWidth = 60) {
    const GAP_X = 16;
    const GAP_Y = 16;
    const PAD_X = 24;
    const PAD_Y = 24;
    const COLS = 8;
    const FRAME_WIDTH = PAD_X * 2 + (COLS * compSetWidth) + ((COLS - 1) * GAP_X);

    frame.resize(FRAME_WIDTH, 300);

    // Auto Layout with WRAP: automatically handles 8 columns and dynamic rows
    frame.layoutMode = 'HORIZONTAL';
    frame.layoutWrap = 'WRAP';
    frame.itemSpacing = GAP_X;
    frame.counterAxisSpacing = GAP_Y;
    frame.paddingLeft = PAD_X;
    frame.paddingRight = PAD_X;
    frame.paddingTop = PAD_Y;
    frame.paddingBottom = PAD_Y;

    // Fixed width (8 columns) and Hug height (variable rows)
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'AUTO';

    // Modern frame styling
    frame.cornerRadius = 16;
    frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.99 } }];
    frame.strokes = [{ type: 'SOLID', color: { r: 0.90, g: 0.91, b: 0.93 } }];
    frame.strokeWeight = 1;
  }

  private ensureCategoryFrameWidth(frame: FrameNode, itemWidth: number) {
    const GAP_X = 16;
    const PAD_X = 24;
    const COLS = 8;
    const targetWidth = PAD_X * 2 + (COLS * itemWidth) + ((COLS - 1) * GAP_X);

    if (Math.abs(frame.width - targetWidth) > 1) {
      frame.resize(targetWidth, frame.height);
      if (frame.x + targetWidth + 120 > this.nextCategoryX) {
        this.nextCategoryX = frame.x + targetWidth + 120;
      }
    }
  }

  private applyAutoLayoutToComponentSet(compSet: ComponentSetNode) {
    try {
      // Horizontal side-by-side with 4px gap so variants never overlap
      compSet.layoutMode = 'HORIZONTAL';
      compSet.itemSpacing = 4;
      compSet.paddingLeft = 4;
      compSet.paddingRight = 4;
      compSet.paddingTop = 4;
      compSet.paddingBottom = 4;
      compSet.primaryAxisSizingMode = 'AUTO';
      compSet.counterAxisSizingMode = 'AUTO';
      compSet.primaryAxisAlignItems = 'CENTER';
      compSet.counterAxisAlignItems = 'CENTER';
    } catch (e) {
      console.warn('Failed to apply auto-layout to ComponentSet:', e);
    }
  }

  private getOrCreateCategoryFrame(category: string): FrameNode {
    let frame = this.categoryFrames.get(category);
    if (!frame || frame.removed) {
      // Check if there is an existing legacy SectionNode to migrate
      const legacySection = figma.currentPage.children.find(
        (c) => c.type === 'SECTION' && c.name === category
      ) as SectionNode | undefined;

      frame = figma.createFrame();
      frame.name = category;
      this.setupCategoryFrameLayout(frame);

      if (legacySection) {
        // Place where the section was
        frame.x = legacySection.x;
        frame.y = legacySection.y;

        // Migrate children from legacy section into new auto-layout frame
        const children = [...legacySection.children];
        for (const child of children) {
          if ('resize' in child) {
            try {
              (child as SceneNode).resize(140, Math.max(80, (child as SceneNode).height));
            } catch {}
          }
          frame.appendChild(child);
        }
        legacySection.remove();
      } else {
        // Lay out horizontally side-by-side along the X axis
        frame.x = this.nextCategoryX;
        frame.y = 0;
        this.nextCategoryX += frame.width + 120;
      }

      this.categoryFrames.set(category, frame);
    }
    return frame;
  }

  public upsertIcon(item: IconBatchItem): { status: 'created' | 'updated' | 'skipped' } {
    // Check if component set already exists
    const existingSet = this.findExistingComponentSet(item.name);

    if (existingSet) {
      return this.updateComponentSet(existingSet, item);
    } else {
      return this.createComponentSet(item);
    }
  }

  public markAsDeprecated(iconName: string): boolean {
    const existing = this.findExistingComponentSet(iconName);
    if (!existing) return false;

    if (!existing.name.startsWith('[Deprecated]')) {
      existing.name = `[Deprecated] ${existing.name}`;
    }
    existing.setPluginData('is_deprecated', 'true');
    return true;
  }

  private findExistingComponentSet(iconName: string): ComponentSetNode | null {
    const cleanTarget = iconName.toLowerCase().trim();
    const sets = figma.currentPage.findAll(
      (node) => node.type === 'COMPONENT_SET'
    ) as ComponentSetNode[];

    for (const s of sets) {
      const storedName = (s.getPluginData('icon_name') || s.name)
        .replace(/^\[Deprecated\]\s*/i, '')
        .toLowerCase()
        .trim();
      if (storedName === cleanTarget) {
        return s;
      }
    }
    return null;
  }

  private createComponentSet(item: IconBatchItem): { status: 'created' } {
    const frame = this.getOrCreateCategoryFrame(item.category);
    const components: ComponentNode[] = [];

    for (const variant of item.variants) {
      const comp = this.buildVariantComponent(item.name, variant);
      components.push(comp);
    }

    if (components.length === 0) {
      throw new Error(`No variants provided for icon: ${item.name}`);
    }

    // Combine into a ComponentSet directly inside the category Frame
    const compSet = figma.combineAsVariants(components, frame);
    compSet.name = item.name;
    if ('cornerRadius' in compSet) {
      compSet.cornerRadius = 0;
    }
    compSet.description = `Google Material Symbols: ${item.name}\nCategory: ${item.category}`;
    compSet.setPluginData('icon_name', item.name);
    compSet.setPluginData('icon_version', String(item.version));
    compSet.setPluginData('icon_category', item.category);
    compSet.setPluginData('icon_imported_at', String(Date.now()));

    // Apply Auto Layout to the component set: side-by-side with 4px gap
    this.applyAutoLayoutToComponentSet(compSet);

    // Ensure category frame width matches 8 columns
    this.ensureCategoryFrameWidth(frame, compSet.width);

    return { status: 'created' };
  }

  private updateComponentSet(
    compSet: ComponentSetNode,
    item: IconBatchItem
  ): { status: 'updated' | 'skipped' } {
    let hasUpdatedAny = false;

    // Ensure auto layout is applied so variants are side-by-side with 4px gap
    this.applyAutoLayoutToComponentSet(compSet);

    for (const variant of item.variants) {
      const expectedVariantName = this.formatVariantName(variant.style, variant.fill);
      const existingVariant = compSet.children.find(
        (child) => child.name === expectedVariantName && child.type === 'COMPONENT'
      ) as ComponentNode | undefined;

      if (existingVariant) {
        existingVariant.cornerRadius = 0;
        const updated = this.updateVariantVector(existingVariant, variant.svgText);
        if (updated) hasUpdatedAny = true;
      } else {
        // Variant does not exist yet in this set (e.g. style was newly selected)
        const newComp = this.buildVariantComponent(item.name, variant);
        compSet.appendChild(newComp);
        hasUpdatedAny = true;
      }
    }

    compSet.setPluginData('icon_version', String(item.version));
    compSet.setPluginData('icon_category', item.category);
    compSet.setPluginData('icon_imported_at', String(Date.now()));

    return { status: hasUpdatedAny ? 'updated' : 'skipped' };
  }

  private buildVariantComponent(iconName: string, variant: SvgVariantData): ComponentNode {
    const comp = figma.createComponent();
    comp.resize(24, 24);
    comp.cornerRadius = 0;
    comp.fills = [];
    comp.name = this.formatVariantName(variant.style, variant.fill);

    const tempFrame = figma.createNodeFromSvg(variant.svgText);
    this.transferAndScaleSvgChildren(tempFrame, comp);
    tempFrame.remove();

    return comp;
  }

  private updateVariantVector(variantComp: ComponentNode, newSvgText: string): boolean {
    variantComp.cornerRadius = 0;

    const existingVector = variantComp.children.find(
      (c) => c.type === 'VECTOR' || c.type === 'BOOLEAN_OPERATION'
    ) as VectorNode | undefined;

    const tempFrame = figma.createNodeFromSvg(newSvgText);
    const newVector = tempFrame.children.find(
      (c) => c.type === 'VECTOR' || c.type === 'BOOLEAN_OPERATION'
    ) as VectorNode | undefined;

    if (!newVector) {
      tempFrame.remove();
      return false;
    }

    if (existingVector && existingVector.type === 'VECTOR' && newVector.type === 'VECTOR') {
      // Non-destructive vector path update: preserves all existing fills, strokes, effects & overrides!
      try {
        existingVector.vectorNetwork = newVector.vectorNetwork;

        const isSquare = Math.abs(newVector.width - newVector.height) < 0.05;
        let targetW: number;
        let targetH: number;

        if (isSquare) {
          targetW = 20;
          targetH = 20;
        } else {
          const maxDim = Math.max(newVector.width, newVector.height);
          const scale = maxDim > 0 ? 20 / maxDim : 1;
          targetW = newVector.width * scale;
          targetH = newVector.height * scale;
        }

        existingVector.resize(targetW, targetH);
        existingVector.x = (24 - targetW) / 2;
        existingVector.y = (24 - targetH) / 2;

        if (this.targetPaintStyle && 'fillStyleId' in existingVector) {
          try {
            existingVector.fillStyleId = this.targetPaintStyle.id;
          } catch (e) {
            console.warn('Failed to bind paint style on update:', e);
          }
        } else if (this.targetColorVariable && 'variables' in figma && figma.variables.setBoundVariableForPaint && 'fills' in existingVector) {
          try {
            const solidPaint: SolidPaint = { type: 'SOLID', color: { r: 0.11, g: 0.11, b: 0.12 } };
            const boundPaint = figma.variables.setBoundVariableForPaint(
              solidPaint,
              'color',
              this.targetColorVariable
            );
            existingVector.fills = [boundPaint];
          } catch (e) {
            console.warn('Failed to bind color variable on update:', e);
          }
        }

        this.applyScaleConstraints(existingVector);
        tempFrame.remove();
        return true;
      } catch {
        // Fallback: replace vector child while retaining styles
      }
    }

    // Fallback if vectorNetwork assignment fails or types differ:
    const preservedFills = existingVector && 'fills' in existingVector ? existingVector.fills : undefined;
    while (variantComp.children.length > 0) {
      variantComp.children[0].remove();
    }

    this.transferAndScaleSvgChildren(tempFrame, variantComp, preservedFills);
    tempFrame.remove();
    return true;
  }

  private transferAndScaleSvgChildren(
    tempFrame: FrameNode,
    targetComp: ComponentNode,
    preservedFills?: readonly Paint[]
  ) {
    const vectorChildren = [...tempFrame.children];
    if (vectorChildren.length === 0) return;

    // Calculate overall bounding box of all children inside tempFrame
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of vectorChildren) {
      if (child.x < minX) minX = child.x;
      if (child.y < minY) minY = child.y;
      if (child.x + child.width > maxX) maxX = child.x + child.width;
      if (child.y + child.height > maxY) maxY = child.y + child.height;
    }

    const currentW = maxX - minX;
    const currentH = maxY - minY;
    const isSquare = Math.abs(currentW - currentH) < 0.05;

    let targetW: number;
    let targetH: number;
    let scale: number;

    if (isSquare) {
      targetW = 20;
      targetH = 20;
      scale = currentW > 0 ? 20 / currentW : 1;
    } else {
      const maxDim = Math.max(currentW, currentH);
      scale = maxDim > 0 ? 20 / maxDim : 1;
      targetW = currentW * scale;
      targetH = currentH * scale;
    }

    const offsetX = (24 - targetW) / 2;
    const offsetY = (24 - targetH) / 2;

    for (const child of vectorChildren) {
      const origX = child.x;
      const origY = child.y;
      const origW = child.width;
      const origH = child.height;

      targetComp.appendChild(child);

      if (vectorChildren.length === 1 && isSquare) {
        child.resize(20, 20);
        child.x = offsetX;
        child.y = offsetY;
      } else {
        child.resize(Math.max(0.01, origW * scale), Math.max(0.01, origH * scale));
        child.x = offsetX + (origX - minX) * scale;
        child.y = offsetY + (origY - minY) * scale;
      }

      // Apply color variable or paint style if specified, otherwise preserve fills or set default fill
      if (this.targetPaintStyle && 'fillStyleId' in child) {
        try {
          child.fillStyleId = this.targetPaintStyle.id;
        } catch (e) {
          console.warn('Failed to bind paint style to fill:', e);
        }
      } else if (this.targetColorVariable && 'variables' in figma && figma.variables.setBoundVariableForPaint) {
        try {
          const solidPaint: SolidPaint = { type: 'SOLID', color: { r: 0.11, g: 0.11, b: 0.12 } };
          const boundPaint = figma.variables.setBoundVariableForPaint(
            solidPaint,
            'color',
            this.targetColorVariable
          );
          if ('fills' in child) {
            child.fills = [boundPaint];
          }
        } catch (e) {
          console.warn('Failed to bind color variable to fill:', e);
        }
      } else if (preservedFills) {
        if ('fills' in child) {
          child.fills = preservedFills;
        }
      } else if ('fills' in child) {
        const fills = child.fills as readonly Paint[];
        if (!fills || fills.length === 0) {
          child.fills = [{ type: 'SOLID', color: { r: 0.11, g: 0.11, b: 0.12 } }];
        }
      }

      this.applyScaleConstraints(child);
    }
  }

  private applyScaleConstraints(node: BaseNode) {
    if ('constraints' in node) {
      try {
        (node as ConstraintMixin).constraints = {
          horizontal: 'SCALE',
          vertical: 'SCALE',
        };
      } catch {
        // Ignore nodes where constraints cannot be applied
      }
    }
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        this.applyScaleConstraints(child);
      }
    }
  }

  private formatVariantName(style: StyleKey, fill: boolean): string {
    const capStyle = style.charAt(0).toUpperCase() + style.slice(1);
    const fillStr = fill ? 'True' : 'False';
    return `Style=${capStyle}, Fill=${fillStr}`;
  }
}
