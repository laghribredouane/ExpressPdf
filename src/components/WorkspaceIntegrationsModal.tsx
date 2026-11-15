import { useCallback, useEffect, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Edit3,
  ExternalLink,
  FileDown,
  FilePlus,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  PenSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { clearWorkspaceAccessToken } from '../firebase';
import {
  WorkspaceAuthError,
  appendTextToGoogleDoc,
  createCalendarEvent,
  createGmailDraft,
  createGoogleDoc,
  deleteCalendarEvent,
  downloadGmailAttachment,
  exportGoogleDocAsPdf,
  getGoogleDoc,
  listCalendarEvents,
  listCalendars,
  listGmailMessages,
  listGoogleDocs,
  replaceGoogleDocText,
  sendGmailMessage,
  trashGoogleDoc,
  updateCalendarEvent,
  type GoogleCalendarEvent,
  type GoogleCalendarSummary,
  type GoogleDocDetail,
  type GoogleDocSummary,
  type GmailAttachmentMeta,
  type GmailMessageSummary,
} from '../services/googleWorkspace';
import type { ToolId } from '../types/pdf';
import { formatBytes } from '../utils/pdfEngine';
import { GoogleSignInButton } from './GoogleSignInButton';

export type WorkspaceModalMode =
  | 'hub'
  | 'gmail_import'
  | 'gmail_send'
  | 'calendar_schedule'
  | 'docs_browse'
  | 'docs_export';

interface AttachmentContext {
  fileName: string;
  blob: Blob;
  toolTitle?: string;
}

interface TextExportContext {
  title: string;
  content: string;
}

interface WorkspaceIntegrationsModalProps {
  isOpen: boolean;
  initialMode: WorkspaceModalMode;
  workspaceToken: string | null;
  isAuthBusy: boolean;
  userEmail?: string | null;
  onAuthorizeGoogle: () => void;
  onClose: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
  attachmentContext?: AttachmentContext | null;
  textExportContext?: TextExportContext | null;
  onImportPdfToTool?: (file: File, targetToolId?: ToolId) => void;
}

type PendingConfirmation =
  | {
      kind: 'calendar_create';
      title: string;
      description: string;
      details: string[];
      calendarId: string;
      summary: string;
      eventDescription: string;
      location: string;
      startIso: string;
      endIso: string;
      attendeesEmails: string[];
    }
  | {
      kind: 'calendar_update';
      title: string;
      description: string;
      details: string[];
      calendarId: string;
      eventId: string;
      summary: string;
      eventDescription: string;
      location: string;
      startIso: string;
      endIso: string;
      attendeesEmails: string[];
    }
  | {
      kind: 'calendar_delete';
      title: string;
      description: string;
      details: string[];
      calendarId: string;
      eventId: string;
    }
  | {
      kind: 'gmail_send';
      title: string;
      description: string;
      details: string[];
      to: string;
      subject: string;
      body: string;
      includeAttachment: boolean;
    }
  | {
      kind: 'gmail_draft';
      title: string;
      description: string;
      details: string[];
      to: string;
      subject: string;
      body: string;
      includeAttachment: boolean;
    }
  | {
      kind: 'docs_create';
      title: string;
      description: string;
      details: string[];
      docTitle: string;
      docContent: string;
    }
  | {
      kind: 'docs_replace';
      title: string;
      description: string;
      details: string[];
      documentId: string;
      docTitle: string;
      newContent: string;
    }
  | {
      kind: 'docs_append';
      title: string;
      description: string;
      details: string[];
      documentId: string;
      docTitle: string;
      appendText: string;
    }
  | {
      kind: 'docs_trash';
      title: string;
      description: string;
      details: string[];
      documentId: string;
      docTitle: string;
    };

function toLocalDateTimeInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatEventTimeRange(ev: GoogleCalendarEvent): string {
  const startRaw = ev.start.dateTime || ev.start.date;
  const endRaw = ev.end.dateTime || ev.end.date;
  if (!startRaw) return 'Horaire non précisé';
  if (!ev.start.dateTime) {
    return `${new Date(startRaw).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })} · Toute la journée`;
  }
  const s = new Date(startRaw);
  const e = endRaw ? new Date(endRaw) : s;
  const dateStr = s.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startTime = s.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = e.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function sanitizePdfText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

export function WorkspaceIntegrationsModal({
  isOpen,
  initialMode,
  workspaceToken,
  isAuthBusy,
  userEmail,
  onAuthorizeGoogle,
  onClose,
  onNotify,
  attachmentContext,
  textExportContext,
  onImportPdfToTool,
}: WorkspaceIntegrationsModalProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'calendar' | 'gmail'>(
    initialMode === 'calendar_schedule'
      ? 'calendar'
      : initialMode === 'docs_browse' || initialMode === 'docs_export'
      ? 'docs'
      : 'gmail'
  );

  // Google Docs state
  const [docsSubView, setDocsSubView] = useState<'list' | 'create'>(
    initialMode === 'docs_export' ? 'create' : 'list'
  );
  const [docsQuery, setDocsQuery] = useState('');
  const [docsList, setDocsList] = useState<GoogleDocSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GoogleDocDetail | null>(null);
  const [isLoadingDocDetail, setIsLoadingDocDetail] = useState(false);
  const [docEditorText, setDocEditorText] = useState('');
  const [docAppendText, setDocAppendText] = useState('');
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');

  // Calendar state
  const [calendars, setCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarFormOpen, setCalendarFormOpen] = useState(
    initialMode === 'calendar_schedule'
  );
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evSummary, setEvSummary] = useState('');
  const [evStart, setEvStart] = useState(toLocalDateTimeInput());
  const [evEnd, setEvEnd] = useState(
    toLocalDateTimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
  );
  const [evLocation, setEvLocation] = useState('');
  const [evAttendees, setEvAttendees] = useState('');
  const [evDescription, setEvDescription] = useState('');

  // Gmail state
  const [gmailSubView, setGmailSubView] = useState<'inbox' | 'compose'>(
    initialMode === 'gmail_send' ? 'compose' : 'inbox'
  );
  const [gmailOnlyPdf, setGmailOnlyPdf] = useState(
    initialMode === 'gmail_import'
  );
  const [gmailQuery, setGmailQuery] = useState('');
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [downloadingAttachmentKey, setDownloadingAttachmentKey] = useState<
    string | null
  >(null);
  const [selectedTargetTool, setSelectedTargetTool] = useState<ToolId>('compress');
  const [mailTo, setMailTo] = useState(userEmail || '');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [attachProcessedFile, setAttachProcessedFile] = useState(true);

  // Confirmation & execution state
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmation | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Sync modal defaults when opened in a specific contextual mode
  useEffect(() => {
    if (!isOpen) return;

    if (initialMode === 'calendar_schedule') {
      setActiveTab('calendar');
      setCalendarFormOpen(true);
      setEditingEventId(null);
      setEvSummary(
        attachmentContext
          ? `Suivi document : ${attachmentContext.fileName}`
          : 'Revue de document PDF'
      );
      const startDate = new Date(Date.now() + 60 * 60 * 1000);
      startDate.setMinutes(0, 0, 0);
      const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);
      setEvStart(toLocalDateTimeInput(startDate.toISOString()));
      setEvEnd(toLocalDateTimeInput(endDate.toISOString()));
      setEvLocation('Google Meet / PDFExpress');
      setEvAttendees('');
      setEvDescription(
        attachmentContext
          ? `Document traité avec PDFExpress (${attachmentContext.toolTitle || 'PDF'}) : ${attachmentContext.fileName} (${formatBytes(attachmentContext.blob.size)}).`
          : ''
      );
    } else if (initialMode === 'gmail_send') {
      setActiveTab('gmail');
      setGmailSubView('compose');
      setMailTo('');
      setMailSubject(
        attachmentContext
          ? `Document PDF : ${attachmentContext.fileName}`
          : 'Document envoyé depuis PDFExpress'
      );
      setMailBody(
        attachmentContext
          ? `Bonjour,\n\nVeuillez trouver en pièce jointe le document "${attachmentContext.fileName}" préparé avec PDFExpress (${attachmentContext.toolTitle || 'Traitement PDF'}).\n\nCordialement,`
          : 'Bonjour,\n\n'
      );
      setAttachProcessedFile(Boolean(attachmentContext));
    } else if (initialMode === 'gmail_import') {
      setActiveTab('gmail');
      setGmailSubView('inbox');
      setGmailOnlyPdf(true);
    } else if (initialMode === 'docs_browse') {
      setActiveTab('docs');
      setDocsSubView('list');
    } else if (initialMode === 'docs_export') {
      setActiveTab('docs');
      setDocsSubView('create');
      setNewDocTitle(
        textExportContext?.title ||
          `Document PDFExpress - ${new Date().toLocaleDateString('fr-FR')}`
      );
      setNewDocContent(textExportContext?.content || '');
    } else {
      setActiveTab('docs');
      setDocsSubView('list');
      setCalendarFormOpen(false);
      setGmailSubView('inbox');
    }
  }, [isOpen, initialMode, attachmentContext, textExportContext]);

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof WorkspaceAuthError) {
        clearWorkspaceAccessToken();
        onNotify(err.message, 'error');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Erreur Google Workspace';
      onNotify(msg, 'error');
    },
    [onNotify]
  );

  const fetchDocsData = useCallback(async () => {
    if (!workspaceToken) return;
    setIsLoadingDocs(true);
    try {
      const files = await listGoogleDocs(workspaceToken, docsQuery, 20);
      setDocsList(files);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [workspaceToken, docsQuery, handleApiError]);

  const fetchCalendarData = useCallback(async () => {
    if (!workspaceToken) return;
    setIsLoadingCalendar(true);
    try {
      const [cals, evs] = await Promise.all([
        listCalendars(workspaceToken),
        listCalendarEvents(workspaceToken, selectedCalendarId, {
          q: calendarSearch,
          maxResults: 25,
        }),
      ]);
      setCalendars(cals);
      setEvents(evs);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [workspaceToken, selectedCalendarId, calendarSearch, handleApiError]);

  const fetchGmailData = useCallback(async () => {
    if (!workspaceToken) return;
    setIsLoadingGmail(true);
    try {
      const qParts: string[] = [];
      if (gmailOnlyPdf) qParts.push('has:attachment filename:pdf');
      if (gmailQuery.trim()) qParts.push(gmailQuery.trim());
      const items = await listGmailMessages(
        workspaceToken,
        qParts.join(' '),
        14
      );
      setMessages(items);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingGmail(false);
    }
  }, [workspaceToken, gmailOnlyPdf, gmailQuery, handleApiError]);

  useEffect(() => {
    if (!isOpen || !workspaceToken) return;
    if (activeTab === 'docs') {
      if (docsSubView === 'list') {
        void fetchDocsData();
      }
    } else if (activeTab === 'calendar') {
      void fetchCalendarData();
    } else if (gmailSubView === 'inbox') {
      void fetchGmailData();
    }
  }, [
    isOpen,
    workspaceToken,
    activeTab,
    docsSubView,
    gmailSubView,
    fetchDocsData,
    fetchCalendarData,
    fetchGmailData,
  ]);

  if (!isOpen) return null;

  const openEditEvent = (ev: GoogleCalendarEvent) => {
    setEditingEventId(ev.id);
    setEvSummary(ev.summary || '');
    setEvStart(toLocalDateTimeInput(ev.start.dateTime || ev.start.date));
    setEvEnd(toLocalDateTimeInput(ev.end.dateTime || ev.end.date));
    setEvLocation(ev.location || '');
    setEvAttendees(
      (ev.attendees || []).map((a) => a.email).filter(Boolean).join(', ')
    );
    setEvDescription(ev.description || '');
    setCalendarFormOpen(true);
  };

  const handleRequestCalendarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evSummary.trim()) {
      onNotify('Veuillez saisir un titre d’événement.', 'error');
      return;
    }
    const startIso = new Date(evStart).toISOString();
    const endDate = new Date(evEnd);
    const startDate = new Date(evStart);
    const endIso =
      endDate > startDate
        ? endDate.toISOString()
        : new Date(startDate.getTime() + 30 * 60 * 1000).toISOString();
    const attendeesList = evAttendees
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));

    const calName =
      calendars.find((c) => c.id === selectedCalendarId)?.summary ||
      'Agenda principal';

    if (editingEventId) {
      setPendingConfirm({
        kind: 'calendar_update',
        title: 'Modifier cet événement Google Calendar ?',
        description:
          'Vous êtes sur le point de mettre à jour un événement existant dans votre agenda Google.',
        details: [
          `Agenda : ${calName}`,
          `Titre : ${evSummary.trim()}`,
          `Début : ${startDate.toLocaleString('fr-FR')}`,
          ...(attendeesList.length > 0
            ? [`Participants : ${attendeesList.join(', ')}`]
            : []),
        ],
        calendarId: selectedCalendarId,
        eventId: editingEventId,
        summary: evSummary.trim(),
        eventDescription: evDescription.trim(),
        location: evLocation.trim(),
        startIso,
        endIso,
        attendeesEmails: attendeesList,
      });
    } else {
      setPendingConfirm({
        kind: 'calendar_create',
        title: 'Créer cet événement dans Google Calendar ?',
        description:
          'Cet événement sera ajouté à votre Google Calendar (et les invités recevront l’invitation s’il y en a).',
        details: [
          `Agenda : ${calName}`,
          `Titre : ${evSummary.trim()}`,
          `Début : ${startDate.toLocaleString('fr-FR')}`,
          ...(evLocation.trim() ? [`Lieu : ${evLocation.trim()}`] : []),
          ...(attendeesList.length > 0
            ? [`Invités : ${attendeesList.join(', ')}`]
            : []),
        ],
        calendarId: selectedCalendarId,
        summary: evSummary.trim(),
        eventDescription: evDescription.trim(),
        location: evLocation.trim(),
        startIso,
        endIso,
        attendeesEmails: attendeesList,
      });
    }
  };

  const handleRequestDeleteEvent = (ev: GoogleCalendarEvent) => {
    setPendingConfirm({
      kind: 'calendar_delete',
      title: 'Supprimer définitivement cet événement ?',
      description:
        'Cette action supprimera l’événement de votre Google Calendar. Elle est irréversible.',
      details: [
        `Événement : ${ev.summary || '(Sans titre)'}`,
        `Horaire : ${formatEventTimeRange(ev)}`,
      ],
      calendarId: selectedCalendarId,
      eventId: ev.id,
    });
  };

  const handleRequestGmailSubmit = (mode: 'send' | 'draft') => {
    if (mode === 'send' && !mailTo.trim()) {
      onNotify('Veuillez saisir une adresse e-mail destinataire.', 'error');
      return;
    }
    if (!mailSubject.trim()) {
      onNotify('Veuillez saisir un objet pour le message.', 'error');
      return;
    }

    const willAttach = Boolean(attachmentContext && attachProcessedFile);

    if (mode === 'send') {
      setPendingConfirm({
        kind: 'gmail_send',
        title: 'Envoyer cet e-mail via Gmail ?',
        description:
          'Le message va être expédié immédiatement depuis votre compte Gmail.',
        details: [
          `Destinataire : ${mailTo.trim()}`,
          `Objet : ${mailSubject.trim()}`,
          ...(willAttach && attachmentContext
            ? [
                `Pièce jointe : ${attachmentContext.fileName} (${formatBytes(
                  attachmentContext.blob.size
                )})`,
              ]
            : ['Sans pièce jointe']),
        ],
        to: mailTo.trim(),
        subject: mailSubject.trim(),
        body: mailBody,
        includeAttachment: willAttach,
      });
    } else {
      setPendingConfirm({
        kind: 'gmail_draft',
        title: 'Enregistrer ce brouillon dans Gmail ?',
        description:
          'Un brouillon sera créé dans votre boîte Gmail sans être envoyé.',
        details: [
          `Destinataire : ${mailTo.trim() || '(Non défini)'}`,
          `Objet : ${mailSubject.trim()}`,
          ...(willAttach && attachmentContext
            ? [`Pièce jointe : ${attachmentContext.fileName}`]
            : []),
        ],
        to: mailTo.trim(),
        subject: mailSubject.trim(),
        body: mailBody,
        includeAttachment: willAttach,
      });
    }
  };

  const executeConfirmedAction = async () => {
    if (!pendingConfirm || !workspaceToken) return;
    setIsExecutingAction(true);
    try {
      if (pendingConfirm.kind === 'calendar_create') {
        await createCalendarEvent(workspaceToken, pendingConfirm.calendarId, {
          summary: pendingConfirm.summary,
          description: pendingConfirm.eventDescription,
          location: pendingConfirm.location,
          startIso: pendingConfirm.startIso,
          endIso: pendingConfirm.endIso,
          attendeesEmails: pendingConfirm.attendeesEmails,
        });
        onNotify('Événement ajouté à Google Calendar.', 'success');
        setCalendarFormOpen(false);
        setEditingEventId(null);
        await fetchCalendarData();
      } else if (pendingConfirm.kind === 'calendar_update') {
        await updateCalendarEvent(
          workspaceToken,
          pendingConfirm.calendarId,
          pendingConfirm.eventId,
          {
            summary: pendingConfirm.summary,
            description: pendingConfirm.eventDescription,
            location: pendingConfirm.location,
            startIso: pendingConfirm.startIso,
            endIso: pendingConfirm.endIso,
            attendeesEmails: pendingConfirm.attendeesEmails,
          }
        );
        onNotify('Événement mis à jour dans Google Calendar.', 'success');
        setCalendarFormOpen(false);
        setEditingEventId(null);
        await fetchCalendarData();
      } else if (pendingConfirm.kind === 'calendar_delete') {
        await deleteCalendarEvent(
          workspaceToken,
          pendingConfirm.calendarId,
          pendingConfirm.eventId
        );
        onNotify('Événement supprimé de Google Calendar.', 'info');
        await fetchCalendarData();
      } else if (pendingConfirm.kind === 'gmail_send') {
        await sendGmailMessage(workspaceToken, {
          to: pendingConfirm.to,
          subject: pendingConfirm.subject,
          body: pendingConfirm.body,
          attachment:
            pendingConfirm.includeAttachment && attachmentContext
              ? {
                  blob: attachmentContext.blob,
                  fileName: attachmentContext.fileName,
                }
              : null,
        });
        onNotify(`E-mail envoyé à ${pendingConfirm.to} via Gmail !`, 'success');
        setGmailSubView('inbox');
        if (initialMode === 'gmail_send') {
          onClose();
        }
      } else if (pendingConfirm.kind === 'gmail_draft') {
        await createGmailDraft(workspaceToken, {
          to: pendingConfirm.to,
          subject: pendingConfirm.subject,
          body: pendingConfirm.body,
          attachment:
            pendingConfirm.includeAttachment && attachmentContext
              ? {
                  blob: attachmentContext.blob,
                  fileName: attachmentContext.fileName,
                }
              : null,
        });
        onNotify('Brouillon sauvegardé dans Gmail.', 'success');
        setGmailSubView('inbox');
      } else if (pendingConfirm.kind === 'docs_create') {
        const created = await createGoogleDoc(
          workspaceToken,
          pendingConfirm.docTitle,
          pendingConfirm.docContent
        );
        onNotify(`Google Doc "${created.title}" créé avec succès.`, 'success');
        setDocsSubView('list');
        setNewDocTitle('');
        setNewDocContent('');
        await fetchDocsData();
        const detail = await getGoogleDoc(workspaceToken, created.documentId);
        setSelectedDoc(detail);
        setDocEditorText(detail.plainText);
        setDocAppendText('');
      } else if (pendingConfirm.kind === 'docs_replace') {
        await replaceGoogleDocText(
          workspaceToken,
          pendingConfirm.documentId,
          pendingConfirm.newContent
        );
        onNotify(
          `Contenu du document "${pendingConfirm.docTitle}" mis à jour.`,
          'success'
        );
        const refreshed = await getGoogleDoc(
          workspaceToken,
          pendingConfirm.documentId
        );
        setSelectedDoc(refreshed);
        setDocEditorText(refreshed.plainText);
      } else if (pendingConfirm.kind === 'docs_append') {
        await appendTextToGoogleDoc(
          workspaceToken,
          pendingConfirm.documentId,
          pendingConfirm.appendText
        );
        onNotify(
          `Texte ajouté à la fin de "${pendingConfirm.docTitle}".`,
          'success'
        );
        setDocAppendText('');
        const refreshed = await getGoogleDoc(
          workspaceToken,
          pendingConfirm.documentId
        );
        setSelectedDoc(refreshed);
        setDocEditorText(refreshed.plainText);
      } else if (pendingConfirm.kind === 'docs_trash') {
        await trashGoogleDoc(workspaceToken, pendingConfirm.documentId);
        onNotify(
          `Document "${pendingConfirm.docTitle}" déplacé dans la corbeille Google Drive.`,
          'info'
        );
        if (selectedDoc?.documentId === pendingConfirm.documentId) {
          setSelectedDoc(null);
          setDocEditorText('');
        }
        await fetchDocsData();
      }
      setPendingConfirm(null);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleOpenGoogleDoc = async (docSummary: GoogleDocSummary) => {
    if (!workspaceToken) return;
    setIsLoadingDocDetail(true);
    try {
      const detail = await getGoogleDoc(workspaceToken, docSummary.id);
      setSelectedDoc(detail);
      setDocEditorText(detail.plainText);
      setDocAppendText('');
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingDocDetail(false);
    }
  };

  const handleImportGoogleDocAsPdf = async (
    documentId: string,
    title: string
  ) => {
    if (!workspaceToken || !onImportPdfToTool) return;
    setExportingDocId(documentId);
    try {
      const pdfFile = await exportGoogleDocAsPdf(
        workspaceToken,
        documentId,
        title
      );
      onNotify(`Google Doc "${title}" exporté en PDF.`, 'success');
      onImportPdfToTool(
        pdfFile,
        initialMode === 'docs_browse' ? undefined : selectedTargetTool
      );
      onClose();
    } catch (err) {
      handleApiError(err);
    } finally {
      setExportingDocId(null);
    }
  };

  const handleRequestCreateDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) {
      onNotify('Veuillez saisir un titre pour le Google Doc.', 'error');
      return;
    }
    setPendingConfirm({
      kind: 'docs_create',
      title: 'Créer un nouveau Google Doc ?',
      description:
        'Un nouveau document sera créé dans votre espace Google Docs / Drive.',
      details: [
        `Titre : ${newDocTitle.trim()}`,
        newDocContent.trim()
          ? `Longueur du texte initial : ${newDocContent.trim().length} caractères`
          : 'Document vierge',
      ],
      docTitle: newDocTitle.trim(),
      docContent: newDocContent,
    });
  };

  const handleRequestSaveDocEdit = () => {
    if (!selectedDoc) return;
    setPendingConfirm({
      kind: 'docs_replace',
      title: 'Enregistrer les modifications dans Google Docs ?',
      description:
        'Le texte actuel de ce Google Doc sera remplacé par le contenu édité ci-dessous.',
      details: [
        `Document : ${selectedDoc.title}`,
        `Nouvelle longueur : ${docEditorText.length} caractères`,
      ],
      documentId: selectedDoc.documentId,
      docTitle: selectedDoc.title,
      newContent: docEditorText,
    });
  };

  const handleRequestAppendDoc = () => {
    if (!selectedDoc || !docAppendText.trim()) {
      onNotify('Veuillez saisir un paragraphe à ajouter.', 'error');
      return;
    }
    setPendingConfirm({
      kind: 'docs_append',
      title: 'Ajouter ce texte à la fin du Google Doc ?',
      description:
        'Le paragraphe saisi sera inséré à la fin du document sans effacer le contenu existant.',
      details: [
        `Document : ${selectedDoc.title}`,
        `Ajout : "${docAppendText.trim().slice(0, 120)}${
          docAppendText.trim().length > 120 ? '...' : ''
        }"`,
      ],
      documentId: selectedDoc.documentId,
      docTitle: selectedDoc.title,
      appendText: docAppendText.trim(),
    });
  };

  const handleRequestTrashDoc = (documentId: string, title: string) => {
    setPendingConfirm({
      kind: 'docs_trash',
      title: 'Déplacer ce Google Doc vers la corbeille ?',
      description:
        'Le document sera placé dans la corbeille de votre Google Drive.',
      details: [`Document : ${title}`],
      documentId,
      docTitle: title,
    });
  };

  const handleImportAttachment = async (
    msgId: string,
    att: GmailAttachmentMeta
  ) => {
    if (!workspaceToken || !onImportPdfToTool) return;
    const key = `${msgId}_${att.attachmentId}`;
    setDownloadingAttachmentKey(key);
    try {
      const file = await downloadGmailAttachment(
        workspaceToken,
        msgId,
        att.attachmentId,
        att.filename,
        att.mimeType
      );
      onNotify(`"${att.filename}" importé depuis Gmail.`, 'success');
      onImportPdfToTool(
        file,
        initialMode === 'gmail_import' ? undefined : selectedTargetTool
      );
      onClose();
    } catch (err) {
      handleApiError(err);
    } finally {
      setDownloadingAttachmentKey(null);
    }
  };

  const handleExportAgendaPdf = async () => {
    if (events.length === 0) {
      onNotify('Aucun événement à exporter en PDF.', 'info');
      return;
    }
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      let page = doc.addPage([595.28, 841.89]);
      let y = 785;

      page.drawText('PDFExpress - Recapitulatif Google Calendar', {
        x: 45,
        y,
        size: 16,
        font: bold,
        color: rgb(0.89, 0.2, 0.18),
      });
      y -= 20;
      page.drawText(
        sanitizePdfText(
          `Genere le ${new Date().toLocaleDateString('fr-FR')} (${events.length} evenements)`
        ),
        {
          x: 45,
          y,
          size: 10,
          font,
          color: rgb(0.4, 0.4, 0.45),
        }
      );
      y -= 28;

      for (const ev of events) {
        if (y < 75) {
          page = doc.addPage([595.28, 841.89]);
          y = 785;
        }
        page.drawText(sanitizePdfText(ev.summary || '(Sans titre)'), {
          x: 45,
          y,
          size: 12,
          font: bold,
          color: rgb(0.1, 0.1, 0.14),
        });
        y -= 15;
        page.drawText(sanitizePdfText(formatEventTimeRange(ev)), {
          x: 45,
          y,
          size: 10,
          font,
          color: rgb(0.3, 0.35, 0.45),
        });
        if (ev.location) {
          y -= 13;
          page.drawText(sanitizePdfText(`Lieu : ${ev.location}`), {
            x: 45,
            y,
            size: 9,
            font,
            color: rgb(0.45, 0.45, 0.5),
          });
        }
        y -= 22;
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PDFExpress_Agenda_Google.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify('Agenda Google exporté en PDF.', 'success');
    } catch {
      onNotify('Erreur lors de la génération du PDF de l’agenda.', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-6 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Google Workspace : Docs, Calendar et Gmail"
    >
      <div className="relative w-[95vw] sm:w-full max-w-5xl max-h-[90dvh] bg-white dark:bg-brand-cardDark rounded-3xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 dark:border-brand-borderDark flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {activeTab === 'docs' ? (
                <FileText className="w-5 h-5" />
              ) : activeTab === 'calendar' ? (
                <Calendar className="w-5 h-5" />
              ) : (
                <Mail className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white truncate">
                Google Docs, Calendar &amp; Gmail
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {workspaceToken
                  ? `Session connectée${userEmail ? ` · ${userEmail}` : ''}`
                  : 'Connectez votre compte Google pour accéder à Docs, Agenda et Gmail'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Switcher tabs */}
            <div className="inline-flex p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab('docs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                  activeTab === 'docs'
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Docs</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                  activeTab === 'calendar'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gmail')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                  activeTab === 'gmail'
                    ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Gmail</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-5 sm:p-6">
          {!workspaceToken ? (
            <div className="max-w-lg mx-auto my-8 p-7 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-900/50 text-center space-y-5">
              <div className="flex items-center justify-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </span>
                <span className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </span>
                <span className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-brand-red flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white mb-2">
                  Autorisez l’accès à Google Docs, Calendar &amp; Gmail
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Consultez, créez et éditez vos Google Docs, importez un Doc en PDF dans PDFExpress, synchronisez vos échéances Calendar et gérez vos pièces jointes Gmail.
                </p>
              </div>
              <div className="flex justify-center">
                <GoogleSignInButton
                  onClick={onAuthorizeGoogle}
                  disabled={isAuthBusy}
                  label={
                    isAuthBusy
                      ? 'Connexion en cours...'
                      : 'Sign in with Google'
                  }
                />
              </div>
            </div>
          ) : activeTab === 'docs' ? (
            <div className="space-y-5">
              {/* Google Docs Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setDocsSubView('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      docsSubView === 'list'
                        ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-neutral-500'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Mes Google Docs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocsSubView('create')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      docsSubView === 'create'
                        ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-neutral-500'
                    }`}
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Nouveau Google Doc</span>
                  </button>
                </div>

                {docsSubView === 'list' && (
                  <div className="flex flex-wrap items-center gap-2 flex-grow justify-end">
                    <div className="relative flex-grow max-w-xs">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={docsQuery}
                        onChange={(e) => setDocsQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void fetchDocsData();
                        }}
                        placeholder="Rechercher un Google Doc..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchDocsData()}
                      disabled={isLoadingDocs}
                      className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isLoadingDocs ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Actualiser</span>
                    </button>
                  </div>
                )}
              </div>

              {docsSubView === 'list' ? (
                <div className="space-y-4">
                  {onImportPdfToTool && (
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                        Transformez n’importe quel Google Doc en PDF prêt pour vos outils :
                      </p>
                      {initialMode !== 'docs_browse' && (
                        <select
                          value={selectedTargetTool}
                          onChange={(e) =>
                            setSelectedTargetTool(e.target.value as ToolId)
                          }
                          className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                        >
                          <option value="compress">Compresser PDF</option>
                          <option value="sign">Signer PDF</option>
                          <option value="editpdf">Modifier PDF</option>
                          <option value="watermark">Filigrane PDF</option>
                          <option value="protect">Protéger PDF</option>
                          <option value="aisummary">Résumé par IA</option>
                          <option value="translatepdf">Traduire le PDF</option>
                        </select>
                      )}
                    </div>
                  )}

                  <div
                    className={`grid gap-5 ${
                      selectedDoc || isLoadingDocDetail
                        ? 'lg:grid-cols-12'
                        : 'grid-cols-1'
                    }`}
                  >
                    {/* Docs List */}
                    <div
                      className={`${
                        selectedDoc || isLoadingDocDetail ? 'lg:col-span-5' : ''
                      } space-y-2.5`}
                    >
                      {isLoadingDocs && docsList.length === 0 ? (
                        <div className="py-14 flex flex-col items-center justify-center text-neutral-400 gap-2">
                          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                          <p className="text-xs font-semibold">
                            Chargement de vos Google Docs...
                          </p>
                        </div>
                      ) : docsList.length === 0 ? (
                        <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
                          <FileText className="w-9 h-9 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                          <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            Aucun Google Doc trouvé
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            Créez un document avec « Nouveau Google Doc » ou modifiez votre recherche.
                          </p>
                        </div>
                      ) : (
                        docsList.map((docItem) => {
                          const isSelected = selectedDoc?.documentId === docItem.id;
                          const isExporting = exportingDocId === docItem.id;

                          return (
                            <div
                              key={docItem.id}
                              className={`p-4 rounded-2xl border transition-colors space-y-3 ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                                  : 'border-neutral-200 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-indigo-400/70'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                                    {docItem.name}
                                  </h4>
                                  {docItem.modifiedTime && (
                                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                      Modifié le{' '}
                                      {new Date(docItem.modifiedTime).toLocaleDateString(
                                        'fr-FR',
                                        {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        }
                                      )}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {docItem.webViewLink && (
                                    <a
                                      href={docItem.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Ouvrir dans Google Docs"
                                      className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRequestTrashDoc(docItem.id, docItem.name)
                                    }
                                    title="Mettre à la corbeille"
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-brand-red"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleOpenGoogleDoc(docItem)}
                                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500 text-xs font-bold text-neutral-700 dark:text-neutral-200 inline-flex items-center gap-1.5"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>Lire / Modifier</span>
                                </button>

                                {onImportPdfToTool && (
                                  <button
                                    type="button"
                                    disabled={isExporting}
                                    onClick={() =>
                                      void handleImportGoogleDocAsPdf(
                                        docItem.id,
                                        docItem.name
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isExporting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <FileDown className="w-3.5 h-3.5" />
                                    )}
                                    <span>Importer en PDF</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Selected Doc Reader & Editor */}
                    {(selectedDoc || isLoadingDocDetail) && (
                      <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/15 space-y-4 h-fit">
                        {isLoadingDocDetail || !selectedDoc ? (
                          <div className="py-16 flex flex-col items-center justify-center gap-2 text-neutral-400">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            <p className="text-xs font-semibold">
                              Chargement du document...
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 dark:text-white truncate">
                                  {selectedDoc.title}
                                </h3>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                                  {docEditorText.trim()
                                    ? `${docEditorText.trim().split(/\s+/).length} mot(s)`
                                    : 'Document vide'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={selectedDoc.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 inline-flex items-center gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Google Docs</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoc(null)}
                                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
                                  aria-label="Fermer l'aperçu"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                                Contenu du document
                              </label>
                              <textarea
                                rows={9}
                                value={docEditorText}
                                onChange={(e) => setDocEditorText(e.target.value)}
                                placeholder="Saisissez ou modifiez le texte du document..."
                                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm leading-relaxed outline-none focus:border-indigo-500"
                              />
                              <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
                                {onImportPdfToTool && (
                                  <button
                                    type="button"
                                    disabled={exportingDocId === selectedDoc.documentId}
                                    onClick={() =>
                                      void handleImportGoogleDocAsPdf(
                                        selectedDoc.documentId,
                                        selectedDoc.title
                                      )
                                    }
                                    className="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold inline-flex items-center gap-1.5"
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                    <span>Convertir &amp; Ouvrir en PDF</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={handleRequestSaveDocEdit}
                                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm ml-auto"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Enregistrer les modifications</span>
                                </button>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-indigo-200/70 dark:border-indigo-900/50 space-y-2">
                              <label className="block text-[11px] font-bold uppercase text-neutral-500">
                                Ajouter un paragraphe à la fin
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={docAppendText}
                                  onChange={(e) => setDocAppendText(e.target.value)}
                                  placeholder="Note ou texte à ajouter en bas du doc..."
                                  className="flex-grow px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleRequestAppendDoc}
                                  className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Ajouter</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CREATE GOOGLE DOC FORM */
                <form
                  onSubmit={handleRequestCreateDoc}
                  className="max-w-2xl mx-auto p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/40 space-y-4"
                >
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                      Titre du document Google Docs *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="Ex: Compte-rendu client PDFExpress"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                      Contenu initial
                    </label>
                    <textarea
                      rows={9}
                      value={newDocContent}
                      onChange={(e) => setNewDocContent(e.target.value)}
                      placeholder="Saisissez le texte à insérer dans votre nouveau Google Doc..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setDocsSubView('list')}
                      className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200"
                    >
                      Retour à la liste
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm"
                    >
                      <FilePlus className="w-4 h-4" />
                      <span>Créer dans Google Docs</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="space-y-5">
              {/* Calendar Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-grow">
                  <select
                    value={selectedCalendarId}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-100 max-w-xs"
                  >
                    {calendars.length === 0 ? (
                      <option value="primary">Agenda principal</option>
                    ) : (
                      calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary} {c.primary ? '(Principal)' : ''}
                        </option>
                      ))
                    )}
                  </select>

                  <div className="relative flex-grow max-w-xs">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={calendarSearch}
                      onChange={(e) => setCalendarSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void fetchCalendarData();
                      }}
                      placeholder="Rechercher un événement..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void fetchCalendarData()}
                    disabled={isLoadingCalendar}
                    className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isLoadingCalendar ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Actualiser</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportAgendaPdf}
                    className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Exporter en PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEventId(null);
                      setEvSummary('');
                      setEvLocation('');
                      setEvAttendees('');
                      setEvDescription('');
                      setCalendarFormOpen((v) => !v);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>
                      {calendarFormOpen ? 'Masquer le formulaire' : 'Nouvel événement'}
                    </span>
                  </button>
                </div>
              </div>

              <div
                className={`grid gap-5 ${
                  calendarFormOpen ? 'lg:grid-cols-12' : 'grid-cols-1'
                }`}
              >
                {/* Events List */}
                <div
                  className={`${
                    calendarFormOpen ? 'lg:col-span-7' : ''
                  } space-y-2.5`}
                >
                  {isLoadingCalendar && events.length === 0 ? (
                    <div className="py-14 flex flex-col items-center justify-center text-neutral-400 gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                      <p className="text-xs font-semibold">
                        Chargement de votre agenda Google...
                      </p>
                    </div>
                  ) : events.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
                      <Calendar className="w-9 h-9 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        Aucun événement à venir trouvé
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Créez un rendez-vous ou une échéance documentaire avec « Nouvel événement ».
                      </p>
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-blue-400/70 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                            {ev.summary || '(Sans titre)'}
                          </h4>
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatEventTimeRange(ev)}</span>
                          </p>
                          {ev.location && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.location}</span>
                            </p>
                          )}
                          {ev.attendees && ev.attendees.length > 0 && (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>{ev.attendees.length} participant(s)</span>
                            </p>
                          )}
                          {ev.description && (
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 pt-0.5">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ouvrir dans Google Calendar"
                              className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditEvent(ev)}
                            title="Modifier l'événement"
                            className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteEvent(ev)}
                            title="Supprimer l'événement"
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-brand-red"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Create / Edit Form */}
                {calendarFormOpen && (
                  <form
                    onSubmit={handleRequestCalendarSubmit}
                    className="lg:col-span-5 p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3.5 h-fit"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                        {editingEventId
                          ? 'Modifier l’événement'
                          : 'Planifier un événement'}
                      </h3>
                      {editingEventId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventId(null);
                            setEvSummary('');
                          }}
                          className="text-[11px] font-bold text-neutral-500 hover:text-brand-red"
                        >
                          Annuler l’édition
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                        Titre *
                      </label>
                      <input
                        type="text"
                        required
                        value={evSummary}
                        onChange={(e) => setEvSummary(e.target.value)}
                        placeholder="Ex: Signature contrat PDF..."
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                          Début
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={evStart}
                          onChange={(e) => setEvStart(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                          Fin
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={evEnd}
                          onChange={(e) => setEvEnd(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                        Lieu ou lien visio
                      </label>
                      <input
                        type="text"
                        value={evLocation}
                        onChange={(e) => setEvLocation(e.target.value)}
                        placeholder="Ex: Bureau / Google Meet"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                        Invités (e-mails séparés par virgule)
                      </label>
                      <input
                        type="text"
                        value={evAttendees}
                        onChange={(e) => setEvAttendees(e.target.value)}
                        placeholder="client@exemple.com, equipe@exemple.com"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                        Description / Notes
                      </label>
                      <textarea
                        rows={3}
                        value={evDescription}
                        onChange={(e) => setEvDescription(e.target.value)}
                        placeholder="Détails sur le document PDF associé..."
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {editingEventId
                          ? 'Mettre à jour dans Calendar'
                          : 'Ajouter à Google Calendar'}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* GMAIL TAB */
            <div className="space-y-5">
              {/* Gmail Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setGmailSubView('inbox')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      gmailSubView === 'inbox'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500'
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    <span>Boîte de réception</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGmailSubView('compose')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      gmailSubView === 'compose'
                        ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                        : 'text-neutral-500'
                    }`}
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Rédiger / Envoyer PDF</span>
                  </button>
                </div>

                {gmailSubView === 'inbox' && (
                  <div className="flex flex-wrap items-center gap-2 flex-grow justify-end">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold cursor-pointer bg-white dark:bg-neutral-800">
                      <input
                        type="checkbox"
                        checked={gmailOnlyPdf}
                        onChange={(e) => setGmailOnlyPdf(e.target.checked)}
                        className="accent-brand-red"
                      />
                      <span>PDF uniquement</span>
                    </label>
                    <div className="relative flex-grow max-w-xs">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={gmailQuery}
                        onChange={(e) => setGmailQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void fetchGmailData();
                        }}
                        placeholder="Rechercher dans Gmail..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs outline-none focus:border-brand-red"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchGmailData()}
                      disabled={isLoadingGmail}
                      className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isLoadingGmail ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Actualiser</span>
                    </button>
                  </div>
                )}
              </div>

              {gmailSubView === 'inbox' ? (
                <div className="space-y-3">
                  {initialMode !== 'gmail_import' && onImportPdfToTool && (
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                        Cliquez sur une pièce jointe PDF pour l’ouvrir directement dans PDFExpress :
                      </p>
                      <select
                        value={selectedTargetTool}
                        onChange={(e) =>
                          setSelectedTargetTool(e.target.value as ToolId)
                        }
                        className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                      >
                        <option value="compress">Compresser PDF</option>
                        <option value="merge">Fusionner PDF</option>
                        <option value="sign">Signer PDF</option>
                        <option value="editpdf">Modifier PDF</option>
                        <option value="aisummary">Résumé par IA</option>
                        <option value="translatepdf">Traduire le PDF</option>
                        <option value="aiocr">OCR Avancé (IA)</option>
                      </select>
                    </div>
                  )}

                  {isLoadingGmail && messages.length === 0 ? (
                    <div className="py-14 flex flex-col items-center justify-center text-neutral-400 gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-brand-red" />
                      <p className="text-xs font-semibold">
                        Chargement des messages Gmail...
                      </p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
                      <Mail className="w-9 h-9 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        Aucun e-mail correspondant trouvé
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Essayez de décocher « PDF uniquement » ou modifiez votre recherche.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                              {msg.subject}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              De : <span className="font-semibold">{msg.from}</span>
                            </p>
                          </div>
                          {msg.date && (
                            <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">
                              {new Date(msg.date).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </div>

                        {msg.snippet && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                            {msg.snippet}
                          </p>
                        )}

                        {msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {msg.attachments.map((att) => {
                              const isPdf =
                                att.mimeType.toLowerCase().includes('pdf') ||
                                att.filename.toLowerCase().endsWith('.pdf');
                              const key = `${msg.id}_${att.attachmentId}`;
                              const busy = downloadingAttachmentKey === key;

                              return (
                                <button
                                  key={att.attachmentId}
                                  type="button"
                                  disabled={busy || !onImportPdfToTool}
                                  onClick={() =>
                                    void handleImportAttachment(msg.id, att)
                                  }
                                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-colors ${
                                    isPdf
                                      ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-brand-red hover:bg-red-100 dark:hover:bg-red-950/50'
                                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                                  }`}
                                >
                                  {busy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Paperclip className="w-3.5 h-3.5" />
                                  )}
                                  <span className="truncate max-w-[200px]">
                                    {att.filename}
                                  </span>
                                  {att.size > 0 && (
                                    <span className="text-[10px] opacity-75 tabular-nums">
                                      ({formatBytes(att.size)})
                                    </span>
                                  )}
                                  {onImportPdfToTool && isPdf && (
                                    <span className="text-[10px] underline ml-0.5">
                                      Importer
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* GMAIL COMPOSE FORM */
                <div className="max-w-2xl mx-auto p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/40 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                      Destinataire (À) *
                    </label>
                    <input
                      type="email"
                      value={mailTo}
                      onChange={(e) => setMailTo(e.target.value)}
                      placeholder="destinataire@exemple.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-brand-red"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                      Objet *
                    </label>
                    <input
                      type="text"
                      value={mailSubject}
                      onChange={(e) => setMailSubject(e.target.value)}
                      placeholder="Objet de votre message"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-brand-red"
                    />
                  </div>

                  {attachmentContext && (
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 cursor-pointer">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {attachmentContext.fileName}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                            Pièce jointe PDF prête ·{' '}
                            {formatBytes(attachmentContext.blob.size)}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={attachProcessedFile}
                        onChange={(e) =>
                          setAttachProcessedFile(e.target.checked)
                        }
                        className="accent-emerald-600"
                      />
                    </label>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                      Message
                    </label>
                    <textarea
                      rows={6}
                      value={mailBody}
                      onChange={(e) => setMailBody(e.target.value)}
                      placeholder="Écrivez votre message ici..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-brand-red"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleRequestGmailSubmit('draft')}
                      className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      Enregistrer en brouillon
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestGmailSubmit('send')}
                      className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-brand-redHover text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Envoyer via Gmail</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MANDATORY Explicit Confirmation Dialog for all Workspace mutations */}
        {pendingConfirm && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-brand-cardDark rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    pendingConfirm.kind === 'calendar_delete' ||
                    pendingConfirm.kind === 'docs_trash'
                      ? 'bg-red-100 dark:bg-red-950/60 text-brand-red'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                    {pendingConfirm.title}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                    {pendingConfirm.description}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                {pendingConfirm.details.map((line, i) => (
                  <p
                    key={i}
                    className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 break-words"
                  >
                    {line}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isExecutingAction}
                  onClick={() => setPendingConfirm(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isExecutingAction}
                  onClick={() => void executeConfirmedAction()}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white inline-flex items-center gap-1.5 ${
                    pendingConfirm.kind === 'calendar_delete' ||
                    pendingConfirm.kind === 'docs_trash'
                      ? 'bg-brand-red hover:bg-brand-redHover'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isExecutingAction && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Confirmer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
