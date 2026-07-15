export type FreightLineInput = {
  quantity: number;
  description: string;
  weightLbs: number;
  pieces?: string;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
};

function formValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => String(value ?? ""));
}

function parseOptionalFloat(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRequiredWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed);
}

export function parseFreightLinesFromForm(formData: FormData): FreightLineInput[] {
  const quantities = formValues(formData, "lineQuantity");
  const descriptions = formValues(formData, "lineDescription");
  const weights = formValues(formData, "lineWeightLbs");
  const pieces = formValues(formData, "linePieces");
  const lengths = formValues(formData, "lineLengthIn");
  const widths = formValues(formData, "lineWidthIn");
  const heights = formValues(formData, "lineHeightIn");

  const count = Math.max(
    quantities.length,
    descriptions.length,
    weights.length,
    pieces.length,
    lengths.length,
    widths.length,
    heights.length
  );

  const lines: FreightLineInput[] = [];

  for (let index = 0; index < count; index += 1) {
    const description = (descriptions[index] ?? "").trim();
    const weightLbs = parseRequiredWeight(weights[index] ?? "");
    const quantityRaw = parseOptionalFloat(quantities[index] ?? "");
    const quantity = quantityRaw != null && quantityRaw > 0 ? quantityRaw : 1;

    // Skip fully blank draft rows; require description + weight when any content is present.
    const piecesValue = (pieces[index] ?? "").trim();
    const lengthIn = parseOptionalFloat(lengths[index] ?? "");
    const widthIn = parseOptionalFloat(widths[index] ?? "");
    const heightIn = parseOptionalFloat(heights[index] ?? "");
    const hasOptional =
      Boolean(piecesValue) || lengthIn != null || widthIn != null || heightIn != null;

    if (!description && weightLbs == null && !hasOptional && quantityRaw == null) {
      continue;
    }

    if (!description) {
      throw new Error("Each freight line needs a description.");
    }

    if (weightLbs == null) {
      throw new Error("Each freight line needs a weight (lbs).");
    }

    lines.push({
      quantity,
      description,
      weightLbs,
      pieces: piecesValue || undefined,
      lengthIn,
      widthIn,
      heightIn
    });
  }

  if (lines.length === 0) {
    throw new Error("Add at least one freight line with description and weight.");
  }

  return lines;
}

export function rollupCommodity(lines: Pick<FreightLineInput, "description">[]): string {
  return lines.map((line) => line.description).join("; ");
}

export function rollupWeight(lines: Pick<FreightLineInput, "weightLbs">[]): number {
  return lines.reduce((sum, line) => sum + line.weightLbs, 0);
}

export function commodityLinesCreateData(lines: FreightLineInput[]) {
  return lines.map((line, index) => ({
    sequence: index + 1,
    quantity: line.quantity,
    description: line.description,
    weightLbs: line.weightLbs,
    pieces: line.pieces ?? null,
    lengthIn: line.lengthIn ?? null,
    widthIn: line.widthIn ?? null,
    heightIn: line.heightIn ?? null
  }));
}
