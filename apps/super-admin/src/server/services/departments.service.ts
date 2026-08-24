import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { ForbiddenError, type SessionUser } from '@/server/rbac'
import { DEFAULT_DEPARTMENT_TEMPLATES, type AddDepartmentInput } from '@/server/validation/department.schema'

export async function listDepartments(hotelId: string) {
  const departments = await prisma.departments.findMany({
    where: { hotel_id: hotelId },
    orderBy: { name: 'asc' },
    include: { users: { select: { user_id: true, full_name: true } } },
  })

  const takenNames = new Set(departments.map((d) => d.name))
  const availableTemplates = DEFAULT_DEPARTMENT_TEMPLATES.filter((name) => !takenNames.has(name))

  return { departments, availableTemplates }
}

export async function addDepartment(hotelId: string, data: AddDepartmentInput, actor: SessionUser) {
  if (data.name.trim() === 'Front Office') {
    throw new ForbiddenError('Front Office already exists for every hotel and cannot be created again')
  }

  const department = await prisma.departments.create({
    data: {
      hotel_id: hotelId,
      name: data.name,
      is_custom: data.isCustom,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: 'super_admin',
    action: 'department.added',
    entityType: 'department',
    entityId: department.department_id,
    afterState: { hotel_id: hotelId, name: department.name, is_custom: department.is_custom },
  })

  return department
}
