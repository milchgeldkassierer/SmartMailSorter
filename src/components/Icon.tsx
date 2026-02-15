import React from 'react';
import {
  Inbox,
  Trash2,
  FileText,
  Mail,
  User,
  Briefcase,
  XOctagon,
  Archive,
  RefreshCw,
  LayoutDashboard,
  ShieldAlert,
  Search,
  CheckCircle2,
  BrainCircuit,
  LogOut,
  FolderPlus,
  Plane,
  GraduationCap,
  ShoppingBag,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  X,
  Server,
  SlidersHorizontal,
  Bot,
  Key,
  Cpu,
  Sparkles,
  Star,
  MailOpen,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Send,
  Filter,
  Folder,
  FolderOpen,
  AlertOctagon,
  Clock,
  Bell,
  BellOff,
} from 'lucide-react';
import { DefaultEmailCategory, SENT_FOLDER, SPAM_FOLDER, TRASH_FOLDER } from '../types';

export const CategoryIcon: React.FC<{ category: string; className?: string }> = ({ category, className }) => {
  switch (category) {
    case DefaultEmailCategory.INBOX:
      return <Inbox className={className} />;
    case DefaultEmailCategory.SPAM:
      return <ShieldAlert className={className} />;
    case DefaultEmailCategory.INVOICE:
      return <FileText className={className} />;
    case DefaultEmailCategory.NEWSLETTER:
      return <Mail className={className} />;
    case DefaultEmailCategory.PRIVATE:
      return <User className={className} />;
    case DefaultEmailCategory.BUSINESS:
      return <Briefcase className={className} />;
    case DefaultEmailCategory.CANCELLATION:
      return <XOctagon className={className} />;
    case DefaultEmailCategory.OTHER:
      return <Archive className={className} />;

    case SENT_FOLDER:
      return <Send className={className} />;
    case TRASH_FOLDER:
      return <Trash2 className={className} />;
    case SPAM_FOLDER:
      return <ShieldAlert className={className} />;

    // Dynamic mapping for common generated categories
    case 'Reise':
    case 'Reisen':
      return <Plane className={className} />;
    case 'Schule':
    case 'Bildung':
      return <GraduationCap className={className} />;
    case 'Bestellungen':
    case 'Shopping':
      return <ShoppingBag className={className} />;

    // Fallback for completely new dynamic categories
    default:
      return <FolderPlus className={className} />;
  }
};

export {
  RefreshCw,
  LayoutDashboard,
  Search,
  CheckCircle2,
  BrainCircuit,
  LogOut,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  X,
  Server,
  SlidersHorizontal,
  Bot,
  Key,
  Cpu,
  Sparkles,
  Star,
  Mail,
  MailOpen,
  CheckCircle,
  AlertCircle,
  Paperclip,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Archive,
  Send,
  Inbox,
  AlertOctagon,
  Trash2,
  Clock,
  Bell,
  BellOff,
};
