import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function withLedgerTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue
      throw error
    }
  }
}

export async function applyLedgerCash(tx: Prisma.TransactionClient, accountId: string, delta: Prisma.Decimal | number) {
  if (!new Prisma.Decimal(delta).isZero()) {
    await tx.investmentAccount.update({ where: { id: accountId }, data: { cashBalance: { increment: delta } } })
  }
}

// A confirmed broker balance replaces the contribution of earlier transactions to that balance.
export async function reconcileLedgerCash(tx: Prisma.TransactionClient, accountId: string) {
  await tx.transaction.updateMany({
    where: { accountId, OR: [{ cashSyncEnabled: true }, { cashDeltaApplied: null }] },
    data: { cashDeltaApplied: 0, cashSyncEnabled: false },
  })
}
