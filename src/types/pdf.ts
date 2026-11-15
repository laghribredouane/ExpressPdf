import type { PDFDocumentProxy } from 'pdfjs-dist';

export type CategoryId =
  | 'all'
  | 'studio_image'
  | 'workflow'
  | 'organiser'
  | 'optimiser'
  | 'convertir'
  | 'convertir_en'
  | 'convertir_depuis'
  | 'modifier'
  | 'securite'
  | 'intelligence';

export type ToolId =
  | 'merge'
  | 'split'
  | 'removepages'
  | 'extractpages'
  | 'organizepages'
  | 'scan2pdf'
  | 'compress'
  | 'repair'
  | 'ocr'
  | 'jpg2pdf'
  | 'word2pdf'
  | 'ppt2pdf'
  | 'excel2pdf'
  | 'html2pdf'
  | 'pdf2jpg'
  | 'pdf2word'
  | 'pdf2ppt'
  | 'pdf2excel'
  | 'pdf2pdfa'
  | 'pdf2md'
  | 'rotate'
  | 'pagenumbers'
  | 'watermark'
  | 'crop'
  | 'editpdf'
  | 'pdfforms'
  | 'unlock'
  | 'protect'
  | 'sign'
  | 'redact'
  | 'compare'
  | 'aisummary'
  | 'translatepdf'
  | 'aiocr'
  | 'socialpost'
  | 'workflow'
  | 'stampgenerator'
  | 'img_bg_remove'
  | 'img_compress'
  | 'ocr_extract';

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
}

export interface ToolDefinition {
  id: ToolId;
  cat: Exclude<CategoryId, 'all' | 'convertir'>;
  catLabel: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  badge: string;
  accept: string;
  multiple: boolean;
  btnText: string;
  actionLabel: string;
  isPro?: boolean;
}

export interface LoadedFile {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  arrayBuffer: ArrayBuffer;
  pageCount: number;
  previewUrl: string | null;
  pdfJsDoc: PDFDocumentProxy | null;
}

export interface PageOrderItem {
  fileIndex: number;
  originalIndex: number;
  rotation: number;
}

export interface CanvasAnnotation {
  type:
    | 'text'
    | 'highlight'
    | 'redact'
    | 'sig'
    | 'form-text'
    | 'form-check'
    | 'form-select';
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  text?: string;
  color?: string;
  size?: number;
  imgData?: string;
  fieldName?: string;
  options?: string[];
}

export interface CropMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface RecentProcessedFile {
  id: string;
  fileName: string;
  toolId: ToolId;
  toolTitle: string;
  sizeFormatted: string;
  processedAt: number;
  cloudSynced?: boolean;
}

export type WorkflowStepId =
  | 'merge'
  | 'rotate90'
  | 'pagenumbers'
  | 'watermark'
  | 'compress'
  | 'protect';

export interface ExecutionOptions {
  mergeName?: string;
  splitMode?: 'range' | 'all';
  splitRanges?: string;
  extractFormat?: 'single' | 'zip';
  scanFilter?: 'bw' | 'color';
  compressLevel?: 'extreme' | 'recommended' | 'low' | 'lossless';
  compressQuality?: number;
  compressGrayscale?: boolean;
  compressStripMetadata?: boolean;
  ocrOutput?: 'pdf' | 'txt';
  aiOcrLang?: string;
  aiOcrOutput?: 'searchable' | 'editable' | 'txt' | 'md';
  jpgOrient?: 'portrait' | 'landscape' | 'fit';
  jpgMargin?: number;
  htmlCode?: string;
  pdf2jpgScale?: number;
  numPos?: 'bc' | 'br' | 'bl' | 'tc' | 'tr' | 'tl';
  numFmt?: '1' | 'page' | 'total';
  wmText?: string;
  wmColor?: 'red' | 'gray' | 'blue';
  wmAngle?: number;
  wmOpacity?: number;
  protectPwd?: string;
  protectStamp?: boolean;
  compareDiffText?: string;
  summaryStyle?: 'short' | 'bullets' | 'detailed';
  summaryOutput?: 'pdf' | 'txt';
  translateTargetLang?: string;
  workflowSteps?: WorkflowStepId[];
  stampShape?: 'circle' | 'rectangle' | 'badge';
  stampTextTop?: string;
  stampCenterText?: string;
  stampTextBottom?: string;
  stampColor?: 'red' | 'blue' | 'green' | 'black' | 'purple';
  stampOpacity?: number;
  stampPosition?: 'br' | 'bl' | 'tr' | 'tl' | 'center';
  stampPageMode?: 'all' | 'first' | 'last';
}

