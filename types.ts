// GENERAL
export interface StatusHistory {
  status: OrderStatus | ReservationStatus;
  startedAt: string;
}

// MENU & PRODUCTS
export interface MenuItem {
  name: string;
  price: string;
  description?: string;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  color?: string;
}

export interface PromotionItem {
  productId: string;
  name: string;
  quantity: number;
}

export interface Promotion {
  id: string;
  name: string;
  items: PromotionItem[];
  price: number;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string;
}

// ORDERS
export enum OrderStatus {
  PENDING = 'Pendiente',
  CONFIRMED = 'Confirmado',
  PREPARING = 'En Preparación',
  READY = 'Listo para Retirar/Entregar',
  DELIVERING = 'En Camino',
  DINE_IN_PENDING_PAYMENT = 'En Mesa (Pendiente de Pago)',
  COMPLETED_PICKUP = 'Completado (Retirado)',
  COMPLETED_DELIVERY = 'Completado (Entregado)',
  COMPLETED_DINE_IN = 'Completado (En Mesa)',
  CANCELLED = 'Cancelado',
}

export enum OrderType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
  DINE_IN = 'dine-in',
}

export enum PaymentMethod {
  CASH = 'Efectivo',
  CREDIT = 'Credito',
  TRANSFER = 'Transferencia',
}

export enum CreatedBy {
    ADMIN = 'Admin Panel',
    WEB_ASSISTANT = 'Web Assistant',
    WHATSAPP_ASSISTANT = 'WhatsApp Assistant',
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  isPromotion: boolean;
  itemId: string;
}

export interface Order {
  id: string;
  customer: {
    name: string;
    phone?: string;
    address?: string;
  };
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  type: OrderType;
  createdAt: string;
  statusHistory: StatusHistory[];
  finishedAt: string | null;
  tableIds?: string[];
  guests?: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paymentProofUrl?: string | null;
  reservationId?: string;
  createdBy: CreatedBy;
}

// RESERVATIONS & TABLES
export enum ReservationStatus {
  PENDING = 'Pendiente',
  CONFIRMED = 'Confirmada',
  SEATED = 'Sentado',
  COMPLETED = 'Completada',
  CANCELLED = 'Cancelada',
  NO_SHOW = 'No Se Presentó',
}

export enum ReservationCancellationReason {
    USER = 'Cancelado por el cliente',
    ADMIN = 'Cancelado por el local',
    SYSTEM = 'Cancelado por el sistema',
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  guests: number;
  reservationTime: string;
  tableIds: string[];
  status: ReservationStatus;
  statusHistory: StatusHistory[];
  finishedAt: string | null;
  cancellationReason?: ReservationCancellationReason;
  notes?: string;
  createdAt: string;
  orderId?: string;
  createdBy: CreatedBy;
}

export interface ReservationSettings {
  duration: number;
  minBookingTime: number;
  initialBlockTime: number;
  extensionBlockTime: number;
  modificationLockTime: number;
  slotInterval: number;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  allowsReservations: boolean;
  overrideStatus: 'Bloqueada' | null;
}

export type TableStatus = 'Libre' | 'Ocupada' | 'Reservada' | 'Bloqueada';

export interface EnrichedTable extends Table {
  status: TableStatus;
  details?: {
    type: 'order' | 'reservation';
    id: string;
    customerName: string;
    time?: string;
    startTime?: string;
    orderStatus?: OrderStatus;
  };
  activeOrdersOnTable?: Order[];
  accumulatedTotal?: number;
}

// CUSTOMERS
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  categoryId: string;
  createdAt: string;
}

export interface CustomerCategory {
  id: string;
  name: string;
  color: string;
}

// USERS (Admin Panel)
export enum UserRole {
    ADMIN = 'Administrador',
    EDITOR = 'Editor',
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
    lastAccess: string | null;
}


// SCHEDULE
export interface TimeSlot {
  open: string;
  close: string;
}

export interface DaySchedule {
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface Schedule {
  [day: string]: DaySchedule;
}

export enum ExceptionType {
  CLOSED = 'Cerrado',
  SPECIAL_HOURS = 'Horario Especial',
}

export interface ScheduleException {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: ExceptionType;
  slots?: TimeSlot[];
}


// CHAT & BOTS
export enum MessageSender {
    USER = 'user',
    BOT = 'bot',
}

export interface ChatMessage {
    sender: MessageSender;
    text: string;
}

export type WhatsAppBotStatus = 'disconnected' | 'initiating' | 'ready_to_scan' | 'scanning' | 'active' | 'error' | 'disconnecting';

// Fix: Added missing WhatsAppBotMetrics interface.
export interface WhatsAppBotMetrics {
    distinctCustomers: number;
    totalMessages: number;
    ordersMade: number;
    reservationsMade: number;
}

export interface BulkSendJob {
  status: 'running' | 'completed' | 'cancelled' | 'error' | 'idle';
  total: number;
  sent: number;
  failed: number;
  startTime: number;
  isCancelled: boolean;
}

export interface SliceBotMetrics {
    distinctCustomers: number;
    totalMessages: number;
    totalTokensUsed: number;
    ordersMade: number;
    reservationsMade: number;
}

export interface ChatHistorySession {
    id: string;
    startTime: string;
    messages: ChatMessage[];
    outcome: 'order' | 'reservation' | null;
    tokensUsed: number;
    lastActivity: string;
}

// NOTIFICATIONS
export interface Notification {
    id: string;
    message: string;
    type: 'order' | 'reservation' | 'general';
    relatedId?: string;
    createdAt: string;
    isRead: boolean;
}

// ADMIN
export type AdminPanel = 'orders' | 'products' | 'customers' | 'users' | 'schedule' | 'reservations' | 'tables' | 'bots' | 'settings';