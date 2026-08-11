import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const rooms = await prisma.room.findMany({ include: { entity: true }, orderBy: { createdAt: 'desc' } });
  res.json(rooms);
});

router.post('/', authMiddleware, requirePermission('admin.rooms'), async (req, res) => {
  try {
    // Duplicate name check
    const existing = await prisma.room.findFirst({ where: { name: req.body.name } });
    if (existing) return res.status(409).json({ error: 'يوجد قاعة بنفس الاسم مسبقاً' });

    const data = {
      name: req.body.name,
      type: req.body.type || 'ROOM',
      capacity: parseInt(req.body.capacity) || 30,
      costType: req.body.costType || 'FIXED',
      learningType: req.body.learningType || 'INSIDE_CENTER',
      modality: req.body.modality || 'PHYSICAL',
      address: req.body.address || null,
      entityId: req.body.entityId ? parseInt(req.body.entityId) : null,
      building: req.body.building || null,
      floor: req.body.floor || null,
      hasProjector: req.body.hasProjector || false,
      hasAC: req.body.hasAC || false,
      notes: req.body.notes || null
    };
    const room = await prisma.room.create({ data });
    res.json(room);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: 'فشل إنشاء القاعة' });
  }
});

router.put('/:id', authMiddleware, requirePermission('admin.rooms'), async (req, res) => {
  try {
    // Duplicate name check (excluding self)
    if (req.body.name !== undefined) {
      const existing = await prisma.room.findFirst({
        where: { name: req.body.name, id: { not: parseInt(req.params.id as string) } }
      });
      if (existing) return res.status(409).json({ error: 'يوجد قاعة بنفس الاسم مسبقاً' });
    }

    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.type !== undefined) data.type = req.body.type;
    if (req.body.capacity !== undefined) data.capacity = parseInt(req.body.capacity) || 30;
    if (req.body.costType !== undefined) data.costType = req.body.costType;
    if (req.body.learningType !== undefined) data.learningType = req.body.learningType;
    if (req.body.modality !== undefined) data.modality = req.body.modality;
    if (req.body.address !== undefined) data.address = req.body.address;
    if (req.body.entityId !== undefined) data.entityId = req.body.entityId ? parseInt(req.body.entityId) : null;
    if (req.body.building !== undefined) data.building = req.body.building;
    if (req.body.floor !== undefined) data.floor = req.body.floor;
    if (req.body.hasProjector !== undefined) data.hasProjector = req.body.hasProjector;
    if (req.body.hasAC !== undefined) data.hasAC = req.body.hasAC;
    if (req.body.notes !== undefined) data.notes = req.body.notes;

    const room = await prisma.room.update({ where: { id: parseInt(req.params.id as string) }, data });
    res.json(room);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: 'فشل تحديث القاعة' });
  }
});

router.delete('/:id', authMiddleware, requirePermission('admin.rooms'), async (req, res) => {
  try {
    await prisma.room.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'فشل حذف القاعة' }); }
});

export default router;
