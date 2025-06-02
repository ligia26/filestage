import { z } from "zod";
import express from "express";
import { UnauthorizedError } from "../errors.js";
import { StringObjectId } from "../schemas.js";

export default function FileRoutes({ db, session }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const { userId } = await session.get(req);
    if (!userId) {
      console.error("[ERROR] Unauthorized access to GET /comments");
      throw new UnauthorizedError();
    }

    try {
      const { fileId } = z.object({ fileId: StringObjectId }).parse(req.query);
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      console.log(
        `[INFO] GET /comments for fileId=${fileId} limit=${limit} offset=${offset}`
      );

      const comments = await db
        .collection("comments")
        .find({ fileId })
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const totalComments = await db
        .collection("comments")
        .countDocuments({ fileId });

      const hasMore = offset + limit < totalComments;

      console.log(
        `[INFO] Retrieved ${comments.length} comments (hasMore=${hasMore}) for fileId=${fileId}`
      );

      res.json({ comments, hasMore });
    } catch (error) {
      console.error("[ERROR] Failed to fetch comments:", error.message);
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    const { userId } = await session.get(req);
    if (!userId) {
      console.error("[ERROR] Unauthorized access to POST /comments");
      throw new UnauthorizedError();
    }

    try {
      const { fileId, body, x, y, parentId } = z
        .object({
          fileId: StringObjectId,
          body: z.string(),
          x: z.number().min(0).max(100).optional(),
          y: z.number().min(0).max(100).optional(),
          parentId: StringObjectId.optional(),
        })
        .parse(req.body);

      const comment = {
        fileId,
        authorId: userId,
        body,
        x,
        y,
        createdAt: new Date(),
        parentId: parentId || null,
      };

      const { insertedId } = await db.collection("comments").insertOne(comment);

      console.log(
        `[INFO] New comment created with id=${insertedId} on fileId=${fileId}`
      );

      res
        .status(201)
        .json(await db.collection("comments").findOne({ _id: insertedId }));
    } catch (error) {
      console.error("[ERROR] Failed to create comment:", error.message);
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
