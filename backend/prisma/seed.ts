import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  // التسجيل
  'students.view', 'students.add', 'students.edit', 'students.delete',
  'students.change_status', 'students.change_date',
  'subscriptions.view', 'subscriptions.add', 'subscriptions.edit',
  'subscriptions.delete', 'subscriptions.change_status',
  'courses.view', 'courses.add', 'courses.edit', 'courses.delete', 'courses.manage',
  'diplomas.view', 'diplomas.add', 'diplomas.edit', 'diplomas.delete', 'diplomas.manage',
  'sections.view', 'sections.add', 'sections.edit', 'sections.delete', 'sections.manage',
  'sections.assign',
  'attendance.view', 'attendance.manage', 'attendance.admin',
  'grades.approve',
  'reports.academic',
  // الموظفون
  'employees.view', 'employees.add', 'employees.edit', 'employees.delete',
  'employees.manage', 'employees.salaries',
  // المالية
  'finance.view', 'finance.receipts', 'finance.payments', 'finance.installments',
  'finance.settlements', 'finance.reports', 'finance.accounts', 'finance.claims',
  // الإدارة
  'admin.users.view', 'admin.users.add', 'admin.users.edit', 'admin.users.delete',
  'admin.users.manage', 'admin.users',
  'admin.settings.view', 'admin.settings.edit', 'admin.settings.manage', 'admin.settings',
  'admin.audit',
  'admin.entities.view', 'admin.entities.add', 'admin.entities.edit',
  'admin.entities.delete', 'admin.entities.manage', 'admin.entities',
  'admin.rooms.view', 'admin.rooms.add', 'admin.rooms.edit',
  'admin.rooms.delete', 'admin.rooms.manage', 'admin.rooms',
  'admin.instructors.view', 'admin.instructors.add', 'admin.instructors.edit',
  'admin.instructors.delete', 'admin.instructors.manage', 'admin.instructors',
  'admin.announcements.view', 'admin.announcements.add', 'admin.announcements.edit',
  'admin.announcements.delete', 'admin.announcements.manage', 'admin.announcements',
  // التطبيقات
  'files.view', 'files.add', 'files.delete', 'files.manage',
  'notes.view', 'notes.add', 'notes.edit', 'notes.delete', 'notes.manage',
  'documents.view', 'documents.add', 'documents.edit', 'documents.delete', 'documents.manage',
  // شامل
  'ADMIN_ALL',
];

