import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { Box, Button, Divider, Popover, Stack, Typography, badgeClasses } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import NotificationList from 'components/sections/notification/NotificationList';
import OutlinedBadge from 'components/styled/OutlinedBadge';
import { Notification, NotificationType } from 'types/notification';

interface NotificationMenuProps {
  type?: 'default' | 'slim';
}

interface ActivityLogRecord {
  id: number;
  eventTimeUtc: string;
  eventKey: string;
  eventText: string;
  eventUrl: string | null;
  imageUrl: string | null;
}

interface ActivityLogResponse {
  records: ActivityLogRecord[];
  page: number;
  hasMore: boolean;
}

const PAGE_SIZE = 8;

function mapEventKeyToNotificationType(eventKey: string): NotificationType {
  const mapping: Record<string, NotificationType> = {
    decode_success: 'activity_decode_success',
    decode_failure: 'activity_decode_failure',
    listing_eval_completed: 'activity_listing_eval_completed',
    inventory_marked_sold: 'activity_inventory_marked_sold',
    inventory_updated: 'activity_inventory_updated',
    inventory_added: 'activity_inventory_added',
    failed_serial_evaluated: 'activity_failed_serial_evaluated',
  };
  return mapping[eventKey] || 'activity_inventory_updated';
}

function mapActivityRecordToNotification(record: ActivityLogRecord): Notification {
  return {
    id: Number(record.id),
    type: mapEventKeyToNotificationType(record.eventKey),
    detail: <>{record.eventText}</>,
    readAt: null,
    user: record.imageUrl
      ? [{ id: Number(record.id), name: 'Activity image', avatar: record.imageUrl }]
      : [],
    createdAt: record.eventTimeUtc,
    url: record.eventUrl,
    openInNewTab: false,
  };
}

const NotificationMenu = ({ type = 'default' }: NotificationMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const open = Boolean(anchorEl);
  const hasActivity = useMemo(() => notifications.length > 0, [notifications.length]);

  const loadPage = async (nextPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/admin-v2/activity-log?${params.toString()}`, {
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as ActivityLogResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load activity log.');
      }

      const mapped = Array.isArray(payload.records)
        ? payload.records.map(mapActivityRecordToNotification)
        : [];
      setNotifications((current) => (append ? [...current, ...mapped] : mapped));
      setPage(Number(payload.page || nextPage));
      setHasMore(Boolean(payload.hasMore));
      setHasLoadedOnce(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Unable to load activity log.';
      setError(text);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!open || hasLoadedOnce || loading) return;
    void loadPage(1, false);
  }, [open, hasLoadedOnce, loading]);

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    void loadPage(page + 1, true);
  };

  return (
    <>
      <Button
        color="neutral"
        variant={type === 'default' ? 'soft' : 'text'}
        shape="circle"
        size={type === 'slim' ? 'small' : 'medium'}
        aria-label="Notifications"
        onClick={handleOpen}
      >
        <OutlinedBadge
          variant="dot"
          color="error"
          invisible={!hasActivity}
          sx={{
            [`& .${badgeClasses.badge}`]: {
              height: 10,
              width: 10,
              top: -2,
              right: -2,
              borderRadius: '50%',
            },
          }}
        >
          <IconifyIcon
            icon={
              type === 'slim'
                ? 'material-symbols:notifications-outline-rounded'
                : 'material-symbols-light:notifications-outline-rounded'
            }
            sx={{ fontSize: type === 'slim' ? 18 : 22 }}
          />
        </OutlinedBadge>
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 420 },
              maxHeight: 560,
              mt: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Stack sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Activity Log
          </Typography>
        </Stack>

        <Box sx={{ px: 2, py: 1, overflowY: 'auto' }}>
          {loading && (
            <Typography variant="body2" sx={{ px: 1, py: 2, color: 'text.secondary' }}>
              Loading activity...
            </Typography>
          )}

          {!loading && error && (
            <Typography variant="body2" sx={{ px: 1, py: 2, color: 'error.main' }}>
              {error}
            </Typography>
          )}

          {!loading && !error && notifications.length < 1 && (
            <Typography variant="body2" sx={{ px: 1, py: 2, color: 'text.secondary' }}>
              No activity yet.
            </Typography>
          )}

          {!loading && notifications.length > 0 && (
            <NotificationList
              title="Recent"
              notifications={notifications}
              variant="small"
              onItemClick={handleClose}
              sx={{ pb: 0 }}
            />
          )}
        </Box>

        {hasMore && (
          <Divider sx={{ mt: 'auto' }}>
            <Button
              color="neutral"
              variant="soft"
              sx={{ borderRadius: 10, my: 1 }}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more...'}
            </Button>
          </Divider>
        )}
      </Popover>
    </>
  );
};

export default NotificationMenu;
