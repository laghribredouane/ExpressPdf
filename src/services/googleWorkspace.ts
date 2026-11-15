export class WorkspaceAuthError extends Error {
  constructor(message = 'Session Google Workspace expirée ou non autorisée.') {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: { email: string; responseStatus?: string }[];
  status?: string;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
  attendeesEmails?: string[];
}

export interface GmailAttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyPreview: string;
  labelIds: string[];
  attachments: GmailAttachmentMeta[];
}

export interface GmailComposePayload {
  to: string;
  subject: string;
  body: string;
  attachment?: {
    blob: Blob;
    fileName: string;
    mimeType?: string;
  } | null;
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new WorkspaceAuthError();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const apiMsg =
      (parsed as { error?: { message?: string } } | null)?.error?.message ||
      `Erreur API Google (${res.status})`;
    if (res.status === 403 && apiMsg.toLowerCase().includes('insufficient')) {
      throw new WorkspaceAuthError(
        'Permissions Google Workspace insuffisantes. Veuillez vous reconnecter avec Google.'
      );
    }
    throw new Error(apiMsg);
  }

  return parsed as T;
}

// =====================================================================
// GOOGLE CALENDAR API v3
// =====================================================================

export async function listCalendars(
  accessToken: string
): Promise<GoogleCalendarSummary[]> {
  const data = await googleFetch<{ items?: GoogleCalendarSummary[] }>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    accessToken
  );
  return (data.items || []).sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId = 'primary',
  options?: {
    timeMin?: string;
    timeMax?: string;
    q?: string;
    maxResults?: number;
  }
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(options?.maxResults ?? 25),
    timeMin:
      options?.timeMin ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  if (options?.timeMax) params.set('timeMax', options.timeMax);
  if (options?.q?.trim()) params.set('q', options.q.trim());

  const data = await googleFetch<{ items?: GoogleCalendarEvent[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`,
    accessToken
  );
  return data.items || [];
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const body: Record<string, unknown> = {
    summary: input.summary.trim(),
    description: input.description?.trim() || undefined,
    location: input.location?.trim() || undefined,
    start: { dateTime: input.startIso, timeZone },
    end: { dateTime: input.endIso, timeZone },
  };
  if (input.attendeesEmails && input.attendeesEmails.length > 0) {
    body.attendees = input.attendeesEmails
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  return googleFetch<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId || 'primary'
    )}/events`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  input: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const body: Record<string, unknown> = {
    summary: input.summary.trim(),
    description: input.description?.trim() || '',
    location: input.location?.trim() || '',
    start: { dateTime: input.startIso, timeZone },
    end: { dateTime: input.endIso, timeZone },
  };
  if (input.attendeesEmails) {
    body.attendees = input.attendeesEmails
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  return googleFetch<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId || 'primary'
    )}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await googleFetch<void>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId || 'primary'
    )}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

// =====================================================================
// GMAIL API v1
// =====================================================================

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailPart[];
}

interface GmailRawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPart & {
    headers?: { name: string; value: string }[];
  };
}

function decodeBase64UrlToUtf8(data: string): string {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function decodeBase64UrlToUint8Array(data: string): Uint8Array {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBytesToBase64Url(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeBytesToBase64Standard(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  const b64 = btoa(binary);
  return b64.match(/.{1,76}/g)?.join('\r\n') || b64;
}

function encodeMimeHeaderUtf8(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function collectAttachmentsAndText(
  part: GmailPart | undefined,
  attachments: GmailAttachmentMeta[],
  textChunks: string[]
) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body.size || 0,
    });
  }
  if (part.mimeType === 'text/plain' && part.body?.data && textChunks.length === 0) {
    textChunks.push(decodeBase64UrlToUtf8(part.body.data));
  }
  if (part.parts) {
    for (const child of part.parts) {
      collectAttachmentsAndText(child, attachments, textChunks);
    }
  }
}

