import { useState } from 'react';
import { Box, Collapse } from '@mui/material';
import { CommentItemType } from 'types/content';
import ThreadConnector from './ThreadConnector';
import ThreadToggle from './ThreadToggle';
import ContentBlock from './content-block';

interface ReplyThreadProps {
  replies: CommentItemType[];
  isLastComment: boolean;
  toggleThreadInput: () => void;
}

const ReplyThread = ({ replies, isLastComment, toggleThreadInput }: ReplyThreadProps) => {
  const [open, setOpen] = useState(true);
  const toggle = () => setOpen((prev) => !prev);

  if (replies.length === 0) return null;

  return (
    <>
      <Box sx={{ position: 'relative', pl: 5 }}>
        {open && <ThreadConnector offsetLeft={16} />}
        <ThreadConnector offsetLeft={16} elbow sx={{ top: -12 }} />
        <ThreadToggle handleToggle={toggle}>
          {open ? 'Hide all replies' : `View ${replies.length} more replies`}
        </ThreadToggle>
      </Box>

      <Collapse in={open} mountOnEnter unmountOnExit>
        <div>
          {replies.map((reply, i) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              isLastReply={i === replies.length - 1}
              isLastComment={isLastComment}
              isRepliesThreadOpen={open}
              toggleThreadInput={toggleThreadInput}
            />
          ))}
        </div>
      </Collapse>
    </>
  );
};

const ReplyItem = ({
  reply,
  isLastReply,
  isRepliesThreadOpen,
  toggleThreadInput,
}: {
  reply: CommentItemType;
  isLastReply: boolean;
  isLastComment: boolean;
  isRepliesThreadOpen: boolean;
  toggleThreadInput: () => void;
}) => {
  return (
    <Box sx={{ position: 'relative', pl: 5 }}>
      {isRepliesThreadOpen && (
        <>
          {!isLastReply && <ThreadConnector offsetLeft={16} />}
          <ThreadConnector offsetLeft={16} elbow />
        </>
      )}
      <ContentBlock content={reply} toggleThreadInput={toggleThreadInput} />
    </Box>
  );
};

export default ReplyThread;
