export interface PageRangeValidation {
  error: string | null;
  normalized: string;
  pageCount: number;
}

interface PageInterval {
  start: number;
  end: number;
}

export function validatePageRange(
  input: string,
  totalPages: number,
): PageRangeValidation {
  const normalizedInput = input
    .trim()
    .replace(/\s*([,-])\s*/g, "$1");
  if (!normalizedInput) {
    return { error: null, normalized: "", pageCount: totalPages };
  }
  if (
    /\s/.test(normalizedInput) ||
    !/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/.test(normalizedInput)
  ) {
    return {
      error:
        "Use page numbers or ranges separated by commas, such as 1-5,8,11-13.",
      normalized: "",
      pageCount: 0,
    };
  }

  const intervals: PageInterval[] = normalizedInput.split(",").map((part) => {
    const [startText, endText = startText] = part.split("-");
    return { start: Number(startText), end: Number(endText) };
  });
  for (const interval of intervals) {
    if (interval.start < 1 || interval.end < interval.start) {
      return {
        error:
          "Page ranges must start at page 1 and list the lower page first.",
        normalized: "",
        pageCount: 0,
      };
    }
    if (interval.end > totalPages) {
      return {
        error: `This PDF has ${totalPages} page${totalPages === 1 ? "" : "s"}.`,
        normalized: "",
        pageCount: 0,
      };
    }
  }

  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start <= sorted[index - 1].end) {
      return {
        error: "Page ranges cannot overlap or repeat pages.",
        normalized: "",
        pageCount: 0,
      };
    }
  }

  return {
    error: null,
    normalized: intervals
      .map(({ start, end }) => (start === end ? `${start}` : `${start}-${end}`))
      .join(","),
    pageCount: intervals.reduce(
      (count, interval) => count + interval.end - interval.start + 1,
      0,
    ),
  };
}
