/**
 * Minimal RFC 4180 CSV reader: quoted fields, escaped quotes ("") and line breaks inside quotes.
 * Streams lines so multi-hundred-MB files don't need to fit in memory.
 */
export async function* parseCsv(lines: AsyncIterable<string> | Iterable<string>) {
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for await (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    if (inQuotes) {
      // The quoted field continues on the next line.
      field += '\n';
      continue;
    }
    fields.push(field);
    yield fields;
    fields = [];
    field = '';
  }
}

/** Rows as objects keyed by the header row. */
export async function* parseCsvRecords(lines: AsyncIterable<string> | Iterable<string>) {
  let header: string[] | null = null;
  for await (const fields of parseCsv(lines)) {
    if (!header) {
      header = fields.map((name) => name.trim());
      continue;
    }
    if (fields.length === 1 && fields[0] === '') continue;
    yield Object.fromEntries(header.map((name, i) => [name, fields[i] ?? '']));
  }
}