export interface ExecutionResult {
  blob: Blob;
  fileName: string;
  btnText: string;
  statsHtml?: string;
}

export interface SiteInfoPage {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  highlights: string[];
  ctaLabel?: string;
  ctaToolId?: ToolId;
}

export type CurrencyCode = 'MAD' | 'USD' | 'EUR';
export type BillingCycle = 'monthly' | 'annual';

export interface BankTransferSubmission {
  reference: string;
  planId: 'premium_pro' | 'premium_team';
  planLabel: string;
  cycle: BillingCycle;
  currency: CurrencyCode;
  amount: number;
  formattedAmount: string;
  payerName: string;
  payerEmail: string;
  bankOrigin: string;
  transferDate: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptDataUrl?: string;
  status: 'pending_verification';
  createdAt: number;
}

export type SocialPlatformId =
  | 'linkedin_carousel'
  | 'linkedin_post'
  | 'instagram_square'
  | 'instagram_story'
  | 'x_post'
  | 'facebook_post';

export type SocialThemeId =
  | 'brand_red'
  | 'midnight'
  | 'emerald'
  | 'amber_gold'
  | 'ocean'
  | 'paper';

export interface SocialSlide {
  id: string;
  badge: string;
  title: string;
  body: string;
  cta: string;
}

export type SubscriptionStatus =
  | 'free'
  | 'trial_active'
  | 'premium_active'
  | 'expired'
  | 'suspended';

export type UserRole = 'user' | 'admin';

export interface SaasUserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  trialClaimed: boolean;
  premiumExpiresAt: number; // 0 = unlimited if premium_active, else epoch ms
  lastDeviceFingerprint?: string;
  adminNote?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface UserDeviceRecord {
  id: string;
  userId: string;
  deviceFingerprint: string;
  userAgent: string;
  os: string;
  browser: string;
  screenResolution: string;
  lastIp: string;
  firstUsedAtMs?: number;
  lastSeenAtMs?: number;
}

export interface BannedDeviceRecord {
  deviceFingerprint: string;
  reason: string;
  bannedByUid: string;
  createdAtMs?: number;
}

export interface PremiumRequestRecord {
  id: string;
  userId: string;
  reference: string;
  planId: 'premium_pro' | 'premium_team';
  planLabel: string;
  cycle: BillingCycle;
  currency: CurrencyCode;
  amount: number;
  formattedAmount: string;
  payerName: string;
  payerEmail: string;
  bankOrigin?: string;
  transferDate: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptDataUrl?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAtMs?: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  blockReasonCode?:
    | 'banned_device'
    | 'suspended_account'
    | 'unverified_email'
    | 'pro_tool_locked'
    | 'daily_limit'
    | 'file_size_limit'
    | 'batch_limit';
  requiresAuth?: boolean;
  requiresUpgrade?: boolean;
  maxFileMb: number;
  maxBatchFiles: number;
  dailyLimit: number | null;
  remainingTasks: number | null;
  isWatermarked: boolean;
}

export interface PdfChatContext {
  fileName: string;
  pageCount: number;
  sizeFormatted: string;
  extractedText: string;
  source: 'workspace' | 'chat-upload';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actionType?: 'qa' | 'summary' | 'translation';
  mode?: 'ai' | 'local';
}

