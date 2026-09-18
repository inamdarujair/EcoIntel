import { Router, Request, Response, NextFunction } from 'express';
import { KnowledgeDocument, KnowledgeChunk } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';

export const sourceRouter = Router();

sourceRouter.get(
  '/sources/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return next(new AppError(`Invalid source ID: ${id}`, 400, 'INVALID_ID'));
      }

      const document = await KnowledgeDocument.findById(id);
      if (!document) {
        return next(new AppError(`Source document not found with ID: ${id}`, 404, 'NOT_FOUND'));
      }

      // Fetch related knowledge chunks
      const chunks = await KnowledgeChunk.find({ documentId: document._id })
        .sort({ chunkIndex: 1 })
        .select('-embedding'); // Omit heavy embedding vectors for general view

      res.status(200).json({
        document,
        chunks,
        chunkCount: chunks.length,
      });
    } catch (error) {
      next(error);
    }
  }
);
