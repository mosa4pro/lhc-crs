import express from 'express';
import { prisma } from '../index.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Parse address/contactName out of notes (stored as structured lines)
const parseEntityMeta = (e: any) => {
  let address = '';
  let contactName = '';
  const notes = e.notes || '';
  const a = notes.match(/\n?العنوان:\s*(.*?)(?=\n|$)/);
  if (a) address = a[1].trim();
  const c = notes.match(/\n?المسؤول:\s*(.*?)(?=\n|$)/);
  if (c) contactName = c[1].trim();
  return { ...e, address, contactName };
};

// Strip previously-stored address/contactName lines so re-saving never duplicates them
const stripEntityMeta = (notes: string) =>
  String(notes || '')
    .replace(/\n?العنوان:\s*.*?(?=\n|$)/g, '')
    .replace(/\n?المسؤول:\s*.*?(?=\n|$)/g, '')
    .replace(/^\n+/, '')
    .replace(/\n{2,}/g, '\n');

router.get('/', authMiddleware, async (req, res) => {
  const authUser = (req as any).user;
  const where: any = {};
  if (!authUser?.isAdmin && authUser?.role !== 'ADMIN') {
    let assignedIds: number[] = [];
    try { assignedIds = JSON.parse(authUser.assignedEntityIds || '[]'); } catch {}
    if (assignedIds.length > 0) where.id = { in: assignedIds };
  }
  const entities = await prisma.educationalEntity.findMany({
    where,
    include: { rooms: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(entities.map(parseEntityMeta));
});

router.post('/', authMiddleware, requirePermission('admin.entities'), async (req, res) => {
  try {
    let notes = stripEntityMeta(req.body.notes || '');
    if (req.body.address) notes += `${notes ? '\n' : ''}العنوان: ${req.body.address}`;
    if (req.body.contactName) notes += `${notes ? '\n' : ''}المسؤول: ${req.body.contactName}`;

    const data = {
      name: req.body.name,
      type: req.body.type || 'UNIVERSITY',
      status: req.body.status || 'ACTIVE',
      commissionType: req.body.commissionType || 'PERCENTAGE',
      uniPercentage: parseFloat(req.body.uniPercentage) || 0,
      fixedAmount: parseFloat(req.body.fixedAmount) || 0,
      roomAmount: parseFloat(req.body.roomAmount) || 0,
      contactPhone: req.body.phone || req.body.contactPhone || null,
      contactEmail: req.body.email || req.body.contactEmail || null,
      notes: notes || null
    };

    const entity = await prisma.educationalEntity.create({ data });
    res.json(entity);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: 'فشل إنشاء الجهة' });
  }
});

router.put('/:id', authMiddleware, requirePermission('admin.entities'), async (req, res) => {
  try {
    let notes = stripEntityMeta(req.body.notes || '');
    if (req.body.address) notes += `${notes ? '\n' : ''}العنوان: ${req.body.address}`;
    if (req.body.contactName) notes += `${notes ? '\n' : ''}المسؤول: ${req.body.contactName}`;

    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.type !== undefined) data.type = req.body.type;
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.commissionType !== undefined) data.commissionType = req.body.commissionType;
    if (req.body.uniPercentage !== undefined) data.uniPercentage = parseFloat(req.body.uniPercentage) || 0;
    if (req.body.fixedAmount !== undefined) data.fixedAmount = parseFloat(req.body.fixedAmount) || 0;
    if (req.body.roomAmount !== undefined) data.roomAmount = parseFloat(req.body.roomAmount) || 0;
    if (req.body.phone !== undefined || req.body.contactPhone !== undefined) {
      data.contactPhone = req.body.phone || req.body.contactPhone || null;
    }
    if (req.body.email !== undefined || req.body.contactEmail !== undefined) {
      data.contactEmail = req.body.email || req.body.contactEmail || null;
    }
    data.notes = notes || null;

    const entity = await prisma.educationalEntity.update({ where: { id: parseInt(req.params.id as string) }, data });
    res.json(entity);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: 'فشل تحديث الجهة' });
  }
});

router.delete('/:id', authMiddleware, requirePermission('admin.entities'), async (req, res) => {
  try {
    await prisma.educationalEntity.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'فشل حذف الجهة' }); }
});

export default router;