async function main() {
  console.log('🌱 Seeding LHC-CRS PostgreSQL database...\n');

  // 1. Permissions
  for (const name of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name }, update: {},
      create: { name, description: name },
    });
  }
  console.log(`✓ ${ALL_PERMISSIONS.length} permissions created`);

  // 2. Admin user
  const adminHash = await bcrypt.hash('102030.00', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, status: 'ACTIVE', role: 'ADMIN', portals: '["ADMIN","EMPLOYEE","INSTRUCTOR","STUDENT"]' },
    create: { username: 'admin', passwordHash: adminHash, fullName: 'مسؤول النظام', role: 'ADMIN', status: 'ACTIVE', maxDevicesAllowed: 10, portals: '["ADMIN","EMPLOYEE","INSTRUCTOR","STUDENT"]' },
  });
  for (const name of ALL_PERMISSIONS) {
    const perm = await prisma.permission.findUnique({ where: { name } });
    if (perm) await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: admin.id, permissionId: perm.id } },
      update: {}, create: { userId: admin.id, permissionId: perm.id },
    });
  }
  console.log(`✓ Admin: admin / 102030.00`);

  // 3. Registrar user
  const regHash = await bcrypt.hash('123456', 10);
  const registrar = await prisma.user.upsert({
    where: { username: 'registrar' },
    update: { passwordHash: regHash },
    create: { username: 'registrar', passwordHash: regHash, fullName: 'موظف التسجيل', role: 'EMPLOYEE', status: 'ACTIVE', maxDevicesAllowed: 3 },
  });
  const registrarPerms = [
    'students.view','students.add','students.edit','students.change_status','students.change_date',
    'subscriptions.view','subscriptions.add','subscriptions.edit','subscriptions.change_status',
    'courses.view','diplomas.view','sections.view','sections.assign',
    'attendance.view','attendance.manage','reports.academic',
    'finance.view','finance.receipts','finance.installments',
  ];
  for (const name of registrarPerms) {
    const perm = await prisma.permission.findUnique({ where: { name } });
    if (perm) await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: registrar.id, permissionId: perm.id } },
      update: {}, create: { userId: registrar.id, permissionId: perm.id },
    });
  }
  console.log(`✓ Registrar: registrar / 123456`);

  // 4. Default permission templates
  const TEMPLATES = [
    {
      name: 'موظف تسجيل',
      permissions: [
        'students.view','students.add','students.edit','students.change_status','students.change_date',
        'subscriptions.view','subscriptions.add','subscriptions.edit','subscriptions.change_status',
        'courses.view','diplomas.view','sections.view','sections.assign',
        'attendance.view','attendance.manage','reports.academic',
        'finance.view','finance.receipts','finance.installments',
      ],
    },
    {
      name: 'مشرف مالي',
      permissions: [
        'finance.view','finance.receipts','finance.payments','finance.installments',
        'finance.reports','finance.settlements','finance.accounts','finance.claims',
        'reports.academic',
      ],
    },
    {
      name: 'مشرف أكاديمي',
      permissions: [
        'students.view','students.edit',
        'subscriptions.view','subscriptions.edit',
        'courses.view','courses.add','courses.edit',
        'diplomas.view','diplomas.add','diplomas.edit',
        'sections.view','sections.add','sections.edit','sections.assign',
        'attendance.view','attendance.manage',
        'reports.academic',
      ],
    },
    {
      name: 'مدير نظام',
      permissions: [
        'admin.users.manage','admin.users',
        'admin.settings.manage','admin.settings',
        'admin.audit',
        'admin.entities.manage','admin.entities',
        'admin.rooms.manage','admin.rooms',
        'admin.instructors.manage','admin.instructors',
        'admin.announcements.manage','admin.announcements',
        'employees.manage','employees.salaries',
      ],
    },
  ];
  for (const t of TEMPLATES) {
    await prisma.permissionTemplate.upsert({
      where: { name: t.name },
      update: { permissions: JSON.stringify(t.permissions) },
      create: { name: t.name, permissions: JSON.stringify(t.permissions) },
    });
  }
  console.log(`✓ ${TEMPLATES.length} permission templates created`);

  // 5. Course Categories
  const courseCategories = [
    { name: 'COMPUTER_SCIENCE', nameAr: 'علوم حاسوب', order: 1 },
    { name: 'PROGRAMMING', nameAr: 'برمجة وتطوير', order: 2 },
    { name: 'NETWORK', nameAr: 'شبكات وأمن معلومات', order: 3 },
    { name: 'IT_SUPPORT', nameAr: 'دعم فني وصيانة حاسوب', order: 4 },
    { name: 'GRAPHIC_DESIGN', nameAr: 'تصميم جرافيك', order: 5 },
    { name: 'UI_UX', nameAr: 'تصميم واجهات (UI/UX)', order: 6 },
    { name: 'VIDEO_EDITING', nameAr: 'مونتاج وفيديو', order: 7 },
    { name: 'DIGITAL_MARKETING', nameAr: 'تسويق إلكتروني', order: 8 },
    { name: 'SOCIAL_MEDIA', nameAr: 'إدارة وسائل التواصل', order: 9 },
    { name: 'OFFICE', nameAr: 'تطبيقات مكتبية', order: 10 },
    { name: 'MANAGEMENT', nameAr: 'إدارة أعمال', order: 11 },
    { name: 'HR', nameAr: 'موارد بشرية', order: 12 },
    { name: 'ACCOUNTING', nameAr: 'محاسبة', order: 13 },
    { name: 'LANGUAGES', nameAr: 'لغات', order: 14 },
    { name: 'ENGINEERING', nameAr: 'هندسة', order: 15 },
    { name: 'MEDICAL', nameAr: 'طبية', order: 16 },
    { name: 'EDUCATION', nameAr: 'تربية وتعليم', order: 17 },
    { name: 'PERSONAL_DEV', nameAr: 'تطوير ذاتي', order: 18 },
  ];
  for (const cat of courseCategories) {
    const existing = await prisma.courseCategory.findFirst({ where: { name: cat.name } });
    if (!existing) {
      await prisma.courseCategory.create({
        data: { name: cat.name, nameAr: cat.nameAr, order: cat.order },
      });
    }
  }
  console.log(`✓ ${courseCategories.length} course categories created`);

  // Assign default category to existing courses without one
  const defaultCat = await prisma.courseCategory.findFirst({ where: { name: 'MANAGEMENT' } });
  if (defaultCat) {
    try {
      // categoryId is non-nullable in schema, so this only applies if courses somehow have an invalid id
      const coursesWithoutCategory = await prisma.course.findMany({ where: { categoryId: 0 } });
      if (coursesWithoutCategory.length > 0) {
        await prisma.course.updateMany({
          where: { id: { in: coursesWithoutCategory.map(c => c.id) } },
          data: { categoryId: defaultCat.id },
        });
      }
    } catch { /* ignore if null not allowed */ }
  }

  // 6. Portal backgrounds
  for (const portal of ['ADMIN','EMPLOYEE','INSTRUCTOR','STUDENT']) {
    await prisma.portalBackground.upsert({
      where: { portal }, update: {},
      create: { portal, type: 'GRADIENT', content: null },
    });
  }
  console.log(`✓ 4 portal backgrounds initialized`);
  console.log('\n✅ Seeding complete!\n  admin / 102030.00\n  registrar / 123456\n');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
