import { ApiError, createGeocoder, reason } from './client';
import { csvRows, pasteRows, validateRow, type ImportRow } from './imports';
import { markerSchema, MAX_CSV_BYTES, type GeocodeResult, type Marker, type PublicConfig } from './schema';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`mm-${id}`) as T;
const fields = {
  title: 'Title', address: 'Address', description: 'Description', latitude: 'Latitude', longitude: 'Longitude', color: 'Color',
} as const;

interface PendingRow {
  input: ImportRow;
  number: number;
  issue?: string;
  results?: GeocodeResult[];
  selection?: GeocodeResult;
  done?: boolean;
}

export function setupImport(geocoder: ReturnType<typeof createGeocoder>, config: PublicConfig, capacity: () => number, add: (markers: Marker[]) => boolean) {
  const dialog = get<HTMLDialogElement>('import-dialog');
  const form = get<HTMLFormElement>('import-form');
  const list = get('import-rows');
  const status = get('import-status');
  const preview = get<HTMLButtonElement>('preview-import');
  const run = get<HTMLButtonElement>('run-import');
  const close = get<HTMLButtonElement>('close-import');
  const file = get<HTMLInputElement>('csv-file');
  const lines = get<HTMLTextAreaElement>('lines');
  let mode: 'paste' | 'csv';
  let rows: PendingRow[] = [];
  let busy = false;

  function open(kind: typeof mode) {
    mode = kind;
    rows = [];
    form.reset();
    status.textContent = `This map has room for ${capacity()} more locations.${config.geocodeBulk ? '' : ' Bulk address lookup is unavailable. Coordinates can still be added.'}`;
    get('import-heading').textContent = kind === 'csv' ? 'Import locations from CSV' : 'Add Multiple Locations';
    get('csv-fields').hidden = kind !== 'csv';
    get('paste-fields').hidden = kind !== 'paste';
    render();
    dialog.showModal();
  }

  function render() {
    list.replaceChildren();
    for (const row of rows) {
      if (row.done) continue;
      const item = document.createElement('li');
      const summary = document.createElement('strong');
      summary.textContent = `${row.number}. ${row.input.title || row.input.address || 'Location'}`;
      const details = document.createElement('p');
      details.textContent = row.issue || (row.input.latitude && row.input.longitude
        ? `Coordinates ${row.input.latitude}, ${row.input.longitude}` : 'Address lookup');
      item.append(summary, details);
      if (row.results?.length) {
        const label = document.createElement('label');
        label.textContent = 'Choose the correct result';
        const select = document.createElement('select');
        select.className = 'input';
        select.add(new Option('Select a location', ''));
        row.results.forEach((result, index) => select.add(new Option(result.address, String(index))));
        select.value = row.selection ? String(row.results.indexOf(row.selection)) : '';
        select.disabled = busy;
        select.addEventListener('change', () => { row.selection = select.value === '' ? undefined : row.results?.[Number(select.value)]; });
        label.append(select);
        item.append(label);
      }
      const editor = document.createElement('details');
      const toggle = document.createElement('summary');
      toggle.textContent = 'Edit this row';
      editor.append(toggle);
      const inputs = document.createElement('div');
      inputs.className = 'mm-fields';
      for (const key of Object.keys(fields) as (keyof ImportRow)[]) {
        const label = document.createElement('label');
        label.textContent = fields[key];
        const input = document.createElement('input');
        input.className = 'input';
        input.maxLength = key === 'description' ? 1000 : key === 'address' ? 300 : 120;
        if (key === 'color') input.placeholder = 'green or #2a9d8f';
        input.value = row.input[key];
        input.disabled = busy;
        input.addEventListener('input', () => {
          row.input[key] = input.value.trim();
          if (key === 'address') {
            row.results = undefined;
            row.selection = undefined;
            item.querySelector('select:not(details select)')?.closest('label')?.remove();
          }
        });
        label.append(input);
        inputs.append(label);
      }
      editor.append(inputs);
      item.append(editor);
      list.append(item);
    }
    run.hidden = !rows.some((row) => !row.done);
    run.textContent = rows.some((row) => row.done || row.issue) ? 'Add or Retry Remaining Locations' : 'Add Locations';
  }

  get('bulk').addEventListener('click', () => open('paste'));
  get('csv').addEventListener('click', () => open('csv'));
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });

  function setBusy(value: boolean) {
    busy = value;
    for (const element of [preview, run, close, file, lines]) element.disabled = value;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      let values: ImportRow[];
      if (mode === 'csv') {
        const input = file.files?.[0];
        if (!input || input.size > MAX_CSV_BYTES) throw new Error('Choose a CSV file up to 128 KB.');
        values = await csvRows(await input.text());
      } else values = pasteRows(lines.value);
      const remaining = capacity();
      if (!values.length) throw new Error('Enter at least one location.');
      if (values.length > remaining) throw new Error(`This map has room for ${remaining} more locations. Reduce the number of rows and preview again.`);
      rows = values.map((input, index) => ({ input, number: index + 1, issue: validateRow(input).issue }));
      status.textContent = `${values.length} ${values.length === 1 ? 'location' : 'locations'} ready to review. Check the rows before adding them.`;
    } catch (error) {
      rows = [];
      status.textContent = error instanceof Error ? error.message : 'The locations could not be read.';
    } finally { setBusy(false); render(); }
  });

  run.addEventListener('click', async () => {
    if (busy) return;
    const remaining = rows.filter((row) => !row.done);
    if (remaining.length > capacity()) {
      status.textContent = `There is room for ${capacity()} more locations. Edit the source and preview fewer rows.`;
      return;
    }
    setBusy(true);
    render();
    let processed = 0;
    let nextAddressAt = 0;
    let lookupIssue = config.geocodeBulk ? '' : 'Bulk address lookup is unavailable. Enter latitude and longitude for this row.';
    const resolved: Array<{ row: PendingRow; marker: Marker }> = [];
    const needsLookup = remaining.some((row) => {
      const validation = validateRow(row.input);
      return !row.results && !validation.marker && !validation.issue;
    });
    try {
      if (needsLookup && !lookupIssue) {
        try { await geocoder.unlock(); }
        catch (error) { lookupIssue = reason(error, 'Location verification could not start.'); }
      }
      for (const row of remaining) {
        status.textContent = `Checking location ${++processed} of ${remaining.length}…`;
        const validation = validateRow(row.input);
        row.issue = validation.issue;
        if (validation.issue) continue;
        if (validation.marker) { resolved.push({ row, marker: validation.marker }); continue; }
        let picked = row.selection;
        if (!picked && row.results) { row.issue = 'Choose the correct result or edit the address.'; continue; }
        if (!picked && lookupIssue) { row.issue = lookupIssue; continue; }
        if (!picked) {
          try {
            const wait = nextAddressAt - Date.now();
            if (wait > 0) await new Promise<void>((done) => window.setTimeout(done, wait));
            nextAddressAt = Date.now() + 1100;
            const results = await geocoder.search(row.input.address, 'bulk');
            if (!results.length) { row.issue = 'No match found. Correct the address or enter coordinates.'; continue; }
            if (results.length > 1) { row.results = results; row.issue = 'Choose the correct result or edit the address.'; continue; }
            picked = results[0];
          } catch (error) {
            row.issue = reason(error, 'Search failed. Try this address again.');
            if (error instanceof ApiError && [403, 429, 503].includes(error.status)) lookupIssue = row.issue;
            continue;
          }
        }
        const result = markerSchema.safeParse({ ...row.input, ...picked, title: row.input.title || picked.title });
        if (result.success) resolved.push({ row, marker: result.data });
        else row.issue = 'Check the row details and try again.';
      }
      if (resolved.length && add(resolved.map(({ marker }) => marker))) {
        for (const { row } of resolved) row.done = true;
      }
      const pending = rows.filter((row) => !row.done).length;
      const added = remaining.length - pending;
      status.textContent = `${added} added. ${pending ? `${pending} still need attention. Review them and try again.` : 'All locations are on the map.'}`;
    } finally { setBusy(false); render(); }
  });
}
