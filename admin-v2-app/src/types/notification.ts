import { JSX } from 'react';

export type NotificationType =
  | 'birthday'
  | 'friend_request'
  | 'commented'
  | 'following'
  | 'reaction_love'
  | 'reaction_smile'
  | 'photos'
  | 'group_invitation'
  | 'tagged'
  | 'activity_decode_success'
  | 'activity_decode_failure'
  | 'activity_listing_eval_completed'
  | 'activity_inventory_marked_sold'
  | 'activity_inventory_updated'
  | 'activity_inventory_added'
  | 'activity_failed_serial_evaluated';

export interface Notification {
  id: number;
  type: NotificationType;
  detail: JSX.Element;
  readAt: null | Date | string;
  user: {
    id: number;
    name: string;
    avatar: string;
  }[];
  images?: string[];
  createdAt: string | Date;
  url?: string | null;
  openInNewTab?: boolean;
}

export interface DatewiseNotification {
  today: Notification[];
  older: Notification[];
}
