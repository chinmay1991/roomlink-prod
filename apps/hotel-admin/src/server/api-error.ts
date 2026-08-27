import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@roomlink/db'
import { UnauthorizedError } from '@/server/require-hotel-session'
import { ForbiddenError } from '@/server/hotel-rbac'
import { InvalidTransitionError, ConfigurationError, InvalidPhoneError } from '@/server/errors'

export function toErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  if (error instanceof ConfigurationError) {
    console.error(error)
    return NextResponse.json({ error: 'QR generation is misconfigured. Contact support.' }, { status: 500 })
  }
  if (error instanceof InvalidPhoneError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid input', issues: error.flatten() }, { status: 400 })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'field'
    return NextResponse.json({ error: `That ${target} is already in use.` }, { status: 409 })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  console.error(error)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}
