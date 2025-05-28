import { useState, useRef, useEffect, useMemo } from "react";
import TopBar from "../components/TopBar";
import {
  Box,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Card,
  CardHeader,
  CardContent,
  Typography,
} from "@mui/material";
import { useSelectedFile } from "../hooks/files";
import { useTheme } from "@mui/material/styles";
import { useComments, useCreateComment } from "../hooks/comments";
import { useSearchParams } from "react-router-dom";
import { useUser } from "../hooks/users";
import UserAvatar from "../components/UserAvatar";
import Loading from "../pages/Loading";

const CommentCard = ({ comment }) => {
  const { isLoading, data: author } = useUser(comment.authorId);

  if (isLoading) {
    return;
  }
  function linkifyText(text) {
    if (typeof text !== "string") return text;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "blue" }}
          >
            {part}
          </a>
        );
      } else {
        return part;
      }
    });
  }

  return (
    <Card data-testid="comment-card" variant="outlined" sx={{ mb: 2 }}>
      <CardHeader
        avatar={<UserAvatar userId={author._id} />}
        title={author.email}
        subheader={new Date(comment.createdAt).toLocaleString()}
      />
      <CardContent>
        <Typography variant="body1" data-testid="comment-body">
          {linkifyText(comment.body)}
        </Typography>
      </CardContent>
    </Card>
  );
};

const CommentBar = ({ fileId }) => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useComments({ fileId });

  const createComment = useCreateComment({ fileId });

  const comments = useMemo(
    () => data?.pages.flatMap((page) => page.comments) ?? [],
    [data]
  );
  const grouped = comments.reduce((acc, comment) => {
    if (comment.parentId) {
      // it's a reply
      acc[comment.parentId] = acc[comment.parentId] || [];
      acc[comment.parentId].push(comment);
    } else {
      // it's a top-level comment
      acc[comment._id] = acc[comment._id] || [];
    }
    return acc;
  }, {});
  const loadMoreRef = useRef(null);
  const topLevelComments = comments.filter((c) => !c.parentId);

  const [replyTo, setReplyTo] = useState(null); // commentId

  const handleReplySubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const body = form.elements.replyBody.value;

    const payload = {
      fileId,
      body,
    };

    if (replyTo) {
      payload.parentId = replyTo;
    }

    createComment.mutate(payload, {
      onSuccess: () => {
        setReplyTo(null);
        form.reset();
      },
    });
  };

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <Typography>Loading comments...</Typography>;
  }

  if (error) {
    return <Typography>Error loading comments</Typography>;
  }

  return (
    <Box
      sx={{
        width: 320,
        height: "100%",
        overflowY: "auto",
        p: 2,
      }}
    >
      {comments.length === 0 && (
        <Typography variant="body1">No comments yet</Typography>
      )}

      {topLevelComments.map((comment) => (
        <div key={comment._id}>
          <CommentCard comment={comment} />
          <Box sx={{ ml: 1, mt: -1, mb: 1 }}>
            <Button size="small" onClick={() => setReplyTo(comment._id)}>
              Reply
            </Button>
          </Box>

          {replyTo === comment._id && (
            <Box
              component="form"
              onSubmit={handleReplySubmit}
              sx={{ mt: 1, ml: 4 }}
            >
              <TextField
                name="replyBody"
                placeholder="Write a reply..."
                size="small"
                fullWidth
                required
              />
              <Box sx={{ mt: 1 }}>
                <Button type="submit" variant="contained" size="small">
                  Send
                </Button>
                <Button
                  onClick={() => setReplyTo(null)}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
          {grouped[comment._id]?.map((reply) => (
            <Box key={reply._id} sx={{ ml: 4 }}>
              <CommentCard comment={reply} isReply />
            </Box>
          ))}
        </div>
      ))}

      {/* Invisible div that triggers fetching next page */}
      <div ref={loadMoreRef} style={{ height: 1 }} />

      {isFetchingNextPage && <Typography>Loading more comments...</Typography>}
    </Box>
  );
};

const ImageViewer = ({ file }) => {
  const theme = useTheme();
  const { data, isLoading, error } = useComments({ fileId: file._id });

  const comments = useMemo(
    () => data?.pages.flatMap((page) => page.comments) ?? [],
    [data]
  );
  const createComment = useCreateComment({ fileId: file._id });
  const imageRef = useRef(null);
  const markerContainerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [clickCoords, setClickCoords] = useState({ x: 0, y: 0 });
  const [, setSearchParams] = useSearchParams();

  const selectComment = (commentId) => {
    setSearchParams({ commentId }, { replace: true });
  };

  const handleImageClick = (e) => {
    const rect = imageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    setClickCoords({ x: xPercent, y: yPercent });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createComment.mutate(
      {
        fileId: file._id,
        body: e.target.elements.body.value,
        x: clickCoords.x,
        y: clickCoords.y,
      },
      { onSuccess: () => setOpen(false) }
    );
  };

  useEffect(function matchMarkerLayerSizeToImage() {
    if (!imageRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      markerContainerRef.current.style.width = `${imageRef.current.width}px`;
      markerContainerRef.current.style.height = `${imageRef.current.height}px`;
    });
    resizeObserver.observe(imageRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (isLoading) {
    return <Typography>Loading image...</Typography>;
  }

  if (error) {
    return <Typography>Error loading comments</Typography>;
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    >
      <Tooltip title="Click to leave a comment" arrow>
        <img
          ref={imageRef}
          src={`${import.meta.env.VITE_BACKEND_ORIGIN}/files/${file._id}/content`}
          alt={file.name}
          onClick={handleImageClick}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            cursor: "pointer",
          }}
        />
      </Tooltip>
      <Box
        id="markers-container"
        ref={markerContainerRef}
        sx={{
          position: "absolute",
          mx: "auto",
          width: imageRef.current?.width ?? "100%",
          height: imageRef.current?.height ?? "100%",
          pointerEvents: "none",
        }}
      >
        {comments.map((comment) => (
          <Box
            key={comment._id}
            sx={{
              position: "absolute",
              left: `${comment.x}%`,
              top: `${comment.y}%`,
              transform: "translate(-50%, -50%)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: theme.palette.primary.light,
              border: "2px solid white",
              cursor: "pointer",
              pointerEvents: "auto",
              "&:hover": {
                backgroundColor: theme.palette.primary.main,
              },
            }}
            onClick={() => selectComment(comment._id)}
          />
        ))}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>Add a Comment</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Comment"
              name="body"
              fullWidth
              multiline
              rows={3}
              required
            />
            {createComment.isError && (
              <Typography color="error">
                {createComment.error.message}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button color="main" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

const File = () => {
  const { data: file, isLoading, isError } = useSelectedFile();
  const theme = useTheme();

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Typography variant="h4">File not found</Typography>;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
      data-testid="comments-panel"
    >
      <TopBar title={file.name} back={`/projects/${file.projectId}`} />
      <Box
        sx={{
          height: "100%",
          display: "flex",
          backgroundColor: theme.palette.grey[200],
        }}
      >
        <ImageViewer file={file} />
        <CommentBar fileId={file._id} />
      </Box>
    </Box>
  );
};

export default File;