export async function listGmailMessages(
  accessToken: string,
  q = '',
  maxResults = 15
): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (q.trim()) params.set('q', q.trim());

  const listData = await googleFetch<{ messages?: { id: string; threadId: string }[] }>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    accessToken
  );

  const refs = listData.messages || [];
  if (refs.length === 0) return [];

  const detailed = await Promise.all(
    refs.slice(0, maxResults).map((ref) =>
      googleFetch<GmailRawMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
          ref.id
        )}?format=full`,
        accessToken
      )
    )
  );

  return detailed.map((msg) => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
      '';

    const attachments: GmailAttachmentMeta[] = [];
    const textChunks: string[] = [];
    collectAttachmentsAndText(msg.payload, attachments, textChunks);

    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: getHeader('Subject') || '(Sans objet)',
      from: getHeader('From') || 'Expéditeur inconnu',
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: msg.snippet || '',
      bodyPreview: textChunks[0] || msg.snippet || '',
      labelIds: msg.labelIds || [],
      attachments,
    };
  });
}

export async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  fileName: string,
  mimeType = 'application/pdf'
): Promise<File> {
  const data = await googleFetch<{ data?: string; size?: number }>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId
    )}/attachments/${encodeURIComponent(attachmentId)}`,
    accessToken
  );

  if (!data.data) {
    throw new Error('Pièce jointe vide ou inaccessible.');
  }

  const bytes = decodeBase64UrlToUint8Array(data.data);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], fileName || 'document.pdf', {
    type: mimeType || 'application/pdf',
  });
}

async function buildRawMimeEmail(payload: GmailComposePayload): Promise<string> {
  const safeTo = payload.to.trim();
  const safeSubject = encodeMimeHeaderUtf8(payload.subject.trim() || 'Document PDFExpress');
  const safeBody = payload.body || '';

  if (!payload.attachment) {
    const mime = [
      `To: ${safeTo}`,
      `Subject: ${safeSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      safeBody,
    ].join('\r\n');
    return encodeBytesToBase64Url(new TextEncoder().encode(mime));
  }

  const boundary = `pdfexpress_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const fileBytes = new Uint8Array(await payload.attachment.blob.arrayBuffer());
  const fileBase64 = encodeBytesToBase64Standard(fileBytes);
  const mimeType =
    payload.attachment.mimeType ||
    payload.attachment.blob.type ||
    'application/pdf';
  const safeFilename = payload.attachment.fileName.replace(/["\r\n]/g, '_');

  const parts = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    safeBody,
    '',
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${safeFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    '',
    fileBase64,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return encodeBytesToBase64Url(new TextEncoder().encode(parts));
}

export async function sendGmailMessage(
  accessToken: string,
  payload: GmailComposePayload
): Promise<{ id: string; threadId: string }> {
  const raw = await buildRawMimeEmail(payload);
  return googleFetch<{ id: string; threadId: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    }
  );
}

export async function createGmailDraft(
  accessToken: string,
  payload: GmailComposePayload
): Promise<{ id: string }> {
  const raw = await buildRawMimeEmail(payload);
  return googleFetch<{ id: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw } }),
    }
  );
}

// =====================================================================
// GOOGLE DOCS API v1 & GOOGLE DRIVE API v3 (for Google Docs discovery/export)
// =====================================================================

export interface GoogleDocSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleDocDetail {
  documentId: string;
  title: string;
  revisionId?: string;
  plainText: string;
  bodyEndIndex: number;
  webViewLink: string;
}

interface DocsParagraphElement {
  textRun?: {
    content?: string;
  };
}

interface DocsStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: DocsParagraphElement[];
  };
  table?: {
    tableRows?: {
      tableCells?: {
        content?: DocsStructuralElement[];
      }[];
    }[];
  };
  tableOfContents?: {
    content?: DocsStructuralElement[];
  };
}

interface RawGoogleDoc {
  documentId: string;
  title?: string;
  revisionId?: string;
  body?: {
    content?: DocsStructuralElement[];
  };
}

function readStructuralElementsText(
  elements: DocsStructuralElement[] | undefined
): string {
  if (!elements || elements.length === 0) return '';
  let text = '';
  for (const el of elements) {
    if (el.paragraph?.elements) {
      for (const pEl of el.paragraph.elements) {
        if (pEl.textRun?.content) {
          text += pEl.textRun.content;
        }
      }
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const rowCells = (row.tableCells || []).map((cell) =>
          readStructuralElementsText(cell.content).trim()
        );
        text += `${rowCells.join(' | ')}\n`;
      }
    } else if (el.tableOfContents?.content) {
      text += readStructuralElementsText(el.tableOfContents.content);
    }
  }
  return text;
}

function getDocBodyEndIndex(doc: RawGoogleDoc): number {
  const content = doc.body?.content;
  if (!content || content.length === 0) return 1;
  const last = content[content.length - 1];
  return typeof last?.endIndex === 'number' && last.endIndex > 1
    ? last.endIndex
    : 1;
}

export async function listGoogleDocs(
  accessToken: string,
  query = '',
  pageSize = 20
): Promise<GoogleDocSummary[]> {
  const qParts = [
    "mimeType='application/vnd.google-apps.document'",
    'trashed=false',
  ];
  const cleanQuery = query.trim().replace(/['\\]/g, '\\$&');
  if (cleanQuery) {
    qParts.push(`name contains '${cleanQuery}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    pageSize: String(pageSize),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime,webViewLink)',
  });

  const data = await googleFetch<{ files?: GoogleDocSummary[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files || [];
}

export async function getGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<GoogleDocDetail> {
  const doc = await googleFetch<RawGoogleDoc>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    accessToken
  );

  const plainText = readStructuralElementsText(doc.body?.content).replace(
    /\n$/,
    ''
  );
  const bodyEndIndex = getDocBodyEndIndex(doc);

  return {
    documentId: doc.documentId,
    title: doc.title || 'Document sans titre',
    revisionId: doc.revisionId,
    plainText,
    bodyEndIndex,
    webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

export async function createGoogleDoc(
  accessToken: string,
  title: string,
  initialContent?: string
): Promise<{ documentId: string; title: string; webViewLink: string }> {
  const cleanTitle = title.trim() || 'Document PDFExpress';
  const created = await googleFetch<RawGoogleDoc>(
    'https://docs.googleapis.com/v1/documents',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: cleanTitle }),
    }
  );

  if (initialContent && initialContent.trim()) {
    await googleFetch<unknown>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(
        created.documentId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: initialContent,
              },
            },
          ],
        }),
      }
    );
  }

  return {
    documentId: created.documentId,
    title: created.title || cleanTitle,
    webViewLink: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

export async function appendTextToGoogleDoc(
  accessToken: string,
  documentId: string,
  textToAppend: string
): Promise<void> {
  const trimmed = textToAppend.trim();
  if (!trimmed) return;

  const latest = await getGoogleDoc(accessToken, documentId);
  const insertIndex = Math.max(1, latest.bodyEndIndex - 1);
  const prefix =
    latest.plainText.trim().length > 0 && !latest.plainText.endsWith('\n')
      ? '\n\n'
      : '';

  await googleFetch<unknown>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(
      documentId
    )}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: `${prefix}${trimmed}\n`,
            },
          },
        ],
      }),
    }
  );
}

export async function replaceGoogleDocText(
  accessToken: string,
  documentId: string,
  newContent: string
): Promise<void> {
  const latest = await getGoogleDoc(accessToken, documentId);
  const requests: Record<string, unknown>[] = [];

  if (latest.bodyEndIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: latest.bodyEndIndex - 1,
        },
      },
    });
  }

  if (newContent.length > 0) {
    requests.push({
      insertText: {
        location: { index: 1 },
        text: newContent,
      },
    });
  }

  if (requests.length === 0) return;

  await googleFetch<unknown>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(
      documentId
    )}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
}

export async function trashGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<void> {
  await googleFetch<unknown>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    }
  );
}

export async function exportGoogleDocAsPdf(
  accessToken: string,
  documentId: string,
  title: string
): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    documentId
  )}/export?mimeType=application/pdf`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new WorkspaceAuthError();
  }

  if (!res.ok) {
    let apiMsg = `Erreur export PDF Google Docs (${res.status})`;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      if (parsed?.error?.message) apiMsg = parsed.error.message;
    } catch {
      // Ignore JSON parse errors on binary endpoint
    }
    if (res.status === 403 && apiMsg.toLowerCase().includes('insufficient')) {
      throw new WorkspaceAuthError(
        'Permissions Google Docs/Drive insuffisantes. Veuillez vous reconnecter avec Google.'
      );
    }
    throw new Error(apiMsg);
  }

  const blob = await res.blob();
  const safeBaseName =
    (title || 'Google_Doc')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'Google_Doc';
  const fileName = safeBaseName.toLowerCase().endsWith('.pdf')
    ? safeBaseName
    : `${safeBaseName}.pdf`;

  return new File([blob], fileName, { type: 'application/pdf' });
}
